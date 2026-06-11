from __future__ import annotations

import argparse
import asyncio
import signal
import sys
from typing import Optional

from aiohttp import web

from .ble import R2Bridge
from .server import create_app


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="DiFluid R2 local bridge")
    parser.add_argument("--host", default="127.0.0.1", help="HTTP bind host")
    parser.add_argument("--port", type=int, default=8765, help="HTTP bind port")
    parser.add_argument(
        "--auto-connect",
        action="store_true",
        help="Scan and connect to the first R2-looking device at startup",
    )
    parser.add_argument("--device-address", help="Connect to a specific BLE address/UUID")
    parser.add_argument("--device-name", help="Connect to a BLE device whose name contains this text")
    parser.add_argument(
        "--allow-mock",
        action="store_true",
        help="Enable POST /mock-reading for skin development without an R2",
    )
    args = parser.parse_args(argv)

    try:
        asyncio.run(run(args))
    except KeyboardInterrupt:
        return 130
    return 0


async def run(args: argparse.Namespace) -> None:
    bridge = R2Bridge()
    app = create_app(bridge, allow_mock=args.allow_mock)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, args.host, args.port)
    await site.start()

    print(f"DiFluid R2 bridge listening on http://{args.host}:{args.port}", flush=True)
    print(f"State:   http://{args.host}:{args.port}/state", flush=True)
    print(f"Events:  ws://{args.host}:{args.port}/events", flush=True)

    if args.auto_connect or args.device_address or args.device_name:
        asyncio.create_task(_connect_on_startup(bridge, args))

    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        with _ignore_unsupported_signal():
            loop.add_signal_handler(sig, stop_event.set)

    await stop_event.wait()
    await bridge.disconnect()
    await runner.cleanup()


async def _connect_on_startup(bridge: R2Bridge, args: argparse.Namespace) -> None:
    try:
        state = await bridge.connect(
            address=args.device_address,
            name=args.device_name,
        )
        device = state.get("device", {})
        print(
            "Connected to R2: "
            f"{device.get('name') or 'unknown'} {device.get('address') or ''}",
            flush=True,
        )
    except Exception as exc:
        bridge.state.last_error = str(exc)
        print(f"Auto-connect failed: {exc}", file=sys.stderr, flush=True)


class _ignore_unsupported_signal:
    def __enter__(self):
        return None

    def __exit__(self, exc_type, _exc, _tb):
        return exc_type is NotImplementedError


if __name__ == "__main__":
    raise SystemExit(main())
