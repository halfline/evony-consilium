"""Legacy public WebGL bundles: download, local UnityFS discovery, and the base catalog."""

import datetime
import hashlib
import json
import re
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

import UnityPy

from consilium_assets.legacy_catalog import classify_legacy_sprite
from consilium_assets.json_file import write_json
from consilium_assets.snapshot import WEBGL_BUNDLES

BUNDLES = [
    "map-castle-highlevel",
    "map-castle-junior",
    "map-castle-senior",
    "map-castle-subcity",
    "map-sprite-common",
    "map-battlefield",
    "map-thumbmap",
]

_NOTICE = (
    "Original Evony graphics © Top Games Inc. Public availability does not grant "
    "redistribution rights. Bundles may be older than the live game."
)


def download(bundles_dir):
    """Cache the seven known public bundles. Existing files are kept."""
    if all((bundles_dir / name).is_file() for name in BUNDLES):
        return
    with urllib.request.urlopen(
        WEBGL_BUNDLES + "BundleMap.txt", timeout=60
    ) as response:
        manifest = json.load(response)
    index = {entry["path"].rsplit("/", 1)[-1]: entry for entry in manifest}
    metadata_file = bundles_dir / "downloads.json"
    metadata = json.loads(metadata_file.read_text()) if metadata_file.exists() else {}
    for name in BUNDLES:
        file = bundles_dir / name
        if file.exists():
            continue
        entry = index.get(name, {})
        pinned = name + "_" + entry.get("crc", "")
        print("Downloading", name)
        try:
            response = urllib.request.urlopen(WEBGL_BUNDLES + pinned, timeout=60)
            url = WEBGL_BUNDLES + pinned
        except urllib.error.HTTPError as error:
            if error.code != 404:
                raise
            print("  Indexed file unavailable; using older unversioned bundle")
            response = urllib.request.urlopen(WEBGL_BUNDLES + name, timeout=60)
            url = WEBGL_BUNDLES + name
        with response:
            temporary = file.with_suffix(".part")
            temporary.write_bytes(response.read())
            temporary.replace(file)
            metadata[name] = {
                "url": url,
                "lastModified": response.headers.get("Last-Modified"),
                "indexedVersion": entry.get("version"),
                "indexedCRC": entry.get("crc"),
                "unversionedFallback": url == WEBGL_BUNDLES + name,
            }
        write_json(metadata_file, metadata)


def extract_apk(apk, bundles_dir):
    """Copy UnityFS members out of a locally supplied APK or ZIP."""
    with zipfile.ZipFile(apk) as archive:
        for info in archive.infolist():
            if info.is_dir():
                continue
            with archive.open(info) as stream:
                if not stream.read(8).startswith(b"UnityFS"):
                    continue
            digest = hashlib.sha256(info.filename.encode()).hexdigest()[:12]
            destination = bundles_dir / (digest + "-" + Path(info.filename).name)
            destination.write_bytes(archive.read(info))


def unityfs_files(bundles_dir):
    files = []
    for file in sorted(bundles_dir.rglob("*")):
        if not file.is_file():
            continue
        with file.open("rb") as stream:
            if stream.read(8).startswith(b"UnityFS"):
                files.append(file)
    return files


def _objective_previews(inputs, output, entries):
    previews = output / "previews"
    previews.mkdir(parents=True, exist_ok=True)
    for file in inputs:
        environment = UnityPy.load(file.read_bytes())
        for path, ref in environment.container.items():
            path = path.lower()
            if ref.type.name != "Sprite" or "/sprite/map/battlefield/" not in path:
                continue
            if not path.endswith("_icon.png"):
                continue
            short = path.split("/sprite/", 1)[-1].removesuffix("_icon.png")
            key = re.sub(r"[^a-z0-9_-]+", "-", short).strip("-")
            if key not in entries or entries[key]["kind"] != "objective":
                continue
            destination = previews / (key + ".webp")
            ref.deref_parse_as_object().image.save(destination, "WEBP", lossless=True)
            entries[key].update(
                previewSrc="assets/previews/" + destination.name,
                previewUnityPath=path,
            )


def extract(inputs, output):
    """Write the base catalog.json and its WebP sprites."""
    output.mkdir(parents=True, exist_ok=True)
    entries = {}
    sources = []
    for file in inputs:
        content = file.read_bytes()
        metadata_file = file.parent / "downloads.json"
        metadata = (
            json.loads(metadata_file.read_text()).get(file.name, {})
            if metadata_file.exists()
            else {}
        )
        sources.append(
            {
                "file": file.name,
                "sha256": hashlib.sha256(content).hexdigest(),
                "bytes": len(content),
                "url": WEBGL_BUNDLES + file.name if file.name in BUNDLES else None,
                **metadata,
            }
        )
        environment = UnityPy.load(content)
        for path, ref in environment.container.items():
            classified = classify_legacy_sprite(path)
            if classified is None or ref.type.name != "Sprite":
                continue
            image = ref.deref_parse_as_object().image
            destination = output / (classified["id"] + ".webp")
            image.save(destination, "WEBP", lossless=True)
            entries[classified["id"]] = {
                "id": classified["id"],
                "name": classified["name"],
                "family": classified["family"],
                "tier": classified["tier"],
                "culture": classified["culture"],
                "kind": classified["kind"],
                "src": "assets/" + destination.name,
                "width": image.width,
                "height": image.height,
                "unityPath": classified["unityPath"],
                "bundle": file.name,
            }
    _objective_previews(inputs, output, entries)
    write_json(
        output / "catalog.json",
        {
            "schema": 1,
            "extractedAt": datetime.datetime.now(datetime.UTC).isoformat(),
            "source": WEBGL_BUNDLES,
            "notice": _NOTICE,
            "sources": sources,
            "assets": sorted(
                entries.values(),
                key=lambda asset: (asset["kind"], asset["name"], asset["tier"]),
            ),
        },
    )
    print(f"Exported {len(entries)} sprites to {output}")
    return len(entries)
