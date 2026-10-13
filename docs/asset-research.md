# Evony graphics investigation

Investigated October 5, 2026 for **Evony: The King's Return**.

## Current public resource source

The current castle catalog is generated from game configuration, not an editorial list of popular castles. The official PC download endpoint `https://em.evony.com/down.php?type=windows_client_zip&print=1` revealed the public resource host `emggcdn1.ucimg.co`. Its public directory listing exposes Android, Windows, WebGL and configuration resources. No game account, login, installed executable or private API is required.

Pinned inputs:

- [Android resource manifest, version 397319](https://emggcdn1.ucimg.co/android/UploadBundles/397319_8AF4BA72AD6CF179DE8EBC3B544C232D_download_config.txt)
- [Bundle dependency index](https://emggcdn1.ucimg.co/android/UploadBundles/BundleMap-397319.zip)
- [Game configuration archive](https://emggcdn1.ucimg.co/config_data/9a2957927cfdbab51180f33211aaa9f3.zip)
- [English localization archive](https://emggcdn1.ucimg.co/config_data/en-US_f0ec476e8fd3042cd98808faa7ac3090.zip)

The configuration archive was the newest production entry listed on October 5. This is a pinned client snapshot; inclusion in configuration does not establish current acquisition eligibility or an event's live status.

`scripts/fetch-current-assets.py` fetches castle bundles and their direct available dependencies for static previews, checks compressed sizes against the manifest, caches downloads and records URL/size/SHA-256 provenance. Optional `--all-dependencies` follows the complete dependency graph, including UI and particle resources; that substantially increases the download. Resources have names such as `prefab-map-castle_1458192241.brotlii`.

These are **block Brotli containers**, not one Brotli stream. The `BROTLIFILE` signature is followed by a marker, uncompressed size, block size, and a table of absolute compressed block offsets. Decode each block independently, concatenate, and check the resulting length. `consilium_assets.brotli_container.decode` implements that container. The decoded files are UnityFS bundles, readable with UnityPy.

## Complete configured castle inventory

`CastleDressUpConfig.bytes` contains 220 records with a keep map prefab path. `GuildCastleSkinConfig.bytes` contains nine alliance glory skin records. Timed copies share graphics and are merged by prefab path; hidden upgrade records remain included. `CastleDressUpgradeConfig.bytes` supplies explicit keep upgrade tiers. English localization supplies names instead of guessing them from filenames. Castle filters use the client's `child_type` IDs (field 102): Activity (1), Collection (2), Excellent (3), Champion (4). Labels come from the Classic default entries' localized `child_type_name` (field 120), and every decoration is assigned by its actual category ID. This avoids a stale Activity title on the Deep Sea Palace record, whose category ID correctly places it in Collection. The application gives Classic culture appearances their own Culture filter and excludes them from the decoration category filters. An upgrade chain spanning categories remains browseable in each applicable category, with all its tiers available in its popup.

The audit is shipped as `web/assets/castle-inventory.json`: every source record maps to its catalog asset and extraction status. Castle of Wonder's parameterized prefab expands into seven culture variants, so the audit has 235 rows covering 229 distinct source records. This count is not the number of unique selectable castles.

Verified examples include Thebes (Throne, Imperium, Divinity), Silver Wonder (Snowfall, Blossom), Verona (Dawn, Night), Fortress Pyramid, Desert Palace, Arcanum Athenaeum (base plus Neophyte, Mage, Archmage), and Shushan Peak (base plus Monster Queller, Fiend Purger, Celestials Vanquisher). Independent designs have separate browser entries; explicit upgrade chains share a tier popup.

All nine configured alliance skins are included: Holy Angel Castle, Camelot, Sigiriya, Star Fort, Loulan, Atlantis, Atlantis – Oracle, Rhodes, and Rhodes – Sacred Radiance. They are searchable under “Chalons Alliance Glory Castle.” Atlantis and Rhodes designs are separate picker entries. The ordinary alliance castle uses the 2×2 default from `GuildCastleObject.edgeGridCount`. Glory skins use the 4×4 footprint from field 117 (`size`) of `GuildCastleSkinConfig`, rather than a hardcoded size. Battlefield footprints are read from `BattlefieldConfig.range`, confirmed by the client's `GetBattleBuildingGridCount` function. Knight's Hall, Portal, Battlefield Hospital, Blessing Tower, March Tower, Rally Hall and Crystal Mine are 3×3; Constantinople is 5×5. Castle and building footprints are derived automatically from the catalog in every map, including imported and inactive layouts. Old dimensions are corrected on load. If the corrected footprint overlaps an unchanged placement or crosses the map edge, that object returns to the unplaced list and the application reports that it needs repositioning. New appearance changes reject overlaps. Only blocked areas have editable dimensions.

Three historical keep records remain in configuration but their map prefabs and icon resources are absent from the current manifest: Town_Harlek, Town_Sophia and Town_Swan, all named “Elegant Noble Castle Decoration.” Their UI preview prefabs refer to the excluded `ignore-others` resource group. They remain visible in the family popup with an unavailable badge and cannot be selected. Other variants of the family have real graphics. No unrelated castle image substitutes for a missing resource.

## Rendering and growth

Player profiles supply the default castle. Each map can pin a different castle for each player, with its own game footprint; a 2×2 tactic and a 3×3 tactic can share the same roster. The map inspector offers a castle picker with tile sizes and a return to the player's default. Overrides live in map placements, survive profile refreshes and map navigation, and never enter player profile files. Unplaced overrides are retained as map settings.

The extractor traverses enabled prefab sprite layers, preserves transforms/drawing order, resolves separate alpha textures, and renders tight sprite meshes. Where Unity omits UV channels, texture coordinates are reconstructed from the sprite's UV transform. Premium castles with Spine 3.8 JSON/binary skeletons are assembled offline using the matching atlas, skins and idle pose. The browser receives static transparent WebP images; the Spine runtime is a development dependency only. Battlefield buildings have one selectable entry: `previewSrc` holds the UI icon for picker/roster thumbnails, while `src` holds the full map sprite used by the renderer. UI icons are not separate placeable buildings.

These are static poses. Unity particle systems, shader effects, event animations and the complete game lighting/rendering pipeline are not reproduced. Preview assembly is not a claim of pixel-for-pixel equivalence with every live game frame.

Culture appearance ranges were checked against the `WorldMapArtResource` TextAsset in Android 5.35.1 with source SHA-256 `b20a39d5b7c55fd82dc20db0dc217e1fcb145ee62d7fc282017c3ebd36ad4b06`. The observed rules are maintained in `src/consilium_assets/culture_growth.py`; extraction writes `web/assets/culture-growth.json` as a report. The public configuration archive does not include that table, so builds use these rules; a supplied `WorldMapArtResource.bytes` overrides per-sprite bounds:

| Keep levels | Culture sprite suffix |
| ----------- | --------------------- |
| 1–5         | lv1                   |
| 6–10        | lv2                   |
| 11–15       | lv3                   |
| 16–20       | lv4                   |
| 21–34       | lv5                   |
| 35–39       | lv7                   |
| 40–50       | lv8                   |

The seven cultures are Europe, China, Japan, Korea, America, Russia and Arabia. `lv6` is Castle of Wonder, a separate decoration; it is not a normal growth stage. Choosing a culture automatically selects the appropriate appearance, including after a keep-level edit or plan import. Premium upgrade choices remain manual.

## Terrain and battlefield limitations

The legacy terrain/resource sprites come from the public WebGL client at `https://ew.evony.com/`, whose update script exposes `https://ewggcdn.ucimg.co/webgl/WebBuild/StreamingAssets/AssetsBundles/`. The earlier resource index was 323936. `scripts/extract-assets.py` retains this route for ground tiles, resources, objective sprites and overview images.

The pinned Android `map-data` bundle supplies the XML/Tiled grids. Server uses WorldMap (1201×1201); BoC uses BattleField, BoG BattleField2, Chalons BattleField4 and All-Star BattleField_AllStar (301×301); Civilization uses BattleField_PvpCivilizationClash (601×601). Toulon uses the BoC layout. These assignments were checked against the client MapResource.GetMapName implementation; BattleField3 belongs to Huns rather than Toulon.

`scripts/extract-terrain.py` decodes CSV, gzip/base64 byte grids and gzip/base64_1 CSV grids, exports original WorldMap1/WorldMap2 sprites from `map-sprite-common`, and derives blocked cells from tileset terrain properties. Invisible decorative tiles do not block placement. Runtime placement checks every cell of an entity's footprint and excludes fixed landmarks. Map terrain lives outside editable formation data.

The low-zoom overview preserves terrain coordinates using averaged original sprite colors; close views use individual original sprites. Seasonal texture selection, battlefield objective coordinates, live resource spawns and influence areas remain outstanding. The adjustable 2:1 affine diamond remains an approximation of the game's camera projection.

## Reproduction

See the README commands. Generate legacy terrain first, fetch current resources second, then run the current castle extractor. Source bundles are cached outside version control. The catalog preserves original Unity paths, prefab bundle names, source IDs, rendering status, configuration hashes and manifest URL. Downloader provenance is written to the cache's `sources.json`.

For a different snapshot, update the pinned resource manifest, dependency index and matching configuration/localization URLs together. Compare the inventory audit rather than just searching for familiar names. Imported user assets and saved legacy asset IDs remain supported.

Evony graphics belong to Top Games Inc. Public download availability is not a redistribution license; no redistribution permission was established. The app is unofficial.

## Server landmarks

The current extractor includes City of Throne (`kingdom.prefab`), Hero Tower, Magic Tower, both catapult orientations (named Throne Tower in `WorldBuildingConfig`), Forging/Harvest/Hunter Temples, four troop camps, and four appearances each of Prosperous City and Gladiator School. These, together with Arch of Triumph, are 21 resources represented in `assets/server-inventory.json`. Server appearances have independent browser entries.

Footprints were independently checked against the Android 5.35.1 client constructors: `KingdomObject` passes gridCount 5 to `MapObject` (RVA 0x44BDCF0); `ThroneBuildingObject` passes 4 (0x44D046C); `ShrineBuildingObject` passes 4 (0x44CD60C); `AltarObject` passes 3 (0x4498D90). Thus the Throne is 5×5, towers/catapults/temples 4×4, and camps/city-state/gladiator-school altars 3×3. TriumphObject passes gridCount 3 (RVA 0x44D4358), confirming the Arch of Triumph is 3×3. This is occupied footprint, not an influence radius.

The downloader includes `prefab-map-kingdom`, `prefab-map-resource` and their direct resource dependencies. Catapults retain the base, shadow and idle Sprite from the prefab while excluding attack/projectile children; the right-facing prefab mirrors its sprite through a 180-degree Y rotation. Temple prefabs without a renderable static pose use the matching original world-building sprite. Other server previews use assembled prefabs. Fixed server coordinates were confirmed by the project owner: throne (600,600), Magic Tower (606,606), Hero Tower (593,593), catapults (606,593)/(593,606), Arch of Triumph (600,607), Hunter Temple (299,899), Harvest Temple (299,299), Forging Temple (899,299). These readonly landmarks are populated automatically and survive formation clearing. Catapult orientation is chosen from the two original prefabs.

## Player portraits

`scripts/extract-avatars.py` reads the same pinned resource version 397319. `AvatarConfigure` supplies localized monarch-image names and portrait paths; `RoleResourceConfig` supplies default culture portraits and monarch-avatar paths, with names resolved through `ItemsConfigure` and English localization. Duplicate image paths are collapsed. The picker offers seven culture filters, Collection, and General. Culture portraits have no visible names; culture text remains available for accessible button labels and search. General includes general skins, while collected monarch avatars and monarch images appear in Collection. These are portrait categories, independent of castle categories.

Category verification uses the Android client, rather than words in display names: `UIChangeArtWindow` has `cultureToggle`, `collectionToggle`, and `generalToggle`. Their Start callbacks (`0x3BAB05C`, `0x3BAB064`, `0x3BAB070`) set `FigureType` to 0, 1, and 2 respectively. `ShowArtList` compares this with `RoleResourceConfig.general_type`, protobuf field 110 (comparison at `0x3BA59C0`). Thus type 0 supplies culture portraits, type 1 supplies Collection, and type 2 supplies General. Dragon God – Martinus and Elektra are General even though their localized item names omit “Skin.” `AvatarConfigure` monarch-image entries are also grouped in Collection. Type 1000 is a champion background with a different unlock schema and is excluded from the portrait list.

The extracted catalog is `web/assets/avatar-catalog.json`, with original Unity paths and source bundle hash/URL. WebP portraits live in `web/assets/avatars/`. References unavailable in the input bundle are recorded separately instead of appearing as broken cards. This pinned catalog does not imply current event availability.

The castle picker distinguishes independent designs from upgrade tiers. `CastleDressUpgradeConfig` field 101 identifies an upgrade chain, field 102 its castle record, and field 104 its tier. Extraction records `upgradeGroup` on those assets. `castlePickerEntries` groups only that chain or automatic keep-level growth; other designs have separate cards, with their design name included in the title. For example, Verona Dawn/Night are separate, Thebes keeps its three-tier popup, and the standalone Arcanum Athenaeum is separate from the Neophyte/Mage/Archmage chain. Server landmark appearances also remain separate entries.

Server landmark alignment preserves the prefab's root pivot through rasterization, including cropping offsets and scale. Rendering these assets uses native tile scale rather than fitting the image into a generic footprint. `MapObject.getCenterMapPos` (RVA 0x44C0610) adds 0.5 to both axes for even gridCount; `getTopMapPos` (0x44C0734) subtracts `(gridCount - 1) // 2`. The tile renderer represents cell centers at half-integer coordinates, so fixed footprint origins use the latter offset. This keeps 4×4 tower/catapult platforms aligned with the throne's moat.

The throne's outer terrain ring (tiles 594–606, excluding its inner floor 597–603) also acts as a foreground ground layer. After drawing terrain and dirt clearings, the renderer restores overlapping surface ring tiles clipped to fixed building footprints. Building sprites are drawn afterward, so the moat covers dirt while towers and their platforms remain fully visible above it. This compositing rule follows visual feedback from the game; it is separate from the verified coordinate and prefab-pivot conversion.

Fixed server buildings outside the throne receive footprint clearings using original dirt tile GID 76 (WorldMap1 sprite 75). Vegetation is suppressed inside these clearings; the throne keeps its original paved floor. The moat overlay is drawn after dirt and before all building sprites, preserving the ground overlap without covering towers. Source terrain grids are retained unchanged; these landmark clearings are a rendering overlay.

The throne uses a visual scale calibration of 98% of its 5×5 footprint width, based on in-game visual feedback. Its grass-base anchor is aligned with the footprint's front corner; other server landmarks retain their native prefab pivots and tile scale. This calibration is distinct from occupied gridCount.

The throne prefab's separate `mask` object is excluded from the preview: it supplies shader masking in the game and is not a second visible tower segment. Horizontal alignment uses the prefab root's grass-base anchor rather than the full image bounds, which include an asymmetric shadow.

Temple sprite previews are calibrated to 98% of their 4×4 footprint width using the solid-alpha bounds, excluding transparent padding and soft shadows. Their front grass-base points align with footprint front corners; the extractor stores these anchors reproducibly in the catalog. This replaces generic castle preview sizing for the three temple sprites.

### Map menu emblems

`scripts/extract-map-icons.py` extracts transparent native menu sprites from snapshot 397319. BuildingMenu and English labels link menu_98 to Constantinople, menu_99 to Gaugamela, menu_114 to All-Star, menu_129 to Chalons, and menu_178 to Civilization Ultimate Battlefield. The server selector uses the client's icon_earth. Toulon shares the Constantinople emblem, matching the supplied in-game screenshot. Source bundle hashes and Unity paths are recorded in `web/assets/map-icons/manifest.json`.

### Discord branding

`web/assets/branding/discord.svg` is the unmodified white Discord symbol downloaded from Discord's official branding page (https://discord.com/branding), asset https://cdn.prod.website-files.com/6257adef93867e50d84d30e2/66e3d7f4ef6498ac018f2c55_Symbol.svg. It is displayed inside a Blurple button linking to the team's Discord invite or channel.

Attack march tiles use the original infantry, archer, cavalry and siege engine sprites from `ui-army-icon-early` in snapshot 397319. Run `scripts/extract-troop-icons.py --bundles <snapshot-directory>` to reproduce the WebP images and source manifest in `web/assets/troop-icons`. Preset marches start with blank counts; no march-size heuristic is applied.
