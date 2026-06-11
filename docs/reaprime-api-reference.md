# ReaPrime API Reference for Workflow Skin

Source snapshot: ReaPrime `v0.7.6`, from `assets/api/rest_v1.yml`, `assets/api/websocket_v1.yml`, and the bundled `visualizer.reaplugin` manifest/source.

Base URLs:

- REST: `http://<tablet-ip>:8080`
- WebSocket: `ws://<tablet-ip>:8080`

Skin usage key:

- Used: called directly by the Workflow skin UI.
- Wrapped: implemented in the skin API client for current or near-term use.
- Fallback: kept for compatibility with older/current installs, but not in the upstream OpenAPI file.
- Available: exposed by ReaPrime but not currently used by this skin.

## REST APIs

### Devices

| Method | Path | Skin usage | Notes |
| --- | --- | --- | --- |
| GET | `/api/v1/devices` | Available | List known machine, scale, and sensor devices. |
| GET | `/api/v1/devices/scan` | Available | Trigger device scan. Query params include `connect` and `quick`. |
| PUT | `/api/v1/devices/connect` | Available | Connect to a device by `deviceId`. |
| PUT | `/api/v1/devices/disconnect` | Available | Disconnect a device by `deviceId`. |

### Machine

| Method | Path | Skin usage | Notes |
| --- | --- | --- | --- |
| GET | `/api/v1/machine/info` | Available | Machine identity/info. |
| GET | `/api/v1/machine/state` | Used | Connection state and status bar details. |
| PUT | `/api/v1/machine/state/{newState}` | Used | Sleep button requests `sleeping`. |
| POST | `/api/v1/machine/profile` | Available | Upload active brew profile to machine. |
| POST | `/api/v1/machine/shotSettings` | Available | Update current shot settings. |
| GET | `/api/v1/machine/capabilities` | Available | Capability discovery, such as Bengle-only features. |
| GET | `/api/v1/machine/cupWarmer` | Available | Read cup warmer setpoint. |
| PUT | `/api/v1/machine/cupWarmer` | Available | Set cup warmer target. |
| GET | `/api/v1/machine/ledStrip` | Available | Read LED strip config. |
| PUT | `/api/v1/machine/ledStrip` | Available | Set LED strip config. |
| POST | `/api/v1/machine/ledStrip/commit` | Available | Persist LED strip config. |
| POST | `/api/v1/machine/ledStrip/reset` | Available | Reload LED strip config from machine memory. |
| GET | `/api/v1/machine/settings` | Available | Read additional DE1 settings. |
| POST | `/api/v1/machine/settings` | Available | Set additional DE1 settings. |
| GET | `/api/v1/machine/settings/advanced` | Available | Read advanced DE1 settings. |
| POST | `/api/v1/machine/settings/advanced` | Available | Set advanced DE1 settings. |
| DELETE | `/api/v1/machine/settings/reset` | Available | Reset machine settings baseline. |
| GET | `/api/v1/machine/calibration` | Available | Read calibration settings. |
| POST | `/api/v1/machine/calibration` | Available | Update calibration settings. |
| POST | `/api/v1/machine/waterLevels` | Available | Set refill threshold. |
| POST | `/api/v1/machine/firmware` | Available | Push firmware to machine. |
| POST | `/api/v1/machine/heartbeat` | Available | Presence/heartbeat support. |

### Scale

| Method | Path | Skin usage | Notes |
| --- | --- | --- | --- |
| PUT | `/api/v1/scale/tare` | Available | Tare connected scale. |
| PUT | `/api/v1/scale/timer/start` | Available | Start scale timer. |
| PUT | `/api/v1/scale/timer/stop` | Available | Stop scale timer. |
| PUT | `/api/v1/scale/timer/reset` | Available | Reset scale timer. |

### Sensors

| Method | Path | Skin usage | Notes |
| --- | --- | --- | --- |
| GET | `/api/v1/sensors` | Used | Finds DiFluid R2 and other sensors. |
| GET | `/api/v1/sensors/{id}` | Wrapped | Read one sensor. |
| POST | `/api/v1/sensors/{id}/execute` | Used | R2 measure command uses `{ commandId: "measure", params: { timeout: 30 } }`. |

### Global Settings and Workflow

| Method | Path | Skin usage | Notes |
| --- | --- | --- | --- |
| GET | `/api/v1/settings` | Available | Global app settings. |
| POST | `/api/v1/settings` | Available | Update global app settings. |
| GET | `/api/v1/workflow` | Used | Reads active workflow/profile/context. |
| PUT | `/api/v1/workflow` | Used | Preset/default profile selection updates workflow context. |

### Shots

| Method | Path | Skin usage | Notes |
| --- | --- | --- | --- |
| GET | `/api/v1/shots` | Used | History, review, last-five averages, live/review context. |
| GET | `/api/v1/shots/ids` | Available | List shot ids. |
| GET | `/api/v1/shots/latest` | Wrapped | Latest shot convenience endpoint. |
| GET | `/api/v1/shots/{id}` | Used | Full shot fetch for review/upload. |
| PUT | `/api/v1/shots/{id}` | Used | Save TDS, EY, grind, tasting notes, and Visualizer metadata. |
| DELETE | `/api/v1/shots/{id}` | Available | Delete a shot. |

### Steams

| Method | Path | Skin usage | Notes |
| --- | --- | --- | --- |
| GET | `/api/v1/steams` | Used | Steam page history. |
| GET | `/api/v1/steams/ids` | Available | List steam ids. |
| GET | `/api/v1/steams/latest` | Available | Latest steam session. |
| GET | `/api/v1/steams/{id}` | Wrapped | Read one steam session. |
| PUT | `/api/v1/steams/{id}` | Available | Update steam metadata. |
| DELETE | `/api/v1/steams/{id}` | Available | Delete steam session. |

### Beans, Batches, and Grinders

| Method | Path | Skin usage | Notes |
| --- | --- | --- | --- |
| GET | `/api/v1/beans` | Used | Bean/bag history. |
| POST | `/api/v1/beans` | Used | Create bean when adding a bag. |
| GET | `/api/v1/beans/{id}` | Available | Read one bean. |
| PUT | `/api/v1/beans/{id}` | Used | Full bean editing. |
| DELETE | `/api/v1/beans/{id}` | Used | Cleanup on failed bag creation. |
| GET | `/api/v1/beans/{beanId}/batches` | Used | Read batches for each bean. |
| POST | `/api/v1/beans/{beanId}/batches` | Used | Create batch/bag. |
| GET | `/api/v1/bean-batches/{id}` | Available | Read one batch. |
| PUT | `/api/v1/bean-batches/{id}` | Used | Edit/archive bag batch data. |
| DELETE | `/api/v1/bean-batches/{id}` | Available | Delete batch. |
| GET | `/api/v1/grinders` | Used | Grinder list/editing. |
| POST | `/api/v1/grinders` | Used | Create grinder. |
| GET | `/api/v1/grinders/{id}` | Available | Read one grinder. |
| PUT | `/api/v1/grinders/{id}` | Used | Edit/archive grinder. |
| DELETE | `/api/v1/grinders/{id}` | Wrapped | Delete grinder. |

### Storage

| Method | Path | Skin usage | Notes |
| --- | --- | --- | --- |
| GET | `/api/v1/store/{namespace}` | Available | List namespace keys/values. |
| GET | `/api/v1/store/{namespace}/{key}` | Used | Primary skin settings read. |
| POST | `/api/v1/store/{namespace}/{key}` | Used | Primary skin settings write. |
| DELETE | `/api/v1/store/{namespace}/{key}` | Available | Delete stored value. |
| GET | `/api/v1/kv/{namespace}/{key}` | Fallback | Legacy skin settings read fallback, not in the v0.7.6 OpenAPI file. |
| PUT | `/api/v1/kv/{namespace}/{key}` | Fallback | Legacy skin settings write fallback, not in the v0.7.6 OpenAPI file. |

### Plugins

| Method | Path | Skin usage | Notes |
| --- | --- | --- | --- |
| GET | `/api/v1/plugins` | Used | Detect Visualizer plugin status. |
| GET | `/api/v1/plugins/{id}/settings` | Used | Read Visualizer settings and skin fallback settings. |
| POST | `/api/v1/plugins/{id}/settings` | Fallback | Skin settings fallback when store/kv routes are absent. |
| POST | `/api/v1/plugins/{id}/enable` | Available | Enable plugin. |
| POST | `/api/v1/plugins/{id}/disable` | Available | Disable plugin. |
| DELETE | `/api/v1/plugins/{id}` | Available | Remove plugin. |
| POST | `/api/v1/plugins/install` | Available | Install plugin. |
| ANY | `/api/v1/plugins/{id}/{endpoint}` | Used | Plugin-defined endpoint route. Visualizer endpoints below use this route. |

### Profiles

| Method | Path | Skin usage | Notes |
| --- | --- | --- | --- |
| GET | `/api/v1/profiles` | Used | Profile picker, profile visibility, profile editor. |
| POST | `/api/v1/profiles` | Used | Create editable profile copies/imported profiles. |
| GET | `/api/v1/profiles/{id}` | Available | Read one profile. |
| PUT | `/api/v1/profiles/{id}` | Used | Save profile edits. |
| DELETE | `/api/v1/profiles/{id}` | Available | Delete profile. |
| PUT | `/api/v1/profiles/{id}/visibility` | Available | Native profile visibility API. Skin currently stores its own show/hide list. |
| GET | `/api/v1/profiles/{id}/lineage` | Available | Profile parent/history info. |
| DELETE | `/api/v1/profiles/{id}/purge` | Available | Purge profile lineage/history. |
| POST | `/api/v1/profiles/import` | Available | Import profile. |
| GET | `/api/v1/profiles/export` | Available | Export profile. |
| POST | `/api/v1/profiles/restore/{filename}` | Available | Restore profile from backup. |
| GET | `/api/v1/profiles/defaults` | Wrapped | Default profile list. |

### Web UI Skin Management

| Method | Path | Skin usage | Notes |
| --- | --- | --- | --- |
| GET | `/api/v1/webui/skins` | Available | List installed skins. |
| GET | `/api/v1/webui/skins/{id}` | Available | Skin details. |
| DELETE | `/api/v1/webui/skins/{id}` | Available | Delete skin. |
| GET | `/api/v1/webui/skins/default` | Available | Current default skin. |
| PUT | `/api/v1/webui/skins/default` | Available | Set default skin. |
| POST | `/api/v1/webui/skins/install/github-release` | Available | Install skin from GitHub release. |
| POST | `/api/v1/webui/skins/install/github-branch` | Available | Install skin from GitHub branch. |
| POST | `/api/v1/webui/skins/install/url` | Available | Install skin from URL. |
| POST | `/api/v1/webui/skins/update` | Available | Update skin. |
| GET | `/api/v1/webui/server/status` | Available | Web UI server status. |
| POST | `/api/v1/webui/server/start` | Available | Start Web UI server. |
| POST | `/api/v1/webui/server/stop` | Available | Stop Web UI server. |
| GET | `/api/v1/webui/skin-assets/{id}/{filepath}` | Available | Serve skin asset file. |

### Presence, Display, Data, Debug, Feedback, Account

| Method | Path | Skin usage | Notes |
| --- | --- | --- | --- |
| GET | `/api/v1/presence/settings` | Available | Presence settings. |
| POST | `/api/v1/presence/settings` | Available | Update presence settings. |
| GET | `/api/v1/presence/schedules` | Available | Presence schedules. |
| POST | `/api/v1/presence/schedules` | Available | Create presence schedule. |
| PUT | `/api/v1/presence/schedules/{id}` | Available | Update presence schedule. |
| DELETE | `/api/v1/presence/schedules/{id}` | Available | Delete presence schedule. |
| GET | `/api/v1/display` | Used | Native display brightness/wake-lock status in settings. |
| PUT | `/api/v1/display/brightness` | Used | Sleep dims screen; wake restores 100. |
| POST | `/api/v1/display/wakelock` | Used | Keep screen awake when the skin is active. |
| DELETE | `/api/v1/display/wakelock` | Used | Release wake-lock when entering screensaver. |
| GET | `/api/v1/data/export` | Available | Export app data. |
| POST | `/api/v1/data/import` | Available | Import app data. |
| POST | `/api/v1/data/sync` | Available | Trigger data sync. |
| GET | `/api/v1/info` | Available | App/server info. |
| POST | `/api/v1/debug/scale/{command}` | Available | Debug scale command. |
| POST | `/api/v1/feedback` | Available | Submit feedback. |
| GET | `/api/v1/account/decent` | Available | Decent account status. |
| GET | `/api/v1/account/proxy/{path}` | Available | Decent account proxy route. |

## WebSocket APIs

| Channel | Address | Skin usage | Notes |
| --- | --- | --- | --- |
| MachineSnapshot | `ws/v1/machine/snapshot` | Used | Live machine telemetry for brew graph/details. |
| ShotSettings | `ws/v1/machine/shotSettings` | Available | Live shot settings. |
| WaterLevels | `ws/v1/machine/waterLevels` | Used | Water level status indicator. |
| ScaleSnapshot | `ws/v1/scale/snapshot` | Used | Live scale weight, flow, battery, and connection status. |
| MachineRaw | `ws/v1/machine/raw` | Available | Raw machine BLE stream. |
| SensorSnapshot | `ws/v1/sensors/{id}/snapshot` | Wrapped | Live sensor readings; useful for future R2 streaming if exposed. |
| Plugins | `ws/v1/plugins/{id}/{endpoint}` | Available | Plugin-defined messages. |
| Logs | `ws/v1/logs` | Available | Subscribe to app logs. |
| Devices | `ws/v1/devices` | Available | Bidirectional device state and scan/connect/disconnect commands. |
| Display | `ws/v1/display` | Available | Streams brightness/wake-lock state and accepts display commands. Skin currently uses REST calls for sleep/wake. |

Display WebSocket commands:

```json
{ "command": "setBrightness", "brightness": 75 }
{ "command": "requestWakeLock" }
{ "command": "releaseWakeLock" }
```

## Bundled Visualizer Plugin API

Plugin id: `visualizer.reaplugin`

Route pattern: `/api/v1/plugins/visualizer.reaplugin/{endpoint}`

| Endpoint | Typical method | Skin usage | Notes |
| --- | --- | --- | --- |
| `status` | GET | Used | Returns Visualizer plugin online/config status. |
| `upload` | POST | Used | Body should include `{ "shotId": "<local shot id>" }`. |
| `verifyCredentials` | POST | Available | Body includes `username` and `password`. |
| `lastUpload` | GET | Used | Returns last local ReaPrime shot id and Visualizer id. |
| `import` | POST | Available | Body includes `{ "shareCode": "1234" }` to import a Visualizer profile. |
| `backSyncNow` | POST | Available | Run Visualizer back-sync immediately. |
| `backSyncStatus` | GET | Used | Last back-sync result/error. |
| `forwardSyncStatus` | GET | Used | Last forward-sync result/error. |
| `forwardSyncNow` | POST | Available | Body may include `{ "shotId": "<local shot id>" }`. |

Visualizer plugin settings read through `/api/v1/plugins/visualizer.reaplugin/settings`:

| Setting | Meaning |
| --- | --- |
| `Username` | Visualizer username. |
| `Password` | Visualizer password, secure setting. |
| `AutoUpload` | Whether the plugin uploads completed shots automatically. |
| `LengthThreshold` | Minimum shot duration in seconds for upload. |
| `BackSync` | Whether Visualizer metadata edits are pulled back to local shots. |
| `BackSyncIntervalSeconds` | Back-sync polling interval, minimum 60 seconds. |

## Workflow Skin API Usage Summary

Current skin features and their API surfaces:

- Preset/default profile selection: `GET /profiles`, `PUT /workflow`, settings via `/store`.
- Profile editing: `PUT /profiles/{id}`, fallback `POST /profiles` when default profiles cannot be edited.
- Profile visibility: skin settings via `/store`; native `/profiles/{id}/visibility` is documented but not used yet.
- Brew live page: `ws/v1/machine/snapshot`, `ws/v1/scale/snapshot`, `GET /shots`.
- Post-shot review: `GET/PUT /shots/{id}`, `POST /sensors/{id}/execute` for R2, Visualizer `upload`.
- Bean/batch/grinder tools: beans, bean-batches, and grinders REST endpoints.
- Steam page: `GET /steams` plus local profile steam timers.
- Status bar: `GET /machine/state`, live scale WebSocket status, `ws/v1/machine/waterLevels`, sensors list, R2 setup state.
- Sleep/screensaver: `PUT /display/brightness`, `POST/DELETE /display/wakelock`, `PUT /machine/state/sleeping`.
- Visualizer status: `GET /plugins`, `GET /plugins/visualizer.reaplugin/settings`, and Visualizer plugin endpoints `status`, `lastUpload`, `backSyncStatus`, `forwardSyncStatus`.
