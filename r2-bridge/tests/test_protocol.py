import unittest

from r2_bridge.protocol import (
    R2ProtocolError,
    build_command,
    parse_packet,
    set_celsius_command,
    single_test_command,
)


def packet(func, cmd, data):
    body = bytes([0xDF, 0xDF, func, cmd, len(data), *data])
    return body + bytes([sum(body) & 0xFF])


class R2ProtocolTest(unittest.TestCase):
    def test_builds_known_commands(self):
        self.assertEqual(set_celsius_command(), bytes.fromhex("DF DF 01 00 01 00 C0"))
        self.assertEqual(single_test_command(), bytes.fromhex("DF DF 03 00 00 C1"))
        self.assertEqual(build_command(0x03, 0x00, b""), single_test_command())

    def test_parses_tds_result_packet(self):
        event = parse_packet(packet(0x03, 0x00, [0x02, 0x00, 0x4F, 0x00, 0x02, 0x09, 0x3D]))

        self.assertEqual(event.kind, "reading")
        self.assertAlmostEqual(event.tds, 0.79)
        self.assertAlmostEqual(event.refractive_index, 1.33437)
        self.assertFalse(event.measuring)

    def test_parses_temperature_packet(self):
        event = parse_packet(packet(0x03, 0x00, [0x01, 0x03, 0x9D, 0x03, 0xA7, 0x00]))

        self.assertEqual(event.kind, "temperature")
        self.assertAlmostEqual(event.temperature_c, 93.0)

    def test_parses_started_and_finished_status(self):
        started = parse_packet(packet(0x03, 0x00, [0x00, 0x0B]))
        finished = parse_packet(packet(0x03, 0x00, [0x00, 0x00]))

        self.assertEqual(started.kind, "status")
        self.assertEqual(started.status, "started")
        self.assertTrue(started.measuring)
        self.assertEqual(finished.status, "finished")
        self.assertFalse(finished.measuring)

    def test_parses_celsius_setting_echo_as_ack(self):
        event = parse_packet(bytes.fromhex("DF DF 01 00 01 00 C0"))

        self.assertEqual(event.kind, "ack")
        self.assertIsNone(event.error)

    def test_maps_known_error_packets(self):
        no_liquid = parse_packet(packet(0x03, 0xFE, [0x02, 0x03]))
        beyond_range = parse_packet(packet(0x03, 0xFE, [0x02, 0x04]))

        self.assertEqual(no_liquid.kind, "error")
        self.assertEqual(no_liquid.error, "no_liquid")
        self.assertEqual(beyond_range.error, "beyond_range")

    def test_rejects_bad_checksum(self):
        raw = bytearray(packet(0x03, 0x00, [0x02, 0x00, 0x4F]))
        raw[-1] ^= 0xFF

        with self.assertRaises(R2ProtocolError):
            parse_packet(bytes(raw))


if __name__ == "__main__":
    unittest.main()
