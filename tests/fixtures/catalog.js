// Authored domain fixtures: no downloaded catalog or sprite data.
const cultures = [
  "europe",
  "china",
  "japan",
  "korea",
  "america",
  "russia",
  "arabia",
];
const growth = [
  [1, 1],
  [2, 6],
  [3, 11],
  [4, 16],
  [5, 21],
  [7, 35],
  [8, 40],
];
export const catalog = {
  assets: cultures.flatMap((culture, index) =>
    growth.map(([tier, minKeepLevel]) => ({
      id: `map-evony${index + 1}-castle_lv${tier}`,
      name: culture,
      family: `culture-${culture}`,
      culture,
      kind: "keep",
      tier,
      minKeepLevel,
      src: "fixture.webp",
      width: 100,
      height: 100,
      footprint: 2,
      categories: ["culture"],
    })),
  ),
};
