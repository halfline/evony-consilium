// Shared document synchronization. Planning edits and cache publications share
// conditional writes, but a background publication never includes local edits.
import { isFileAccessError } from "./google/drive.js";
import { appendTeamActivity } from "../domain/team-activity.js";
import { mergeActivityLogs } from "../domain/activity.js";
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
    merge = null,
    applyPlan = null,
    validate = () => {},
    resolve = async () => null,
    activityActor = null,
    activitySession = () => null,
    prepareSave = (plan) => plan,
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
      merge,
      applyPlan,
      validate,
      resolve,
      activityActor,
      activitySession,
      prepareSave,
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
    this.basePlan = null;
    this.baselineKnown = true;
    this.saving = false;
    this.publishing = false;
    this.saveError = null;
    this.notify();
  }
  opened(
    file,
    sharedPlan,
    sharedVersion = file.version,
    basePlan = sharedPlan,
  ) {
    this.generation++;
    this.checking = null;
    this.saving = false;
    this.saveError = null;
    this.file = file;
    this.remoteChanged = file.version !== sharedVersion;
    this.basePlan = structuredClone(basePlan || sharedPlan);
    this.baselineKnown = !!basePlan;
    this.savedSnapshot = this.fingerprint(this.basePlan);
    this.changed();
  }
  changed() {
    this.dirty = this.fingerprint(this.getPlan()) !== this.savedSnapshot;
    this.notify();
  }
  draft(plan) {
    return {
      plan,
      baseVersion: this.file.version,
      basePlan: this.baselineKnown ? structuredClone(this.basePlan) : null,
      dirty: this.dirty,
    };
  }
  state() {
    const reload = this.remoteChanged && !this.dirty;
    return {
      disabled:
        this.saving ||
        !(this.dirty || this.remoteChanged) ||
        (!reload && !this.file?.capabilities?.canEdit),
      label: this.saving
        ? this.publishing
          ? "Updating players…"
          : "Saving team…"
        : reload
          ? "Load latest team"
          : "Save team",
      saving: this.saving,
      conflict: this.remoteChanged,
      dirty: this.dirty,
      readOnly: !this.file?.capabilities?.canEdit,
      error: this.saveError,
    };
  }
  notify() {
    this.onChange(this.state());
  }
  adopt(
    file,
    sharedPlan,
    plan,
    { base = this.basePlan, remote = sharedPlan } = {},
  ) {
    file.resourceKey ||= this.file?.resourceKey;
    this.file = file;
    this.basePlan = structuredClone(sharedPlan);
    this.baselineKnown = true;
    this.savedSnapshot = this.fingerprint(sharedPlan);
    this.remoteChanged = false;
    this.saveError = null;
    this.applyPlan?.(plan, { base, remote });
    this.changed();
  }
  async checkRemote() {
    if (this.checking || this.saving || !this.file || !this.canCheck()) return;
    const checking = (this.checking = {}),
      generation = this.generation,
      file = this.file;
    const current = () =>
      this.generation === generation &&
      this.file === file &&
      !this.saving &&
      this.canCheck();
    try {
      const latest = await this.drive.metadata(file);
      if (!current()) return;
      file.capabilities = latest.capabilities;
      if (latest.version === file.version) {
        this.notify();
        return;
      }
      const loaded = await this.drive.load(file);
      if (!current()) return;
      if (this.merge && this.applyPlan && this.baselineKnown) {
        const result = this.merge(this.basePlan, this.getPlan(), loaded.plan);
        if (!result.conflicts.length) {
          try {
            this.validate(result.plan);
            this.adopt(loaded.file, loaded.plan, result.plan);
            await this.writeDraft(this.draft(this.getPlan()), this.key());
            this.saved();
            return;
          } catch (error) {
            this.status(`Team updates need review: ${error.message}`, true);
          }
        }
      } else if (
        !this.remoteChanged &&
        this.fingerprint(loaded.plan) === this.savedSnapshot
      ) {
        this.adopt(loaded.file, loaded.plan, this.getPlan());
        await this.writeDraft(this.draft(this.getPlan()), this.key());
        this.saved();
        return;
      }
      if (!this.remoteChanged)
        this.status(
          this.dirty
            ? "Team changes need review. Your draft is kept locally; Save team lets you resolve the conflicting changes."
            : "A newer team version is available. Load latest team to see it.",
        );
      this.remoteChanged = true;
      this.notify();
    } catch (error) {
      if (this.generation !== generation || this.file !== file) return;
      if (error.status === 401) this.expired();
      if (isFileAccessError(error)) {
        file.capabilities = { ...file.capabilities, canEdit: false };
        this.notify();
      }
    } finally {
      if (this.checking === checking) this.checking = null;
    }
  }
  async combine(base, local, remote, interactive, current) {
    if (!this.merge || !this.baselineKnown) {
      if (this.fingerprint(remote) === this.fingerprint(base)) return local;
      const error = new Error(
        "This draft needs review against the latest team. Your local changes are kept on this device.",
      );
      error.status = 409;
      throw error;
    }
    let result = this.merge(base, local, remote);
    if (result.conflicts.length) {
      if (!interactive)
        throw Object.assign(
          new Error("Team changes need review. Use Save team to resolve them."),
          { status: 409 },
        );
      const resolution = await this.resolve(result.conflicts);
      if (!current()) return null;
      if (!resolution)
        throw Object.assign(
          new Error("Save cancelled. Your team draft is kept locally."),
          { cancelled: true },
        );
      result = this.merge(base, local, remote, { resolution });
    }
    try {
      this.validate(result.plan);
    } catch (error) {
      throw Object.assign(
        new Error(
          `The combined changes cannot be saved: ${error.message} Your draft is kept locally.`,
        ),
        { status: 409 },
      );
    }
    return result.plan;
  }
  async save() {
    if (!this.file || this.state().disabled) return;
    if (this.remoteChanged && !this.dirty) return this.reload();
    return this.upload(null);
  }
  async autosave() {
    if (
      !this.dirty ||
      !this.file?.capabilities?.canEdit ||
      this.saving ||
      this.remoteChanged ||
      !this.baselineKnown
    )
      return;
    try {
      await this.upload(null, { interactive: false });
    } catch {
      // upload retains the draft and exposes the failure in the save status.
      // A later interval retries network failures; conflicts require review.
    }
  }
  async publish(transform, { activity = null, silent = false } = {}) {
    if (
      !this.file?.capabilities?.canEdit ||
      this.saving ||
      (!activity && (this.remoteChanged || !this.baselineKnown))
    )
      return;
    const next = transform(structuredClone(this.basePlan));
    if (!activity && JSON.stringify(next) === JSON.stringify(this.basePlan))
      return;
    return this.upload(transform, { activity, silent });
  }
  async upload(
    transform,
    { interactive = true, activity = null, silent = false } = {},
  ) {
    const generation = this.generation,
      current = () => this.generation === generation;
    const key = this.key(),
      originalBase = this.basePlan,
      originalVersion = this.file.version;
    const preserveBaseline =
      !!activity && (this.remoteChanged || !this.baselineKnown);
    const actor = this.activityActor?.(),
      sessionId = this.activitySession();
    let source = this.file,
      remote = originalBase;
    this.saving = true;
    this.publishing = !!transform;
    this.saveError = null;
    this.notify();
    try {
      await this.flush();
      if (!current()) return;
      const snapshot = transform
        ? structuredClone(this.getPlan())
        : this.prepareSave(structuredClone(this.getPlan()));
      let candidate = transform ? transform(structuredClone(remote)) : snapshot;
      this.validate(candidate);
      let file;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const saving = activity
            ? {
                ...candidate,
                activityLog: mergeActivityLogs(candidate.activityLog, [
                  activity,
                ]),
              }
            : silent
              ? candidate
              : this.activityActor
                ? appendTeamActivity(remote, candidate, actor, {
                    sync: !!transform,
                    sessionId,
                  })
                : candidate;
          file = await this.drive.save(source, saving);
          candidate = saving;
          break;
        } catch (error) {
          if (!current()) return;
          if (![409, 412].includes(error.status)) throw error;
          if (attempt === 3)
            throw Object.assign(
              new Error(
                "The team is changing quickly. Your draft is kept locally; try Save team again.",
              ),
              { status: 409 },
            );
          const loaded = await this.drive.load(source);
          if (!current()) return;
          remote = loaded.plan;
          source = loaded.file;
          source.resourceKey ||= this.file.resourceKey;
          candidate = transform
            ? transform(structuredClone(remote))
            : await this.combine(
                originalBase,
                snapshot,
                remote,
                interactive,
                current,
              );
          if (!current() || !candidate) return;
          this.validate(candidate);
        }
      }
      if (!current()) return;
      file.resourceKey ||= source.resourceKey;
      await this.flush();
      if (!current()) return;
      let plan = this.getPlan();
      let pendingConflicts = false;
      if (preserveBaseline) {
        plan = {
          ...plan,
          activityLog: mergeActivityLogs(
            plan.activityLog,
            candidate.activityLog,
          ),
        };
      } else if (this.merge && this.applyPlan) {
        // Edits made during an upload stay local. Cache publications include
        // only the source updates; they cannot accidentally save a formation.
        const result = this.merge(
          transform ? originalBase : snapshot,
          plan,
          candidate,
          { resolution: "local" },
        );
        plan = result.plan;
        pendingConflicts = !!transform && result.conflicts.length > 0;
        this.validate(plan);
      }
      if (preserveBaseline) {
        this.file = { ...file, version: originalVersion };
        this.remoteChanged = true;
        this.applyPlan?.(plan, {
          base: originalBase,
          remote: { ...originalBase, activityLog: plan.activityLog },
        });
        this.changed();
      } else if (pendingConflicts) {
        // Publishing caches must not bless an overlapping local planning edit.
        // Retain its original baseline so Save still reviews that conflict.
        this.file = { ...file, version: originalVersion };
        this.remoteChanged = true;
        this.applyPlan(plan, { base: originalBase, remote: candidate });
        this.changed();
        this.status(
          "Players updated. Team changes overlap with your draft; Save team lets you review them.",
        );
      } else {
        this.adopt(file, candidate, plan, {
          base: originalBase,
          remote: transform ? candidate : remote,
        });
      }
      await this.writeDraft(this.draft(this.getPlan()), key);
      if (current()) this.saved();
      return candidate;
    } catch (error) {
      if (!current()) return;
      if ([409, 412].includes(error.status)) this.remoteChanged = true;
      if (isFileAccessError(error))
        this.file.capabilities = { ...this.file.capabilities, canEdit: false };
      this.saveError = error.message;
      if (!error.cancelled) throw error;
      this.status(error.message);
    } finally {
      if (current()) {
        this.saving = false;
        this.publishing = false;
        this.notify();
      }
    }
  }
}
