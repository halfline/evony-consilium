#!/usr/bin/env python3
"""Fetch a pinned public Evony resource/config snapshot without a game account."""

import argparse
from pathlib import Path

from consilium_assets.fetch import fetch_snapshot


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=Path(".asset-cache/current"))
    parser.add_argument(
        "--all-dependencies",
        action="store_true",
        help="Include transitive UI, particle and other client resources (large download)",
    )
    args = parser.parse_args()
    fetch_snapshot(args.cache, all_dependencies=args.all_dependencies)
    print(
        "Next: python scripts/extract-current-castles.py --bundles",
        args.cache / "decoded",
        "--config",
        args.cache / "config",
    )


if __name__ == "__main__":
    main()
