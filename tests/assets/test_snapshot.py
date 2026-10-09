import unittest
from consilium_assets.snapshot import parse_language


class SnapshotTest(unittest.TestCase):
    def test_language_table(self):
        text = '"castle_name"="Silver Wonder";\n"other"="Kept \\\\ slash";\n'
        self.assertEqual(
            parse_language(text),
            {"castle_name": "Silver Wonder", "other": "Kept \\\\ slash"},
        )
