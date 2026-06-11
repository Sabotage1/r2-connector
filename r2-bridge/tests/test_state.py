import unittest

from r2_bridge.state import BridgeState
from r2_bridge.protocol import parse_packet


def packet(func, cmd, data):
    body = bytes([0xDF, 0xDF, func, cmd, len(data), *data])
    return body + bytes([sum(body) & 0xFF])


class BridgeStateTest(unittest.TestCase):
    def test_reading_updates_last_reading_json(self):
        state = BridgeState()

        update = state.apply_event(parse_packet(packet(0x03, 0x00, [0x02, 0x01, 0x2C])))
        snapshot = state.snapshot()

        self.assertEqual(update["type"], "reading")
        self.assertEqual(snapshot["lastReading"]["tds"], 3.0)
        self.assertFalse(snapshot["measuring"])
        self.assertIsNone(snapshot["lastError"])

    def test_status_updates_measuring(self):
        state = BridgeState()

        state.apply_event(parse_packet(packet(0x03, 0x00, [0x00, 0x0B])))
        self.assertTrue(state.snapshot()["measuring"])

        state.apply_event(parse_packet(packet(0x03, 0x00, [0x00, 0x00])))
        self.assertFalse(state.snapshot()["measuring"])

    def test_error_clears_measuring_and_sets_last_error(self):
        state = BridgeState()
        state.apply_event(parse_packet(packet(0x03, 0x00, [0x00, 0x0B])))

        update = state.apply_event(parse_packet(packet(0x03, 0xFE, [0x02, 0x03])))
        snapshot = state.snapshot()

        self.assertEqual(update["type"], "error")
        self.assertEqual(snapshot["lastError"], "no_liquid")
        self.assertFalse(snapshot["measuring"])


if __name__ == "__main__":
    unittest.main()
