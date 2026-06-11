# DiFluid R2 Bridge

Local HTTP/WebSocket bridge for automatic DiFluid R2 Extract TDS readings.

The bridge talks to the R2 over BLE and exposes a small local API that a
ReaPrime/Decent skin or plugin can call.

## Requirements

- macOS with Bluetooth enabled
- Python 3.9+
- DiFluid R2 powered on and near the Mac

## Setup

```bash
cd "/Users/royackerman/Documents/Decent skin/r2-bridge"
python3 -m venv .venv
. .venv/bin/activate
pip install -e .
```

## Run

```bash
r2-bridge --host 0.0.0.0 --port 8765 --auto-connect
```

Use `0.0.0.0` if the Decent tablet needs to reach this Mac over your LAN. Use
`127.0.0.1` when the skin/app is running on the same Mac.

## API

### Health

```http
GET /health
```

### Current State

```http
GET /state
```

### Scan

```http
POST /scan
Content-Type: application/json

{"timeout": 5, "includeAll": false}
```

### Connect

```http
POST /connect
Content-Type: application/json

{}
```

Optional fields: `address`, `name`, `timeout`.

### Trigger Measurement

```http
POST /measure
Content-Type: application/json

{"timeout": 25}
```

This sends the R2 single-test command and waits for the TDS notification.

### Live Events

```text
ws://<bridge-host>:8765/events
```

Every state/status/temperature/reading/error update is pushed as JSON. If you
press the R2 button manually, readings still appear here.

## Skin Example

```js
const bridge = "http://127.0.0.1:8765";

async function readR2() {
  const response = await fetch(`${bridge}/measure`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ timeout: 25 }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "R2 read failed");
  return result.reading.tds;
}

const ws = new WebSocket("ws://127.0.0.1:8765/events");
ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  if (update.type === "reading") {
    console.log("R2 TDS", update.reading.tds);
  }
};
```

## Development Without Hardware

Start with mock readings enabled:

```bash
r2-bridge --allow-mock
```

Then inject a fake reading:

```bash
curl -X POST http://127.0.0.1:8765/mock-reading \
  -H 'Content-Type: application/json' \
  -d '{"tds": 8.75}'
```

## Protocol Notes

- Service UUID: `000000ff-0000-1000-8000-00805f9b34fb`
- Characteristic UUID: `0000aa01-0000-1000-8000-00805f9b34fb`
- Packet header: `DF DF`
- Single-test command: `DF DF 03 00 00 C1`
- TDS result: package `0x02`, bytes 1-2, big-endian uint16 divided by 100
