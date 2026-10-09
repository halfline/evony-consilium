import { createLogoPicker } from "./logo-picker.js";
import { createTeamList } from "./team-list.js";
import { createAccountMenu } from "./account-menu.js";
import { createTeamTabs } from "./team-tabs.js";
import { showEntryProgress } from "./entry-progress.js";
import { OperationCancelled } from "../services/cancellation.js";
import { view } from "./dom.js";
export class TeamEntry {
  constructor({
    root,
    header,
    planner,
    toast,
    workspace,
    status,
    opened = () => {},
    initialTeam = null,
  }) {
    Object.assign(this, {
      root,
      planner,
      toast,
      workspace,
      status,
      opened,
      initialTeam,
    });
    this.$ = view(root, header);
    this.pendingLogo = "";
    this.busy = false;
    this.logoPicker = createLogoPicker({
      root: this.$("project-logo"),
      uploadLabel: "Upload team logo",
      getValue: () => this.pendingLogo,
      change: (value) => {
        this.pendingLogo = value;
        this.logoPicker.render();
      },
      context: () => this.workspace.account?.sub,
      status,
      run: (task) => this.run(task, "Loading logo…"),
    });
    this.tabs = createTeamTabs({
      root: this.$("projects-screen"),
      changed: () => {
        this.$("entry-error").textContent = "";
      },
    });
    this.teamList = createTeamList({
      root: this.$("project-list"),
      files: () => this.workspace.list(),
      open: (file) => this.run(() => this.open(file), "Opening team…"),
      forget: (id) => {
        this.workspace.forget(id);
        this.list();
      },
    });
    this.accountMenuRoot = this.$("account-menu");
    this.entryAccountHost = root.querySelector(".entry-header");
    this.plannerAccountHost = header.querySelector(".header-actions");
    this.accountMenu = createAccountMenu({
      root: this.accountMenuRoot,
      switchAccount: () => this.signIn(),
      signOut: () => this.signOut(),
    });
  }
  show(screen) {
    clearInterval(this.remoteTimer);
    if (screen === "planner")
      this.remoteTimer = setInterval(() => this.workspace.checkRemote(), 30000);
    clearTimeout(this.expiryTimer);
    if (screen === "projects" && !this.workspace.healthy()) screen = "login";
    if (screen === "login") {
      this.workspace.clear();
      this.accountMenu.render(null);
    }
    this.toast.hidden = true;
    this.root.hidden = screen === "planner";
    (screen === "planner"
      ? this.plannerAccountHost
      : this.entryAccountHost
    ).append(this.accountMenuRoot);
    this.accountMenu.show(screen !== "login");
    this.planner.hidden = screen !== "planner";
    if (screen === "planner") this.opened();
    this.$("login-screen").hidden = screen !== "login";
    this.$("projects-screen").hidden = screen !== "projects";
    this.$("entry-error").textContent = "";
    this.$("google-grant-access").hidden = true;
    if (screen === "projects") {
      this.list();
      this.tabs.select(this.$("project-tab-teams").hidden ? "open" : "teams");
      this.expiryTimer = setTimeout(
        () => this.show("login"),
        this.workspace.expiresIn(),
      );
    }
  }
  async run(fn, message = "Working…") {
    if (this.busy) return;
    this.busy = true;
    this.accountMenuRoot.open = false;
    const finish = showEntryProgress(this.root, message);
    try {
      await fn();
    } catch (e) {
      if (e instanceof OperationCancelled) return;
      this.$("entry-error").textContent = e.message;
      this.$("google-grant-access").hidden =
        e.code !== "drive_permission_missing";
      this.status(e.message, true);
      if (e.status === 401) {
        this.show("login");
        this.$("entry-error").textContent = e.message;
      }
    } finally {
      this.busy = false;
      finish();
      if (!this.planner.hidden) this.workspace.checkRemote();
    }
  }
  async start() {
    this.show("login");
    this.$("google-login").onclick = () => this.signIn();
    this.$("google-grant-access").onclick = () =>
      this.signIn({ requestConsent: true });
    window.addEventListener("focus", () => {
      this.workspace.checkRemote();
      if (!this.$("projects-screen").hidden && !this.workspace.healthy())
        this.show("login");
    });
    this.$("project-create").onsubmit = (e) => {
      e.preventDefault();
      this.run(() => this.create(), "Creating team…");
    };
    this.$("project-join").onsubmit = (e) => {
      e.preventDefault();
      this.run(() => this.join(), "Opening team…");
    };
    this.$("project-back").onclick = () =>
      this.run(async () => {
        await this.workspace.flush();
        this.show("projects");
      });
    this.$("drive-save").onclick = () => this.run(() => this.workspace.save());
    this.$("project-browse").onclick = () =>
      this.run(() => this.join(true), "Opening team…");
    this.$("project-reload").onclick = () =>
      this.run(async () => {
        await this.workspace.reload();
        this.show("planner");
      });
    if (!this.workspace.configured()) {
      this.$("google-login").disabled = true;
      this.$("login-detail").textContent =
        "Google sign-in is not configured for this deployment yet. The site owner needs to add the OAuth client ID, Picker API key and Cloud project number.";
      return;
    }
    try {
      await this.workspace.initialize();
      this.$("google-login").disabled = false;
    } catch (e) {
      this.$("entry-error").textContent = e.message;
    }
  }
  signIn(options) {
    return this.run(async () => {
      this.$("google-grant-access").hidden = true;
      const account = await this.workspace.signIn(options);
      this.accountMenu.render(account);
      this.show("projects");
      if (this.initialTeam) {
        const resource = this.initialTeam;
        this.initialTeam = null;
        await this.open(resource);
      }
    });
  }
  signOut() {
    return this.run(async () => {
      await this.workspace.flush();
      this.show("login");
    });
  }
  list() {
    this.tabs.setTeamsAvailable(this.teamList.render() > 0);
  }
  async open(file, discardDraft = false) {
    const draft = await this.workspace.open(file, discardDraft);
    this.show("planner");
    if (draft.restored)
      this.status(
        draft.stale
          ? "The shared team has changed. Your edits are kept locally. Load latest replaces them with the shared version."
          : "Restored unsaved changes.",
      );
  }
  clearLogo() {
    this.pendingLogo = "";
    this.logoPicker.reset();
  }
  async create() {
    await this.workspace.create(this.$("project-name").value, this.pendingLogo);
    this.show("planner");
    this.clearLogo();
  }
  async join(browse = false) {
    const draft = await this.workspace.join(
      browse ? null : this.$("project-url").value.trim(),
    );
    this.show("planner");
    if (draft.restored) this.status("Restored unsaved changes.");
  }
}
