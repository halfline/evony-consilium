"""Read Spine atlas regions and run the geometry adapter."""

import json
import subprocess


def atlas_regions(text, pages):
    regions = []
    page = None
    region = None
    for line in text.splitlines():
        if not line.strip():
            region = None
            continue
        if not line.startswith(" ") and ":" not in line:
            name = line.strip()
            if name in pages:
                page = name
                region = None
            else:
                region = {"name": name, "page": pages[page]["src"], "rotate": False}
                regions.append(region)
        elif region and ":" in line:
            k, v = line.strip().split(":", 1)
            v = v.strip()
            if k == "rotate":
                region["rotate"] = v not in ("false", "0")
            elif k in ("xy", "size", "orig", "offset"):
                region[k] = [int(i) for i in v.split(",")]
    for r in regions:
        page = next(p for p in pages.values() if p["src"] == r["page"])
        x, y = r["xy"]
        w, h = r["size"]
        ow, oh = r.get("orig", [w, h])
        ox, oy = r.get("offset", [0, 0])
        r.update(
            width=w,
            height=h,
            originalWidth=ow,
            originalHeight=oh,
            offsetX=ox,
            offsetY=oy,
            u=x / page["width"],
            v=y / page["height"],
            u2=(x + (h if r["rotate"] else w)) / page["width"],
            v2=(y + (w if r["rotate"] else h)) / page["height"],
        )
    return regions


def spine_geometry(cache, jobs, renderer):
    (cache / "spine-jobs.json").write_text(json.dumps(jobs))
    subprocess.run(
        [
            "node",
            str(renderer),
            str(cache / "spine-jobs.json"),
            str(cache / "spine-result.json"),
        ],
        check=True,
    )
    return {
        record["id"]: record
        for record in json.loads((cache / "spine-result.json").read_text())
    }
