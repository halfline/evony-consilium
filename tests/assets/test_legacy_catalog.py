import unittest
from consilium_assets.legacy_catalog import classify_legacy_sprite


class LegacySpriteTest(unittest.TestCase):
    def test_culture_keep(self):
        asset = classify_legacy_sprite(
            "Assets/PackageRes/Raw/Sprite/Map/evony3/castle_lv2.png"
        )
        self.assertEqual(asset["kind"], "keep")
        self.assertEqual(asset["culture"], "Japan")
        self.assertEqual(asset["tier"], 2)
        self.assertEqual(asset["family"], "culture-japan")
        self.assertEqual(asset["name"], "Japan")
        self.assertEqual(asset["id"], "map-evony3-castle_lv2")

    def test_skips_decoration_and_objective_icons(self):
        self.assertIsNone(
            classify_legacy_sprite("assets/sprite/map/guildflag/banner.png")
        )
        self.assertIsNone(
            classify_legacy_sprite("assets/sprite/map/battlefield/portal_icon.png")
        )

    def test_resource_and_overview(self):
        resource = classify_legacy_sprite("assets/sprite/map/world_food_3.png")
        overview = classify_legacy_sprite("assets/sprite/uithumbmap/boc_main.png")
        self.assertEqual(resource["kind"], "resource")
        self.assertEqual(overview["kind"], "overview")
