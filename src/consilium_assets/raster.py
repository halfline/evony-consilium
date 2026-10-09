"""Transform and composite textured prefab geometry into sprite previews."""

import numpy as np
from PIL import Image, ImageDraw


def matrix(t):
    q = t.m_LocalRotation
    # Project the full quaternion rotation onto the sprite's XY plane.
    # In particular, a 180-degree Y rotation mirrors the right-facing catapult.
    return np.array(
        [
            [
                (1 - 2 * (q.y * q.y + q.z * q.z)) * t.m_LocalScale.x,
                2 * (q.x * q.y - q.z * q.w) * t.m_LocalScale.y,
                t.m_LocalPosition.x,
            ],
            [
                2 * (q.x * q.y + q.z * q.w) * t.m_LocalScale.x,
                (1 - 2 * (q.x * q.x + q.z * q.z)) * t.m_LocalScale.y,
                t.m_LocalPosition.y,
            ],
            [0, 0, 1],
        ]
    )


def points(m, flat):
    a = np.array(flat).reshape(-1, 2)
    return (np.c_[a, np.ones(len(a))] @ m.T)[:, :2].reshape(-1).tolist()


def raster(layers, images, metadata=None):
    coords = np.concatenate(
        [np.array(layer["vertices"]).reshape(-1, 2) for layer in layers]
    )
    low = coords.min(axis=0)
    high = coords.max(axis=0)
    scale = min(1, 1600 / max(high - low))
    w, h = np.ceil((high - low) * scale + 4).astype(int)
    result = Image.new("RGBA", (int(w), int(h)))
    for layer in layers:
        texture = images[layer["texture"]]
        vertices = np.array(layer["vertices"]).reshape(-1, 2)
        vertices[:, 0] = (vertices[:, 0] - low[0]) * scale + 2
        vertices[:, 1] = (high[1] - vertices[:, 1]) * scale + 2
        uv = np.array(layer["uvs"]).reshape(-1, 2) * [texture.width, texture.height]
        canvas = Image.new("RGBA", result.size)
        for tri in np.array(layer["triangles"]).reshape(-1, 3):
            dst = vertices[tri]
            src = uv[tri]
            left, top = np.floor(dst.min(axis=0)).astype(int)
            right, bottom = np.ceil(dst.max(axis=0)).astype(int)
            left = max(0, left)
            top = max(0, top)
            right = min(w, right + 1)
            bottom = min(h, bottom + 1)
            if right <= left or bottom <= top:
                continue
            try:
                coeff = np.linalg.solve(np.c_[dst, np.ones(3)], src)
            except np.linalg.LinAlgError:
                continue
            offset = np.array([left, top, 1]) @ coeff
            affine = (
                coeff[0, 0],
                coeff[1, 0],
                offset[0],
                coeff[0, 1],
                coeff[1, 1],
                offset[1],
            )
            patch = texture.transform(
                (int(right - left), int(bottom - top)),
                Image.Transform.AFFINE,
                affine,
                Image.Resampling.BICUBIC,
            )
            mask = Image.new("L", patch.size)
            ImageDraw.Draw(mask).polygon(
                [tuple(p - [left, top]) for p in dst], fill=255
            )
            canvas.paste(patch, (int(left), int(top)), mask)
        if layer.get("alpha", 1) != 1:
            alpha = layer["alpha"]
            canvas.putalpha(
                canvas.getchannel("A").point(
                    lambda pixel, alpha=alpha: round(pixel * alpha)
                )
            )
        result.alpha_composite(canvas)
    box = result.getbbox()
    if not box:
        raise ValueError("Empty castle image")
    if metadata is not None:
        metadata.update(
            pixelScale=float(scale),
            pivotX=float(-low[0] * scale + 2 - box[0]),
            pivotY=float(high[1] * scale + 2 - box[1]),
        )
    return result.crop(box)


def expand_layers(layers, geometry):
    expanded = []
    for layer in sorted(layers, key=lambda item: item["order"]):
        if "spine" not in layer:
            expanded.append(layer)
            continue
        for piece in geometry[layer["spine"]].get("layers", []):
            expanded.append(
                {
                    **piece,
                    "vertices": points(np.array(layer["matrix"]), piece["vertices"]),
                }
            )
    return expanded


def temple_anchor(image):
    """Front grass edge of a temple sprite, excluding soft shadow padding."""
    alpha = np.array(image.convert("RGBA"))[:, :, 3]
    solid = alpha >= 128
    rows, columns = np.where(solid)
    bottom = int(rows.max()) + 1
    front = solid[max(0, bottom - 3) : bottom]
    return {
        "pixelScale": 1,
        "pivotX": float(np.median(np.where(front)[1])),
        "pivotY": bottom,
        "groundPivotY": bottom,
        "footprintWidth": int(columns.max() - columns.min() + 1),
        "footprintFill": 0.98,
    }
