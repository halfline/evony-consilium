"""Translate client prefab configuration into extraction records and catalog entries."""

import re
from consilium_assets.config_protobuf import rows, value
from consilium_assets.snapshot import CULTURES


def upgrade_tiers(config):
    return {
        value(record, 102): value(record, 104)
        for record in rows(config / "CastleDressUpgradeConfig.bytes")
    }


def configuration_records(config, language, *, server_only=False):
    """Keep, alliance, and fixed server prefab records in extraction order."""
    records = []
    if not server_only:
        for record in rows(config / "CastleDressUpConfig.bytes"):
            if 112 not in record:
                continue
            records.append(
                {
                    "gameId": value(record, 103),
                    "name": language.get(value(record, 108), value(record, 108)),
                    "path": value(record, 112),
                    "kind": "keep",
                    "footprint": value(record, 124, 2),
                    "gameCategory": value(record, 102),
                }
            )
        for record in rows(config / "GuildCastleSkinConfig.bytes"):
            records.append(
                {
                    "gameId": value(record, 101),
                    "name": language.get(value(record, 103), value(record, 103)),
                    "path": value(record, 105),
                    "kind": "alliance",
                    "footprint": value(record, 117),
                }
            )
    records.extend(_server_records(config, language))
    return records


def _server_records(config, language):
    records = [
        {
            "gameId": 0,
            "name": "City of Throne",
            "path": "Prefabs/Map/kingdom",
            "kind": "objective",
            "footprint": 5,
        },
        {
            "gameId": -1,
            "name": "Arch of Triumph",
            "path": "Prefabs/Map/triumph",
            "kind": "objective",
            "footprint": 3,
        },
    ]
    for record in rows(config / "WorldBuildingConfig.bytes"):
        game_id = value(record, 101)
        if game_id not in range(21, 39):
            continue
        name = language.get(value(record, 102), value(record, 102))
        path = value(record, 108)
        for suffix in ["Left", "Right"] if game_id == 24 else [""]:
            records.append(
                {
                    "gameId": game_id,
                    "name": name + (" - " + suffix if suffix else ""),
                    "path": path + suffix,
                    "kind": "objective",
                    "footprint": 4 if game_id <= 26 else 3,
                }
            )
    return records


def prefab_variations(record):
    return range(1, 8) if "{0}" in record["path"] else [None]


def excluded_prefab_nodes(record):
    if record["kind"] == "objective" and record["gameId"] == 24:
        return {"AtkRoot", "FxGrid"}
    if record["kind"] == "objective" and record["gameId"] == 0:
        return {"mask"}
    return set()


def prefab_path(record, culture, container):
    path = (
        "assets/packageres/raw/"
        + record["path"].replace("{0}", str(culture)).lower()
        + ".prefab"
    )
    if path not in container and "/castle_model/" in path:
        alternative = path.replace("/castle_model/", "/")
        if alternative in container:
            return alternative
    return path


def decoration_names(record_name, culture):
    name = re.sub(
        r"\s*\((?:\d+ days?|Permanent).*?\)$", "", record_name, flags=re.IGNORECASE
    )
    family = name.split(" - ")[0].removesuffix(" Decoration")
    variant = name.split(" - ", 1)[1] if " - " in name else "Standard"
    if culture:
        variant = CULTURES[culture]
    return family, variant


def catalog_entry(record, path, bundle, culture, tier):
    family_name, variant = decoration_names(record["name"], culture)
    family = (
        record["kind"]
        + "-"
        + re.sub(r"[^a-z0-9]+", "-", family_name.lower()).strip("-")
    )
    short = path.split("/prefabs/", 1)[1].removesuffix(".prefab")
    key = re.sub(r"[^a-z0-9_-]+", "-", short)
    asset = {
        "id": key,
        "name": family_name,
        "variantName": variant,
        "family": family,
        "tier": tier,
        "culture": None,
        "kind": record["kind"],
        "src": "assets/" + key + ".webp",
        "gameIds": [record["gameId"]],
        "footprint": record["footprint"],
        "unityPath": path,
        "bundle": bundle,
    }
    if record["kind"] == "objective":
        asset.update(
            mapContext="server",
            footprintSource="Android 5.35.1 MapObject constructor gridCount",
        )
        if record["gameId"] == 24:
            asset["aliases"] = ["Catapult", "Throne Catapult"]
        if record["gameId"] in range(31, 39):
            asset["variantName"] = record["path"][-1]
            asset["tier"] = int(record["path"][-1])
        if record["gameId"] == 0:
            asset["aliases"] = ["Throne", "Server Throne", "Throne Castle"]
    return asset
