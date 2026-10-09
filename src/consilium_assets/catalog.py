"""Catalog rules derived from client configuration, independent of Unity rendering."""

import hashlib
import re
from pathlib import Path

from consilium_assets.config_protobuf import rows, value
from consilium_assets.culture_growth import CULTURE_GROWTH
from consilium_assets.snapshot import (
    ANDROID_BASE,
    CONFIG_ARCHIVE,
    RESOURCE_MANIFEST,
    SNAPSHOT,
)

_TRACKED_CONFIG = (
    "CastleDressUpConfig.bytes",
    "GuildCastleSkinConfig.bytes",
    "CastleDressUpgradeConfig.bytes",
    "WorldBuildingConfig.bytes",
    "en-US.bytes",
)


def apply_castle_upgrade_groups(catalog, config):
    upgrades = {
        value(record, 102): value(record, 101)
        for record in rows(config / "CastleDressUpgradeConfig.bytes")
    }
    for asset in catalog["assets"]:
        asset.pop("upgradeGroup", None)
        if asset["kind"] != "keep":
            continue
        groups = {
            upgrades[game_id]
            for game_id in asset.get("gameIds", [])
            if game_id in upgrades
        }
        if len(groups) == 1:
            asset["upgradeGroup"] = "castle-upgrade-" + str(next(iter(groups)))


def apply_objective_config(entries, config, language):
    """BattlefieldConfig.range is returned by GetBattleBuildingGridCount."""
    records = rows(config / "BattlefieldConfig.bytes")
    for asset in entries.values():
        if asset["kind"] != "objective":
            continue
        basename = re.sub(r"_icon\d*$", "", Path(asset["unityPath"]).stem.lower())
        matches = [
            record
            for record in records
            if value(record, 116, "").rsplit("/", 1)[-1].lower() == basename
        ]
        if not matches:
            continue
        # Shared building graphics must agree on their occupied grid width.
        sizes = {value(record, 121) for record in matches}
        if len(sizes) != 1:
            raise ValueError("Ambiguous battlefield footprint: " + basename)
        record = matches[0]
        asset["footprint"] = sizes.pop()
        asset["gameIds"] = [value(match, 101) for match in matches]
        asset["name"] = language.get(value(record, 102), value(record, 102))
        asset["footprintSource"] = "BattlefieldConfig.range"
        if "_icon" in Path(asset["unityPath"]).stem.lower():
            asset["name"] += " (icon)"


def apply_castle_categories(catalog, config, language):
    records = rows(config / "CastleDressUpConfig.bytes")
    categories = {}
    for record in records:
        if value(record, 101) != 1 or value(record, 107) != "Prefabs/Skin/UINormal":
            continue
        code = value(record, 102)
        localization_key = value(record, 120)
        name = language[localization_key]
        categories[code] = {
            "id": re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-"),
            "name": name,
            "gameCategory": code,
            "localizationKey": localization_key,
        }
    if not categories:
        raise ValueError("No castle categories in client configuration")
    by_game_id = {
        value(record, 103): value(record, 102)
        for record in records
        if value(record, 101) == 1
    }
    catalog["keepCategories"] = [{"id": "culture", "name": "Culture"}] + [
        categories[code] for code in sorted(categories)
    ]
    for asset in catalog["assets"]:
        if asset["kind"] != "keep":
            continue
        if asset.get("culture"):
            asset["categories"] = ["culture"]
            continue
        codes = sorted(
            {
                by_game_id[game_id]
                for game_id in asset.get("gameIds", [])
                if game_id in by_game_id
            }
        )
        asset["categories"] = [categories[code]["id"] for code in codes]


def apply_culture_growth(entries, config):
    """Apply observed client growth rules, overridden by supplied config rows."""
    ranges = CULTURE_GROWTH
    growth = {}
    art = config / "WorldMapArtResource.bytes"
    for record in rows(art) if art.exists() else []:
        if value(record, 1) != 1 or not value(record, 104):
            continue
        sprite = value(record, 104).lower().removesuffix(".png")
        key = "map-" + sprite.rsplit("/map/", 1)[-1].replace("/", "-")
        growth.setdefault(key, []).append(value(record, 3))
    for asset in entries.values():
        if not asset.get("culture"):
            continue
        bounds = next(
            (item for item in ranges if item["spriteTier"] == asset["tier"]), None
        )
        if bounds:
            asset.update(
                minKeepLevel=bounds["minKeepLevel"],
                maxKeepLevel=bounds["maxKeepLevel"],
                footprint=2,
            )
    for key, levels in growth.items():
        if key in entries:
            entries[key].update(minKeepLevel=min(levels), maxKeepLevel=max(levels))


def mark_legacy_assets(entries, audit, *, server_only):
    """Mark sprite-only decorations and attach current building aliases."""
    ids = {item["asset"] for item in audit}
    for asset in entries.values():
        if (
            not server_only
            and asset["kind"] in ("keep", "alliance")
            and asset["id"] not in ids
            and not asset.get("culture")
            and asset["id"] != "map-world_castle_guild"
        ):
            asset["legacyOnly"] = True
        elif asset["id"] == "map-world_castle_guild":
            asset.pop("legacyOnly", None)
            asset["name"] = "Alliance Castle"
            asset["footprint"] = 2
            asset["footprintSource"] = "GuildCastleObject.edgeGridCount"
        if asset["kind"] == "alliance" and asset["id"] in ids:
            asset["footprintSource"] = "GuildCastleSkinConfig.size"
            asset["aliases"] = [
                "Chalons Alliance Glory Castle",
                "Alliance Glory Castle",
                "Battle of Chalons",
            ]
        if asset.get("family") == "keep-arcanum-athenaeum":
            asset["aliases"] = ["Arcanium Athenaeum"]


def current_sources(config):
    return {
        "resourceVersion": SNAPSHOT,
        "configUrl": ANDROID_BASE + CONFIG_ARCHIVE,
        "manifestUrl": ANDROID_BASE + RESOURCE_MANIFEST,
        "configSha256": {
            path.name: hashlib.sha256(path.read_bytes()).hexdigest()
            for path in config.glob("*.bytes")
            if path.name in _TRACKED_CONFIG
        },
    }
