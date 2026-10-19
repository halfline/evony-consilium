import { createPlayerDetails } from "./player-details.js";
import { editPlayerDetails } from "../domain/player-details.js";
import { editPlayerProfile } from "../domain/players.js";
import {
  playerProfile,
  mergePlayerProfiles,
  profileFingerprint,
} from "../domain/player-document.js";
import { validatePlan } from "../domain/validation.js";
import { changeAppearance } from "../domain/appearance-commands.js";
import { renderAvatarButton } from "./avatar-browser.js";
import { renderCastleButton } from "./castle-button.js";
import { bindTileActions } from "./tile-actions.js";
import { view } from "./dom.js";
import { paintStatusBadge } from "./status-badge.js";
import { uppercaseInput } from "./player-fields.js";

// The profile has its own durable draft, autosave, and immediate Save button.
// Team navigation and background refreshes cannot replace pending inputs.
export function createPlayerScreen({
  root,
  getPlan,
  terrainFor,
  getPlayer,
  assets,
  getAvatars,
  catalog,
  browseCastle,
  browseAvatar,
  commit,
  remove,
  status,
  applied,
  canEdit = () => true,
  context = () => "",
  readDraft = async () => null,
  writeDraft = async () => {},
  discardDraft = (player) => writeDraft(player, null),
  draftChanged = () => {},
}) {
  const $ = view(root),
    form = $("player-form"),
    details = createPlayerDetails({
      root,
      canEdit: () => !!getPlayer() && canEdit(getPlayer()),
      saveChanges: () => save(getPlayer()),
    });
  // Handle invalid inputs ourselves so a field on a hidden tab can be shown.
  form.noValidate = true;
  uppercaseInput($("player-tag"));
  const entries = new Map();
  const fields = {
    name: "player-name",
    accountId: "player-account",
    allianceTag: "player-tag",
    level: "player-level",
  };
  let renderedKey = null,
    saving = false;
  const key = (player) =>
    `${context()}:${player.playerSource?.fileId || player.id}`;
  function entry(player) {
    const id = key(player);
    if (entries.has(id)) return entries.get(id);
    const state = {
      draft: null,
      progressEditor: null,
      revision: 0,
      loading: true,
    };
    entries.set(id, state);
    readDraft(player)
      .then((draft) => {
        if (!state.revision && draft?.fields && draft.baseline) {
          state.progressEditor = draft.progressEditor || null;
          if (draft.profileDirty !== false) state.draft = draft;
        }
      })
      .catch(() => status("Player draft backup unavailable.", true))
      .finally(() => {
        state.loading = false;
        if (getPlayer() && key(getPlayer()) === id) {
          renderedKey = null;
          render();
        }
        draftChanged();
      });
    return state;
  }
  function storedDraft(player, state) {
    if (!state.draft && !state.progressEditor) return null;
    return {
      ...(state.draft || {
        baseline: playerProfile(player),
        fields: Object.fromEntries(
          Object.keys(fields).map((field) => [
            field,
            String(player[field] ?? ""),
          ]),
        ),
        details: player.details,
        avatarId: player.avatarId,
        skin: player.skin,
      }),
      profileDirty: !!state.draft,
      progressEditor: state.progressEditor,
    };
  }
  function persist(player, state) {
    return writeDraft(player, storedDraft(player, state)).catch(() => {});
  }
  function captureProgressEditor() {
    const player = getPlayer();
    if (!player || entry(player).loading) return;
    const state = entry(player);
    state.progressEditor = details.progressEditorDraft();
    persist(player, state);
    draftChanged();
  }
  function paintStatus() {
    const player = getPlayer();
    if (!player) return;
    const state = entry(player);
    const editable = canEdit(player);
    const badge = state.saving
      ? "saving"
      : state.loading
        ? "loading"
        : !editable
          ? "readonly"
          : state.review
            ? "warning"
            : state.error
              ? "error"
              : state.draft
                ? "draft"
                : "saved";
    const label = state.saving
      ? "Player · Saving"
      : state.loading
        ? "Player · Loading"
        : !editable
          ? state.draft
            ? "Player · Draft kept"
            : "Player · Read-only"
          : state.review
            ? "Player · Review"
            : state.error
              ? "Player · Not saved"
              : state.draft
                ? "Player · Draft"
                : "Player · Saved";
    const detail =
      state.error ||
      (state.saving
        ? "Saving player to Drive."
        : state.loading
          ? "Loading the saved player draft."
          : !editable && state.draft
            ? "Player draft kept. The profile is read-only."
            : !editable
              ? "This player profile is read-only."
              : state.review
                ? "Player changes need review. Use Save player to resolve them."
                : state.draft
                  ? "Player changes are autosaving every 30 seconds."
                  : "Player saved.");
    paintStatusBadge($("player-save-status"), label, badge, detail);
    $("player-save").disabled =
      saving || state.loading || !state.draft || !canEdit(player);
    $("player-discard-draft").hidden = !state.draft;
    $("player-discard-draft").disabled = saving;
  }
  function capture() {
    const player = getPlayer();
    if (
      !player ||
      !canEdit(player) ||
      renderedKey !== key(player) ||
      entry(player).loading
    )
      return;
    const state = entry(player);
    const values = formValues(player, state);
    const signature = profileFingerprint(values);
    // A native change event can follow input or blur during an upload/render.
    // Only newly edited values create another draft revision.
    if (signature === state.formSignature) return;
    state.formSignature = signature;
    state.error = null;
    state.draft = {
      baseline: state.draft?.baseline || playerProfile(player),
      ...values,
    };
    state.revision++;
    persist(player, state);
    paintStatus();
    draftChanged();
  }
  function formValues(player, state) {
    return {
      fields: Object.fromEntries(
        Object.entries(fields).map(([field, id]) => [
          field,
          field === "level" ? details.currentLevel() : $(id).value,
        ]),
      ),
      details: details.snapshot(),
      avatarId: state.draft?.avatarId ?? player.avatarId,
      skin: state.draft?.skin ?? player.skin,
    };
  }
  const teamAction = (event) =>
    event
      .composedPath()
      .some((node) =>
        node.matches?.(
          '[data-player-panel="subcities"], [data-player-panel="alts"], [data-player-panel="notes"]',
        ),
      );
  for (const event of ["input", "change"])
    form.addEventListener(event, (event) => {
      if (
        details.isHistorical() ||
        event.target.closest?.("[data-progress-editor]")
      ) {
        queueMicrotask(captureProgressEditor);
        return;
      }
      if (
        !teamAction(event) &&
        event.target.id !== "player-section-select" &&
        !event.target.closest?.("[data-progress-view]")
      )
        queueMicrotask(capture);
    });
  form.addEventListener("progressdraftchange", captureProgressEditor);
  form.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (
      details.isHistorical() ||
      !button ||
      button.type === "submit" ||
      button.hasAttribute("data-player-tab") ||
      button.hasAttribute("data-march-tab") ||
      button.hasAttribute("data-buff-context") ||
      button.hasAttribute("data-player-progress-link") ||
      event.composedPath().some((node) => node.id === "player-progress") ||
      button.id === "player-march-back" ||
      button.id === "player-reinforcement-back" ||
      button.id === "player-discard-draft" ||
      teamAction(event)
    )
      return;
    queueMicrotask(capture);
  });
  bindTileActions(root.querySelector(".player-name-actions"), {
    tileSelector: ".player-name-actions",
    triggerSelector: "#player-title",
    className: "player-name-actions-open",
  });
  async function save(player, { interactive = true } = {}) {
    if (!player || saving || !canEdit(player) || entry(player).loading) return;
    if (!interactive && (!entry(player).draft || entry(player).review)) return;
    const visible = getPlayer() && key(getPlayer()) === key(player);
    if (visible) {
      const invalid = [...form.elements].find(
        (input) =>
          !input.closest("[data-progress-editor]") &&
          !(
            details.isHistorical() &&
            (input.id === "player-level" ||
              input.id === "player-rally-capacity" ||
              input.matches("[data-buff], [data-debuff], [data-march-size]"))
          ) &&
          input.willValidate &&
          !input.validity.valid,
      );
      if (invalid) {
        entry(player).error =
          "Complete the required fields before this player can be saved.";
        paintStatus();
        if (interactive) {
          const panel = invalid?.closest("[data-player-panel]");
          if (panel)
            root
              .querySelector(`[data-player-tab="${panel.dataset.playerPanel}"]`)
              ?.click();
          details.reveal(invalid);
          invalid?.focus();
          invalid?.reportValidity();
          status("Check the highlighted player field before saving.", true);
        }
        return;
      }
      capture();
    }
    const state = entry(player),
      revision = state.revision,
      id = key(player),
      scope = context(),
      draft = structuredClone(state.draft);
    if (!draft) return;
    saving = true;
    state.saving = true;
    state.error = null;
    paintStatus();
    draftChanged();
    try {
      const changes = {
        ...draft.fields,
        name: draft.fields.name.trim(),
        accountId: draft.fields.accountId.trim(),
        allianceTag: draft.fields.allianceTag.trim(),
        level: Number(draft.fields.level),
        avatarId: draft.avatarId,
        skin: draft.skin,
      };
      let next = editPlayerProfile(getPlan(player.id), player.id, changes);
      const detailChanges = visible ? details.read() : draft.details;
      if (detailChanges)
        next = editPlayerDetails(next, player.id, detailChanges);
      validatePlan(next, catalog);
      await commit(next, draft.baseline, player.id, { interactive });
      if (context() !== scope) return;
      const updated = getPlan(player.id).keeps.find(
        (item) => item.id === player.id,
      );
      state.review = false;
      if (state.revision === revision) state.draft = null;
      else if (updated) {
        // Keep inputs changed during the upload, but adopt saved values for
        // untouched fields so a later autosave cannot revert a merged edit.
        for (const field of Object.keys(fields))
          if (state.draft.fields[field] === draft.fields[field])
            state.draft.fields[field] = String(updated[field] ?? "");
        state.draft.details = mergePlayerProfiles(
          { details: draft.details },
          { details: state.draft.details },
          { details: updated.details },
        ).profile.details;
        for (const field of ["skin", "avatarId"])
          if (state.draft[field] === draft[field])
            state.draft[field] = updated[field];
        state.draft.baseline = playerProfile(updated);
        renderedKey = null;
      }
      await writeDraft(
        updated || player,
        storedDraft(updated || player, state),
      );
      if (updated && getPlayer() && key(getPlayer()) === id) {
        applied(updated);
        if (!state.draft) {
          details.reset();
          renderedKey = null;
        }
        render();
        if (interactive) details.closeEditors();
      }
      if (interactive) status("Player saved to Drive.");
    } catch (error) {
      state.review = !!error.review || [409, 412].includes(error.status);
      state.error = error.message;
      if (interactive) status(error.message, true);
    } finally {
      saving = false;
      state.saving = false;
      paintStatus();
      draftChanged();
    }
  }
  form.onsubmit = (event) => {
    event.preventDefault();
    if (details.isHistorical()) return details.saveHistorical();
    return save(getPlayer());
  };
  $("player-discard-draft").onclick = async () => {
    const player = getPlayer();
    if (!player || saving) return;
    const state = entry(player);
    try {
      await discardDraft(player);
    } catch (error) {
      status(error.message, true);
      return;
    }
    state.revision++;
    state.draft = null;
    state.error = null;
    state.review = false;
    renderedKey = null;
    details.reset();
    render();
    persist(player, state);
    draftChanged();
  };
  function stage(change) {
    capture();
    const player = getPlayer();
    if (!player) return;
    const state = entry(player);
    state.draft ||= {
      baseline: playerProfile(player),
      ...formValues(player, state),
    };
    Object.assign(state.draft, change);
    state.formSignature = profileFingerprint(formValues(player, state));
    state.revision++;
    persist(player, state);
    paintAppearance(player, state);
    paintStatus();
  }
  $("player-avatar").onclick = () => {
    const player = getPlayer();
    if (!player || !canEdit()) return;
    const id = key(player);
    browseAvatar(entry(player).draft?.avatarId ?? player.avatarId, (avatar) => {
      if (getPlayer() && key(getPlayer()) === id && canEdit())
        stage({ avatarId: avatar.id });
    });
  };
  $("player-castle").onclick = () => {
    const player = getPlayer();
    if (!player || !canEdit()) return;
    const id = key(player);
    browseCastle("keep", (asset) => {
      if (!getPlayer() || key(getPlayer()) !== id || !canEdit()) return;
      try {
        const next = changeAppearance(
          getPlan(),
          player.id,
          asset,
          terrainFor(getPlan().map),
        );
        validatePlan(next, catalog);
        stage({ skin: next.keeps.find((item) => item.id === player.id).skin });
      } catch (error) {
        status(error.message, true);
      }
    });
  };
  $("player-remove").onclick = () => {
    const player = getPlayer();
    if (player) remove(player.id);
  };
  function paintAppearance(player, state) {
    const castle = assets.get(state.draft?.skin ?? player.skin);
    if (castle) renderCastleButton($("player-castle"), castle);
    renderAvatarButton(
      $("player-avatar"),
      getAvatars(),
      state.draft?.avatarId ?? player.avatarId,
    );
  }
  function render() {
    const player = getPlayer();
    $("player-inspector").hidden = !player;
    if (!player) return;
    const state = entry(player),
      id = key(player),
      changedPlayer = renderedKey !== id;
    $("player-title").textContent = player.name;
    $("player-remove").setAttribute("aria-label", `Remove ${player.name}`);
    root
      .querySelector(".player-name-actions")
      .classList.remove("player-name-actions-open");
    if (changedPlayer || !state.draft) {
      if (changedPlayer) details.reset();
      for (const [field, fieldId] of Object.entries(fields)) {
        if (field === "level" && details.isHistoricalFor(player.id)) continue;
        $(fieldId).value = state.draft
          ? (state.draft.fields[field] ?? "")
          : (player[field] ?? "");
      }
      details.render(
        state.draft
          ? {
              ...player,
              details: state.draft.details,
              level: Number(state.draft.fields.level) || player.level,
            }
          : player,
        { progressEditor: state.progressEditor },
      );
      renderedKey = id;
      state.formSignature = profileFingerprint(formValues(player, state));
    }
    paintAppearance(player, state);
    paintStatus();
  }
  return {
    render,
    autosave: async () => {
      if (saving) return;
      const scope = context();
      for (const player of getPlan().keeps) {
        if (context() !== scope) return;
        if (canEdit(player)) await save(player, { interactive: false });
      }
    },
    ready: () => !getPlayer() || !entry(getPlayer()).loading,
    hasDraft: (player = getPlayer()) =>
      !!player && !!(entry(player).draft || entry(player).progressEditor),
    draftStatus: (player) => {
      const state = entry(player);
      if (!state.draft && state.progressEditor)
        return "Past stats draft · on this device";
      return !canEdit(player)
        ? "Player draft kept · profile read-only"
        : state.review
          ? "Player draft · needs review"
          : state.error
            ? "Player draft · not saved"
            : "Player draft · autosaving every 30 seconds";
    },
  };
}
