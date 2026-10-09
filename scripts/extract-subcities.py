#!/usr/bin/env python3
"""Regenerate subcity choices and sprites without checking downloaded assets into Git."""

import argparse
from pathlib import Path

from consilium_assets.subcities import extract_subcities


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundles", type=Path, default=Path(".asset-cache/current"))
    parser.add_argument("--config", type=Path, default=Path(".asset-cache/current/config"))
    parser.add_argument("--output", type=Path, default=Path("web/assets"))
    args = parser.parse_args()
    count, missing = extract_subcities(args.bundles, args.config, args.output)
    print(f"Subcity choices: {count}; unavailable artwork: {missing}")


if __name__ == "__main__":
    main()
