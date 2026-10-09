import unittest
import tempfile
from pathlib import Path
from protobuf_fixture import key, length_delimited, varint
from consilium_assets.catalog import apply_castle_upgrade_groups


class UpgradeGroupTest(unittest.TestCase):
    def test_one_shared_group_is_recorded(self):
        row = key(102, 0) + varint(10) + key(101, 0) + varint(3)
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory)
            (config / "CastleDressUpgradeConfig.bytes").write_bytes(
                length_delimited(1, row)
            )
            catalog = {
                "assets": [
                    {"kind": "keep", "gameIds": [10], "upgradeGroup": "stale"},
                    {"kind": "alliance", "gameIds": [10], "upgradeGroup": "stale"},
                ]
            }
            apply_castle_upgrade_groups(catalog, config)
        self.assertEqual(catalog["assets"][0]["upgradeGroup"], "castle-upgrade-3")
        self.assertNotIn("upgradeGroup", catalog["assets"][1])
