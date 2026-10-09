"""Catalog rules derived from client configuration, independent of Unity rendering."""

import re
from pathlib import Path
from consilium_assets.config_protobuf import rows, value


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
