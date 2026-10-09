"""Assemble static castle previews from current public client prefabs and config.
Requires the consilium-assets package and npm install. See asset-research.md.
"""

import json

import numpy as np
import UnityPy

from consilium_assets.catalog import (
    apply_castle_categories,
    apply_castle_upgrade_groups,
    apply_culture_growth,
    apply_objective_config,
    current_sources,
    mark_legacy_assets,
)
from consilium_assets.prefab_reader import PrefabReader
from consilium_assets.raster import raster, expand_layers, temple_anchor
from consilium_assets.spine import spine_geometry
from consilium_assets.prefab_catalog import (
    catalog_entry,
    configuration_records,
    excluded_prefab_nodes,
    prefab_path,
    prefab_variations,
    upgrade_tiers,
)
from consilium_assets.json_file import write_json
from consilium_assets.culture_growth import (
    CULTURE_GROWTH,
    CULTURE_GROWTH_SOURCE,
    CULTURE_GROWTH_SHA256,
)
from consilium_assets.snapshot import SNAPSHOT, parse_language


def _sprite_candidates(container, predicate, suffixes):
    return [
        (path, ref)
        for path, ref in container.items()
        if ref.type.name == "Sprite" and predicate(path) and path.endswith(suffixes)
    ]


def fallback_sprite(container, record):
    """Original world sprite, then UI icon, when a prefab has nothing to rasterize."""
    basename = record["path"].rsplit("/", 1)[-1].lower()
    bare = basename.removeprefix("town_")
    candidates = _sprite_candidates(
        container,
        lambda path: (
            "/castle_model/" in path
            or (record["kind"] == "objective" and "/worldbuilding/" in path)
        ),
        ("/" + basename + ".png", "/" + bare + ".png"),
    )
    if not candidates:
        candidates = _sprite_candidates(
            container,
            lambda path: "/castle_icon/" in path,
            (
                "/" + basename + "_icon.png",
                "/icon_" + basename + ".png",
                "/icon_" + bare + ".png",
            ),
        )
    if not candidates:
        return None
    path, ref = candidates[0]
    status = (
        "sprite"
        if "/castle_model/" in path or record["kind"] == "objective"
        else "icon"
    )
    return ref, status, basename


def mark_unavailable(asset, basename):
    asset.update(
        unavailable=True,
        src="assets/branding/unavailable.svg",
        width=280,
        height=220,
        variantName=basename.removeprefix("town_").title(),
        renderSource="unavailable",
    )


def extract(args, spine_renderer):
    env = UnityPy.load(str(args.bundles))
    container = {p.lower(): r for p, r in env.container.items()}
    cache = args.cache
    reader = PrefabReader(cache)

    language = parse_language((args.config / "en-US.bytes").read_text())
    records = configuration_records(args.config, language, server_only=args.server_only)
    upgrades = upgrade_tiers(args.config)
    catalog = json.loads((args.output / "catalog.json").read_text())
    entries = {asset["id"]: asset for asset in catalog["assets"]}
    apply_objective_config(entries, args.config, language)
    apply_culture_growth(entries, args.config)
    write_json(
        args.output / "culture-growth.json",
        {
            "source": CULTURE_GROWTH_SOURCE,
            "sourceSha256": CULTURE_GROWTH_SHA256,
            "ranges": CULTURE_GROWTH,
        },
    )
    pending = []
    for record in records:
        excluded_nodes = excluded_prefab_nodes(record)
        for culture in prefab_variations(record):
            path = prefab_path(record, culture, container)
            layers = []
            reference = container.get(path)
            if reference:
                reader.collect(
                    reference.deref_parse_as_object(), np.eye(3), layers, excluded_nodes
                )
            bundle = reference.deref().assets_file.parent.name if reference else None
            pending.append(
                (
                    record,
                    catalog_entry(
                        record,
                        path,
                        bundle,
                        culture,
                        upgrades.get(record["gameId"], 1),
                    ),
                    layers,
                )
            )
    geometry = spine_geometry(cache, reader.jobs, spine_renderer)
    audit = []
    for record, asset, layers in pending:
        expanded = expand_layers(layers, geometry)
        status = "assembled"
        try:
            if not expanded:
                raise ValueError("No renderable prefab")
            anchor = {}
            image = raster(expanded, reader.images, anchor)
            if record["kind"] == "objective":
                asset["mapAnchor"] = anchor
                if record["gameId"] == 0:
                    asset["mapAnchor"]["footprintFill"] = 0.98
        except ValueError:
            fallback = fallback_sprite(container, record)
            if fallback is None:
                mark_unavailable(asset, record["path"].rsplit("/", 1)[-1].lower())
                entries[asset["id"]] = asset
                audit.append({**record, "asset": asset["id"], "status": "missing"})
                continue
            ref, status, _basename = fallback
            image = ref.deref_parse_as_object().image
        if record["kind"] == "objective" and asset["id"].endswith(
            ("fireshrin", "harvestshrin", "huntingshrin")
        ):
            asset["mapAnchor"] = temple_anchor(image)
        image.save(args.output / (asset["id"] + ".webp"), "WEBP", lossless=True)
        asset.update(width=image.width, height=image.height, renderSource=status)
        if asset["id"] in entries and entries[asset["id"]].get("gameIds"):
            asset["gameIds"] = sorted(
                set(entries[asset["id"]]["gameIds"] + asset["gameIds"])
            )
        entries[asset["id"]] = asset
        audit.append({**record, "asset": asset["id"], "status": status})
    # Assets without a current decoration record are hidden from the browser.
    mark_legacy_assets(entries, audit, server_only=args.server_only)
    catalog["assets"] = sorted(
        entries.values(),
        key=lambda asset: (asset["kind"], asset["name"], asset["tier"]),
    )
    apply_castle_categories(catalog, args.config, language)
    apply_castle_upgrade_groups(catalog, args.config)
    catalog["currentSources"] = current_sources(args.config)
    (cache / "extraction-warnings.json").write_text(
        json.dumps(reader.missing, indent=2)
    )
    castle_audit = [item for item in audit if item["kind"] in ("keep", "alliance")]
    server_audit = [item for item in audit if item["kind"] == "objective"]
    catalog["serverAudit"] = {
        "inventory": "assets/server-inventory.json",
        "records": len(server_audit),
        "missingRecords": sum(item["status"] == "missing" for item in server_audit),
    }
    if not args.server_only:
        catalog["castleAudit"] = {
            "keepRecords": 220,
            "allianceRecords": 9,
            "missingRecords": sum(item["status"] == "missing" for item in castle_audit),
            "inventory": "assets/castle-inventory.json",
            "resourceVersion": SNAPSHOT,
        }
        write_json(args.output / "castle-inventory.json", castle_audit)
    write_json(args.output / "catalog.json", catalog)
    write_json(args.output / "server-inventory.json", server_audit)
    print(
        "Records:",
        len(audit),
        "missing:",
        [a["name"] for a in audit if a["status"] == "missing"],
    )
    print("Spine errors:", [r for r in geometry.values() if "error" in r])
    print("Dependency warnings:", len(reader.missing))
