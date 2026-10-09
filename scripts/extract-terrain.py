#!/usr/bin/env python3
"""Extract the pinned client tile grids and original tile sprites for the planner."""

import argparse
from pathlib import Path

from consilium_assets.terrain import extract_terrain


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--bundles", type=Path, default=Path(".asset-cache/current/decoded")
    )
    parser.add_argument("--output", type=Path, default=Path("web/assets/terrain"))
    args = parser.parse_args()
    extract_terrain(args.bundles, args.output)


if __name__ == "__main__":
    main()
