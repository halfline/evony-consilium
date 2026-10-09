import unittest
from types import SimpleNamespace

import numpy as np
from PIL import Image

from consilium_assets.raster import expand_layers, matrix, points, raster, temple_anchor


class RasterTest(unittest.TestCase):
    def layer(self, texture, **extra):
        return dict(
            texture=texture,
            vertices=[0, 0, 8, 0, 8, 8, 0, 8],
            uvs=[0, 0, 1, 0, 1, 1, 0, 1],
            triangles=[0, 1, 2, 0, 2, 3],
            **extra,
        )

    def test_composition_preserves_order_alpha_and_anchor(self):
        images = {
            "red": Image.new("RGBA", (8, 8), "red"),
            "blue": Image.new("RGBA", (8, 8), "blue"),
        }
        metadata = {}
        image = raster(
            [self.layer("red"), self.layer("blue", alpha=0.5)], images, metadata
        )
        red, green, blue, alpha = image.getpixel((4, 4))
        self.assertEqual((green, alpha), (0, 255))
        self.assertAlmostEqual(red, 127, delta=1)
        self.assertAlmostEqual(blue, 128, delta=1)
        self.assertEqual(metadata["pixelScale"], 1)
        self.assertEqual(metadata["pivotX"], 0)
        self.assertEqual(metadata["pivotY"], 8)

    def test_mirrored_quaternion_and_translation(self):
        transform = SimpleNamespace(
            m_LocalRotation=SimpleNamespace(x=0, y=1, z=0, w=0),
            m_LocalScale=SimpleNamespace(x=2, y=3),
            m_LocalPosition=SimpleNamespace(x=10, y=20),
        )
        self.assertEqual(points(matrix(transform), [1, 2]), [8, 26])

    def test_spine_pieces_follow_prefab_draw_order(self):
        layers = [
            dict(order=2, texture="front"),
            dict(order=1, spine="s", matrix=np.eye(3).tolist()),
        ]
        result = expand_layers(
            layers, {"s": {"layers": [{"texture": "back", "vertices": [1, 2]}]}}
        )
        self.assertEqual([item["texture"] for item in result], ["back", "front"])
        self.assertEqual(result[0]["vertices"], [1, 2])

    def test_degenerate_triangles_fail_as_empty_image(self):
        layer = self.layer("red")
        layer["triangles"] = [0, 0, 1]
        with self.assertRaisesRegex(ValueError, "Empty castle image"):
            raster([layer], {"red": Image.new("RGBA", (8, 8), "red")})

    def test_temple_anchor_ignores_soft_shadow(self):
        image = Image.new("RGBA", (10, 10))
        for y in range(2, 8):
            for x in range(2, 7):
                image.putpixel((x, y), (0, 255, 0, 255))
        image.putpixel((9, 9), (0, 0, 0, 80))
        anchor = temple_anchor(image)
        self.assertEqual(anchor["pivotY"], 8)
        self.assertEqual(anchor["pivotX"], 4)
        self.assertEqual(anchor["footprintWidth"], 5)
