from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


HEADER = b"\xDF\xDF"

FUNC_DEVICE_SETTINGS = 0x01
FUNC_DEVICE_ACTION = 0x03

CMD_SET_TEMPERATURE_UNIT = 0x00
CMD_SINGLE_TEST = 0x00
CMD_KNOWN_ERROR = 0xFE

STATUS_CODES = {
    0: "finished",
    4: "average_started",
    5: "average_ongoing",
    6: "average_finished",
    9: "loop_finished",
    11: "started",
}

ERROR_CODES = {
    3: "no_liquid",
    4: "beyond_range",
}


class R2ProtocolError(ValueError):
    """Raised when a BLE notification does not match the R2 packet format."""


@dataclass(frozen=True)
class R2Event:
    kind: str
    raw: bytes
    status: Optional[str] = None
    measuring: Optional[bool] = None
    tds: Optional[float] = None
    temperature_c: Optional[float] = None
    refractive_index: Optional[float] = None
    error: Optional[str] = None
    package: Optional[int] = None


def checksum(data: bytes) -> int:
    return sum(data) & 0xFF


def build_command(func: int, cmd: int, data: bytes = b"") -> bytes:
    if len(data) > 255:
        raise ValueError("R2 command data is limited to 255 bytes")
    body = HEADER + bytes([func, cmd, len(data)]) + data
    return body + bytes([checksum(body)])


def set_celsius_command() -> bytes:
    return build_command(FUNC_DEVICE_SETTINGS, CMD_SET_TEMPERATURE_UNIT, b"\x00")


def single_test_command() -> bytes:
    return build_command(FUNC_DEVICE_ACTION, CMD_SINGLE_TEST)


def parse_packet(raw: bytes) -> R2Event:
    if len(raw) < 6:
        raise R2ProtocolError("packet too short")
    if raw[:2] != HEADER:
        raise R2ProtocolError("invalid packet header")

    data_len = raw[4]
    expected_len = 2 + 1 + 1 + 1 + data_len + 1
    if len(raw) != expected_len:
        raise R2ProtocolError(
            f"invalid packet length: got {len(raw)}, expected {expected_len}"
        )
    if checksum(raw[:-1]) != raw[-1]:
        raise R2ProtocolError("invalid packet checksum")

    func = raw[2]
    cmd = raw[3]
    data = raw[5:-1]

    if cmd == CMD_KNOWN_ERROR:
        return _parse_error_packet(raw, data)

    if func == FUNC_DEVICE_SETTINGS:
        return R2Event(kind="ack", raw=raw)

    if not data:
        return R2Event(kind="ack", raw=raw)

    package = data[0]
    if package == 0x00:
        return _parse_status_packet(raw, data)
    if package == 0x01:
        return _parse_temperature_packet(raw, data)
    if package == 0x02:
        return _parse_tds_packet(raw, data)

    return R2Event(kind="unknown", raw=raw, package=package)


def _parse_status_packet(raw: bytes, data: bytes) -> R2Event:
    if len(data) < 2:
        raise R2ProtocolError("status packet missing status code")

    code = data[1]
    status = STATUS_CODES.get(code, f"unknown_{code}")
    measuring = code in (4, 5, 11)
    if code in (0, 6, 9):
        measuring = False

    return R2Event(
        kind="status",
        raw=raw,
        package=0,
        status=status,
        measuring=measuring,
    )


def _parse_temperature_packet(raw: bytes, data: bytes) -> R2Event:
    if len(data) < 6:
        raise R2ProtocolError("temperature packet too short")

    prism_x10 = _read_u16_be(data, 1)
    tank_x10 = _read_u16_be(data, 3)
    temp_c = (prism_x10 + tank_x10) / 20.0

    return R2Event(
        kind="temperature",
        raw=raw,
        package=1,
        temperature_c=temp_c,
    )


def _parse_tds_packet(raw: bytes, data: bytes) -> R2Event:
    if len(data) < 3:
        raise R2ProtocolError("TDS packet too short")

    tds = _read_u16_be(data, 1) / 100.0
    refractive_index = None
    if len(data) >= 7:
        refractive_index = _read_u32_be(data, 3) / 100000.0

    return R2Event(
        kind="reading",
        raw=raw,
        package=2,
        tds=tds,
        refractive_index=refractive_index,
        measuring=False,
    )


def _parse_error_packet(raw: bytes, data: bytes) -> R2Event:
    error = "unknown_error"
    if len(data) >= 2 and data[0] == 0x02:
        error = ERROR_CODES.get(data[1], f"unknown_error_{data[1]}")

    return R2Event(kind="error", raw=raw, error=error, measuring=False)


def _read_u16_be(data: bytes, offset: int) -> int:
    return (data[offset] << 8) | data[offset + 1]


def _read_u32_be(data: bytes, offset: int) -> int:
    return (
        (data[offset] << 24)
        | (data[offset + 1] << 16)
        | (data[offset + 2] << 8)
        | data[offset + 3]
    )
