import tempfile
import unittest
from pathlib import Path

from consilium_assets.config_protobuf import fields, rows, value


from protobuf_fixture import key, length_delimited, varint


class ConfigProtobufTest(unittest.TestCase):
    def test_rows_and_values(self):
        europe = key(101, 0) + varint(1) + length_delimited(103, b"Europe")
        china = key(101, 0) + varint(2) + length_delimited(103, b"China")
        table = length_delimited(1, europe) + length_delimited(1, china)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "Culture.bytes"
            path.write_bytes(table)
            parsed = rows(path)
        self.assertEqual(value(parsed[0], 101), 1)
        self.assertEqual(value(parsed[0], 103), "Europe")
        self.assertEqual(value(parsed[1], 103), "China")
        self.assertIsNone(value(parsed[0], 999))
        self.assertEqual(value(parsed[0], 999, 0), 0)

    def test_repeated_field_keeps_every_value_and_value_reads_the_first(self):
        message = key(5, 0) + varint(1) + key(5, 0) + varint(2)
        self.assertEqual(fields(message)[5], [1, 2])
        self.assertEqual(value(fields(message), 5), 1)

    def test_fixed_wire_types_stay_raw_bytes(self):
        message = key(1, 5) + b"\x01\x00\x00\x00" + key(2, 1) + b"\x02" * 8
        parsed = fields(message)
        self.assertEqual(parsed[1], [b"\x01\x00\x00\x00"])
        self.assertEqual(parsed[2], [b"\x02" * 8])

    def test_rejects_unknown_wire_type(self):
        with self.assertRaisesRegex(ValueError, "Unsupported protobuf wire type"):
            fields(key(1, 3))

    def test_rejects_unterminated_varint(self):
        with self.assertRaisesRegex(ValueError, "Invalid protobuf varint"):
            fields(b"\x80" * 12)


if __name__ == "__main__":
    unittest.main()
