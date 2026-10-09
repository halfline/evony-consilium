"""Tile grids and original map sprites for the planner."""

import hashlib
from pathlib import Path
from xml.etree import ElementTree

import numpy as np
import UnityPy
from PIL import Image

from consilium_assets.json_file import write_json
from consilium_assets.snapshot import ANDROID_BUNDLES, SNAPSHOT
from consilium_assets.terrain_grid import (
    SERVER_FOREGROUND,
    SERVER_LANDMARKS,
    decode_tile_values,
    landmark_record,
)

MAP_FILES = {
    "server": "WorldMap",
    "boc": "BattleField",
    "bog": "BattleField2",
    "chalons": "BattleField4",
    "allstars": "BattleField_AllStar",
    "civilization": "BattleField_PvpCivilizationClash",
    "toulon": "BattleField",
}


def _text_assets(bundle):
    texts = {}
    for obj in UnityPy.load(str(bundle)).objects:
        if obj.type.name == "TextAsset":
            text = obj.read()
            texts[text.m_Name] = text.m_Script
    return texts


def _world_sprites(bundle):
    environment = UnityPy.load(str(bundle))
    return {
        path: ref
        for path, ref in environment.container.items()
        if ref.type.name == "Sprite" and "/sprite/worldmap/" in path
    }


def _source_record(bundle):
    return {
        "file": bundle.name,
        "sha256": hashlib.sha256(bundle.read_bytes()).hexdigest(),
        "url": ANDROID_BUNDLES + bundle.name,
        "hashOf": "decoded Unity bundle",
    }


def _tiles_for(tileset, sprites, exported, output):
    first = int(tileset.attrib["firstgid"])
    sheet = tileset.attrib["name"].lower()
    terrain_types = [
        terrain.find("properties/property[@name='type']").attrib["value"]
        for terrain in tileset.findall("terraintypes/terrain")
    ]
    tiles = {}
    blocked_ids = set()
    for tile in tileset.findall("tile"):
        tile_id = int(tile.attrib["id"])
        gid = first + tile_id
        path = f"assets/packageres/raw/sprite/worldmap/{sheet}/{tile_id:02}.png"
        if path in sprites:
            filename = f"{sheet}-{tile_id:02}.webp"
            if filename not in exported:
                image = sprites[path].deref_parse_as_object().image.convert("RGBA")
                image.save(output / filename, "WEBP", lossless=True)
                exported[filename] = image
            image = exported[filename]
            tiles[gid] = {
                "src": "assets/terrain/" + filename,
                "width": image.width,
                "height": image.height,
            }
        kinds = [
            terrain_types[int(index)]
            for index in tile.attrib.get("terrain", "").split(",")
            if index
        ]
        if "invisible" in kinds and gid not in tiles:
            tiles[gid] = {"invisible": True}
        if "stop" in kinds:
            blocked_ids.add(gid)
    return tiles, blocked_ids


def _overview_color(overview, grid, gid, tiles, exported):
    if not gid or tiles[int(gid)].get("invisible"):
        return
    image = exported[Path(tiles[int(gid)]["src"]).name]
    # The low-zoom overview uses original-tile colors at exact grid coordinates.
    sample = np.array(image.resize((16, 16)))
    opaque = sample[:, :, 3] > 160
    if opaque.any():
        overview[grid == gid] = sample[:, :, :3][opaque].mean(axis=0).astype(np.uint8)


def _write_map(key, name, root, sprites, exported, output):
    width, height = int(root.attrib["width"]), int(root.attrib["height"])
    tiles = {}
    blocked_ids = set()
    for tileset in root.findall("tileset"):
        sheet_tiles, sheet_blocked = _tiles_for(tileset, sprites, exported, output)
        tiles.update(sheet_tiles)
        blocked_ids.update(sheet_blocked)
    layers = []
    binary = bytearray()
    blocked = np.zeros(width * height, dtype=np.uint8)
    overview = np.zeros((height, width, 3), dtype=np.uint8)
    for layer in root.findall("layer"):
        data = layer.find("data")
        values = decode_tile_values(
            data.text, data.attrib.get("encoding"), width, height
        )
        missing = {int(value) for value in np.unique(values) if value} - tiles.keys()
        if missing:
            raise ValueError(f"Missing sprites for {key}: {missing}")
        layers.append({"name": layer.attrib["name"], "offset": len(binary)})
        binary.extend(values.astype(np.uint8).tobytes())
        blocked |= np.isin(values, list(blocked_ids)).astype(np.uint8)
        grid = values.reshape(height, width)
        for gid in np.unique(values):
            _overview_color(overview, grid, gid, tiles, exported)
    blocked_offset = len(binary)
    binary.extend(blocked.tobytes())
    (output / (key + ".bin")).write_bytes(binary)
    Image.fromarray(overview).save(
        output / (key + "-overview.webp"), "WEBP", quality=90
    )
    print(key, width, height, "blocked", int(blocked.sum()), flush=True)
    return {
        "file": name,
        "width": width,
        "height": height,
        "extent": width - 1,
        "src": "assets/terrain/" + key + ".bin",
        "overview": "assets/terrain/" + key + "-overview.webp",
        "layers": layers,
        "blockedOffset": blocked_offset,
        "tiles": tiles,
        "landmarks": [],
    }


def extract_terrain(bundles, output):
    """Write terrain binaries, tile sprites, overviews, and manifest.json."""
    output.mkdir(parents=True, exist_ok=True)
    bundle = next(bundles.glob("map-data_*"))
    sprite_bundle = next(bundles.glob("map-sprite-common_*"))
    texts = _text_assets(bundle)
    sprites = _world_sprites(sprite_bundle)
    exported = {}
    manifest = {
        "snapshot": SNAPSHOT,
        "maps": {},
        "sources": [_source_record(path) for path in (bundle, sprite_bundle)],
    }
    for key, name in MAP_FILES.items():
        root = ElementTree.fromstring(texts[name])
        manifest["maps"][key] = _write_map(key, name, root, sprites, exported, output)
    manifest["maps"]["server"]["landmarks"] = [
        landmark_record(*landmark) for landmark in SERVER_LANDMARKS
    ]
    manifest["maps"]["server"]["foregroundRegions"] = SERVER_FOREGROUND
    write_json(output / "manifest.json", manifest)
    return manifest
