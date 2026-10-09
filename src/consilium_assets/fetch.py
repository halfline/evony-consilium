"""Download one pinned public resource snapshot."""

import concurrent.futures
import hashlib
import io
import json
import urllib.request
import zipfile
from pathlib import Path

from consilium_assets.brotli_container import decode
from consilium_assets.config_protobuf import fields
from consilium_assets.json_file import write_json
from consilium_assets.snapshot import (
    ANDROID_BASE,
    BUNDLE_MAP,
    CONFIG_ARCHIVE,
    ENGLISH_ARCHIVE,
    RESOURCE_MANIFEST,
)

DIRECT_BUNDLES = {
    "prefab-map-kingdom",
    "prefab-map-resource",
    "map-data",
    "map-sprite-common",
    "map-sprite-famouscity",
    "mainui",
    "ui-icon-menu",
    "ui-army-icon-early",
}


def dependency_index(table):
    """Map a bundle name to the bundle names it lists as dependencies."""
    bundles = {}
    for row in fields(table)[1]:
        record = fields(row)
        name = record[1][0].decode().rsplit("/", 1)[-1]
        bundles[name] = [item.decode().rsplit("/", 1)[-1] for item in record.get(5, [])]
    return bundles


def select_bundles(manifest, dependencies, *, all_dependencies=False):
    """Castle bundles plus their direct dependencies.

    ``all_dependencies`` follows the whole graph, including UI and particles.
    Fixed server bundles stay selected even when the manifest has not listed
    them yet; fetching then reports that mismatch.
    """
    names = {name for name in manifest if "castle" in name} | set(DIRECT_BUNDLES)
    pending = list(names)
    while pending:
        for name in dependencies.get(pending.pop(), []):
            if name in manifest and name not in names:
                names.add(name)
                if all_dependencies:
                    pending.append(name)
    return names


def fetch_snapshot(cache, *, all_dependencies=False):
    """Cache the pinned manifest, bundles, and configuration tables.

    Returns the number of selected bundles. Compressed downloads stay in
    ``cache`` and decoded UnityFS bundles go in ``cache/decoded``.
    """
    root = Path(cache)
    root.mkdir(parents=True, exist_ok=True)
    (root / "decoded").mkdir(exist_ok=True)
    (root / "config").mkdir(exist_ok=True)
    sources = {}

    def get(path):
        target = root / Path(path).name
        if not target.exists():
            with urllib.request.urlopen(ANDROID_BASE + path, timeout=90) as response:
                data = response.read()
            temporary = target.with_suffix(target.suffix + ".part")
            temporary.write_bytes(data)
            temporary.replace(target)
        data = target.read_bytes()
        sources[path] = {
            "url": ANDROID_BASE + path,
            "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
        }
        return data

    manifest = json.loads(get(RESOURCE_MANIFEST))
    with zipfile.ZipFile(io.BytesIO(get(BUNDLE_MAP))) as archive:
        dependencies = dependency_index(archive.read("BundleMap.bytes"))
    names = select_bundles(manifest, dependencies, all_dependencies=all_dependencies)
    print(
        "Castle and server resources:",
        len(names),
        "bundles,",
        sum(manifest[name]["size"] for name in names),
        "compressed bytes",
        flush=True,
    )

    def fetch(name):
        entry = manifest[name]
        data = get("android/UploadBundles/" + entry["bundleName"])
        if len(data) != entry["size"]:
            raise ValueError("Manifest size mismatch: " + name)
        target = root / "decoded" / entry["bundleName"]
        if not target.exists():
            target.write_bytes(decode(data))
        return name

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for name in pool.map(fetch, sorted(names)):
            print("Fetched", name, flush=True)
    for path in (CONFIG_ARCHIVE, ENGLISH_ARCHIVE):
        with zipfile.ZipFile(io.BytesIO(get(path))) as archive:
            for name in archive.namelist():
                if name.endswith(".bytes") and not name.endswith("/"):
                    (root / "config" / Path(name).name).write_bytes(archive.read(name))
    write_json(root / "sources.json", sources)
    return len(names)
