import { createPlayerDetails } from "./player-details.js";
import { editPlayerDetails } from "../domain/player-details.js";
import { editPlayerProfile } from "../domain/players.js";
import { playerProfile } from "../domain/player-document.js";
import { validatePlan } from "../domain/validation.js";
import { changeAppearance } from "../domain/appearance-commands.js";
import { renderAvatarButton } from "./avatar-browser.js";
import { renderCastleButton } from "./castle-button.js";
import { bindTileActions } from "./tile-actions.js";
import { view } from "./dom.js";

// The profile has its own durable draft and Save button. Team navigation and
// background refreshes cannot replace inputs that have not been submitted.
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
    details = createPlayerDetails({ root });
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
    const state = { draft: null, revision: 0, loading: true };
    entries.set(id, state);
    readDraft(player)
      .then((draft) => {
        if (!state.revision && draft?.fields && draft.baseline)
          state.draft = draft;
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
  function persist(player, state) {
    writeDraft(player, state.draft).catch(() => {});
  }
  function paintStatus() {
    const player = getPlayer();
    if (!player) return;
    const state = entry(player);
    $("player-save-status").textContent = saving
      ? "Saving player…"
      : state.loading
        ? "Loading player draft…"
        : state.draft
          ? "Player changes unsaved · draft kept on this device"
          : canEdit()
            ? "Player saved"
            : "Player profile read-only";
    $("player-save").disabled =
      saving || state.loading || !state.draft || !canEdit();
    $("player-discard-draft").hidden = !state.draft;
    $("player-discard-draft").disabled = saving;
  }
  function capture() {
    const player = getPlayer();
    if (
      !player ||
      !canEdit() ||
      renderedKey !== key(player) ||
      entry(player).loading
    )
      return;
    const state = entry(player);
    state.draft = {
      baseline: state.draft?.baseline || playerProfile(player),
      fields: Object.fromEntries(
        Object.entries(fields).map(([field, id]) => [field, $(id).value]),
      ),
      details: details.snapshot(),
      avatarId: state.draft?.avatarId ?? player.avatarId,
      skin: state.draft?.skin ?? player.skin,
    };
    state.revision++;
    persist(player, state);
    paintStatus();
    draftChanged();
  }
  for (const event of ["input", "change"])
    form.addEventListener(event, (event) => {
      if (!event.target.closest('[data-player-panel="subcities"]'))
        queueMicrotask(capture);
    });
  form.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (
      !button ||
      button.type === "submit" ||
      button.hasAttribute("data-player-tab") ||
      button.id === "player-march-back" ||
      button.id === "player-discard-draft" ||
      button.closest('[data-player-panel="subcities"]')
    )
      return;
    queueMicrotask(capture);
  });
  bindTileActions(root.querySelector(".player-name-actions"), {
    tileSelector: ".player-name-actions",
    triggerSelector: "#player-title",
    className: "player-name-actions-open",
  });
  form.onsubmit = async (event) => {
    event.preventDefault();
    const player = getPlayer();
    if (!player || saving || !canEdit() || entry(player).loading) return;
    capture();
    const state = entry(player),
      revision = state.revision,
      id = key(player),
      draft = structuredClone(state.draft);
    saving = true;
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
      let next = editPlayerProfile(getPlan(), player.id, changes);
      const detailChanges = details.read();
      if (detailChanges)
        next = editPlayerDetails(next, player.id, detailChanges);
      validatePlan(next, catalog);
      await commit(next, draft.baseline);
      const updated = getPlan().keeps.find((item) => item.id === player.id);
      if (state.revision === revision) state.draft = null;
      else if (updated) state.draft.baseline = playerProfile(updated);
      await writeDraft(player, state.draft);
      if (updated && getPlayer() && key(getPlayer()) === id) {
        applied(updated);
        if (!state.draft) {
          details.reset();
          renderedKey = null;
        }
        render();
      }
      status("Player saved to Drive.");
    } catch (error) {
      status(error.message, true);
    } finally {
      saving = false;
      paintStatus();
      draftChanged();
    }
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
    renderedKey = null;
    details.reset();
    render();
    draftChanged();
  };
  function stage(change) {
    capture();
    const player = getPlayer();
    if (!player) return;
    const state = entry(player);
    if (!state.draft) return;
    Object.assign(state.draft, change);
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
      details.render(
        state.draft
          ? {
              ...player,
              details: state.draft.details,
              level: Number(state.draft.fields.level) || player.level,
            }
          : player,
      );
      for (const [field, fieldId] of Object.entries(fields))
        $(fieldId).value = state.draft
          ? (state.draft.fields[field] ?? "")
          : (player[field] ?? "");
      renderedKey = id;
    }
    paintAppearance(player, state);
    paintStatus();
  }
  return {
    render,
    ready: () => !saving && (!getPlayer() || !entry(getPlayer()).loading),
    hasDraft: (player = getPlayer()) => !!player && !!entry(player).draft,
  };
}
