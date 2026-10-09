// Shared project state and version checks, independent of browser presentation.
export class ProjectSync {
  constructor({
    drive,
    getPlan,
    flush,
    writeDraft,
    key,
    reload,
    saved,
    changed,
    status,
    expired,
    canCheck,
    fingerprint = JSON.stringify,
  }) {
    Object.assign(this, {
      drive,
      getPlan,
      flush,
      writeDraft,
      key,
      reload,
      saved,
      onChange: changed,
      status,
      expired,
      canCheck,
      fingerprint,
    });
    this.reset();
  }
  reset() {
    this.generation = (this.generation || 0) + 1;
    this.checking = null;
    this.file = null;
    this.dirty = false;
    this.remoteChanged = false;
    this.savedSnapshot = null;
    this.saving = false;
    this.notify();
  }
  opened(file, sharedPlan, sharedVersion = file.version) {
    this.generation++;
    this.checking = null;
    this.saving = false;
    this.file = file;
    this.remoteChanged = file.version !== sharedVersion;
    this.savedSnapshot = this.fingerprint(sharedPlan);
    this.dirty = this.fingerprint(this.getPlan()) !== this.savedSnapshot;
    this.notify();
  }
  changed() {
    this.dirty = this.fingerprint(this.getPlan()) !== this.savedSnapshot;
    this.notify();
  }
  draft(plan) {
    return { plan, baseVersion: this.file.version, dirty: this.dirty };
  }
  state() {
    const reload = this.remoteChanged && !this.dirty;
    return {
      disabled:
        this.saving ||
        !(this.dirty || this.remoteChanged) ||
        (!reload && !this.file?.capabilities?.canEdit),
      label: this.saving
        ? reload
          ? "Reloading…"
          : "Saving…"
        : reload
          ? "Reload"
          : "Save",
      saving: this.saving,
      conflict: this.remoteChanged,
      dirty: this.dirty,
      readOnly: !this.file?.capabilities?.canEdit,
    };
  }
  notify() {
    this.onChange(this.state());
  }
  async checkRemote() {
    if (this.checking || this.saving || !this.file || !this.canCheck()) return;
    const checking = (this.checking = {});
    const generation = this.generation;
    const file = this.file;
    try {
      const latest = await this.drive.metadata(file);
      if (
        this.generation !== generation ||
        this.file !== file ||
        this.saving ||
        !this.canCheck()
      )
        return;
      file.capabilities = latest.capabilities;
      const changed = latest.version !== file.version;
      if (changed) {
        const loaded = await this.drive.load(file);
        if (
          this.generation !== generation ||
          this.file !== file ||
          this.saving ||
          !this.canCheck()
        )
          return;
        if (
          !this.remoteChanged &&
          this.fingerprint(loaded.plan) === this.savedSnapshot
        ) {
          // Drive can advance a revision after an upload without changing its data.
          // Adopt that revision only after verifying the shared content is unchanged.
          loaded.file.resourceKey ||= file.resourceKey;
          this.file = loaded.file;
          this.remoteChanged = false;
          this.notify();
          await this.writeDraft(this.draft(this.getPlan()), this.key());
          return;
        }
      }
      if (changed && !this.remoteChanged)
        this.status(
          "A teammate updated this team. Load latest to use their changes.",
        );
      this.remoteChanged = changed;
      this.notify();
    } catch (error) {
      // Retry network failures next time; explicit saves surface their errors.
      if (this.generation !== generation || this.file !== file) return;
      if (error.status === 401) this.expired();
      if (error.status === 403) {
        file.capabilities = { ...file.capabilities, canEdit: false };
        this.notify();
      }
    } finally {
      if (this.checking === checking) this.checking = null;
    }
  }
}
