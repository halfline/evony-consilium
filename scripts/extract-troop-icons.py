#!/usr/bin/env python3
"""Extract native troop icons from the pinned public Evony client snapshot."""

import argparse
from pathlib import Path

from consilium_assets.icons import extract_troop_icons


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundles", type=Path, default=Path(".asset-cache/current"))
    parser.add_argument("--output", type=Path, default=Path("web/assets/troop-icons"))
    args = parser.parse_args()
    count = extract_troop_icons(args.bundles, args.output)
    print(f"Extracted {count} original icons.")


if __name__ == "__main__":
    main()
