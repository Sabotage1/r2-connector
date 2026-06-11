from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from .protocol import R2Event


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class BridgeState:
    connected: bool = False
    device_name: Optional[str] = None
    device_address: Optional[str] = None
    measuring: bool = False
    last_reading: Optional[Dict[str, Any]] = None
    last_temperature_c: Optional[float] = None
    last_error: Optional[str] = None
    updated_at: str = field(default_factory=utc_now_iso)

    def set_connected(
        self,
        connected: bool,
        *,
        name: Optional[str] = None,
        address: Optional[str] = None,
    ) -> Dict[str, Any]:
        self.connected = connected
        if name is not None:
            self.device_name = name
        if address is not None:
            self.device_address = address
        if not connected:
            self.measuring = False
        self.updated_at = utc_now_iso()
        return {"type": "state", "state": self.snapshot()}

    def apply_event(self, event: R2Event) -> Dict[str, Any]:
        self.updated_at = utc_now_iso()

        if event.measuring is not None:
            self.measuring = event.measuring

        if event.kind == "temperature":
            self.last_temperature_c = event.temperature_c
            return {"type": "temperature", "state": self.snapshot()}

        if event.kind == "reading":
            self.last_error = None
            self.measuring = False
            self.last_reading = {
                "tds": event.tds,
                "temperatureC": self.last_temperature_c,
                "refractiveIndex": event.refractive_index,
                "timestamp": self.updated_at,
            }
            return {"type": "reading", "reading": self.last_reading, "state": self.snapshot()}

        if event.kind == "error":
            self.measuring = False
            self.last_error = event.error
            return {"type": "error", "error": event.error, "state": self.snapshot()}

        if event.kind == "status":
            return {
                "type": "status",
                "status": event.status,
                "state": self.snapshot(),
            }

        return {"type": event.kind, "state": self.snapshot()}

    def snapshot(self) -> Dict[str, Any]:
        return {
            "connected": self.connected,
            "device": {
                "name": self.device_name,
                "address": self.device_address,
            },
            "measuring": self.measuring,
            "lastReading": self.last_reading,
            "lastTemperatureC": self.last_temperature_c,
            "lastError": self.last_error,
            "updatedAt": self.updated_at,
        }
