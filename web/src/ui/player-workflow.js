import { createPlayerFileControls } from "./player-file-controls.js";
import { createPlayersScreen } from "./players-screen.js";
import { createPlayerScreen } from "./player-screen.js";
import { createAddPlayerDialog } from "./add-player-dialog.js";
import { createAvatarBrowser } from "./avatar-browser.js";

export function createPlayerWorkflow({
  roots,
  search,
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
    assets,
    getAvatars,
    browseAvatar: avatars.open,
    browse: browseCastle,
    lastTag: () => lastTag,
    add: async (player) => {
      const linked = await getWorkspace().profiles.add(player);
      lastTag = player.allianceTag;
      select(player.id);
      navigate("player");
      return linked;
    },
  });
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
    add: dialog.open,
    fileState: (player) => getWorkspace()?.players.state(player),
  });
  const cachedPlayer = () =>
    getPlan().keeps.find((player) => player.id === selection.id);
  const editingPlan = () =>
    getWorkspace()?.profiles.editingPlan(selection.id) || getPlan();
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
      fileControls.render();
      refreshAccess();
    },
  });
  const profile = createPlayerScreen({
    root: roots.profile,
    canEdit: () => !!getWorkspace()?.players.state(cachedPlayer()).canEdit,
    getPlan: editingPlan,
    terrainFor,
    getPlayer: () =>
      editingPlan().keeps.find((player) => player.id === selection.id),
    assets,
    catalog,
    getAvatars,
    browseCastle,
    browseAvatar: avatars.open,
    commit: async (next) => {
      const player = next.keeps.find((player) => player.id === selection.id);
      roots.profile.setAttribute("aria-busy", "true");
      try {
        await getWorkspace().profiles.save(player, fileControls.resolve);
        status("Player saved.");
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
    renderList: list.render,
    renderProfile: () => {
      const focused = roots.profile.ownerDocument.activeElement;
      if (
        !focused?.matches("input, textarea, select") ||
        !roots.profile.contains(focused)
      )
        profile.render();
      fileControls.render();
      refreshAccess();
      getWorkspace()?.players.probe(cachedPlayer());
    },
    canEditPlayer: () =>
      !!getWorkspace()?.players.state(cachedPlayer()).canEdit,
    openAdd: dialog.open,
    draft: dialog.player,
    resetTag: () => {
      lastTag = getPlan().keeps.at(-1)?.allianceTag || "";
    },
  };
}
