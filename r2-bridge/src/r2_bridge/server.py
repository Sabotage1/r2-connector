from __future__ import annotations

import asyncio
from typing import Awaitable, Callable

from aiohttp import WSMsgType, web

from .ble import BridgeError, R2Bridge


Handler = Callable[[web.Request], Awaitable[web.StreamResponse]]


@web.middleware
async def cors_middleware(request: web.Request, handler: Handler) -> web.StreamResponse:
    if request.method == "OPTIONS":
        response = web.Response(status=204)
    else:
        response = await handler(request)

    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Max-Age"] = "86400"
    return response


def create_app(bridge: R2Bridge, *, allow_mock: bool = False) -> web.Application:
    app = web.Application(middlewares=[cors_middleware])
    app["bridge"] = bridge
    app["allow_mock"] = allow_mock

    app.router.add_get("/", handle_index)
    app.router.add_get("/health", handle_health)
    app.router.add_get("/state", handle_state)
    app.router.add_post("/scan", handle_scan)
    app.router.add_post("/connect", handle_connect)
    app.router.add_post("/disconnect", handle_disconnect)
    app.router.add_post("/measure", handle_measure)
    app.router.add_get("/events", handle_events)
    app.router.add_post("/mock-reading", handle_mock_reading)
    app.router.add_route("OPTIONS", "/{tail:.*}", handle_options)

    return app


async def handle_index(_request: web.Request) -> web.Response:
    return web.json_response(
        {
            "name": "DiFluid R2 Bridge",
            "version": "0.1.0",
            "endpoints": {
                "health": "GET /health",
                "state": "GET /state",
                "scan": "POST /scan",
                "connect": "POST /connect",
                "disconnect": "POST /disconnect",
                "measure": "POST /measure",
                "events": "GET /events websocket",
            },
        }
    )


async def handle_health(request: web.Request) -> web.Response:
    bridge: R2Bridge = request.app["bridge"]
    return web.json_response({"ok": True, "state": bridge.state.snapshot()})


async def handle_state(request: web.Request) -> web.Response:
    bridge: R2Bridge = request.app["bridge"]
    return web.json_response(bridge.state.snapshot())


async def handle_scan(request: web.Request) -> web.Response:
    bridge: R2Bridge = request.app["bridge"]
    payload = await _json_or_empty(request)
    timeout = float(payload.get("timeout", 5.0))
    include_all = bool(payload.get("includeAll", False))
    try:
        devices = await bridge.scan(timeout=timeout, include_all=include_all)
        return web.json_response({"devices": devices})
    except BridgeError as exc:
        return web.json_response(
            {"error": str(exc), "state": bridge.state.snapshot()},
            status=503,
        )


async def handle_connect(request: web.Request) -> web.Response:
    bridge: R2Bridge = request.app["bridge"]
    payload = await _json_or_empty(request)
    try:
        state = await bridge.connect(
            address=payload.get("address"),
            name=payload.get("name"),
            scan_timeout=float(payload.get("timeout", 8.0)),
        )
        return web.json_response(state)
    except BridgeError as exc:
        return web.json_response({"error": str(exc), "state": bridge.state.snapshot()}, status=404)
    except Exception as exc:
        return web.json_response({"error": str(exc), "state": bridge.state.snapshot()}, status=500)


async def handle_disconnect(request: web.Request) -> web.Response:
    bridge: R2Bridge = request.app["bridge"]
    state = await bridge.disconnect()
    return web.json_response(state)


async def handle_measure(request: web.Request) -> web.Response:
    bridge: R2Bridge = request.app["bridge"]
    payload = await _json_or_empty(request)
    timeout = float(payload.get("timeout", 25.0))
    try:
        update = await bridge.measure(timeout=timeout)
        return web.json_response(update)
    except BridgeError as exc:
        return web.json_response({"error": str(exc), "state": bridge.state.snapshot()}, status=409)
    except Exception as exc:
        return web.json_response({"error": str(exc), "state": bridge.state.snapshot()}, status=500)


async def handle_events(request: web.Request) -> web.WebSocketResponse:
    bridge: R2Bridge = request.app["bridge"]
    ws = web.WebSocketResponse(heartbeat=20)
    await ws.prepare(request)

    queue = bridge.subscribe()
    pump = asyncio.create_task(_pump_events(ws, queue))
    try:
        async for message in ws:
            if message.type in (WSMsgType.CLOSE, WSMsgType.ERROR):
                break
    finally:
        bridge.unsubscribe(queue)
        pump.cancel()
    return ws


async def handle_mock_reading(request: web.Request) -> web.Response:
    if not request.app["allow_mock"]:
        return web.json_response({"error": "mock readings are disabled"}, status=403)

    bridge: R2Bridge = request.app["bridge"]
    payload = await _json_or_empty(request)
    if "tds" not in payload:
        return web.json_response({"error": "tds is required"}, status=400)
    update = await bridge.inject_mock_reading(float(payload["tds"]))
    return web.json_response(update)


async def handle_options(_request: web.Request) -> web.Response:
    return web.Response(status=204)


async def _pump_events(ws: web.WebSocketResponse, queue: asyncio.Queue) -> None:
    while not ws.closed:
        update = await queue.get()
        await ws.send_json(update)


async def _json_or_empty(request: web.Request) -> dict:
    if not request.can_read_body:
        return {}
    try:
        return await request.json()
    except Exception:
        return {}
