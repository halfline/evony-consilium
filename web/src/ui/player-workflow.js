import { createPlayersScreen } from "./players-screen.js";
import { createAddPlayerDialog } from "./add-player-dialog.js";
import { createAvatarBrowser } from "./avatar-browser.js";

// The first player screen supports the roster and creating a linked player file.
export function createPlayerWorkflow({
  roots,
  search,
  getPlan,
  getAvatars,
  assets,
  browseCastle,
  getWorkspace,
  remove,
  status,
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
      list.render();
    },
    remove: (id) => {
      remove(id);
      if (selectedId === id) selectedId = null;
      list.render();
    },
    add: dialog.open,
    fileState: (player) => getWorkspace()?.players.state(player),
  });
  return {
    renderList: () => {
      list.render();
      roots.list.querySelector("#add-player").hidden =
        !getWorkspace()?.sync.file?.capabilities?.canEdit;
    },
    openAdd: dialog.open,
    selected: () => getPlan().keeps.find((player) => player.id === selectedId),
  };
}
