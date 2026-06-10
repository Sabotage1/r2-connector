# ReaPrime Workflow Skin

This skin targets ReaPrime/Decent.app v0.7.6 or newer. It adds editable profile presets, valid bag tracking, bag-aware history, profile recommendations, and a post-shot review page with manual TDS/EY entry.

## Build

```bash
cd skin/workflow-skin
npm install
npm run package
```

The package script creates `skin/workflow-skin/workflow-skin.zip`.

## Install In ReaPrime

1. Open ReaPrime settings for WebUI skins.
2. Install a skin from the ZIP URL, or copy the ZIP to a reachable location and use the URL installer.
3. Set `workflow-skin` as the default skin.
4. Start the WebUI server and open the skin in the in-app WebView.

## Workflow Checks

1. Assign at least one profile preset on the Brew page.
2. Choose a startup default profile on the Edit Profiles page. The skin applies it once after the skin loads with ReaPrime.
3. Create or select a valid bag. A bag is valid only when it has roaster, bean, roast date, and process.
4. Pull a shot.
5. Open Review.
6. Enter dose, yield, and TDS manually to calculate EY.
7. Save grind size and tasting notes.
8. Upload to Visualizer when the bundled Visualizer plugin is configured.

## Milk Workflows

Each profile can be marked as a milk drink on the Edit Profiles page. Milk profiles have predefined steam timers for small, medium, and large jugs.

When a new shot is detected for a milk profile, the skin moves to the Steam page instead of Review. The Steam page shows the profile name, jug-size timer buttons, and start/pause/reset controls. Review is still available from the Steam page.

## Connection Status

The top-left header above the menu shows a compact status bar for:

- Machine connection.
- WiFi/IP address.
- Scale connection.
- DiFluid R2 connection when R2 has been set up in Settings.

Green means connected. Red means not connected. R2 stays hidden until Settings has a configured R2 sensor id.

The skin title is a centered top-middle app headline above the active page. It can be changed from Settings.

## DiFluid R2

Manual TDS/EY entry is always available. The R2 button only appears when the running ReaPrime build exposes a DiFluid R2 through `/api/v1/sensors`, with a TDS data channel and a `measure` command.

Use Settings to save the detected R2 as the configured reflectometer. This makes the R2 status appear on the Brew page.

This repository does not add a native DiFluid R2 adapter to ReaPrime itself. If ReaPrime does not expose the R2 as a sensor, use the manual TDS field and the EY calculation still works.
