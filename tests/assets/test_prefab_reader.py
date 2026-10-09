import struct
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace as Object

import numpy as np

from consilium_assets.prefab_reader import PrefabReader, script_bytes


class Pointer:
    def __init__(self, value, kind):
        self.value = value
        self.type = Object(name=kind)
        self.m_PathID = 1

    def deref(self):
        return self

    def deref_parse_as_object(self):
        return self.value

    def read_typetree(self):
        return self.value


def prefab(name, x=0, children=()):
    transform = Object(
        m_LocalRotation=Object(x=0, y=0, z=0, w=1),
        m_LocalScale=Object(x=1, y=1),
        m_LocalPosition=Object(x=x, y=0),
        m_Children=list(children),
    )
    behavior = Pointer({"skeletonDataAsset": {"m_PathID": 1}}, "MonoBehaviour")
    go = Object(
        m_Name=name,
        m_IsActive=True,
        m_Component=[
            Object(component=Pointer(transform, "Transform")),
            Object(component=behavior),
        ],
    )
    transform.m_GameObject = Pointer(go, "GameObject")
    return go, transform


class PrefabReaderTest(unittest.TestCase):
    def test_text_asset_payload_respects_unity_string_alignment(self):
        payload = b"geometry"
        raw = (
            struct.pack("<I", 3)
            + b"key"
            + b"\0"
            + struct.pack("<I", len(payload))
            + payload
        )
        self.assertEqual(script_bytes(Object(get_raw_data=lambda: raw)), payload)

    def test_tree_transforms_and_exclusions_are_specific_to_each_prefab(self):
        with tempfile.TemporaryDirectory() as temporary:
            reader = PrefabReader(Path(temporary))
            reader.spine_job = lambda obj, data: "skeleton"
            reader.ref = lambda obj, data: Object(read_typetree=lambda: {"scale": 0.01})
            child, transform = prefab("Child", x=2)
            parent, _ = prefab(
                "Parent", x=3, children=[Pointer(transform, "Transform")]
            )
            layers = []
            reader.collect(parent, np.eye(3), layers, {"Child"})
            self.assertEqual(len(layers), 1)
            self.assertEqual(layers[0]["matrix"][0][2], 300)
            layers = []
            reader.collect(parent, np.eye(3), layers, set())
            self.assertEqual([layer["matrix"][0][2] for layer in layers], [300, 500])
            self.assertEqual(reader.missing, [])

    def test_inactive_and_deep_nodes_do_not_read_components(self):
        with tempfile.TemporaryDirectory() as temporary:
            reader = PrefabReader(Path(temporary))
            layers = []
            reader.collect(Object(m_IsActive=False), np.eye(3), layers, set())
            reader.collect(Object(m_IsActive=True), np.eye(3), layers, set(), depth=31)
            self.assertEqual(layers, [])
