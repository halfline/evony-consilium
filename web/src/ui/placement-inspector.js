import {
  changeAppearance,
  changeMapCastle,
  useProfileCastle,
} from "../domain/appearance-commands.js";
import { mapSkin } from "../domain/castles.js";
import { canPlace } from "../domain/placement.js";
import { validatePlan } from "../domain/validation.js";
import { renderCastleButton } from "./castle-button.js";
import { view } from "./dom.js";

// This form edits an object's map placement. Player identity belongs to player-screen.
export function createPlacementInspector({
  root,
  canEdit = () => true,
  getPlan,
  terrainFor,
  selected,
  assets,
  catalog,
  browse,
  commit,
  status,
  applied,
  close,
}) {
  const $ = view(root);
  function applyAsset(id, asset) {
    try {
      const command = getPlan().keeps.some((player) => player.id === id)
        ? changeMapCastle
        : changeAppearance;
      const next = command(getPlan(), id, asset, terrainFor(getPlan().map));
      validatePlan(next, catalog);
      commit(next);
    } catch (error) {
      status(error.message, true);
    }
  }
  $("choose-building-skin").onclick = () => {
    if (!canEdit()) return;
    const entity = selected();
    const asset = assets.get(mapSkin(entity));
    const mapId = getPlan().activeMapId;
    if (asset)
      browse(
        asset.kind,
        (chosen) => {
          if (canEdit() && getPlan().activeMapId === mapId)
            applyAsset(entity.id, chosen);
        },
        { showFootprints: "level" in entity },
      );
  };
  $("use-player-castle").onclick = () => {
    if (!canEdit()) return;
    const entity = selected();
    if (!entity) return;
    try {
      const next = useProfileCastle(
        getPlan(),
        entity.id,
        assets.get(entity.skin),
        terrainFor(getPlan().map),
      );
      validatePlan(next, catalog);
      commit(next);
    } catch (error) {
      status(error.message, true);
    }
  };
  $("entity-form").onsubmit = (event) => {
    event.preventDefault();
    const entity = selected();
    if (!entity) return;
    try {
      const next = structuredClone(getPlan());
      const target = [
        ...next.keeps,
        ...next.structures,
        ...next.obstacles,
      ].find((item) => item.id === entity.id);
      if (!("level" in target)) {
        target.name = $("placement-name").value.trim();
        if (!target.name) throw new Error("Enter a name.");
      }
      if (next.obstacles.some((item) => item.id === target.id)) {
        target.w = Number($("entity-w").value);
        target.h = Number($("entity-h").value);
      }
      target.locked = $("entity-locked").checked;
      const x = $("entity-x").value,
        y = $("entity-y").value;
      if ((x === "") !== (y === ""))
        throw new Error("Enter both X and Y, or leave both blank.");
      target.x = x === "" ? null : Number(x);
      target.y = y === "" ? null : Number(y);
      if (
        target.x !== null &&
        !canPlace(target, target.x, target.y, next, [], terrainFor(next.map))
      )
        throw new Error(
          "That location overlaps another tile or is outside the map.",
        );
      validatePlan(next, catalog);
      commit(next);
      applied();
      status("Changes applied.");
    } catch (error) {
      status(error.message, true);
    }
  };
  $("close-inspector").onclick = close;
  function render() {
    const entity = selected();
    $("inspector").hidden = !entity;
    if (!entity) return;
    const keep = "level" in entity;
    const obstacle = getPlan().obstacles.some((item) => item.id === entity.id);
    $("entity-title").textContent = entity.name;
    $("entity-kind").textContent = keep
      ? "SELECTED KEEP"
      : obstacle
        ? "BLOCKED TILE"
        : "ALLIANCE / BATTLEFIELD TILE";
    $("placement-name").value = entity.name;
    $("placement-name").closest("label").hidden = keep;
    for (const key of ["x", "y", "w", "h"])
      $("entity-" + key).value = entity[key] ?? "";
    $("entity-locked").checked = entity.locked;
    $("choose-building-skin").hidden = obstacle;
    $("choose-building-skin").parentElement.hidden = obstacle;
    $("choose-building-skin").disabled = !canEdit();
    $("choose-building-skin").setAttribute(
      "aria-label",
      keep ? "Choose castle for this map" : "Choose building",
    );
    $("map-castle-note").hidden = !keep;
    $("map-castle-note").textContent = `${entity.w} × ${entity.h} tiles. ${
      entity.castleOverride === undefined
        ? "Using the player's castle."
        : "This castle is used only on this map."
    }`;
    $("use-player-castle").hidden =
      !keep || entity.castleOverride === undefined;
    $("use-player-castle").disabled = !canEdit();
    $("entity-w").closest("label").hidden = !obstacle;
    $("entity-h").closest("label").hidden = !obstacle;
    $("entity-w").readOnly = !obstacle || !canEdit();
    $("entity-h").readOnly = !obstacle || !canEdit();
    const asset = assets.get(mapSkin(entity));
    if (asset) renderCastleButton($("choose-building-skin"), asset);
  }
  return { render };
}
