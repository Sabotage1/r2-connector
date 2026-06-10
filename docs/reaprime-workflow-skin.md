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
2. Create or select a valid bag. A bag is valid only when it has roaster, bean, roast date, and process.
3. Pull a shot.
4. Open Review.
5. Enter dose, yield, and TDS manually to calculate EY.
6. Save grind size and tasting notes.
7. Upload to Visualizer when the bundled Visualizer plugin is configured.

## DiFluid R2

Manual TDS/EY entry is always available. The R2 button only appears when the running ReaPrime build exposes a DiFluid R2 through `/api/v1/sensors`, with a TDS data channel and a `measure` command.

This repository does not add a native DiFluid R2 adapter to ReaPrime itself. If ReaPrime does not expose the R2 as a sensor, use the manual TDS field and the EY calculation still works.
