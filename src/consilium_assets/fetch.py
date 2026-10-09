"""Select pinned resource bundles from protobuf dependencies."""

from consilium_assets.config_protobuf import fields

DIRECT_BUNDLES = {
    "prefab-map-kingdom",
    "prefab-map-resource",
    "map-data",
    "map-sprite-common",
    "map-sprite-famouscity",
    "mainui",
    "ui-icon-menu",
    "ui-army-icon-early",
}


def dependency_index(table):
    """Map a bundle name to the bundle names it lists as dependencies."""
    bundles = {}
    for row in fields(table)[1]:
        record = fields(row)
        name = record[1][0].decode().rsplit("/", 1)[-1]
        bundles[name] = [item.decode().rsplit("/", 1)[-1] for item in record.get(5, [])]
    return bundles


def select_bundles(manifest, dependencies, *, all_dependencies=False):
    """Castle bundles plus their direct dependencies.

    ``all_dependencies`` follows the whole graph, including UI and particles.
    Fixed server bundles stay selected even when the manifest has not listed
    them yet; fetching then reports that mismatch.
    """
    names = {name for name in manifest if "castle" in name} | set(DIRECT_BUNDLES)
    pending = list(names)
    while pending:
        for name in dependencies.get(pending.pop(), []):
            if name in manifest and name not in names:
                names.add(name)
                if all_dependencies:
                    pending.append(name)
    return names
