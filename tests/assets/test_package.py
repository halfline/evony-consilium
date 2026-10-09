import sys
import subprocess
import unittest

import consilium_assets
from consilium_assets.config_protobuf import fields


class PackageImportTest(unittest.TestCase):
    def test_public_import_does_not_load_unity(self):
        subprocess.run(
            [
                sys.executable,
                "-c",
                "import sys; import consilium_assets; import consilium_assets.fetch; assert 'UnityPy' not in sys.modules",
            ],
            check=True,
        )
        self.assertIs(consilium_assets.fields, fields)
        self.assertEqual(
            consilium_assets.__all__,
            ["decode", "fields", "rows", "value"],
        )


if __name__ == "__main__":
    unittest.main()
