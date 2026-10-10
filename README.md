# Evony Consilium

A static JavaScript alliance formation and hive planner for **Evony: The King's Return**, deployable to GitHub Pages. Uses extracted original game sprites, an adjustable isometric grid, and shared Google Drive project folders.

**Current status:** original client terrain grids and tile sprites are loaded for Server, BoC, BoG, Chalons, All-Star, Civilization and Toulon. Lakes and mountains restrict placement, and the server's fixed throne, towers, catapults, temples and Arch of Triumph are populated automatically. Blank maps allow unrestricted planning. Resources are pinned to public client version 397319. The adjustable camera projection remains an approximation; seasonal textures and battlefield objective locations are not yet reproduced. At distant zoom levels a simplified terrain overview replaces individual sprites.

## Run

```sh
npm ci
python3.12 -m venv .venv
.venv/bin/python -m pip install -e .
npm run assets
npm run dev
```

Open `http://127.0.0.1:4173`. The entry flow is Google sign-in → team selector → Team dashboard. Configure the public OAuth client ID, Google Picker API key and Cloud project number as described in [Google Drive setup](docs/google-drive.md), and publish the OAuth app to production. The app uses the non-sensitive `drive.file` permission; shared project folders and their existing files are explicitly authorized with Google Picker. No backend or game account is needed. New teams start empty. Remembered teams appear in the default Your teams tab; Open team is the default when there are none.

## Delegating player editing

New teams use `Team - <name>.team.consilium.json`; profiles use `Player - <name>.player.consilium.json`. Picker uses a list so names stay visible. Each file list includes existing JSON files and the new Drive types together, with a filename search for team or player documents. Existing files need no manual renaming and adopt the new name/type on their next save.

Open a team through its Consilium link, its Drive file link, or **Browse team files**. Only the team document needs authorization to view the roster and maps. Selecting a profile automatically checks existing access; **Connect player file** opens Picker only if that linked file needs authorization. **Check editing access** rechecks Drive permissions directly. Picker does not grant Editor access. Administrators see a targeted folder picker only when creating a player requires authorizing the central folder. Opening an empty roster does not start creation. **Add existing player file** explicitly imports one profile; background refresh never creates roster membership or reverses Undo.

Use **Share this team** on the Team screen for the app link and Drive sharing links. Share the folder as Viewer with ordinary members, then grant Editor access to each member's own player file. Give planners Editor access to the team document; they can manage maps and roster membership but need folder permission to create new files. A trusted administrator can have Editor access to the folder, which also permits editing its player files. Alt ownership is a roster relationship, not a Drive permission.

**Save team** publishes team settings, roster membership, subcities, and formations. **Save player** publishes all profile fields, statistics, avatar, and castle. Profile drafts survive navigation and reloads on the same device, separately from team drafts. **Undo team** reverses team edits and never rolls back a saved player profile. New profile files are created immediately; adding their membership still requires Save team. Undoing that addition retains the standalone file for a deliberate import later.

Accessible player files refresh for viewers as well as editors, even while a team draft is unsaved. A team editor publishes source caches separately without including local planning edits. Viewers without source authorization see the last shared cache and its timestamp. All writes use conditional Drive uploads; independent team edits merge, and overlapping edits open a conflict review. Player fields merge independently, with marches treated as complete arrays. These are separate documents, so a source save can succeed while cache publication waits for access or conflict resolution.

Subcities have their own tab between Players and Maps. Team editors add or edit fixed server coordinates from a squircle card grid and choose culture and color through a visual castle chooser with search and filters. Red subcities are selected by their specific Historic or Cultural (Famous) city name, with artwork generated from the pinned client snapshot. Each city has an optional player owner. Set it in the city editor or manage owned cities from the player’s Subcities tab; unlinking retains the city, and deleting a player clears their ownership links. Ownership is team data, so edits require team write access and use the team Save button. Viewers can inspect the records.

The Team dashboard includes Players, Subcities, and Maps counts. The header distinguishes unsaved team edits from saved or read-only team state. Subcities can be searched and filtered by culture, color, and owner; located cities appear as fixed markers on Server maps. **Locate on map** opens an existing Server map centered on the city. Ownership remains separate from formation placement.

Screen, player, and map navigation is reflected in the URL. Browser Back restores the previous view, and opening a team link after sign-in restores its requested view subject to the usual Drive permissions.

## Features

- Team dashboard: editable name/logo, optional Discord chat link, and player/map counts.
- Players: names, per-player alliance tags, optional account ID **strings** (preserves leading zeros), keep levels, avatars, and castle sprites/tiers. Dedicated profile tabs track In-City/In-Rally/Solo buffs, march sizes at a fixed +200% boost, named attack-march layers (T16 at K45 and T17 at K50), and rally capacity. Base-layer counts apply to every lower tier (T1–T9 by default). Blank statistics remain unknown; entered zeros are preserved.
- Visual browser: all 220 configured keep-decoration records and nine alliance glory skin records, with duration duplicates merged. Culture castles have their own filter. Decoration filters use Activity, Collection, Excellent and Champion. Upgrade tiers share one castle entry with a tier popup; alternate designs have independent entries. Three historical Elegant Noble variants have unavailable resources and are shown explicitly as unavailable. Additional sprites can be imported.
- Server hive, BoC, BoG, Chalons, All-Stars, Civilization Battlefield, and Toulon contexts; custom battlefield entries for future modes.
- Drag keeps onto a skewed grid; enter exact coordinates; pan, zoom, fit a formation, or see the entire planning extent. Arrow keys move selected unlocked keeps.
- One compact formation: Arrange packs higher keep levels nearest the rally setter’s current position, without configurable gaps or a separate center. The highest keep is the default rally setter; a hover or long-press star selects another, independently per map. Locked keeps and occupied footprints are respected.
- Alliance castle type/location, warehouse, farm and other resource tiles, server landmarks (Throne, catapults, towers, temples and altars), battlefield objectives, and blocked tiles; configured castle/objective footprints; their dimensions are read-only. “Use game size” restores the configured size of an existing building without allowing overlaps.
- Shared Drive project folders, account-scoped remembered projects in localStorage, IndexedDB draft autosave, explicit Drive saves with version checks, Undo.
- Map screenshot imports, adjustable grid axes, and background image alignment for current battlefield references.
- Responsive desktop/mobile layout.

Keep level is a ranking proxy, not a combat-power calculation. Culture castle appearance follows keep level automatically. Premium castle upgrade tiers remain a manual choice. Account IDs and imported images are included in local drafts and formations saved to the shared project folder.

## Deploy to github.io

```sh
npm run build
```

`npm run build` downloads cached public resources, regenerates every required game catalog and image, verifies their file references, and writes a complete static site to `dist/`. It requires the Python environment from the Run instructions and the Node dependencies. Set `ASSET_PYTHON` to use another Python interpreter with the asset package installed. Build failures stop deployment. Asset paths are relative, so both user Pages sites and repository sites such as `https://USERNAME.github.io/evony-consilium/` work.

The included `.github/workflows/pages.yml` builds and deploys pushes to `master` or `main`. In the GitHub repository, set **Settings → Pages → Build and deployment → Source → GitHub Actions**. This work has not been pushed or published. [GitHub's workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Graphics acquisition

See [the asset investigation](docs/asset-research.md) for verified URLs, findings, limitations, and how to obtain newer resources from an installed client.

The current downloader uses public CDN manifests and configuration archives; no installed game is required. The legacy extractor supplies background and resource tiles, followed by the current castle extractor. Run `npm install` first for the offline Spine renderer. The deployed app has no Spine runtime dependency. Use Python 3.12 and a separate virtual environment. The editable install provides the `consilium_assets` package imported by the extraction scripts, including UnityPy 1.25.4, Pillow, Brotli, and NumPy:

```sh
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -e .
.venv/bin/python scripts/extract-assets.py --download --bundles-dir .asset-cache/legacy
.venv/bin/python scripts/fetch-current-assets.py
.venv/bin/python scripts/extract-current-castles.py --bundles .asset-cache/current/decoded --config .asset-cache/current/config
```

`npm run assets` runs the acquisition coordinator with `--avatars`, `--terrain`, and `--icons` for local development. `npm run build` runs the same complete sequence in a fresh temporary directory, so an old generated catalog cannot supply missing build inputs. The individual Python commands remain available for investigation.

Or extract bundles from local client files:

```sh
.venv/bin/python scripts/extract-assets.py --bundles-dir /path/to/bundles
.venv/bin/python scripts/extract-assets.py --apk /path/to/Evony.apk
```

Downloaded bundles are cached under `.asset-cache/` (ignored by git), with legacy WebGL inputs isolated under `.asset-cache/legacy/`. Generated content under `web/assets/` is ignored too; only maintained branding and the authored unavailable-preview SVG are tracked. Extraction writes WebP sprites and `web/assets/catalog.json`, which records original Unity paths, bundle names, source sizes, and SHA-256 digests. Local sprite import is also available directly in the application.

Evony graphics belong to Top Games Inc. Public download availability is not a redistribution license. No permission to redistribute the original graphics was verified. The app is unofficial; code and third-party game graphics should be treated separately.

## Verification

```sh
npm run format:check
npm test
npm run build
ASSET_ROOT=dist npm run test:assets
npm run assets
npm run test:browser
.venv/bin/python -m unittest discover -s tests/assets
```

`npm test` uses authored synthetic fixtures and runs without downloaded assets. `npm run test:assets` verifies the generated snapshot inventory, image availability, terrain grids, and native anchors; it defaults to `web/`, or checks the production site with `ASSET_ROOT=dist`. Python unit tests also run without downloads. Browser checks require `npm run assets` first, or `SERVE_DIR=dist` after a build. Pull-request checks and Pages deployment run the browser workflows against the built site.

The browser check launches `/usr/bin/google-chrome`; set `CHROME_PATH` if needed. It starts its own test server on port 4174. Tests cover domain rules, isolated profile edits, independent map layouts, state ownership and Undo, validation, persistence ordering, remote revision races, real dragging, manual placement, map selection, and mobile overflow. Browser scenarios are organized by workflow under `tests/browser/`. Google services are mocked; live OAuth still needs a configured deployment. Screenshots are written to `test-results/` (ignored). Run `npm run format` to format maintained source and documentation; generated assets and private configuration are excluded.

Player management and map planning are separate team screens. Players handles player names, IDs, levels, castles, and avatars. Map & formation handles keep placement, rally selection, automatic layouts, buildings, and terrain. Unplacing a keep preserves its player entry. Team edits use Save team and Undo team; profile edits use a separate Save player workflow.

## Structure

- `web/app.js`: small browser entry point.
- `web/src/domain/`: plan rules, map definitions, castle appearances, player statistics, and Drive-link validation.
- `web/src/application/`: authoritative team state, atomic edits, Undo, and subscriptions.
- `web/src/ui/`: focused team, player, and map controllers, catalog browsers, map interaction, and DOM helpers.
- `web/src/rendering/`: Canvas map rendering.
- `web/src/services/`: startup resources, team file loading, save/reload state, and shared revision checks.
- `web/styles/entry.css`: login, project selection, account menu, and progress styling.
- `web/src/services/google/`: OAuth session, Drive transport, Picker, and shared scope definitions.
- `web/src/persistence/`: IndexedDB drafts, serialized draft saves, and remembered project folders.
- `web/src/io/`: browser file imports.
- `web/assets/`: generated game resources and catalog data.
- `scripts/`: static build/dev server, policy page generation, and offline asset acquisition/assembly.
- `src/consilium_assets/`: installable Python package imported by the asset scripts. It holds the pinned snapshot, container and configuration readers, catalog rules, and the export routines. The scripts are the commands for those routines.
- `tests/`: domain/service unit tests and browser workflow checks.

See [the architecture guide](docs/architecture.md) for module boundaries, state ownership, and extension guidance. The build copies maintained source and branding to `dist/`, then generates game resources there; native browser modules need no runtime bundler.

The app uses optional Google Fonts for typography, with local system font fallbacks. It makes no calls to game servers at runtime.

## Privacy and terms

[PRIVACY.md](PRIVACY.md) and [TERMS.md](TERMS.md) are the policy source documents. Development serving and production builds provide readable `privacy.html` and `terms.html` pages, linked from the entry screen and About dialog. For a repository Pages deployment, set Google branding's policy URLs to `https://halfline.github.io/evony-consilium/privacy.html` and `https://halfline.github.io/evony-consilium/terms.html`, adjusting the path to the actual published repository or custom domain. The documents use the user-support email on the Google consent screen as the privacy/terms contact. Update them when deployed features or data practices change.

Maps use a separate list and editor from Players. Add a map by choosing its type and formation name: Server defaults to **Hive**, and battlefields default to **Rally**. Names can be changed freely. Each map retains its own placements, buildings, tiles, and background while sharing the project’s players. Opening an empty Maps screen starts the Add Map dialog.

Add Player offers castle and avatar pickers side by side. Avatars can be searched by name and filtered by portrait category, and changed later in the Players editor. To regenerate the portrait catalog from the cached snapshot, run `.venv/bin/python scripts/extract-avatars.py --bundles .asset-cache/current/decoded --config .asset-cache/current/config`.

To regenerate terrain after fetching the pinned bundles:

```sh
python scripts/extract-terrain.py --bundles .asset-cache/current/decoded
```

The terrain extractor uses the same `consilium-assets` install as the castle extractor.

Attack marches inherit the player's per-type +200% march capacity, with an optional capacity override for each general's march. Strategies reserve supporting layers before distributing the remaining capacity. Ground/Mounted use 30/50/20 across the highest three tiers; Archers emphasize T12, while Siege offers T11-heavy small siege and T13-heavy big siege. Percentages, support-layer size, and highest tier are editable. Any direct troop/base edit freezes the whole march against automatic regeneration; Reset to strategy clears those edits. Capacity changes continue to show unused space or overflow. Existing manually entered marches are preserved.
