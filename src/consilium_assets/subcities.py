"""Subcity choices and artwork derived from the pinned client configuration."""

import json

import UnityPy

from consilium_assets.brotli_container import decode
from consilium_assets.json_file import write_json
from consilium_assets.snapshot import parse_language
from consilium_assets.subcity_catalog import subcity_requests

def extract_subcities(bundles, config, output):
    language = parse_language((config / "en-US.bytes").read_text())
    requests = subcity_requests(config, language)
    environments = {}
    destination = output / "subcities"
    destination.mkdir(parents=True, exist_ok=True)
    records = []
    for request in requests:
        bundle = request["bundle"]
        if bundle not in environments:
            source = next(bundles.glob(bundle + "_*.brotlii"))
            env = UnityPy.load(decode(source.read_bytes()))
            environments[bundle] = {
                path.lower().removeprefix("assets/packageres/raw/"): ref
                for path, ref in env.container.items()
                if ref.type.name == "Sprite"
            }
        record = {key: request[key] for key in ("id", "name", "culture", "color", "category")}
        ref = environments[bundle].get(request["path"])
        if ref:
            image = ref.deref_parse_as_object().image.convert("RGBA")
            if image.getbbox():
                image = image.crop(image.getbbox())
            image.thumbnail((256, 256))
            image.save(destination / (request["id"] + ".webp"), "WEBP", lossless=True)
            record["src"] = "assets/subcities/" + request["id"] + ".webp"
        else:
            record["artUnavailable"] = True
        record["unityPath"] = request["path"]
        records.append(record)
    catalog_path = output / "catalog.json"
    catalog = json.loads(catalog_path.read_text())
    catalog["subcityTypes"] = records
    write_json(catalog_path, catalog)
    return len(records), sum("src" not in record for record in records)
