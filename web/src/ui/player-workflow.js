import { createPlayerFileControls } from "./player-file-controls.js";
import { createPlayersScreen } from "./players-screen.js";
import { createPlayerScreen } from "./player-screen.js";
import { createAddPlayerDialog } from "./add-player-dialog.js";
import { view } from "./dom.js";
import { assignPlayerOwner } from "../domain/players.js";
import { createAvatarBrowser } from "./avatar-browser.js";
import { OperationCancelled } from "../services/cancellation.js";

export function createPlayerWorkflow({
  roots,
  search,
  altSearch,
  canEditTeam,
  commitTeam,
  getPlan,
  getAvatars,
  assets,
  catalog,
  terrainFor,
  selection,
  select,
  remove,
  browseCastle,
  navigate,
  status,
  getWorkspace,
  refreshAccess,
}) {
  let lastTag = getPlan().keeps.at(-1)?.allianceTag || "";
  const avatars = createAvatarBrowser({
    root: roots.avatars,
    getCatalog: getAvatars,
  });
  const dialog = createAddPlayerDialog({
    root: roots.add,
    getPlan,
    assets,
    getAvatars,
    browseAvatar: avatars.open,
    browse: browseCastle,
    lastTag: () => lastTag,
    context: () => getWorkspace()?.key(),
    add: async (player, closeForPicker) => {
      const workspace = getWorkspace();
      const current = workspace.players.captureContext();
      try {
        await workspace.playerFolder({ interactive: false });
      } catch (error) {
        if (error.code !== "team_folder_picker_needed") throw error;
        closeForPicker();
        await workspace.playerFolder();
      }
      current();
      const linked = await workspace.profiles.add(player);
      lastTag = player.allianceTag;
      select(player.id);
      navigate("player");
      await workspace.autosave();
      return linked;
    },
    importPlayer: async () => {
      const workspace = getWorkspace();
      const player = await workspace.profiles.import();
      select(player.id);
      navigate("player");
      await workspace.autosave();
      status("Player added to the team.");
    },
  });
  let profile;
  const fileState = (player) => ({
    ...getWorkspace()?.players.state(player),
    ...(profile?.hasDraft(player)
      ? { label: profile.draftStatus(player) }
      : {}),
  });
  function openAdd(alt = false) {
    if (canEditTeam()) dialog.open(alt);
  }
  const list = createPlayersScreen({
    root: roots.list,
    search,
    getPlan,
    getAvatars,
    getSelection: () => selection.id,
    open: (id) => {
      select(id);
      navigate("player");
    },
    remove,
    add: () => openAdd(),
    fileState,
  });
  const alts = createPlayersScreen({
    root: roots.alts,
    search: altSearch,
    getPlan,
    getAvatars,
    getSelection: () => selection.id,
    open: (id) => {
      select(id);
      navigate("player");
    },
    remove,
    add: () => openAdd(true),
    alts: true,
    fileState,
  });
  const $ = view(roots.profile);
  $("player-owner").onchange = () => {
    if (!canEditTeam()) return;
    try {
      commitTeam(
        assignPlayerOwner(
          getPlan(),
          selection.id,
          $("player-owner").value || null,
        ),
      );
      navigate("player");
      renderOwnership();
      status("Player ownership changed. Save team to share it.");
    } catch (error) {
      status(error.message, true);
      renderOwnership();
    }
  };
  function renderOwnership() {
    const player = cachedPlayer();
    if (!player) return;
    const owner = $("player-owner");
    const independent = document.createElement("option");
    independent.value = "";
    independent.textContent = "Regular player (emancipated)";
    owner.replaceChildren(
      independent,
      ...getPlan()
        .keeps.filter((item) => item.id !== player.id && item.ownerId == null)
        .map((item) => {
          const option = document.createElement("option");
          option.value = item.id;
          option.textContent = item.name;
          return option;
        }),
    );
    owner.value = player.ownerId || "";
    owner.disabled = !canEditTeam();
    $("player-ownership-help").textContent = getPlan().keeps.some(
      (item) => item.ownerId === player.id,
    )
      ? "Assigning an owner transfers this player's alts to the new owner."
      : "Assign an owner to make this player an alt, or emancipate it to make it a regular player.";
  }
  const cachedPlayer = () =>
    getPlan().keeps.find((player) => player.id === selection.id);
  const editingPlan = (id = selection.id) =>
    getWorkspace()?.profiles.editingPlan(id) || getPlan();
  const fileControls = createPlayerFileControls({
    root: roots.profile,
    dialog: roots.sync,
    getPlayer: cachedPlayer,
    getFiles: () => getWorkspace()?.players,
    unlock: () => getWorkspace().profiles.unlock(selection.id),
    status,
    refresh: () => {
      profile.render();
      list.render();
      alts.render();
      fileControls.render();
      refreshAccess();
    },
  });
  profile = createPlayerScreen({
    root: roots.profile,
    canEdit: (player = cachedPlayer()) =>
      !!getWorkspace()?.players.state(player).canEdit,
    context: () => getWorkspace()?.key(),
    readDraft: (player) => getWorkspace().readEditorDraft(player),
    writeDraft: (player, draft) =>
      getWorkspace().writeEditorDraft(player, draft),
    discardDraft: (player) => getWorkspace().discardPlayerDraft(player),
    draftChanged: () => {
      list.render();
      alts.render();
      refreshAccess();
    },
    getPlan: editingPlan,
    terrainFor,
    getPlayer: () =>
      editingPlan().keeps.find((player) => player.id === selection.id),
    assets,
    catalog,
    getAvatars,
    browseCastle,
    browseAvatar: avatars.open,
    commit: async (next, baseline, id, { interactive }) => {
      const player = next.keeps.find((player) => player.id === id);
      roots.profile.setAttribute("aria-busy", "true");
      try {
        await getWorkspace().profiles.save(
          player,
          interactive
            ? fileControls.resolve
            : async () => {
                throw Object.assign(
                  new Error(
                    "Player changes need review. Use Save player to resolve them.",
                  ),
                  { status: 409, review: true },
                );
              },
          baseline,
        );
      } finally {
        roots.profile.setAttribute("aria-busy", "false");
      }
    },
    remove,
    status,
    applied: (player) => {
      lastTag = player.allianceTag;
    },
  });
  return {
    autosave: () => profile.autosave(),
    renderList: () => {
      list.render();
      alts.render();
    },
    renderProfile: () => {
      profile.render();
      fileControls.render();
      refreshAccess();
      renderOwnership();
      getWorkspace()?.players.probe(cachedPlayer());
    },
    canEditPlayer: () =>
      !!getWorkspace()?.players.state(cachedPlayer()).canEdit &&
      profile.ready(),
    openAdd: () => openAdd(),
    draft: dialog.player,
    resetTag: () => {
      lastTag = getPlan().keeps.at(-1)?.allianceTag || "";
    },
  };
}
