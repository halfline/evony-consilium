"""Classify the public WebGL sprite inventory."""

import re
from consilium_assets.snapshot import CULTURES


def classify_legacy_sprite(path):
    """Return catalog fields for a legacy WebGL sprite, or None when it is skipped."""
    path = path.lower()
    if not any(
        part in path for part in ("/sprite/map/", "/sprite/worldmap/", "/uithumbmap/")
    ):
        return None
    if "/guildflag/" in path or "/mapanim/" in path:
        return None
    short = path.split("/sprite/", 1)[-1]
    key = re.sub(r"[^a-z0-9_-]+", "-", short.rsplit(".", 1)[0]).strip("-")
    name = path.rsplit("/", 1)[-1].rsplit(".", 1)[0]
    kind = "decoration"
    label = name.replace("_", " ").title()
    tier = 1
    family = key
    culture = None
    match = re.search(r"/evony(\d)/castle_lv(\d+)\.", path)
    if match:
        culture = CULTURES[int(match[1])]
        tier = int(match[2])
        family = "culture-" + culture.lower()
        label = culture
        kind = "keep"
    elif (
        "/castle_model/" in path
        and name.startswith("town_")
        and "barbarian" not in name
    ):
        kind = "keep"
        label = name.removeprefix("town_").replace("_", " ").title()
    elif name in ["castle_gold", "castle_prosperitycity"]:
        kind = "keep"
    elif "guild" in name and "castle" in name:
        kind = "alliance"
    elif "warehouse" in name:
        kind = "warehouse"
    elif name.startswith("world_") and any(
        part in name for part in ("food", "corn", "wood", "stone", "iron")
    ):
        kind = "resource"
    elif "/worldmap/" in path:
        kind = "terrain"
    elif "/uithumbmap/" in path and name.startswith(("thumbmap", "pvemap", "boc")):
        kind = "overview"
    elif "/battlefield/" in path and "/icon/" not in path:
        kind = "objective"
    if kind == "decoration":
        return None
    if kind == "objective" and re.search(r"_icon\d*$", name):
        return None
    return {
        "id": key,
        "name": label,
        "family": family,
        "tier": tier,
        "culture": culture,
        "kind": kind,
        "unityPath": path,
    }
