"""Resolve Unity prefab trees into textured geometry and Spine jobs."""

import struct
import numpy as np
from PIL import Image
from UnityPy.classes.PPtr import PPtr
from UnityPy.export.SpriteHelper import get_image
from UnityPy.helpers.MeshHelper import MeshHandler

from consilium_assets.raster import matrix, points
from consilium_assets.spine import atlas_regions


def script_bytes(obj):
    b = obj.get_raw_data()
    n = struct.unpack_from("<I", b)[0]
    p = (4 + n + 3) & ~3
    n = struct.unpack_from("<I", b, p)[0]
    return b[p + 4 : p + 4 + n]


class PrefabReader:
    def __init__(self, cache):
        self.cache = cache
        cache.mkdir(parents=True, exist_ok=True)
        self.images = {}
        self.jobs = []
        self.jobcache = {}
        self.missing = []

    def ref(self, obj, d):
        return PPtr(
            m_FileID=d["m_FileID"], m_PathID=d["m_PathID"], assetsfile=obj.assets_file
        ).deref()

    def image(self, obj):
        key = str(obj.assets_file.name) + "-" + str(obj.path_id)
        if key not in self.images:
            self.images[key] = obj.read().image.convert("RGBA")
        return key

    def spine_job(self, obj, d):
        data = self.ref(obj, d["skeletonDataAsset"])
        cfg = data.read_typetree()
        skeleton = self.ref(data, cfg["skeletonJSON"])
        key = str(skeleton.path_id) + "-" + d.get("initialSkinName", "")
        if key in self.jobcache:
            return key
        path = self.cache / (str(skeleton.path_id) + ".skel")
        path.write_bytes(script_bytes(skeleton))
        atlas = self.ref(data, cfg["atlasAssets"][0])
        acfg = atlas.read_typetree()
        atlastext = self.ref(atlas, acfg["atlasFile"])
        pages = {}
        for matref in acfg["materials"]:
            mat = self.ref(atlas, matref).read()
            tex = next(
                v.m_Texture.deref()
                for k, v in mat.m_SavedProperties.m_TexEnvs
                if k == "_MainTex"
            )
            texture = tex.read()
            name = texture.m_Name + ".png"
            keyimage = self.image(tex)
            pages[name] = {
                "src": keyimage,
                "width": self.images[keyimage].width,
                "height": self.images[keyimage].height,
            }
        job = {
            "id": key,
            "skeleton": str(path),
            "skin": d.get("initialSkinName", ""),
            "regions": atlas_regions(script_bytes(atlastext).decode(), pages),
        }
        self.jobs.append(job)
        self.jobcache[key] = job
        return key

    def collect(self, go, m, layers, excluded_nodes, depth=0):
        if not go.m_IsActive or depth > 30 or go.m_Name in excluded_nodes:
            return
        transform = next(
            (
                c.component.deref_parse_as_object()
                for c in go.m_Component
                if c.component.deref().type.name == "Transform"
            ),
            None,
        )
        if transform is None:
            return
        m = m @ matrix(transform)
        for c in go.m_Component:
            obj = c.component.deref()
            if obj.type.name == "SpriteRenderer":
                sr = obj.read()
                if not sr.m_Enabled or not sr.m_Sprite.m_PathID:
                    continue
                try:
                    spr = sr.m_Sprite.deref()
                    sp = spr.read()
                    mesh = MeshHandler(sp.m_RD, spr.version)
                    mesh.process()
                    rd = sp.m_RD
                    if sp.m_SpriteAtlas.m_PathID:
                        atlas = sp.m_SpriteAtlas.deref_parse_as_object()
                        rd = next(
                            v
                            for k, v in atlas.m_RenderDataMap
                            if k == sp.m_RenderDataKey
                        )
                    if not rd.texture.m_PathID:
                        key = self.image(spr)
                        im = self.images[key]
                        x = -sp.m_Pivot.x * sp.m_Rect.width
                        y = -sp.m_Pivot.y * sp.m_Rect.height
                        sm = m @ np.diag(
                            [-1 if sr.m_FlipX else 1, -1 if sr.m_FlipY else 1, 1]
                        )
                        sm[:2, 2] *= 100
                        layers.append(
                            {
                                "texture": key,
                                "vertices": points(
                                    sm,
                                    [
                                        x,
                                        y,
                                        x + im.width,
                                        y,
                                        x + im.width,
                                        y + im.height,
                                        x,
                                        y + im.height,
                                    ],
                                ),
                                "triangles": [0, 1, 2, 0, 2, 3],
                                "uvs": [0, 1, 1, 1, 1, 0, 0, 0],
                                "order": sr.m_SortingOrder,
                                "alpha": sr.m_Color.a,
                            }
                        )
                        continue
                    texture = rd.texture.deref()
                    key = self.image(texture)
                    if rd.alphaTexture.m_PathID:
                        key += "-alpha-" + str(rd.alphaTexture.m_PathID)
                        if key not in self.images:
                            self.images[key] = (
                                get_image(sp, rd.texture, rd.alphaTexture)
                                .transpose(Image.Transpose.FLIP_TOP_BOTTOM)
                                .convert("RGBA")
                            )
                    uvs = mesh.m_UV0
                    if not any(u or v for u, v in uvs):
                        t = sp.m_RD.uvTransform
                        uvs = [
                            (
                                (v[0] * t.x + t.y) / self.images[key].width,
                                (v[1] * t.z + t.w) / self.images[key].height,
                            )
                            for v in mesh.m_Vertices
                        ]
                    verts = [
                        coordinate
                        for v in mesh.m_Vertices
                        for coordinate in (v[0] * 100, v[1] * 100)
                    ]
                    sm = m @ np.diag(
                        [-1 if sr.m_FlipX else 1, -1 if sr.m_FlipY else 1, 1]
                    )
                    sm[:2, 2] *= 100
                    layers.append(
                        {
                            "texture": key,
                            "vertices": points(sm, verts),
                            "triangles": [
                                i
                                for submesh in mesh.get_triangles()
                                for tri in submesh
                                for i in tri
                            ],
                            "uvs": [
                                coordinate for u, v in uvs for coordinate in (u, 1 - v)
                            ],
                            "order": sr.m_SortingOrder,
                            "alpha": sr.m_Color.a,
                        }
                    )
                except (FileNotFoundError, KeyError, ValueError) as e:
                    self.missing.append(go.m_Name + ": " + str(e))
            elif obj.type.name == "MonoBehaviour":
                try:
                    d = obj.read_typetree()
                    if d.get("skeletonDataAsset", {}).get("m_PathID"):
                        key = self.spine_job(obj, d)
                        sm = m.copy()
                        sm[:2, 2] *= 100
                        # Unity's SkeletonDataAsset scale converts Spine pixels to Unity units.
                        scale = (
                            self.ref(obj, d["skeletonDataAsset"])
                            .read_typetree()
                            .get("scale", 0.01)
                            * 100
                        )
                        sm = sm @ np.diag([scale, scale, 1])
                        layers.append({"spine": key, "matrix": sm.tolist(), "order": 0})
                except (FileNotFoundError, KeyError, ValueError) as e:
                    self.missing.append(str(e))
        for child in transform.m_Children:
            if child.m_PathID:
                try:
                    self.collect(
                        child.deref_parse_as_object().m_GameObject.deref_parse_as_object(),
                        m,
                        layers,
                        excluded_nodes,
                        depth + 1,
                    )
                except FileNotFoundError:
                    pass
