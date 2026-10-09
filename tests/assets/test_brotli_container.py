import struct
import unittest

import brotli

from consilium_assets.brotli_container import decode


def container(blocks, total, block_size):
    compressed = [brotli.compress(block) for block in blocks]
    header = 20 + 4 * len(compressed)
    body = bytearray()
    offsets = []
    cursor = header
    for chunk in compressed:
        offsets.append(cursor)
        body.extend(chunk)
        cursor += len(chunk)
    return (
        b"BROTLIFILE"
        + b"\x00\x00"
        + struct.pack("<II", total, block_size)
        + struct.pack("<" + "I" * len(compressed), *offsets)
        + bytes(body)
    )


class BrotliContainerTest(unittest.TestCase):
    def test_passthrough_without_signature(self):
        raw = b"UnityFS\x00not-brotli"
        self.assertEqual(decode(raw), raw)

    def test_round_trip_blocks(self):
        payload = b"unity-block-" * 20
        block = 24
        parts = [payload[i : i + block] for i in range(0, len(payload), block)]
        self.assertEqual(decode(container(parts, len(payload), block)), payload)

    def test_rejects_unsorted_offsets(self):
        data = bytearray(container([b"aaaa", b"bbbb"], 8, 4))
        first, second = struct.unpack_from("<II", data, 20)
        struct.pack_into("<II", data, 20, second, first)
        with self.assertRaisesRegex(ValueError, "Invalid Brotli block table"):
            decode(bytes(data))

    def test_rejects_offset_inside_header(self):
        data = bytearray(container([b"abcd"], 4, 8))
        struct.pack_into("<I", data, 20, 0)
        with self.assertRaisesRegex(ValueError, "Invalid Brotli block table"):
            decode(bytes(data))

    def test_rejects_wrong_decoded_length(self):
        data = container([b"abcd"], 8, 8)
        with self.assertRaisesRegex(ValueError, "Incorrect decoded resource size"):
            decode(data)


if __name__ == "__main__":
    unittest.main()
