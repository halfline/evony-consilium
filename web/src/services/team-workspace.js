import { OperationCancelled } from "./cancellation.js";
import { loadTeamFiles } from "./team-files.js";
import { ProjectSync } from "./project-sync.js";
import { DraftQueue } from "../persistence/draft-queue.js";
import { teamDraftKey, resolveTeamDraft } from "../persistence/team-draft.js";
import { createEmptyPlan } from "../domain/plan.js";
import { parseDriveLink } from "../domain/drive-links.js";
import { PlayerFiles } from "./player-files.js";

const teamFingerprint = (plan) =>
  JSON.stringify(plan, (_key, value) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, value[key]]),
        )
      : value,
  );

// Account and shared-document lifetime; callers supply presentation callbacks.
export class TeamWorkspace {
  #generation = 0;
  #begin() {
    const generation = ++this.#generation;
    return () => {
      if (generation !== this.#generation) throw new OperationCancelled();
    };
  }
  healthy() {
    return !!this.account && !!this.session.token();
  }
  configured() {
    return this.session.configured();
  }
  initialize() {
    return this.session.initialize();
  }
  expiresIn() {
    return Math.max(0, this.session.expires - Date.now());
  }
  checkRemote() {
    return this.sync.checkRemote();
  }
  save() {
    return this.sync.save();
  }
  reload() {
    return this.open(this.project.folder, true);
  }

  constructor({
    session,
    drive,
    picker,
    repository,
    getPlan,
    getPlayer = () => null,
    playersChanged = () => {},
    openPlan,
    setReadOnly,
    status,
    changed,
    expired,
    canCheck,
  }) {
    Object.assign(this, {
      session,
      drive,
      picker,
      repository,
      getPlan,
      getPlayer,
      openPlan,
      setReadOnly,
      status,
    });
    this.account = null;
    this.project = null;
    this.players = new PlayerFiles({
      drive,
      picker,
      changed: playersChanged,
      remember: (id) => repository.rememberPlayer?.(this.account?.sub, id),
      readDraft: (id) =>
        repository.read(`consilium-player:${this.account?.sub}:${id}`),
      writeDraft: (id, draft) =>
        repository.write(draft, `consilium-player:${this.account?.sub}:${id}`),
    });
    this.drafts = new DraftQueue((data, key) => repository.write(data, key), {
      onError: () => status("Local backup unavailable.", true),
    });
    this.sync = new ProjectSync({
      drive,
      getPlan,
      flush: () => this.flush(),
      writeDraft: (data, key) => this.drafts.writeNow(data, key),
      key: () => this.key(),
      reload: () => this.open(this.project.folder, true),
      saved: () => this.remember(),
      changed: (state) => {
        changed(state);
        if (this.sync?.file) setReadOnly(!this.sync.file.capabilities?.canEdit);
      },
      fingerprint: teamFingerprint,
      status,
      expired,
      canCheck: () => canCheck() && !!session.token(),
    });
  }
  key() {
    return this.account && this.project && this.sync.file
      ? teamDraftKey(
          this.account.sub,
          this.project.folder.id,
          this.sync.file.id,
        )
      : null;
  }
  flush() {
    return this.drafts.flush();
  }
  persist() {
    const key = this.key();
    if (!key) return;
    this.sync.changed();
    this.drafts.schedule(this.sync.draft(structuredClone(this.getPlan())), key);
  }
  list() {
    return this.repository.list(this.account.sub);
  }
  forget(id) {
    this.repository.forget(this.account.sub, id);
  }
  clear() {
    this.#generation++;
    this.session.clear();
    this.sync.reset();
    this.players.reset();
    this.account = null;
    this.project = null;
  }
  async signIn(options) {
    const current = this.#begin();
    const account = await this.session.signIn(options);
    current();
    await this.flush();
    current();
    if (this.account?.sub !== account.sub) {
      this.sync.reset();
      this.players.reset();
      this.project = null;
    }
    this.account = account;
    return account;
  }
  authorize() {
    if (this.session.token()) return;
    const error = new Error("Your Google session expired. Sign in again.");
    error.status = 401;
    throw error;
  }
  remember() {
    const plan = this.getPlan();
    this.project.folder.name = plan.title;
    this.project.folder.logo = plan.projectLogo || "";
    this.repository.remember(this.account.sub, this.project.folder);
  }
  async open(resource, discardDraft = false) {
    this.authorize();
    const current = this.#begin();
    const account = this.account;
    await this.flush();
    current();
    const { project, file, plan } = await loadTeamFiles({
      drive: this.drive,
      picker: this.picker,
      folder: resource,
      authorizeFiles: () => this.status("Choose the team file."),
    });
    current();
    const key = teamDraftKey(account.sub, project.folder.id, file.id);
    const cached = await this.repository.read(key);
    current();
    const readOnly = !file.capabilities?.canEdit;
    const draft = resolveTeamDraft({
      sharedPlan: plan,
      file,
      cached,
      discardDraft: discardDraft || readOnly,
    });
    this.players.reset();
    this.openPlan(draft.plan);
    this.setReadOnly(readOnly);
    this.project = project;
    if (discardDraft)
      await this.drafts.writeNow(
        { plan, baseVersion: file.version, dirty: false },
        key,
      );
    current();
    this.sync.opened(draft.file, plan, file.version);
    this.remember();
    const opened = new Set(this.repository.openedPlayers?.(account.sub) || []);
    for (const player of draft.plan.keeps) {
      if (opened.has(player.playerSource?.fileId)) this.players.probe(player);
    }
    return draft;
  }
  async unlockTeam() {
    this.authorize();
    const current = this.#begin();
    const file = this.sync.file;
    if (!file) throw new Error("Open a team first.");
    const [selected] = await this.picker.files(null, file);
    current();
    if (selected.id !== file.id) throw new Error("Choose this team's file.");
    selected.resourceKey ||= file.resourceKey || "";
    const latest = await this.drive.metadata(selected);
    current();
    file.capabilities = latest.capabilities;
    this.setReadOnly(!latest.capabilities?.canEdit);
    this.sync.notify();
    if (!latest.capabilities?.canEdit)
      throw new Error(
        "The team is still read-only. Ask an admin to grant you write access in Drive, then unlock again.",
      );
    // Preserve the local snapshot; a different shared version follows normal conflict handling.
    await this.sync.checkRemote();
    current();
  }
  async create(name, logo) {
    this.authorize();
    if (!name.trim()) throw new Error("Enter a team name.");
    const current = this.#begin();
    await this.flush();
    current();
    const plan = createEmptyPlan();
    plan.title = name.trim();
    plan.projectLogo = logo;
    const folder = await this.drive.createFolder(plan.title);
    current();
    await this.drive.initializeProject(folder, plan);
    current();
    return this.open(folder);
  }
  async join(link) {
    this.authorize();
    if (link) return this.open(parseDriveLink(link));
    const current = this.#begin();
    const [selected] = await this.picker.files(null);
    current();
    return this.open({ ...selected, kind: "file" });
  }
}
