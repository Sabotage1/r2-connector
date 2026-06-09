# ReaPrime Espresso Workflow Skin Design

Date: 2026-06-09

## Goal

Create a ReaPrime/Decent.app WebUI skin for espresso workflow, bean/bag history, profile selection, shot review, and extraction analysis. The skin must work against ReaPrime v0.7.6 APIs and should package as an installable WebUI skin ZIP. Manual TDS and EY entry is required in all cases. Direct DiFluid R2 reflectometer reading is planned as a native ReaPrime enhancement only if it can be verified with real hardware.

## Target Platform

The deliverable is not a Home Assistant dashboard. It is a ReaPrime WebUI skin served by Decent.app on port 3000 and communicating with the local app API on port 8080.

The related native app change, if implemented, belongs in the ReaPrime app source tree, not this Home Assistant connector repository. It should expose the DiFluid R2 through the existing device discovery, `Sensor`, REST, and WebSocket APIs.

## Relevant ReaPrime Capabilities

ReaPrime v0.7.6 already provides the primitives needed for most of the requested behavior:

- WebUI skins served in the app webview.
- REST and WebSocket machine APIs.
- Profile list, profile defaults, profile CRUD, and workflow update APIs.
- Bean, bean batch, grinder, and shot storage APIs.
- Shot annotations with `actualDoseWeight`, `actualYield`, `drinkTds`, `drinkEy`, `enjoyment`, `espressoNotes`, and `extras`.
- Shot filtering by grinder, bean batch, coffee name, coffee roaster, profile title, and search text.
- Visualizer plugin endpoints for upload, status, credentials, and sync.
- BLE device discovery and a generic `Sensor` abstraction.
- Existing DiFluid Microbalance BLE implementation using a similar packet family.

## Product Model

The skin treats a "bag" as a valid bean batch only when the combined bean and batch data includes:

- Roaster.
- Bean name.
- Roast date.
- Process.

Country, region, roast level, notes, batch weight, open date, and other fields improve filtering and recommendations but are not required for bag validity.

## Main Navigation

The skin uses an app-style dashboard, not a landing page.

Primary surfaces:

- Brew: live machine state, editable preset profile buttons, selected bag/grinder, dose/yield, and start controls.
- Bags: bean and bag history with creation/editing and filters.
- Profiles: profile library, preset slot assignment, and recommendation explanations.
- History: shot list and filters.
- Review: post-shot graph, statistics, TDS/EY, Visualizer upload, grind size, and tasting notes.
- Settings: Visualizer status, R2 status, post-shot review defaults, and skin preferences.

## Main Page

The first screen should be optimized for a tablet next to the machine.

It includes:

- Machine connection state and compact live telemetry.
- Editable preset profile buttons. Each button can be assigned to an installed/default profile from ReaPrime.
- Current bag selector and current grinder selector.
- Grind setting field.
- Dose and target yield fields.
- Recommended profiles for the selected bag or bean.
- Primary brew controls and scale controls.

Selecting a profile updates the current ReaPrime workflow via `PUT /api/v1/workflow`, including profile and context where appropriate. Preset profile slot assignments are stored in the skin namespace using the ReaPrime key-value store.

## Bean And Bag History

The bag form follows the visual direction in the supplied screenshot: dark UI, large labels, clear inputs, and prominent Cancel/Save actions. It should include:

- Roaster.
- Bean.
- Country.
- Region.
- Process.
- Roast date.
- Roast level.
- Notes.
- Optional producer, variety, altitude, batch weight, open date, and frozen/archived status.

The history view supports filtering by:

- Roaster.
- Bean.
- Country.
- Region.
- Process.
- Roast level/type.
- Profile.
- Grinder.
- Date range.
- Free text.

Because ReaPrime shot filtering does not directly filter by country/process/roast level, the skin should join shot records to beans and batches client-side for these filters. As an optimization, the skin may also denormalize stable bag fields into `workflow.context.extras` when a bag is selected.

## Profile Recommendation

The recommendation engine should be deterministic and explainable. It should rank candidate profiles using local shot history:

1. Same valid bag.
2. Same bean across batches.
3. Same roaster and bean name.
4. Same process and roast level.
5. Same country or region.
6. Fallback profile metadata and sensible defaults.

Signals:

- EY closeness to target or user-selected preferred range.
- Enjoyment score.
- Recent success with the same bag.
- Lower variability across the last matching shots.
- Target beverage type compatibility.
- Manual user pinning or preset slot assignment.

The UI shows why a profile is recommended, not just a score. Example reasons: "3 good shots on this bag", "best average EY", "worked well for washed Ethiopia", or "your pinned default for light roast".

## Post-Shot Workflow

The skin adds a per-profile setting: "Open review after brew". It is on by default for every profile. The user can turn it off per profile.

When a shot finishes, the skin detects completion from machine state transitions or by polling `GET /api/v1/shots/latest` after the espresso state ends. If the selected profile has review enabled, the skin opens the Review surface for the latest shot.

The Review surface includes:

- Brew graph from stored shot measurements.
- Shot statistics: duration, dose, yield, ratio, average/peak pressure, average/peak flow, temperature summary, and profile.
- Current bag and grinder context.
- Manual TDS entry.
- Automatic EY calculation.
- Optional DiFluid R2 reading button when connected.
- Visualizer upload action and upload status.
- Previous 5-shot averages for the same valid bag.
- Previous 5 grind sizes for the same valid bag.
- Grind size entry for the current shot.
- Tasting notes, with suggested text from recent same-bag shots.

Manual TDS/EY must always work, even when no R2 is present.

## TDS And EY

Manual entry:

- User enters TDS percent from any reflectometer.
- The skin calculates EY when dose and yield are available.
- The user can edit dose/yield if needed.

Formula:

```text
EY% = yield_g * TDS% / dose_g
```

Persistence:

- Save TDS to `shot.annotations.drinkTds`.
- Save EY to `shot.annotations.drinkEy`.
- Save edited dose/yield to `shot.annotations.actualDoseWeight` and `shot.annotations.actualYield`.
- Save tasting notes to `shot.annotations.espressoNotes`.
- Save grind size to `shot.annotations.extras.workflowSkin.grindSize` or to the workflow context for future shots. The shot annotation copy is required for historical comparison.

## Visualizer Upload

The skin should use the bundled Visualizer plugin endpoint when available:

- Check plugin status.
- Verify credentials if the plugin exposes that state.
- Upload the current full shot.
- Display success, Visualizer ID, and sync status.

The skin should not duplicate Visualizer credentials storage unless the plugin endpoint is unavailable. If the plugin is disabled or missing credentials, the skin shows a setup path rather than a fake upload.

## DiFluid R2 Native Enhancement

The R2 work is feasible enough to plan, but it must be verified with hardware before it is considered complete.

Planned native app changes:

- Add a `DifluidR2Reflectometer` device class implementing ReaPrime's `Sensor` interface.
- Add service UUID `000000FF-0000-1000-8000-00805F9B34FB`.
- Use characteristic UUID `0000AA01-0000-1000-8000-00805F9B34FB`.
- Match advertised names containing `r2`, with safeguards to avoid matching unrelated devices.
- Add the R2 service UUID to `DeviceMatcher.serviceUuidsFor(DeviceType.sensor)`.
- Subscribe to notifications on `AA01`.
- Send "set Celsius" after connect.
- Expose an `execute` command such as `measure` that sends the single-test command.
- Parse status, temperature, TDS, refractive index, and error packets.
- Emit sensor snapshots with at least `timestamp`, `tds`, `temperature`, `refractiveIndex`, `status`, and `error`.
- Update API docs and tests.

Skin behavior:

- Call `GET /api/v1/sensors` to find a DiFluid R2.
- When found, connect to `ws/v1/sensors/{id}/snapshot`.
- Show "Read from R2".
- On click, call `POST /api/v1/sensors/{id}/execute` with the measurement command.
- Fill TDS from the next successful reading.
- Leave manual TDS editable after import.

Completion criteria for R2:

- ReaPrime scan discovers the R2.
- ReaPrime connects to the R2.
- A measurement command starts a test.
- A real device reading returns TDS.
- The skin receives the reading through the sensor API.
- TDS and calculated EY save to the current shot.
- The manual path still works when no R2 is present.

If hardware verification is not available, the native R2 work can be merged only behind a clear "experimental" state, with mock tests covering packet parsing and UI fallback behavior.

## Data Storage

Use ReaPrime first-party storage where possible:

- Profiles: `/api/v1/profiles` and `/api/v1/profiles/defaults`.
- Workflow: `/api/v1/workflow`.
- Beans and batches: `/api/v1/beans`, `/api/v1/beans/{id}/batches`, `/api/v1/bean-batches/{id}`.
- Grinders: `/api/v1/grinders`.
- Shots: `/api/v1/shots`.
- Skin-only preferences and preset slots: `/api/v1/kv/<namespace>`.

Recommended skin namespace:

```text
workflow-skin
```

Skin-only records:

- Preset profile slots.
- Per-profile review-enabled settings.
- Recommendation preferences.
- UI preferences.
- Last selected bag and grinder.

## Error Handling

The skin should handle:

- ReaPrime API unavailable.
- Machine disconnected.
- Scale disconnected.
- Missing selected profile.
- Missing or incomplete bag data.
- No matching historical shots.
- Visualizer plugin disabled or missing credentials.
- Visualizer upload failure.
- R2 disconnected, busy, no liquid, beyond range, checksum failure, or timeout.

For R2 failures, the manual TDS field remains available and focused.

## Testing

Skin tests:

- Profile preset slot assignment persists.
- Selecting a preset updates workflow.
- Bag validity requires roaster, bean, roast date, and process.
- Filters work for bean, country, process, roast level, grinder, and profile.
- Recommendation ranking is deterministic and explainable.
- Shot completion opens Review when enabled and does not when disabled.
- Manual TDS calculates EY and saves annotations.
- Grind size and notes save to the shot.
- Previous 5-shot bag statistics are calculated from the same valid bag only.
- Visualizer upload calls the plugin endpoint and handles disabled/missing credential states.
- R2 absent state keeps manual TDS flow available.

Native ReaPrime tests:

- Device matching identifies R2 without breaking DiFluid Microbalance detection.
- Packet checksum is validated.
- Status, temperature, TDS, and error packets parse correctly.
- Sensor info exposes the right channels and command.
- `execute("measure")` writes the single-test command.
- WebSocket snapshots emit parsed readings.
- API docs reflect the new sensor capability.

Manual verification:

- Install the skin ZIP in ReaPrime v0.7.6.
- Open the in-app skin webview on tablet-sized viewport.
- Select a bag and preset profile.
- Pull a shot.
- Verify Review opens after completion.
- Enter TDS manually and save EY.
- Upload to Visualizer.
- Connect a DiFluid R2, run a measurement, and save imported TDS/EY.

## Out Of Scope For First Version

- Cloud sync beyond existing ReaPrime data sync and Visualizer plugin behavior.
- Automatic profile creation from taste notes.
- Machine-learning recommendations.
- Replacing ReaPrime's native profile editor.
- Direct Visualizer credential management in the skin when the plugin is available.
- Native R2 support without hardware verification, except as experimental.

## Implementation Path

Use this workspace for the WebUI skin project. The current repository started as a Home Assistant connector, but the requested deliverable is a ReaPrime skin, so implementation should add a separate skin app/package here rather than extending the Home Assistant integration.

Native R2 work requires a ReaPrime app source checkout. The implementation plan should either clone the upstream ReaPrime repository into a separate local checkout or use an existing user-provided ReaPrime checkout if one is available. R2 changes should be developed as a ReaPrime patch/branch, while the skin remains packaged from this workspace.
