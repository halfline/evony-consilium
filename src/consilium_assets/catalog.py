"""Catalog rules derived from client configuration, independent of Unity rendering."""

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
