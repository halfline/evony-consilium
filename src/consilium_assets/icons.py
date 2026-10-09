"""Export named sprites from Brotli-wrapped client bundles."""

import hashlib

import UnityPy

from consilium_assets.brotli_container import decode
from consilium_assets.json_file import write_json
from consilium_assets.snapshot import ANDROID_BUNDLES, SNAPSHOT

MAP_ICONS = {
    "server": ("mainui", "sprite/ui/uimainui/base/icon_earth.png"),
    "boc": ("ui-icon-menu", "sprite/ui/icon/uimenuicon/menu_98.png"),
    "bog": ("ui-icon-menu", "sprite/ui/icon/uimenuicon/menu_99.png"),
    "allstars": ("ui-icon-menu", "sprite/ui/icon/uimenuicon/menu_114.png"),
    "chalons": ("ui-icon-menu", "sprite/ui/icon/uimenuicon/menu_129.png"),
    "civilization": ("ui-icon-menu", "sprite/ui/icon/uimenuicon/menu_178.png"),
}

TROOP_ICONS = {
    "ground": ("ui-army-icon-early", "sprite/ui/icon/armyicon/common/infantry.png"),
    "ranged": ("ui-army-icon-early", "sprite/ui/icon/armyicon/common/archer.png"),
    "mounted": ("ui-army-icon-early", "sprite/ui/icon/armyicon/common/cavalry.png"),
    "siege": ("ui-army-icon-early", "sprite/ui/icon/armyicon/common/siegeengines.png"),
}

TOULON_NOTE = {
    "note": "Toulon uses the Constantinople menu emblem shown in the reference screenshot."
}


def extract_icons(
    bundles, output, icons, *, src_prefix, snapshot=SNAPSHOT, aliases=None
):
    """Write one lossless WebP per icon and a manifest beside them.

    ``icons`` maps an output id to ``(bundle_prefix, unity_path_suffix)``.
    ``aliases`` maps an extra manifest id to ``(source_id, extra_fields)`` and
    reuses that source image. Returns the number of sprites written.
    """
    output.mkdir(parents=True, exist_ok=True)
    environments = {}
    records = {}
    for icon_id, (bundle, suffix) in icons.items():
        if bundle not in environments:
            source = next(bundles.glob(bundle + "_*.brotlii"))
            environments[bundle] = (
                source,
                UnityPy.load(decode(source.read_bytes())),
            )
        source, env = environments[bundle]
        unity_path, sprite = next(
            (path, ref)
            for path, ref in env.container.items()
            if path.lower().endswith(suffix) and ref.type.name == "Sprite"
        )
        image = sprite.deref_parse_as_object().image.convert("RGBA")
        image = image.crop(image.getbbox())
        image.thumbnail((256, 256))
        image.save(output / (icon_id + ".webp"), "WEBP", lossless=True)
        records[icon_id] = {
            "src": src_prefix + icon_id + ".webp",
            "unityPath": unity_path,
            "bundle": source.name,
            "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "url": ANDROID_BUNDLES + source.name,
        }
    for alias, (source_id, extra) in (aliases or {}).items():
        records[alias] = {**records[source_id], **extra}
    write_json(output / "manifest.json", {"snapshot": snapshot, "icons": records})
    return len(icons)


def extract_map_icons(bundles, output):
    return extract_icons(
        bundles,
        output,
        MAP_ICONS,
        src_prefix="assets/map-icons/",
        aliases={"toulon": ("boc", TOULON_NOTE)},
    )


def extract_troop_icons(bundles, output):
    return extract_icons(
        bundles,
        output,
        TROOP_ICONS,
        src_prefix="assets/troop-icons/",
    )
