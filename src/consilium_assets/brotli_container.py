"""Decode Evony BROTLIFILE containers into UnityFS bytes.

The signature is followed by a 2-byte marker, the uncompressed size, the block
size, and absolute offsets of independently compressed Brotli blocks. Bytes
without the signature are returned unchanged.
"""

import math
import struct

import brotli


def decode(data):
    if not data.startswith(b"BROTLIFILE"):
        return data
    total, block = struct.unpack_from("<II", data, 12)
    count = math.ceil(total / block)
    offsets = list(struct.unpack_from("<" + "I" * count, data, 20)) + [len(data)]
    if offsets != sorted(offsets) or offsets[0] < 20 + 4 * count:
        raise ValueError("Invalid Brotli block table")
    result = b"".join(
        brotli.decompress(data[offsets[i] : offsets[i + 1]]) for i in range(count)
    )
    if len(result) != total:
        raise ValueError("Incorrect decoded resource size")
    return result
