import { useEffect, useState } from "react";
import type { DisplayState, JsonMap, PluginManifest, SensorListItem, VisualizerStatus, WebUISkin } from "../api/types";
import type { SkinSettings } from "../state/skinSettings";

const WORKFLOW_SKIN_ID = "workflow-skin";

type SkinUpdateStatus = { type: "success" | "error"; message: string };

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

function brightnessValue(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 8;
  return Math.min(100, Math.max(0, Math.round(value)));
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
  onCheckSkinUpdates?: () => Promise<void> | void;
  onInstallSkinUpdate?: () => Promise<void> | void;
}) {
  const r2Configured = Boolean(settings.r2SensorId);
  const [title, setTitle] = useState(settings.skinTitle);
  const [updateRepo, setUpdateRepo] = useState(settings.skinUpdateRepo);
  const [updateAsset, setUpdateAsset] = useState(settings.skinUpdateAsset);
  const screensaverBrightness = brightnessValue(settings.screensaverBrightness);
  const workflowSkin = webuiSkins?.find((skin) => skin.id === WORKFLOW_SKIN_ID) ?? (defaultWebuiSkin?.id === WORKFLOW_SKIN_ID ? defaultWebuiSkin : null);

  useEffect(() => {
    setTitle(settings.skinTitle);
  }, [settings.skinTitle]);

  useEffect(() => {
    setUpdateRepo(settings.skinUpdateRepo);
  }, [settings.skinUpdateRepo]);

  useEffect(() => {
    setUpdateAsset(settings.skinUpdateAsset);
  }, [settings.skinUpdateAsset]);

  const updateTitle = (value: string) => {
    setTitle(value);
    onUpdateSettings({ ...settings, skinTitle: value.trim() || "Workflow" });
  };

  const updateSkinRepo = (value: string) => {
    setUpdateRepo(value);
    onUpdateSettings({ ...settings, skinUpdateRepo: value });
  };

  const updateSkinAsset = (value: string) => {
    setUpdateAsset(value);
    onUpdateSettings({ ...settings, skinUpdateAsset: value });
  };

  return (
    <div className="panel wide">
      <h2>Settings</h2>
      <div className="list-row">
        <strong>Skin title</strong>
        <label className="settings-field">
          Skin title
          <input value={title} onChange={(event) => updateTitle(event.target.value)} />
        </label>
      </div>
      <div className="list-row">
        <strong>Creator</strong>
        <span>Roy Ackerman</span>
      </div>
      <div className="list-row settings-update-row">
        <strong>Skin updates</strong>
        <span>Installed: {installedSkinLine(workflowSkin)}</span>
        <span>Default skin: {skinName(defaultWebuiSkin)}</span>
        <span>{sourceLine(workflowSkin)}</span>
        <label className="inline-toggle">
          <input
            type="checkbox"
            checked={settings.skinAutoUpdateEnabled}
            onChange={(event) => onUpdateSettings({ ...settings, skinAutoUpdateEnabled: event.target.checked })}
          />
          Auto update this skin on startup
        </label>
        <div className="settings-update-grid">
          <label className="settings-field">
            GitHub repo
            <input
              value={updateRepo}
              placeholder="owner/repo"
              onChange={(event) => updateSkinRepo(event.target.value)}
            />
          </label>
          <label className="settings-field">
            Release asset
            <input
              value={updateAsset}
              placeholder="workflow-skin.zip"
              onChange={(event) => updateSkinAsset(event.target.value)}
            />
          </label>
          <label className="inline-toggle settings-update-prerelease">
            <input
              type="checkbox"
              checked={settings.skinUpdatePrerelease}
              onChange={(event) => onUpdateSettings({ ...settings, skinUpdatePrerelease: event.target.checked })}
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
            disabled={skinUpdateBusy || !onInstallSkinUpdate || !updateRepo.trim()}
            onClick={() => void onInstallSkinUpdate?.()}
          >
            Install/update from GitHub release
          </button>
        </div>
        {skinUpdateStatus && <span className={skinUpdateStatus.type === "error" ? "settings-update-status error" : "settings-update-status"}>{skinUpdateStatus.message}</span>}
      </div>
      <div className="list-row">
        <strong>Native display</strong>
        <span>Brightness {displayState?.brightness ?? displayState?.requestedBrightness ?? "unknown"}%</span>
        <span>{displayState?.wakeLockOverride ? "Wake-lock on" : "Wake-lock off"}</span>
        <label className="inline-toggle">
          <input
            type="checkbox"
            checked={settings.keepScreenAwake !== false}
            onChange={(event) => onUpdateSettings({ ...settings, keepScreenAwake: event.target.checked })}
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
              onChange={(event) => onUpdateSettings({ ...settings, screensaverBrightness: Number(event.target.value) })}
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
        <span>{r2Configured ? `Configured sensor: ${settings.r2SensorId}` : "R2 status is hidden until setup."}</span>
        <div className="profile-workflow-controls">
          <button
            type="button"
            className="primary-button"
            disabled={!r2Sensor}
            onClick={() => r2Sensor && onUpdateSettings({ ...settings, r2SensorId: r2Sensor.id })}
          >
            {r2Sensor ? "Use detected R2" : "No R2 detected"}
          </button>
          {r2Configured && (
            <button type="button" className="ghost-button" onClick={() => onUpdateSettings({ ...settings, r2SensorId: undefined })}>
              Hide R2 status
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
