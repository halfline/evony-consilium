import unittest
from protobuf_fixture import length_delimited
from consilium_assets.fetch import dependency_index, select_bundles


class FetchSelectionTest(unittest.TestCase):
    def test_dependency_index_uses_bundle_file_names(self):
        row = length_delimited(1, b"groups/prefab-map-castle_9") + length_delimited(
            5, b"groups/dep-a"
        )
        index = dependency_index(length_delimited(1, row))
        self.assertEqual(index, {"prefab-map-castle_9": ["dep-a"]})

    def test_direct_dependencies_stop_at_one_hop(self):
        manifest = {
            "prefab-map-castle_1": {"size": 1},
            "dep-a": {"size": 1},
            "dep-b": {"size": 1},
        }
        dependencies = {
            "prefab-map-castle_1": ["dep-a"],
            "dep-a": ["dep-b"],
        }
        direct = select_bundles(manifest, dependencies)
        full = select_bundles(manifest, dependencies, all_dependencies=True)
        self.assertIn("dep-a", direct)
        self.assertNotIn("dep-b", direct)
        self.assertIn("dep-b", full)
        self.assertIn("map-data", direct)
        self.assertTrue({"mainui", "ui-icon-menu", "ui-army-icon-early"} <= direct)
