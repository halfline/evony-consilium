import { PlayerProfiles } from "./player-profiles.js";
import { PlayerCacheSync } from "./player-cache-sync.js";
import { PlayerFiles } from "./player-files.js";
import { PlayerNotes } from "./player-notes.js";
import { OperationCancelled } from "./cancellation.js";
import { loadTeamFiles, loadPlayerFolder } from "./team-files.js";
import { ProjectSync } from "./project-sync.js";
import { DraftQueue } from "../persistence/draft-queue.js";
import { teamDraftKey, resolveTeamDraft } from "../persistence/team-draft.js";
import {
  teamFingerprint,
  mergeTeamPlans,
  applyProfileCaches,
} from "../domain/team-collaboration.js";
import { createEmptyPlan } from "../domain/plan.js";
import { parseTeamLink } from "../domain/drive-links.js";
import { isFileAccessError } from "./google/drive.js";
import { teamCreationActivity } from "../domain/team-activity.js";

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
  async checkRemote() {
    await this.sync.checkRemote();
    this.rememberCurrent();
    if (this.sync.canCheck()) await this.players.probe(this.getPlayer(), true);
    await this.refreshPlayers();
    await this.notes.refresh();
  }
  refreshPlayers() {
    return this.playerCache.refresh();
  }
  save() {
    return this.sync.save();
  }
  autosave() {
    return this.sync.autosave();
  }
  async activity() {
    if (!this.sync.file) return [];
    const loaded = await this.drive.load(this.sync.file);
    return loaded.plan.activityLog || [];
  }
  reload() {
    return this.open(this.project.folder, true, true);
  }

  constructor({
    session,
    drive,
    picker,
    repository,
    getPlan,
    getPlayer = () => null,
    commitPlan,
    refreshPlan = commitPlan,
    applyPlan = null,
    resolveTeamConflicts = async () => null,
    validatePlan = () => {},
    isEditingPlayer = () => false,
    playersChanged = () => {},
    notesChanged = () => {},
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
      refreshPlan,
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
    this.editorDrafts = new DraftQueue(
      (data, key) => repository.write(data, key),
      {
        onError: () => status("Player draft backup unavailable.", true),
      },
    );
    this.sync = new ProjectSync({
      drive,
      getPlan,
      flush: () => this.flush(),
      writeDraft: (data, key) => this.drafts.writeNow(data, key),
      key: () => this.key(),
      reload: () => this.reload(),
      saved: () => this.remember(),
      changed: (state) => {
        changed(state);
        if (this.sync?.file) setReadOnly(!this.sync.file.capabilities?.canEdit);
      },
      fingerprint: teamFingerprint,
      merge: mergeTeamPlans,
      applyPlan,
      validate: validatePlan,
      resolve: resolveTeamConflicts,
      activityActor: () => this.account,
      status,
      expired,
      canCheck: () => canCheck() && !!session.token(),
    });
    this.profiles = new PlayerProfiles({
      workspace: this,
      getPlan,
      commitPlan,
      refreshPlan,
      validatePlan,
      isEditing: isEditingPlayer,
    });
    this.playerCache = new PlayerCacheSync({
      players: this.players,
      profiles: this.profiles,
      sync: this.sync,
      getPlan,
      isEditing: isEditingPlayer,
      save: (updates) => this.publishPlayers(updates),
      status,
    });
    this.notes = new PlayerNotes(this, notesChanged);
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
  publishPlayers(updates) {
    return this.sync.publish((plan) => applyProfileCaches(plan, updates));
  }
  flush() {
    return Promise.all([this.drafts.flush(), this.editorDrafts.flush()]);
  }
  editorKey(player) {
    return `consilium-player-editor:${this.account?.sub}:${player.playerSource?.fileId || player.id}`;
  }
  async readEditorDraft(player) {
    const account = this.account?.sub,
      id = player.playerSource?.fileId;
    const draft = await this.repository.read(this.editorKey(player));
    if (draft || !id) return draft;
    const submitted = await this.repository.read(
      `consilium-player:${account}:${id}`,
    );
    if (!submitted?.profile) return null;
    return {
      baseline: submitted.baseline,
      fields: Object.fromEntries(
        ["name", "accountId", "allianceTag", "level"].map((field) => [
          field,
          String(submitted.profile[field] ?? ""),
        ]),
      ),
      details: submitted.profile.details,
      skin: submitted.profile.skin,
      avatarId: submitted.profile.avatarId,
    };
  }
  async discardPlayerDraft(player) {
    await this.writeEditorDraft(player, null);
    await this.players.discardDraft(player);
  }
  writeEditorDraft(player, draft) {
    return this.editorDrafts.writeNow(draft, this.editorKey(player));
  }
  persist() {
    const key = this.key();
    if (!key) return;
    const plan = this.getPlan();
    this.rememberCurrent();
    this.sync.changed();
    this.drafts.schedule(this.sync.draft(structuredClone(plan)), key);
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
    this.playerCache.reset();
    this.notes.reset();
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
      this.playerCache.reset();
      this.notes.reset();
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
  remember(plan = this.getPlan()) {
    this.project.folder.name = plan.title;
    this.project.folder.logo = plan.projectLogo || "";
    this.repository.remember(this.account.sub, this.project.folder);
  }
  rememberCurrent() {
    if (!this.project || !this.sync.file || !this.account) return;
    const plan = this.getPlan();
    if (
      plan.title !== this.project.folder.name ||
      (plan.projectLogo || "") !== (this.project.folder.logo || "")
    )
      this.remember(plan);
  }
  async open(resource, discardDraft = false, preserveView = false) {
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
    this.playerCache.reset();
    this.notes.reset();
    this.openPlan(draft.plan, { preserveView });
    this.setReadOnly(readOnly);
    this.project = project;
    if (discardDraft)
      await this.drafts.writeNow(
        { plan, baseVersion: file.version, dirty: false },
        key,
      );
    current();
    this.sync.opened(draft.file, plan, file.version, draft.basePlan);
    this.remember(draft.plan);
    if (this.drive.noteIndexes)
      this.notes.initialize().catch((error) => {
        if (!(error instanceof OperationCancelled))
          this.status("Notes synchronization paused: " + error.message, true);
      });
    const opened = new Set(this.repository.openedPlayers?.(account.sub) || []);
    // Only revisit files this account explicitly opened; viewers need just the team grant.
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
    let latest;
    try {
      latest = await this.drive.metadata(file);
    } catch (error) {
      if (!isFileAccessError(error)) throw error;
      this.status(
        "Choose this team's document to reconnect it. Editor access must be granted by its owner in Drive.",
      );
      const [selected] = await this.picker.files(null, file);
      current();
      if (selected.id !== file.id) throw new Error("Choose this team's file.");
      selected.resourceKey ||= file.resourceKey || "";
      latest = await this.drive.metadata(selected);
    }
    current();
    file.capabilities = latest.capabilities;
    this.setReadOnly(!latest.capabilities?.canEdit);
    this.sync.notify();
    if (!latest.capabilities?.canEdit)
      throw new Error(
        "The team is still read-only. Ask its owner for Editor access to the team document in Drive, then check access again.",
      );
    // Preserve the local snapshot; a different shared version follows normal conflict handling.
    await this.sync.checkRemote();
    current();
  }
  async playerFolder({ interactive = true } = {}) {
    this.authorize();
    if (!this.sync.file?.capabilities?.canEdit)
      throw new Error("Team write access is needed to manage player files.");
    const current = this.players.captureContext();
    const file = await this.drive.metadata(this.sync.file);
    current();
    const folder = await loadPlayerFolder({
      drive: this.drive,
      picker: this.picker,
      project: this.project,
      file,
      current,
      status: this.status,
      interactive,
    });
    current();
    if (!folder.capabilities?.canAddChildren)
      throw new Error(
        "You need permission to add player files to the central team folder.",
      );
    this.project.folder = folder;
    return folder;
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
    plan.activityLog = [teamCreationActivity(this.account)];
    const folder = await this.drive.createFolder(plan.title);
    current();
    await this.drive.initializeProject(folder, plan);
    current();
    return this.open(folder);
  }
  async join(link) {
    this.authorize();
    if (link) return this.open(parseTeamLink(link));
    const current = this.#begin();
    const [selected] = await this.picker.files(null);
    current();
    return this.open({ ...selected, kind: "file" });
  }
}
