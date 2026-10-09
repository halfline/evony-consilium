import unittest

from consilium_assets.catalog import mark_legacy_assets


class CatalogVisibilityTest(unittest.TestCase):
    def test_legacy_keep_stays_loadable_but_out_of_the_browser(self):
        entries = {
            "old-keep": {"id": "old-keep", "kind": "keep", "culture": None},
            "map-world_castle_guild": {
                "id": "map-world_castle_guild",
                "kind": "alliance",
                "legacyOnly": True,
            },
        }
        mark_legacy_assets(entries, [], server_only=False)
        self.assertTrue(entries["old-keep"]["legacyOnly"])
        self.assertNotIn("legacyOnly", entries["map-world_castle_guild"])
        self.assertEqual(entries["map-world_castle_guild"]["name"], "Alliance Castle")
        self.assertEqual(entries["map-world_castle_guild"]["footprint"], 2)
