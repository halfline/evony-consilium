import { createPlayersScreen } from "./players-screen.js";
import { createAddPlayerDialog } from "./add-player-dialog.js";
import { createAvatarBrowser } from "./avatar-browser.js";
import { createPlayerScreen } from "./player-screen.js";
import { createPlayerFileControls } from "./player-file-controls.js";

// The first player screen supports the roster and creating a linked player file.
export function createPlayerWorkflow({
  roots,
  search,
  getPlan,
  getAvatars,
  assets,
  catalog,
  terrainFor,
  browseCastle,
  getWorkspace,
  remove,
  status,
  navigate,
  refreshAccess,
}) {
  let selectedId = null;
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
      selectedId = linked.id;
      list.render();
      status("Player added.");
      return linked;
    },
  });
  const list = createPlayersScreen({
    root: roots.list,
    search,
    getPlan,
    getAvatars,
    getSelection: () => selectedId,
    open: (id) => {
      selectedId = id;
      navigate("player");
    },
    remove: (id) => {
      remove(id);
      if (selectedId === id) selectedId = null;
      list.render();
    },
    add: dialog.open,
    fileState: (player) => getWorkspace()?.players.state(player),
  });
  const cachedPlayer = () =>
    getPlan().keeps.find((player) => player.id === selectedId);
  const editingPlan = () =>
    getWorkspace()?.profiles.editingPlan(selectedId) || getPlan();
  let fileControls;
  const profile = createPlayerScreen({
    root: roots.profile,
    getPlan: editingPlan,
    getPlayer: () => editingPlan().keeps.find((player) => player.id === selectedId),
    terrainFor,
    assets,
    getAvatars,
    catalog,
    browseAvatar: avatars.open,
    browseCastle,
    canEdit: () => !!getWorkspace()?.players.state(cachedPlayer()).canEdit,
    commit: async (next) => {
      const player = next.keeps.find((item) => item.id === selectedId);
      roots.profile.setAttribute("aria-busy", "true");
      try {
        await getWorkspace().profiles.save(player, fileControls.resolve);
        status("Player saved.");
        list.render();
        refreshAccess();
      } finally {
        roots.profile.setAttribute("aria-busy", "false");
      }
    },
    applied: (player) => {
      lastTag = player.allianceTag;
    },
    unlock: (id) => getWorkspace().profiles.unlock(id),
    remove: (id) => {
      remove(id);
      selectedId = null;
      navigate("players");
    },
    status,
  });
  fileControls = createPlayerFileControls({
    root: roots.profile,
    dialog: roots.sync,
    getPlayer: cachedPlayer,
    getFiles: () => getWorkspace()?.players,
    unlock: () => getWorkspace().profiles.unlock(selectedId),
    status,
    refresh: () => {
      profile.render();
      list.render();
      refreshAccess();
    },
  });
  return {
    open: (id) => {
      selectedId = id;
      navigate("player");
    },
    renderList: () => {
      list.render();
      roots.list.querySelector("#add-player").hidden =
        !getWorkspace()?.sync.file?.capabilities?.canEdit;
    },
    openAdd: dialog.open,
    selected: () => getPlan().keeps.find((player) => player.id === selectedId),
    renderProfile: () => {
      profile.render();
      fileControls.render();
      refreshAccess();
      getWorkspace()?.players.probe(cachedPlayer());
    },
    canEditPlayer: () => !!getWorkspace()?.players.state(cachedPlayer()).canEdit,
  };
}
