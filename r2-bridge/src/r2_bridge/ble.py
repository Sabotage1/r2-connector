from __future__ import annotations

import asyncio
import contextlib
from typing import Any, Dict, List, Optional, Set

from bleak import BleakClient, BleakScanner
from bleak.backends.device import BLEDevice

from .protocol import (
    R2ProtocolError,
    parse_packet,
    set_celsius_command,
    single_test_command,
)
from .state import BridgeState


R2_SERVICE_UUID = "000000ff-0000-1000-8000-00805f9b34fb"
R2_CHARACTERISTIC_UUID = "0000aa01-0000-1000-8000-00805f9b34fb"


class BridgeError(RuntimeError):
    pass


class R2Bridge:
    def __init__(self) -> None:
        self.state = BridgeState()
        self._client: Optional[BleakClient] = None
        self._device: Optional[BLEDevice] = None
        self._subscribers: Set[asyncio.Queue] = set()
        self._reading_waiters: Set[asyncio.Future] = set()
        self._lock = asyncio.Lock()

    async def scan(self, timeout: float = 5.0, include_all: bool = False) -> List[Dict[str, Any]]:
        try:
            devices = await BleakScanner.discover(timeout=timeout)
        except Exception as exc:
            self.state.last_error = str(exc)
            raise BridgeError(str(exc)) from exc
        results = []
        for device in devices:
            entry = self._device_to_json(device)
            if include_all or self._looks_like_r2(device):
                results.append(entry)
        return results

    async def connect(
        self,
        *,
        address: Optional[str] = None,
        name: Optional[str] = None,
        scan_timeout: float = 8.0,
    ) -> Dict[str, Any]:
        async with self._lock:
            if self._client and self._client.is_connected:
                return self.state.snapshot()

            device = await self._find_device(address=address, name=name, timeout=scan_timeout)
            if device is None:
                raise BridgeError("DiFluid R2 not found")

            client = BleakClient(device)
            await client.connect()
            try:
                await client.start_notify(R2_CHARACTERISTIC_UUID, self._on_notification)
                await asyncio.sleep(0.1)
                await self._write_command(client, set_celsius_command())
            except Exception:
                with contextlib.suppress(Exception):
                    await client.disconnect()
                raise

            self._client = client
            self._device = device
            update = self.state.set_connected(
                True,
                name=device.name or "DiFluid R2",
                address=device.address,
            )
            await self._publish(update)
            return self.state.snapshot()

    async def disconnect(self) -> Dict[str, Any]:
        async with self._lock:
            client = self._client
            self._client = None
            self._device = None

            if client is not None:
                with contextlib.suppress(Exception):
                    await client.stop_notify(R2_CHARACTERISTIC_UUID)
                with contextlib.suppress(Exception):
                    await client.disconnect()

            update = self.state.set_connected(False)
            await self._publish(update)
            return self.state.snapshot()

    async def measure(self, timeout: float = 25.0) -> Dict[str, Any]:
        client = self._require_connected()
        waiter = asyncio.get_running_loop().create_future()
        self._reading_waiters.add(waiter)
        try:
            await self._write_command(client, single_test_command())
            result = await asyncio.wait_for(waiter, timeout=timeout)
            if result.get("type") == "error":
                raise BridgeError(result.get("error") or "R2 measurement failed")
            return result
        except asyncio.TimeoutError as exc:
            raise BridgeError("Timed out waiting for R2 reading") from exc
        finally:
            self._reading_waiters.discard(waiter)

    async def inject_mock_reading(self, tds: float) -> Dict[str, Any]:
        raw_tds = max(0, min(3000, round(tds * 100)))
        body = bytes([0xDF, 0xDF, 0x03, 0x00, 0x03, 0x02, raw_tds >> 8, raw_tds & 0xFF])
        event = parse_packet(body + bytes([sum(body) & 0xFF]))
        update = self.state.apply_event(event)
        await self._publish(update)
        return update

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        queue.put_nowait({"type": "state", "state": self.state.snapshot()})
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        self._subscribers.discard(queue)

    def _require_connected(self) -> BleakClient:
        if self._client is None or not self._client.is_connected:
            raise BridgeError("R2 is not connected")
        return self._client

    async def _find_device(
        self,
        *,
        address: Optional[str],
        name: Optional[str],
        timeout: float,
    ) -> Optional[BLEDevice]:
        try:
            devices = await BleakScanner.discover(timeout=timeout)
        except Exception as exc:
            self.state.last_error = str(exc)
            raise BridgeError(str(exc)) from exc
        wanted_name = name.lower() if name else None
        wanted_address = address.lower() if address else None

        for device in devices:
            if wanted_address and device.address.lower() == wanted_address:
                return device
            if wanted_name and wanted_name in (device.name or "").lower():
                return device

        for device in devices:
            if self._looks_like_r2(device):
                return device
        return None

    def _on_notification(self, _sender: Any, data: bytearray) -> None:
        asyncio.create_task(self._handle_packet(bytes(data)))

    async def _handle_packet(self, raw: bytes) -> None:
        try:
            event = parse_packet(raw)
            update = self.state.apply_event(event)
        except R2ProtocolError as exc:
            self.state.last_error = str(exc)
            update = {"type": "error", "error": str(exc), "state": self.state.snapshot()}

        await self._publish(update)
        if update.get("type") in {"reading", "error"}:
            for waiter in list(self._reading_waiters):
                if not waiter.done():
                    waiter.set_result(update)

    async def _write_command(self, client: BleakClient, command: bytes) -> None:
        try:
            await client.write_gatt_char(R2_CHARACTERISTIC_UUID, command, response=True)
        except Exception:
            await client.write_gatt_char(R2_CHARACTERISTIC_UUID, command, response=False)

    async def _publish(self, update: Dict[str, Any]) -> None:
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(update)
            except asyncio.QueueFull:
                self._subscribers.discard(queue)

    @staticmethod
    def _looks_like_r2(device: BLEDevice) -> bool:
        name = (device.name or "").lower()
        uuids = [
            str(uuid).lower()
            for uuid in getattr(device, "metadata", {}).get("uuids", [])
        ]
        return "r2" in name or R2_SERVICE_UUID in uuids

    @staticmethod
    def _device_to_json(device: BLEDevice) -> Dict[str, Any]:
        return {
            "name": device.name,
            "address": device.address,
            "rssi": getattr(device, "rssi", None),
            "uuids": [
                str(uuid)
                for uuid in getattr(device, "metadata", {}).get("uuids", [])
            ],
            "r2Candidate": R2Bridge._looks_like_r2(device),
        }
