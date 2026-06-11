import { useEffect, useState } from "react";
import skinManifest from "../../skin-manifest.json";
import type { DisplayState, JsonMap, PluginManifest, SensorListItem, VisualizerStatus, WebUISkin } from "../api/types";
import {
  defaultPresetLabel,
  ensurePresetSlots,
  hiddenMainMenuItemIdsForSettings,
  mainMenuItemsForSettings,
  MAX_PRESET_SLOT_COUNT,
  MIN_PRESET_SLOT_COUNT,
  type SkinSettings
} from "../state/skinSettings";

const WORKFLOW_SKIN_ID = "workflow-skin";
const CURRENT_SKIN_VERSION = typeof skinManifest.version === "string" ? skinManifest.version : "";

type SkinUpdateStatus = { type: "success" | "error"; message: string };
export type SkinUpdatePhase = "idle" | "checking" | "downloading";

function pluginLine(plugin: PluginManifest | null | undefined): string {
  if (!plugin) return "Not installed";
  const loaded = plugin.loaded ? "Loaded" : "Disabled";
  const autoLoad = plugin.autoLoad ? "Auto-load on" : "Auto-load off";
  const version = plugin.version ? `v${plugin.version}` : "version unknown";
  return `${loaded} · ${autoLoad} · ${version}`;
}

function hasCredential(settings: JsonMap | null | undefined, key: string): boolean {
  const value = settings?.[key];
  return typeof value === "string" && value.trim().length > 0;
}

function visualizerSettingsLine(settings: JsonMap | null | undefined): string {
  const credentials = hasCredential(settings, "Username") && hasCredential(settings, "Password") ? "Credentials configured" : "Credentials missing";
  const autoUpload = settings?.AutoUpload === false ? "Auto upload off" : "Auto upload on";
  const backSync = settings?.BackSync ? "Back-sync on" : "Back-sync off";
  return `${credentials} · ${autoUpload} · ${backSync}`;
}

function statusString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function visualizerUploadLine(status: VisualizerStatus | null | undefined): string {
  const reaId = statusString(status?.lastUpload?.reaId);
  const visId = statusString(status?.lastUpload?.visId);
  if (reaId && visId) return `Last upload ${visId} from ${reaId}`;
  return "No upload recorded";
}

function visualizerSyncLine(status: VisualizerStatus | null | undefined): string {
  const backError = statusString(status?.backSyncStatus?.lastError);
  const forwardError = statusString(status?.forwardSyncStatus?.lastError);
  if (backError || forwardError) return `Sync issue: ${backError ?? forwardError}`;
  const backResult = statusString(status?.backSyncStatus?.lastResult);
  const forwardResult = statusString(status?.forwardSyncStatus?.lastResult);
  return [backResult, forwardResult].filter(Boolean).join(" · ") || "No sync activity";
}

function skinName(skin: WebUISkin | null | undefined): string {
  return skin?.name || skin?.id || "Unknown skin";
}

function installedSkinLine(skin: WebUISkin | null | undefined): string {
  if (!skin) return "Not listed by ReaPrime";
  return `${skinName(skin)}${skin.version ? ` v${skin.version}` : ""}`;
}

function versionParts(value: string): number[] | null {
  const clean = value.trim().replace(/^v/i, "").split("-", 1)[0];
  if (!/^\d+(?:\.\d+)*$/.test(clean)) return null;
  return clean.split(".").map((part) => Number(part));
}

function compareVersions(left: string, right: string): number | null {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  if (!leftParts || !rightParts) return null;
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart !== rightPart) return leftPart > rightPart ? 1 : -1;
  }
  return 0;
}

function skinUpdateLine(skin: WebUISkin | null | undefined, phase: SkinUpdatePhase): string {
  if (phase === "checking") return "Checking for skin updates...";
  if (phase === "downloading") return "Downloading update...";
  if (!skin) return "Skin status unavailable.";

  const installedVersion = skin.version?.trim();
  if (!installedVersion || !CURRENT_SKIN_VERSION) return "Skin version unknown.";

  const comparison = compareVersions(installedVersion, CURRENT_SKIN_VERSION);
  if (comparison === null) return `Skin version ${installedVersion} installed.`;
  if (comparison < 0) return `Update available: v${CURRENT_SKIN_VERSION} is available (installed v${installedVersion}).`;
  if (comparison > 0) return `Installed skin v${installedVersion} is newer than this build v${CURRENT_SKIN_VERSION}.`;
  return "The skin is up-to-date.";
}

function brightnessValue(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 8;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function normalizeDraftSettings(settings: SkinSettings): SkinSettings {
  const presetSlotCount = Math.min(MAX_PRESET_SLOT_COUNT, Math.max(MIN_PRESET_SLOT_COUNT, Math.round(settings.presetSlotCount || 4)));
  const next: SkinSettings = {
    ...settings,
    presetSlotCount,
    presetSlots: ensurePresetSlots(settings.presetSlots, presetSlotCount),
    skinTitle: settings.skinTitle.trim() || "Workflow",
    skinUpdateRepo: settings.skinUpdateRepo.trim(),
    skinUpdateAsset: settings.skinUpdateAsset.trim() || "workflow-skin.zip",
    mainMenuItems: mainMenuItemsForSettings(settings),
    hiddenMainMenuItemIds: hiddenMainMenuItemIdsForSettings(settings),
    keepScreenAwake: settings.keepScreenAwake !== false,
    screensaverBrightness: brightnessValue(settings.screensaverBrightness),
    skinAutoUpdateEnabled: Boolean(settings.skinAutoUpdateEnabled),
    skinUpdatePrerelease: Boolean(settings.skinUpdatePrerelease)
  };

  if (!next.r2SensorId) delete next.r2SensorId;
  return next;
}

function sourceLine(skin: WebUISkin | null | undefined): string {
  const source = skin?.reaMetadata?.sourceUrl;
  return source ? `Remote source: ${source}` : "Remote source not registered";
}

export function SettingsPage({
  settings,
  r2Sensor,
  onUpdateSettings,
  displayState,
  visualizerPlugin,
  visualizerSettings,
  visualizerStatus,
  webuiSkins,
  defaultWebuiSkin,
  skinUpdateStatus,
  skinUpdateBusy,
  skinUpdatePhase = "idle",
  mainMenuEditing = false,
  onToggleMainMenuEditing,
  onCheckSkinUpdates,
  onInstallSkinUpdate
}: {
  settings: SkinSettings;
  r2Sensor: SensorListItem | null;
  onUpdateSettings: (settings: SkinSettings) => void;
  displayState?: DisplayState | null;
  visualizerPlugin?: PluginManifest | null;
  visualizerSettings?: JsonMap | null;
  visualizerStatus?: VisualizerStatus | null;
  webuiSkins?: WebUISkin[];
  defaultWebuiSkin?: WebUISkin | null;
  skinUpdateStatus?: SkinUpdateStatus | null;
  skinUpdateBusy?: boolean;
  skinUpdatePhase?: SkinUpdatePhase;
  mainMenuEditing?: boolean;
  onToggleMainMenuEditing?: (editing: boolean) => void;
  onCheckSkinUpdates?: () => Promise<void> | void;
  onInstallSkinUpdate?: () => Promise<void> | void;
}) {
  const [draftSettings, setDraftSettings] = useState(settings);
  const [acknowledgedSettings, setAcknowledgedSettings] = useState(settings);
  const savedSettings = normalizeDraftSettings(acknowledgedSettings);
  const nextSettings = normalizeDraftSettings(draftSettings);
  const settingsChanged = JSON.stringify(nextSettings) !== JSON.stringify(savedSettings);
  const r2Configured = Boolean(draftSettings.r2SensorId);
  const screensaverBrightness = brightnessValue(draftSettings.screensaverBrightness);
  const workflowSkin = webuiSkins?.find((skin) => skin.id === WORKFLOW_SKIN_ID) ?? (defaultWebuiSkin?.id === WORKFLOW_SKIN_ID ? defaultWebuiSkin : null);

  useEffect(() => {
    setDraftSettings(settings);
    setAcknowledgedSettings(settings);
  }, [settings]);

  const updateDraftSettings = (patch: Partial<SkinSettings>) => {
    setDraftSettings((current) => ({ ...current, ...patch }));
  };

  const updatePresetCount = (value: number) => {
    const presetSlotCount = Math.min(MAX_PRESET_SLOT_COUNT, Math.max(MIN_PRESET_SLOT_COUNT, Math.round(value)));
    setDraftSettings((current) => ({
      ...current,
      presetSlotCount,
      presetSlots: ensurePresetSlots(current.presetSlots, presetSlotCount)
    }));
  };

  const updatePresetTitle = (index: number, label: string) => {
    setDraftSettings((current) => {
      const slots = ensurePresetSlots(current.presetSlots, current.presetSlotCount);
      slots[index] = { ...slots[index], label };
      return { ...current, presetSlots: slots };
    });
  };

  const updateR2SensorId = (sensorId: string | undefined) => {
    setDraftSettings((current) => {
      if (sensorId) return { ...current, r2SensorId: sensorId };
      const next = { ...current };
      delete next.r2SensorId;
      return next;
    });
  };

  const saveSettings = () => {
    setAcknowledgedSettings(nextSettings);
    setDraftSettings(nextSettings);
    onUpdateSettings(nextSettings);
  };

  return (
    <div className="panel wide">
      <h2>Settings</h2>
      <div className="list-row">
        <strong>Skin title</strong>
        <label className="settings-field">
          Skin title
          <input value={draftSettings.skinTitle} onChange={(event) => updateDraftSettings({ skinTitle: event.target.value })} />
        </label>
      </div>
      <div className="list-row">
        <strong>Creator</strong>
        <span>Roy Ackerman</span>
      </div>
      <div className="list-row settings-update-row">
        <strong>Main menu</strong>
        <span>{mainMenuEditing ? "Editing is active in the left menu." : "Start editing to hide or reorder items directly in the left menu."}</span>
        <div className="profile-workflow-controls">
          <button type="button" className={mainMenuEditing ? "ghost-button" : "primary-button"} onClick={() => onToggleMainMenuEditing?.(!mainMenuEditing)}>
            {mainMenuEditing ? "Done editing main menu" : "Edit main menu in sidebar"}
          </button>
        </div>
      </div>
      <div className="list-row settings-update-row">
        <strong>Main page presets</strong>
        <label className="settings-field">
          Preset cards on main page
          <input
            aria-label="Preset cards on main page"
            type="number"
            min={MIN_PRESET_SLOT_COUNT}
            max={MAX_PRESET_SLOT_COUNT}
            value={draftSettings.presetSlotCount}
            onChange={(event) => updatePresetCount(Number(event.target.value))}
          />
        </label>
        <div className="settings-preset-title-grid">
          {ensurePresetSlots(draftSettings.presetSlots, draftSettings.presetSlotCount)
            .slice(0, draftSettings.presetSlotCount)
            .map((slot, index) => (
              <label className="settings-field" key={index}>
                Preset {index + 1} title
                <input
                  aria-label={`Preset ${index + 1} title`}
                  value={slot.label}
                  placeholder={defaultPresetLabel(index)}
                  onChange={(event) => updatePresetTitle(index, event.target.value)}
                />
              </label>
            ))}
        </div>
      </div>
      <div className="list-row settings-update-row">
        <strong>Skin updates</strong>
        <span className={skinUpdatePhase === "idle" ? "settings-update-state" : "settings-update-state busy"}>{skinUpdateLine(workflowSkin, skinUpdatePhase)}</span>
        <span>Installed: {installedSkinLine(workflowSkin)}</span>
        <span>Default skin: {skinName(defaultWebuiSkin)}</span>
        <span>{sourceLine(workflowSkin)}</span>
        <label className="inline-toggle">
          <input
            type="checkbox"
            checked={draftSettings.skinAutoUpdateEnabled}
            onChange={(event) => updateDraftSettings({ skinAutoUpdateEnabled: event.target.checked })}
          />
          Auto update this skin on startup
        </label>
        <div className="settings-update-grid">
          <label className="settings-field">
            GitHub repo
            <input
              value={draftSettings.skinUpdateRepo}
              placeholder="owner/repo"
              onChange={(event) => updateDraftSettings({ skinUpdateRepo: event.target.value })}
            />
          </label>
          <label className="settings-field">
            Release asset
            <input
              value={draftSettings.skinUpdateAsset}
              placeholder="workflow-skin.zip"
              onChange={(event) => updateDraftSettings({ skinUpdateAsset: event.target.value })}
            />
          </label>
          <label className="inline-toggle settings-update-prerelease">
            <input
              type="checkbox"
              checked={draftSettings.skinUpdatePrerelease}
              onChange={(event) => updateDraftSettings({ skinUpdatePrerelease: event.target.checked })}
            />
            Include prereleases
          </label>
        </div>
        <div className="profile-workflow-controls">
          <button type="button" className="primary-button" disabled={skinUpdateBusy || !onCheckSkinUpdates} onClick={() => void onCheckSkinUpdates?.()}>
            Check for skin updates
          </button>
          <button
            type="button"
            className="ghost-button"
            disabled={skinUpdateBusy || !onInstallSkinUpdate || !draftSettings.skinUpdateRepo.trim() || settingsChanged}
            onClick={() => void onInstallSkinUpdate?.()}
          >
            Install/update from GitHub release
          </button>
        </div>
        {settingsChanged && <span className="settings-draft-status">Save settings before installing GitHub release updates.</span>}
        {skinUpdateStatus && <span className={skinUpdateStatus.type === "error" ? "settings-update-status error" : "settings-update-status"}>{skinUpdateStatus.message}</span>}
      </div>
      <div className="list-row">
        <strong>Native display</strong>
        <span>Brightness {displayState?.brightness ?? displayState?.requestedBrightness ?? "unknown"}%</span>
        <span>{displayState?.wakeLockOverride ? "Wake-lock on" : "Wake-lock off"}</span>
        <label className="inline-toggle">
          <input
            type="checkbox"
            checked={draftSettings.keepScreenAwake !== false}
            onChange={(event) => updateDraftSettings({ keepScreenAwake: event.target.checked })}
          />
          Keep screen awake while the skin is open
        </label>
        <label className="settings-field settings-slider-field">
          <span>Screensaver brightness</span>
          <span className="settings-slider-row">
            <input
              aria-label="Screensaver brightness"
              type="range"
              min={0}
              max={100}
              step={1}
              value={screensaverBrightness}
              onChange={(event) => updateDraftSettings({ screensaverBrightness: Number(event.target.value) })}
            />
            <strong className="settings-slider-value">{screensaverBrightness}%</strong>
          </span>
        </label>
      </div>
      <div className="list-row">
        <strong>Visualizer</strong>
        <span>{visualizerPlugin?.name ?? "Visualizer plugin not installed"}</span>
        <span>{pluginLine(visualizerPlugin)}</span>
        <span>{visualizerSettingsLine(visualizerSettings)}</span>
        <span>{visualizerUploadLine(visualizerStatus)}</span>
        <span>{visualizerSyncLine(visualizerStatus)}</span>
      </div>
      <div className="list-row">
        <strong>DiFluid R2 status</strong>
        <span>{r2Configured ? `Configured sensor: ${draftSettings.r2SensorId}` : "R2 status is hidden until setup."}</span>
        <div className="profile-workflow-controls">
          <button
            type="button"
            className="primary-button"
            disabled={!r2Sensor}
            onClick={() => r2Sensor && updateR2SensorId(r2Sensor.id)}
          >
            {r2Sensor ? "Use detected R2" : "No R2 detected"}
          </button>
          {r2Configured && (
            <button type="button" className="ghost-button" onClick={() => updateR2SensorId(undefined)}>
              Hide R2 status
            </button>
          )}
        </div>
      </div>
      <div className="settings-save-actions">
        <button type="button" className="primary-button settings-save-button" disabled={!settingsChanged} onClick={saveSettings}>
          Save settings
        </button>
      </div>
    </div>
  );
}
