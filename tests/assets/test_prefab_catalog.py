import unittest
from consilium_assets.prefab_catalog import catalog_entry, decoration_names, excluded_prefab_nodes, prefab_path, prefab_variations


class CatalogRuleTest(unittest.TestCase):
    def test_duration_suffix_and_culture_variant(self):
        self.assertEqual(
            decoration_names("Verona - Dawn (30 days)", None), ("Verona", "Dawn")
        )
        self.assertEqual(decoration_names("Thebes (Permanent)", 2), ("Thebes", "China"))

    def test_prefab_path_falls_back_when_the_model_directory_is_absent(self):
        record = {"path": "Prefabs/Castle_Model/Town_Example"}
        alternative = "assets/packageres/raw/prefabs/town_example.prefab"
        self.assertEqual(
            prefab_path(record, None, {alternative: object()}), alternative
        )
        self.assertEqual(prefab_variations({"path": "Prefabs/Skin/{0}"}), range(1, 8))

    def test_catapult_entry_keeps_its_aliases_and_excluded_children(self):
        record = {
            "gameId": 24,
            "name": "Throne Tower - Left",
            "path": "Prefabs/Map/MangonelLeft",
            "kind": "objective",
            "footprint": 4,
        }
        asset = catalog_entry(
            record, "assets/prefabs/map/mangonelleft.prefab", "bundle", None, 1
        )
        self.assertEqual(asset["aliases"], ["Catapult", "Throne Catapult"])
        self.assertEqual(asset["id"], "map-mangonelleft")
        self.assertEqual(excluded_prefab_nodes(record), {"AtkRoot", "FxGrid"})
