import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from consilium_assets.legacy import BUNDLES, download


class LegacyDownloadTest(unittest.TestCase):
    def test_complete_cache_works_without_requesting_the_remote_index(self):
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory)
            for name in BUNDLES:
                (cache / name).write_bytes(b"cached")
            with patch("consilium_assets.legacy.urllib.request.urlopen") as request:
                download(cache)
                request.assert_not_called()
