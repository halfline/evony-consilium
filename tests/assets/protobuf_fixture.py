def varint(n):
    out = bytearray()
    while True:
        byte = n & 127
        n >>= 7
        if n:
            out.append(byte | 128)
        else:
            out.append(byte)
            return bytes(out)


def key(number, wire):
    return varint((number << 3) | wire)


def length_delimited(number, data):
    return key(number, 2) + varint(len(data)) + data


