#!/usr/bin/env python3
"""Run the documented acquisition order.

Legacy WebGL bundles, then the pinned Android snapshot, then castle previews.
Avatar, terrain, and icon catalogs are optional regenerators of that snapshot.
"""

import argparse
import subprocess
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent


def run(script, *args):
    subprocess.run([sys.executable, str(SCRIPTS / script), *args], check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=Path(".asset-cache"))
    parser.add_argument("--output", type=Path, default=Path("web/assets"))
    parser.add_argument(
        "--all-dependencies",
        action="store_true",
        help="Follow the complete Android bundle graph while fetching",
    )
    parser.add_argument("--server-only", action="store_true")
    parser.add_argument("--avatars", action="store_true")
    parser.add_argument("--terrain", action="store_true")
    parser.add_argument("--icons", action="store_true")
    args = parser.parse_args()
    current = args.cache / "current"
    run(
        "extract-assets.py",
        "--download",
        "--bundles-dir",
        str(args.cache / "legacy"),
        "--output",
        str(args.output),
    )
    fetch = ["--cache", str(current)]
    if args.all_dependencies:
        fetch.append("--all-dependencies")
    run("fetch-current-assets.py", *fetch)
    castles = [
        "--cache",
        str(args.cache / "render"),
        "--bundles",
        str(current / "decoded"),
        "--config",
        str(current / "config"),
        "--output",
        str(args.output),
    ]
    if args.server_only:
        castles.append("--server-only")
    run("extract-current-castles.py", *castles)
    run("extract-subcities.py", "--bundles", str(current), "--config", str(current / "config"), "--output", str(args.output))
    if args.avatars:
        run(
            "extract-avatars.py",
            "--bundles",
            str(current / "decoded"),
            "--config",
            str(current / "config"),
            "--output",
            str(args.output),
        )
    if args.terrain:
        run(
            "extract-terrain.py",
            "--bundles",
            str(current / "decoded"),
            "--output",
            str(args.output / "terrain"),
        )
    if args.icons:
        run(
            "extract-map-icons.py",
            "--bundles",
            str(current),
            "--output",
            str(args.output / "map-icons"),
        )
        run(
            "extract-troop-icons.py",
            "--bundles",
            str(current),
            "--output",
            str(args.output / "troop-icons"),
        )


if __name__ == "__main__":
    main()
