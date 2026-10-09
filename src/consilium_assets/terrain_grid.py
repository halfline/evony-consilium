"""Pure Tiled-grid decoding and fixed server landmark placement."""

import base64
import gzip

import numpy as np

# Center coordinates are fixed across servers and were confirmed by the project owner.
SERVER_LANDMARKS = (
    ("kingdom", "City of Throne", 600, 600, 5),
    ("worldbuilding-huntingshrin", "Hunter Temple", 299, 899, 4),
    ("worldbuilding-harvestshrin", "Harvest Temple", 299, 299, 4),
    ("worldbuilding-fireshrin", "Forging Temple", 899, 299, 4),
    ("worldbuilding-wizardtower", "Magic Tower", 606, 606, 4),
    ("worldbuilding-samuraitower", "Hero Tower", 593, 593, 4),
    ("worldbuilding-mangonelright", "Throne Tower Catapult", 606, 593, 4),
    ("worldbuilding-mangonelleft", "Throne Tower Catapult", 593, 606, 4),
    ("triumph", "Arch of Triumph", 600, 607, 3),
)

SERVER_FOREGROUND = [
    {
        "x": 594,
        "y": 594,
        "w": 13,
        "h": 13,
        "exclude": {"x": 597, "y": 597, "w": 7, "h": 7},
    }
]


def decode_tile_values(text, encoding, width, height):
    """Decode one Tiled layer to a flat grid of tile ids."""
    if encoding == "csv":
        values = np.fromstring(text.strip(), sep=",", dtype=np.uint32)
    else:
        decoded = gzip.decompress(base64.b64decode(text))
        if encoding == "base64_1":
            values = np.fromstring(decoded.decode(), sep=",", dtype=np.uint32)
        else:
            values = np.frombuffer(decoded, dtype=np.uint8)
    if len(values) != width * height or values.max() > 255:
        raise ValueError("Unexpected tile encoding")
    return values


def landmark_record(skin, label, x, y, size):
    """Place a fixed landmark so its center sits on the confirmed coordinate."""
    origin = (size - 1) // 2
    return {
        "id": "terrain-" + skin,
        "name": label,
        "skin": "map-" + skin,
        "x": x - origin,
        "y": y - origin,
        "w": size,
        "h": size,
        "groundTile": None if skin == "kingdom" else 76,
        "locked": True,
        "coordinate": {"x": x, "y": y},
        "coordinateSource": "Fixed server coordinates confirmed by the project owner",
    }
