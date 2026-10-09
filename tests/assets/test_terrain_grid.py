import unittest
import base64
import gzip
from consilium_assets.terrain_grid import decode_tile_values, landmark_record


class TerrainGridTest(unittest.TestCase):
    def test_csv_and_gzip_encodings(self):
        csv = decode_tile_values("1, 0, 2, 3", "csv", 2, 2)
        self.assertEqual(csv.tolist(), [1, 0, 2, 3])
        binary = base64.b64encode(gzip.compress(bytes([4, 5, 6, 7]))).decode()
        self.assertEqual(
            decode_tile_values(binary, "base64", 2, 2).tolist(), [4, 5, 6, 7]
        )
        text = base64.b64encode(gzip.compress(b"8,9,10,11")).decode()
        self.assertEqual(
            decode_tile_values(text, "base64_1", 2, 2).tolist(), [8, 9, 10, 11]
        )

    def test_rejects_a_short_grid(self):
        with self.assertRaisesRegex(ValueError, "Unexpected tile encoding"):
            decode_tile_values("1,2", "csv", 2, 2)

    def test_landmark_origin_centers_the_footprint(self):
        throne = landmark_record("kingdom", "City of Throne", 600, 600, 5)
        temple = landmark_record(
            "worldbuilding-fireshrin", "Forging Temple", 899, 299, 4
        )
        self.assertEqual(
            (throne["x"], throne["y"], throne["groundTile"]), (598, 598, None)
        )
        self.assertEqual(
            (temple["x"], temple["y"], temple["groundTile"]), (898, 298, 76)
        )
        self.assertTrue(throne["locked"])
