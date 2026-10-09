"""Authored fixture coverage for subcity catalog rules."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from consilium_assets.subcity_catalog import subcity_requests


class SubcityCatalogTests(unittest.TestCase):
    def test_culture_quality_pairs_and_named_red_cities(self):
        records = [
            {101: [1001], 102: [b"historic_name"], 109: [1], 106: [b"Sprite/Map/FamousCity/Rostock"]},
            {101: [10001], 102: [b"cultural_name"], 109: [10001], 106: [b"Sprite/Map/FamousCity/red_Germany"]},
        ]
        with tempfile.TemporaryDirectory() as directory:
            with patch("consilium_assets.subcity_catalog.rows", return_value=records):
                requests = subcity_requests(Path(directory), {
                    "historic_name": "Rostock", "cultural_name": "Germany Famous City",
                })
        normal = [record for record in requests if record["color"] != "red"]
        red = [record for record in requests if record["color"] == "red"]
        self.assertEqual(len(normal), 35)
        self.assertEqual(len({(record["culture"], record["color"]) for record in normal}), 35)
        self.assertEqual([record["name"] for record in red], ["Rostock", "Germany Famous City"])
        self.assertEqual([record["culture"] for record in red], ["Europe", "Germany"])
        self.assertNotEqual(red[0]["id"], red[1]["id"])
        self.assertEqual([record["category"] for record in red], ["historic", "famous"])
        self.assertTrue(all(record["category"] == "culture" for record in normal))
        self.assertTrue(all(record["path"].endswith(".png") for record in requests))
