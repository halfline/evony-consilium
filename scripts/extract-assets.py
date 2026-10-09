#!/usr/bin/env python3
"""Download public Unity bundles or extract local bundles/APKs into a static catalog.
Run with Python 3.12 and the consilium-assets package. No game login is used.
"""

import argparse
from pathlib import Path

from consilium_assets.legacy import download, extract, extract_apk, unityfs_files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--download",
        action="store_true",
        help="Download the seven known public bundles (cached)",
    )
    parser.add_argument("--bundles-dir", type=Path, default=Path(".asset-cache"))
    parser.add_argument(
        "--apk", type=Path, help="Extract UnityFS files from a locally supplied APK/ZIP"
    )
    parser.add_argument("--output", type=Path, default=Path("web/assets"))
    args = parser.parse_args()
    args.bundles_dir.mkdir(parents=True, exist_ok=True)
    if args.download:
        download(args.bundles_dir)
    if args.apk:
        extract_apk(args.apk, args.bundles_dir)
    files = unityfs_files(args.bundles_dir)
    if not files:
        parser.error(
            "No UnityFS bundles found. Use --download, --apk, or --bundles-dir."
        )
    extract(files, args.output)


if __name__ == "__main__":
    main()
