"""Observed culture appearance rules, documented in docs/asset-research.md.

These rules were checked against Android 5.35.1 WorldMapArtResource.
The public config archive does not contain that table; a local copy can
provide per-sprite overrides in apply_culture_growth.
"""

CULTURE_GROWTH_SOURCE = "WorldMapArtResource TextAsset in Evony Android 5.35.1"
CULTURE_GROWTH_SHA256 = "b20a39d5b7c55fd82dc20db0dc217e1fcb145ee62d7fc282017c3ebd36ad4b06"

CULTURE_GROWTH = [
    {"spriteTier": tier, "minKeepLevel": low, "maxKeepLevel": high}
    for tier, low, high in (
        (1, 1, 5), (2, 6, 10), (3, 11, 15), (4, 16, 20),
        (5, 21, 34), (7, 35, 39), (8, 40, 50),
    )
]
