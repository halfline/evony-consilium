#!/usr/bin/env python3
"""Extract configured player portraits from the pinned public client snapshot."""

import argparse
from pathlib import Path

from consilium_assets.avatars import extract_avatars


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--config", type=Path, default=Path(".asset-cache/current/config")
    )
    parser.add_argument(
        "--bundles", type=Path, default=Path(".asset-cache/current/decoded")
    )
    parser.add_argument("--output", type=Path, default=Path("web/assets"))
    args = parser.parse_args()
    written, missing = extract_avatars(args.bundles, args.config, args.output)
    print(f"Extracted {written} portraits; {missing} unavailable references recorded.")


if __name__ == "__main__":
    main()
