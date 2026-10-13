// Growth ranges come from the client's WorldMapArtResource configuration.
export const mapSkin = (entity) => entity?.castleOverride ?? entity?.skin;

export function castleForLevel(variants, level) {
  const growth = variants
    .filter((a) => a.minKeepLevel !== undefined)
    .sort((a, b) => b.minKeepLevel - a.minKeepLevel);
  return (
    growth.find((a) => a.minKeepLevel <= level) || growth.at(-1) || variants[0]
  );
}

export function updateKeepAppearances(keeps, assets) {
  for (const keep of keeps) {
    const current = assets.get(keep.skin);
    if (!current) continue;
    const variants = [...assets.values()].filter(
      (a) => a.family === current.family,
    );
    if (variants.some((a) => a.minKeepLevel !== undefined)) {
      keep.skin = castleForLevel(variants, keep.level).id;
    }
  }
}

// A visual family may include unrelated designs as well as upgrade chains.
// Only explicit client upgrade groups (or automatic growth) share picker entries.
export function castlePickerEntries(assets) {
  const groups = new Map();
  const keyFor = (asset) =>
    asset.minKeepLevel !== undefined
      ? asset.family
      : asset.upgradeGroup || asset.id;
  const familyGroups = new Map();
  for (const asset of assets) {
    const key = keyFor(asset);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(asset);
    const family = asset.family || asset.id;
    if (!familyGroups.has(family)) familyGroups.set(family, new Set());
    familyGroups.get(family).add(key);
  }
  return [...groups.entries()]
    .map(([id, members]) => {
      members.sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
      const first = members[0];
      const automatic = members.some(
        (asset) => asset.minKeepLevel !== undefined,
      );
      const separateDesign =
        !automatic && familyGroups.get(first.family || first.id).size > 1;
      const suffix =
        separateDesign && first.variantName !== "Standard"
          ? first.variantName
          : "";
      return {
        id,
        family: first.family || first.id,
        name: first.name + (suffix ? " – " + suffix : ""),
        automatic,
        variants: members,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
