import tempfile
import unittest
from pathlib import Path

from consilium_assets.catalog import apply_culture_growth
from protobuf_fixture import key, length_delimited, varint


class CultureGrowthTest(unittest.TestCase):
    def test_observed_ranges_do_not_require_a_previous_output_catalog(self):
        entries = {
            f"tier-{tier}": {"culture": "Japan", "tier": tier}
            for tier in [1, 5, 6, 7, 8]
        }
        with tempfile.TemporaryDirectory() as directory:
            apply_culture_growth(entries, Path(directory))
        self.assertEqual(entries["tier-1"]["minKeepLevel"], 1)
        self.assertEqual(entries["tier-5"]["maxKeepLevel"], 34)
        self.assertNotIn("minKeepLevel", entries["tier-6"])
        self.assertEqual(entries["tier-7"]["minKeepLevel"], 35)
        self.assertEqual(entries["tier-8"]["maxKeepLevel"], 50)

    def test_local_config_overrides_observed_bounds_for_its_sprite(self):
        entries = {"map-evony3-castle_lv1": {"culture": "Japan", "tier": 1}}
        sprite = b"Assets/Sprite/Map/evony3/castle_lv1.png"
        def record(level):
            return key(1, 0) + varint(1) + key(3, 0) + varint(level) + length_delimited(104, sprite)
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory)
            (config / "WorldMapArtResource.bytes").write_bytes(
                length_delimited(1, record(2)) + length_delimited(1, record(4))
            )
            apply_culture_growth(entries, config)
        self.assertEqual(entries["map-evony3-castle_lv1"]["minKeepLevel"], 2)
        self.assertEqual(entries["map-evony3-castle_lv1"]["maxKeepLevel"], 4)
