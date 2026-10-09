#!/usr/bin/env python3
"""Assemble castle previews from public client prefabs and configuration."""

import argparse
from pathlib import Path

from consilium_assets.castles import extract


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--bundles", type=Path, required=True)
    p.add_argument("--config", type=Path, required=True)
    p.add_argument("--cache", type=Path, default=Path(".asset-cache/render"))
    p.add_argument("--output", type=Path, default=Path("web/assets"))
    p.add_argument("--server-only", action="store_true")
    extract(p.parse_args(), Path(__file__).with_name("spine-geometry.cjs"))
