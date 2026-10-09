"""Configured player portraits from the pinned client snapshot."""

import hashlib

import UnityPy

from consilium_assets.config_protobuf import rows, value
from consilium_assets.json_file import write_json
from consilium_assets.snapshot import (
    ANDROID_BUNDLES,
    CULTURES,
    SNAPSHOT,
    parse_language,
)


def portrait_requests(config):
    """Portrait records in catalog order, before sprite resolution.

    AvatarConfigure entries come first so a shared image keeps that name.
    RoleResourceConfig type 1000 is a champion background and is omitted.
    """
    language = parse_language((config / "en-US.bytes").read_text())
    items = {
        value(record, 101): language.get(value(record, 103), value(record, 103))
        for record in rows(config / "ItemsConfigure.bytes")
    }
    requests = []
    for record in rows(config / "AvatarConfigure.bytes"):
        name = language[value(record, 103)].removeprefix("Monarch Image - ")
        requests.append(
            {
                "id": "avatar-" + str(value(record, 101)),
                "name": name,
                "category": "collection",
                "path": value(record, 105),
                "source": "AvatarConfigure",
            }
        )
    for record in rows(config / "RoleResourceConfig.bytes"):
        culture = value(record, 101)
        role = value(record, 102)
        general_type = value(record, 110)
        # general_type matches the client's Culture/Collection/General toggles.
        if general_type not in (0, 1, 2):
            continue
        if general_type == 0:
            category = "culture-" + str(culture)
            name = ""
        else:
            category = "general" if general_type == 2 else "collection"
            name = items.get(value(record, 109))
            if name is None:
                continue
            name = name.removeprefix("Monarch Image - ").removeprefix(
                "Monarch Avatar - "
            )
        requests.append(
            {
                "id": "portrait-" + str(culture) + "-" + str(role),
                "name": name,
                "category": category,
                "path": value(record, 105),
                "source": "RoleResourceConfig",
                "generalType": general_type,
                "culture": CULTURES[culture] if general_type == 0 else None,
            }
        )
    categories = [
        {"id": "culture-" + str(culture_id), "name": name}
        for culture_id, name in CULTURES.items()
    ]
    categories.extend(
        [
            {"id": "collection", "name": "Collection"},
            {"id": "general", "name": "General"},
        ]
    )
    return requests, categories


def extract_avatars(bundles, config, output):
    """Write portrait WebPs and avatar-catalog.json. Returns (written, missing)."""
    requests, categories = portrait_requests(config)
    bundle = next(bundles.glob("mainui_*.brotlii"))
    environment = UnityPy.load(str(bundle))
    sprites = {
        path.lower().removeprefix("assets/packageres/raw/").removesuffix(".png"): ref
        for path, ref in environment.container.items()
        if ref.type.name == "Sprite"
    }
    destination = output / "avatars"
    destination.mkdir(parents=True, exist_ok=True)
    records = []
    missing = []
    seen = set()
    for request in requests:
        path = request["path"].lower()
        if path in seen:
            continue
        metadata = {
            key: request[key] for key in ("generalType", "culture") if key in request
        }
        if path not in sprites:
            missing.append(
                {
                    "id": request["id"],
                    "name": request["name"],
                    "unityPath": path,
                    "source": request["source"],
                    **metadata,
                }
            )
            continue
        seen.add(path)
        image = sprites[path].deref_parse_as_object().image
        image.thumbnail((256, 256))
        image.save(destination / (request["id"] + ".webp"), "WEBP", lossless=True)
        records.append(
            {
                "id": request["id"],
                "name": request["name"],
                "category": request["category"],
                "src": "assets/avatars/" + request["id"] + ".webp",
                "unityPath": path,
                "source": request["source"],
                **metadata,
            }
        )
    write_json(
        output / "avatar-catalog.json",
        {
            "snapshot": SNAPSHOT,
            "categories": categories,
            "defaultId": "portrait-3-1",
            "avatars": records,
            "unavailable": missing,
            "sources": [
                {
                    "file": bundle.name,
                    "sha256": hashlib.sha256(bundle.read_bytes()).hexdigest(),
                    "url": ANDROID_BUNDLES + bundle.name,
                }
            ],
        },
    )
    return len(records), len(missing)
