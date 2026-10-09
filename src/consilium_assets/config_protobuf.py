"""Read the length-delimited protobuf tables in Evony configuration archives.

These readers cover the wire types the client configs use. Field 1 of a table
is the repeated row list. ``value`` returns the first value of a field.
"""


def varint(b, p):
    n = shift = 0
    while True:
        v = b[p]
        p += 1
        n |= (v & 127) << shift
        if v < 128:
            return n, p
        shift += 7
        if shift > 70:
            raise ValueError("Invalid protobuf varint")


def fields(b):
    p = 0
    out = {}
    while p < len(b):
        tag, p = varint(b, p)
        wire = tag & 7
        if wire == 0:
            v, p = varint(b, p)
        elif wire == 2:
            n, p = varint(b, p)
            v = b[p : p + n]
            p += n
        elif wire in (1, 5):
            n = 8 if wire == 1 else 4
            v = b[p : p + n]
            p += n
        else:
            raise ValueError("Unsupported protobuf wire type")
        out.setdefault(tag >> 3, []).append(v)
    return out


def rows(path):
    return [fields(b) for b in fields(path.read_bytes())[1]]


def value(row, key, default=None):
    v = row.get(key, [default])[0]
    return v.decode("utf8") if isinstance(v, bytes) else v
