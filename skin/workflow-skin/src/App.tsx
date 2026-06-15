import {
  Activity,
  Coffee,
  Flame,
  Gauge,
  History,
  Maximize2,
  Minimize2,
  Moon,
  NotebookPen,
  PackageOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  SlidersHorizontal
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import skinManifest from "../skin-manifest.json";
import { apiBaseUrl, ReaPrimeApi, ReaPrimeApiError, type CreateGrinderPayload } from "./api/reaprime";
import { findDifluidR2Sensor } from "./api/sensors";
import type { DeviceInfo, Grinder, MachineState, Profile, ProfileRecord, SensorListItem, ShotAnnotations, ShotRecord, ShotSnapshot, WebUISkin, Workflow } from "./api/types";
import { uploadShotToVisualizer } from "./api/visualizer";
import type { Bag } from "./lib/bags";
import { buildConnectivityStatuses } from "./lib/connectivity";
import type { ConnectivityStatus } from "./lib/connectivity";
import { trimLiveGraphWarmup } from "./lib/liveMeasurements";
import { machineModeLabel, machineTemperature } from "./lib/machineState";
import { postActivityPage, selectedProfileIdFromWorkflow, type CompletedWorkflowActivity } from "./lib/workflowRouting";
import { BagsPage } from "./pages/BagsPage";
import { BrewPage } from "./pages/BrewPage";
import { GrindersPage } from "./pages/GrindersPage";
import { HistoryPage } from "./pages/HistoryPage";
import { LivePage } from "./pages/LivePage";
import { ProfilesPage } from "./pages/ProfilesPage";
import { ReviewPage } from "./pages/ReviewPage";
import { ScreensaverPage } from "./pages/ScreensaverPage";
import { SettingsPage, type SkinUpdatePhase } from "./pages/SettingsPage";
import { SteamPage } from "./pages/SteamPage";
import {
  MAIN_MENU_ITEM_LABELS,
  activeSkinTheme,
  topStatusIndicatorIdsForSettings,
  visibleMainMenuItems,
  isProfileShown,
  profileWorkflowFor,
  type MainMenuItemId,
  type ProfileWorkflowSettings,
  type SkinSettings,
  type TopStatusIndicatorId
} from "./state/skinSettings";
import { useLiveTelemetry } from "./state/useLiveTelemetry";
import { useReaData } from "./state/useReaData";

type Page = MainMenuItemId | "screensaver";
type SkinUpdateSource = "release" | "branch";

const POST_ACTIVITY_ROUTE_DELAY_MS = 1000;
const ACTIVE_MACHINE_STATE_POLL_MS = 500;
const WORKFLOW_SKIN_ID = "workflow-skin";
const CURRENT_SKIN_VERSION = typeof skinManifest.version === "string" ? skinManifest.version : "";

interface TopStatusIndicator {
  id: TopStatusIndicatorId;
  label: string;
  detail: string;
  connected: boolean;
}

const navById: Record<MainMenuItemId, { label: string; icon: React.ComponentType<{ className?: string; size?: number }> }> = {
  brew: { label: MAIN_MENU_ITEM_LABELS.brew, icon: Coffee },
  live: { label: MAIN_MENU_ITEM_LABELS.live, icon: Activity },
  review: { label: MAIN_MENU_ITEM_LABELS.review, icon: NotebookPen },
  steam: { label: MAIN_MENU_ITEM_LABELS.steam, icon: Flame },
  bags: { label: MAIN_MENU_ITEM_LABELS.bags, icon: PackageOpen },
  profiles: { label: MAIN_MENU_ITEM_LABELS.profiles, icon: SlidersHorizontal },
  grinders: { label: MAIN_MENU_ITEM_LABELS.grinders, icon: Gauge },
  history: { label: MAIN_MENU_ITEM_LABELS.history, icon: History },
  settings: { label: MAIN_MENU_ITEM_LABELS.settings, icon: Settings }
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function statusSentence(message: unknown, fallback: string): string {
  const text = typeof message === "string" && message.trim() ? message.trim() : fallback;
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function githubReleaseMissing(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return message.includes("github-release") && (message.includes("404") || message.includes("not found") || message.includes("failed to fetch github release"));
}

function rawGithubBranchPath(branch: string): string | null {
  const cleanBranch = branch.trim().replace(/^\/+|\/+$/g, "");
  if (!cleanBranch || cleanBranch.includes("..") || !/^[A-Za-z0-9._/-]+$/.test(cleanBranch)) return null;
  return cleanBranch
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function githubWorkflowSkinFileUrl(repo: string, branch: string, path: string): string | null {
  const normalizedRepo = normalizedGithubRepo(repo);
  const branchPath = rawGithubBranchPath(branch);
  if (!normalizedRepo || !branchPath || !path) return null;
  return `https://raw.githubusercontent.com/${normalizedRepo}/${branchPath}/skin/workflow-skin/${path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

function githubWorkflowZipUrl(repo: string, branch: string, asset: string): string | null {
  const cleanAsset = asset.trim() || "workflow-skin.zip";

  if (!/^[A-Za-z0-9_.-]+\.zip$/.test(cleanAsset)) return null;

  return githubWorkflowSkinFileUrl(repo, branch, cleanAsset);
}

function normalizedGithubRepo(repo: string): string | null {
  const normalizedRepo = repo
    .trim()
    .replace(/^https:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/^\/+|\/+$/g, "");

  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalizedRepo) ? normalizedRepo : null;
}

function versionFromGithubTag(tag: unknown): string | null {
  if (typeof tag !== "string") return null;
  const clean = tag.trim().replace(/^v/i, "");
  return clean ? clean : null;
}

function releaseVersionFromPayload(payload: unknown): string | null {
  const releases = Array.isArray(payload) ? payload : [payload];
  for (const release of releases) {
    if (!release || typeof release !== "object") continue;
    if ((release as { draft?: unknown }).draft === true) continue;
    const version = versionFromGithubTag((release as { tag_name?: unknown }).tag_name);
    if (version) return version;
  }
  return null;
}

async function fetchLatestGithubReleaseVersion(repo: string, includePrerelease: boolean): Promise<string | null> {
  const normalizedRepo = normalizedGithubRepo(repo);
  if (!normalizedRepo) return null;

  const url = includePrerelease
    ? `https://api.github.com/repos/${normalizedRepo}/releases`
    : `https://api.github.com/repos/${normalizedRepo}/releases/latest`;
  const response = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) throw new Error(`GitHub release check failed: ${response.status}`);
  return releaseVersionFromPayload(await response.json());
}

function manifestVersionFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const version = (payload as { version?: unknown }).version;
  return typeof version === "string" && version.trim() ? version.trim() : null;
}

async function fetchGithubSkinManifestVersion(repo: string, branch: string): Promise<string | null> {
  const url = githubWorkflowSkinFileUrl(repo, branch, "skin-manifest.json");
  if (!url) return null;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`GitHub skin manifest check failed: ${response.status}`);
  return manifestVersionFromPayload(await response.json());
}

function versionPartsForBest(value: string): number[] | null {
  const clean = value.trim().replace(/^v/i, "").split("-", 1)[0];
  if (!/^\d+(?:\.\d+)*$/.test(clean)) return null;
  return clean.split(".").map((part) => Number(part));
}

function compareVersionStrings(left: string, right: string): number | null {
  const leftParts = versionPartsForBest(left);
  const rightParts = versionPartsForBest(right);
  if (!leftParts || !rightParts) return null;
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart !== rightPart) return leftPart > rightPart ? 1 : -1;
  }
  return 0;
}

function newestSkinUpdate(releaseVersion: string | null | undefined, manifestVersion: string | null | undefined): { version: string; source: SkinUpdateSource } | null {
  const release = releaseVersion?.trim();
  const manifest = manifestVersion?.trim();
  if (!release && !manifest) return null;
  if (!release) return { version: manifest!, source: "branch" };
  if (!manifest) return { version: release, source: "release" };

  const comparison = compareVersionStrings(manifest, release);
  return comparison !== null && comparison > 0 ? { version: manifest, source: "branch" } : { version: release, source: "release" };
}

function versionLabel(value: string | null | undefined): string {
  const clean = value?.trim().replace(/^v/i, "");
  return clean ? `v${clean}` : "Version unknown";
}

function workflowSkinFromList(webuiSkins: WebUISkin[] | undefined, defaultWebuiSkin: WebUISkin | null | undefined): WebUISkin | null {
  return webuiSkins?.find((skin) => skin.id === WORKFLOW_SKIN_ID) ?? (defaultWebuiSkin?.id === WORKFLOW_SKIN_ID ? defaultWebuiSkin : null);
}

function dateOnlyToIsoDateTime(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T00:00:00Z` : trimmed;
}

function extractNumericTds(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (!value || typeof value !== "object") return null;
  if ("key" in value && String((value as { key?: unknown }).key).toLowerCase() === "tds") {
    const tds = extractNumericTds((value as { value?: unknown }).value);
    if (tds !== null) return tds;
  }
  if ("tds" in value) {
    const tds = extractNumericTds((value as { tds?: unknown }).tds);
    if (tds !== null) return tds;
  }
  if ("data" in value) {
    const tds = extractNumericTds((value as { data?: unknown }).data);
    if (tds !== null) return tds;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const tds = extractNumericTds(item);
      if (tds !== null) return tds;
    }
  }
  return null;
}

function extractR2Tds(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const result = (value as { result?: unknown }).result;
  if (result && typeof result === "object") {
    const tds = extractR2Tds(result);
    if (tds !== null) return tds;
  }
  const reading = (value as { reading?: unknown }).reading;
  if (reading && typeof reading === "object") {
    return extractNumericTds((reading as { tds?: unknown }).tds);
  }
  return extractNumericTds(value);
}

function replaceProfileIdInSettings(settings: SkinSettings, fromId: string, toId: string): SkinSettings {
  if (fromId === toId) return settings;

  const reviewEnabledByProfile = { ...settings.reviewEnabledByProfile };
  if (Object.prototype.hasOwnProperty.call(reviewEnabledByProfile, fromId)) {
    reviewEnabledByProfile[toId] = reviewEnabledByProfile[fromId];
    delete reviewEnabledByProfile[fromId];
  }

  const profileWorkflows = { ...settings.profileWorkflows };
  if (Object.prototype.hasOwnProperty.call(profileWorkflows, fromId)) {
    profileWorkflows[toId] = profileWorkflows[fromId];
    delete profileWorkflows[fromId];
  }

  return {
    ...settings,
    presetSlots: settings.presetSlots.map((slot) => (slot.profileId === fromId ? { ...slot, profileId: toId } : slot)),
    startupProfileId: settings.startupProfileId === fromId ? toId : settings.startupProfileId,
    shownProfileIds: Array.from(new Set(settings.shownProfileIds.map((id) => (id === fromId ? toId : id)))),
    reviewEnabledByProfile,
    profileWorkflows
  };
}

function statusPopoverTitle(status: Pick<TopStatusIndicator, "id" | "label">): string {
  if (status.id === "wifi") return "Machine IP address";
  if (status.id === "water") return "Current water level";
  return `${status.label} status`;
}

function deviceLabel(device: DeviceInfo): string {
  return `${device.type ?? ""} ${device.name ?? ""} ${device.id}`.toLowerCase();
}

function isScaleDeviceCandidate(device: DeviceInfo): boolean {
  const label = deviceLabel(device);
  return (
    device.type === "scale" ||
    label.includes("scale") ||
    label.includes("microbalance") ||
    label.includes("acaia") ||
    label.includes("hiroia") ||
    label.includes("lunar") ||
    label.includes("pearl") ||
    label.includes("felicita") ||
    label.includes("bookoo") ||
    label.includes("boo koo") ||
    label.includes("decent scale")
  );
}

function isConnectedDevice(device: DeviceInfo): boolean {
  return ["connected", "ready", "online"].includes(device.state?.trim().toLowerCase() ?? "");
}

function hasConnectedScale(devices: DeviceInfo[]): boolean {
  return devices.some((device) => isScaleDeviceCandidate(device) && isConnectedDevice(device) && !isR2Device(device));
}

function isConfiguredR2Device(device: DeviceInfo, configuredR2DeviceId: string | undefined): boolean {
  return Boolean(configuredR2DeviceId && device.id === configuredR2DeviceId);
}

function isConnectableStartupDevice(device: DeviceInfo, configuredR2DeviceId: string | undefined): boolean {
  const isScale = isScaleDeviceCandidate(device) && !isR2Device(device);
  const shouldConnectR2 = Boolean(configuredR2DeviceId && (isConfiguredR2Device(device, configuredR2DeviceId) || isR2Device(device)));
  return (device.type === "machine" || isScale || shouldConnectR2) && !isConnectedDevice(device);
}

function uniqueDevices(devices: DeviceInfo[]): DeviceInfo[] {
  const byId = new Map<string, DeviceInfo>();
  for (const device of devices) {
    const current = byId.get(device.id);
    if (!current) {
      byId.set(device.id, device);
      continue;
    }
    byId.set(device.id, {
      ...current,
      ...device,
      state: isConnectedDevice(current) && !isConnectedDevice(device) ? current.state : device.state
    });
  }
  return Array.from(byId.values());
}

function isR2Device(device: DeviceInfo): boolean {
  const label = deviceLabel(device);
  return label.includes("difluid") || label.includes("r2");
}

function waitForNativeUpdate(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function findR2SensorWithRetry(api: ReaPrimeApi, fallbackSensors: SensorListItem[]): Promise<SensorListItem | null> {
  let latestSensors = fallbackSensors;
  for (const delay of [0, 450, 1200]) {
    if (delay > 0) await waitForNativeUpdate(delay);
    latestSensors = await api.listSensors().catch(() => latestSensors);
    const sensor = findDifluidR2Sensor(latestSensors);
    if (sensor) return sensor;
  }
  return findDifluidR2Sensor(latestSensors);
}

function r2MeasurementNeedsReconnect(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("flutterblueplus") ||
    normalized.includes("fbp-code") ||
    normalized.includes("timed out") ||
    normalized.includes("timeout") ||
    normalized.includes("not connected") ||
    normalized.includes("disconnected") ||
    normalized.includes("connect failed")
  );
}

function isSleepingMachine(machineState: MachineState | null): boolean {
  return isSleepingMode(machineState?.state?.state);
}

function screensaverBrightnessValue(value: number | undefined): number {
  return Math.min(100, Math.max(0, Math.round(value ?? 8)));
}

function compactMachineMode(state: string | undefined): string {
  return state?.trim().toLowerCase().replace(/[^a-z]/g, "") ?? "";
}

function isBrewingMode(state: string | undefined): boolean {
  const mode = compactMachineMode(state);
  return mode === "espresso" || mode === "brewing";
}

function isSteamingMode(state: string | undefined): boolean {
  const mode = compactMachineMode(state);
  return mode === "steam" || mode === "steaming";
}

function isIdleMode(state: string | undefined): boolean {
  return compactMachineMode(state) === "idle";
}

function workflowActivityForMode(state: string | undefined): CompletedWorkflowActivity | null {
  if (isBrewingMode(state)) return "brew";
  if (isSteamingMode(state)) return "steam";
  return null;
}

function isSleepingMode(state: string | undefined): boolean {
  return compactMachineMode(state) === "sleeping";
}

async function wakeMachineIfNeeded(api: ReaPrimeApi, fallbackMachineState: MachineState | null): Promise<MachineState | null> {
  const latestState = await api.getMachineState().catch(() => fallbackMachineState);
  if (!isSleepingMachine(latestState)) return latestState;

  await api.wakeMachine().catch(() => undefined);
  void scanScaleDuringMachineWake(api);

  let nextState: MachineState | null = latestState;
  for (const delay of [250, 750, 1500]) {
    await waitForNativeUpdate(delay);
    nextState = await api.getMachineState().catch(() => nextState);
    if (!isSleepingMachine(nextState)) return nextState;
  }

  return nextState;
}

async function scanScaleDuringMachineWake(api: ReaPrimeApi): Promise<void> {
  const scannedDevices = await api.scanDevices({ connect: true, quick: false }).catch(() => [] as DeviceInfo[]);
  const scaleDevices = scannedDevices.filter((device) => isScaleDeviceCandidate(device) && !isConnectedDevice(device) && !isR2Device(device));
  for (const device of scaleDevices) {
    await api.connectDevice(device.id).catch(() => undefined);
  }
}

function autoSleepCheckIntervalMs(idleLimitMs: number): number {
  return Math.min(30_000, Math.max(1_000, Math.floor(idleLimitMs / 4)));
}

function latestMachineSnapshot(measurements: ShotSnapshot[]): ShotSnapshot["machine"] | undefined {
  return measurements.length > 0 ? measurements[measurements.length - 1]?.machine : undefined;
}

function shotWithFallbackMeasurements(shot: ShotRecord, fallbackMeasurements: ShotSnapshot[]): ShotRecord {
  const trimmedFallbackMeasurements = trimLiveGraphWarmup(fallbackMeasurements);
  if ((shot.measurements?.length ?? 0) > 0 || trimmedFallbackMeasurements.length === 0) return shot;
  return { ...shot, measurements: trimmedFallbackMeasurements };
}

function mergeReviewShot(cachedShot: ShotRecord | null, refreshedShot: ShotRecord | undefined): ShotRecord | null {
  if (!cachedShot) return refreshedShot ?? null;
  if (!refreshedShot) return cachedShot;

  const cachedMeasurements = cachedShot.measurements ?? [];
  const refreshedMeasurements = refreshedShot.measurements ?? [];
  return {
    ...cachedShot,
    ...refreshedShot,
    annotations: { ...cachedShot.annotations, ...refreshedShot.annotations },
    measurements: refreshedMeasurements.length >= cachedMeasurements.length ? refreshedMeasurements : cachedMeasurements
  };
}

function formatTopNumber(value: number | null | undefined, unit: string): string {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(1)}${unit}` : "—";
}

function buildTopStatusIndicators({
  statuses,
  indicatorIds,
  machineState,
  liveMeasurements
}: {
  statuses: ConnectivityStatus[];
  indicatorIds: TopStatusIndicatorId[];
  machineState: MachineState | null;
  liveMeasurements: ShotSnapshot[];
}): TopStatusIndicator[] {
  const liveMachine = latestMachineSnapshot(liveMeasurements);
  const statusById = new Map(statuses.map((status) => [status.id, status]));
  const all: Record<TopStatusIndicatorId, TopStatusIndicator | null> = {
    machine: statusById.get("machine") ?? null,
    wifi: statusById.get("wifi") ?? null,
    scale: statusById.get("scale") ?? null,
    water: statusById.get("water") ?? null,
    r2: statusById.get("r2") ?? null,
    state: { id: "state", label: "State", detail: machineModeLabel(machineState, liveMachine), connected: machineState?.connected !== false },
    temperature: { id: "temperature", label: "Temp", detail: formatTopNumber(machineTemperature(machineState, liveMachine), "°C"), connected: true },
    pressure: { id: "pressure", label: "Bar", detail: formatTopNumber(liveMachine?.pressure ?? machineState?.pressure, " bar"), connected: true },
    flow: { id: "flow", label: "Flow", detail: formatTopNumber(liveMachine?.flow ?? machineState?.flow, " g/s"), connected: true }
  };

  return indicatorIds.map((id) => all[id]).filter((indicator): indicator is TopStatusIndicator => Boolean(indicator));
}

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function currentFullscreenElement(): Element | null {
  const fullscreenDocument = document as FullscreenDocument;
  return document.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement ?? null;
}

function requestAppFullscreen(): Promise<void> {
  const element = document.documentElement as FullscreenElement;
  if (element.requestFullscreen) return element.requestFullscreen();
  if (element.webkitRequestFullscreen) return Promise.resolve(element.webkitRequestFullscreen());
  return Promise.reject(new Error("Fullscreen is not supported on this device."));
}

function exitAppFullscreen(): Promise<void> {
  const fullscreenDocument = document as FullscreenDocument;
  if (document.exitFullscreen) return document.exitFullscreen();
  if (fullscreenDocument.webkitExitFullscreen) return Promise.resolve(fullscreenDocument.webkitExitFullscreen());
  return Promise.reject(new Error("Fullscreen is not supported on this device."));
}

function TopStatusBar({
  indicators,
  expandedStatusId,
  machineSummary,
  onStatusPress,
  children
}: {
  indicators: TopStatusIndicator[];
  expandedStatusId: TopStatusIndicatorId | null;
  machineSummary: string;
  onStatusPress: (status: TopStatusIndicator) => void;
  children: ReactNode;
}) {
  const expandedStatus = indicators.find((status) => status.id === expandedStatusId);

  return (
    <header className="top-status-bar" aria-label="Machine status bar">
      <div className="top-status-indicators" aria-label="Machine indicators">
        {indicators.map((status) => (
          <button
            type="button"
            className="top-status-chip"
            key={status.id}
            title={`${status.label}: ${status.detail}`}
            aria-label={status.label}
            aria-expanded={expandedStatusId === status.id}
            onClick={() => onStatusPress(status)}
          >
            <span className={status.connected ? "status-dot connected" : "status-dot disconnected"} aria-hidden="true" />
            <span>{status.label}</span>
          </button>
        ))}
        {expandedStatus && (
          <div className="top-status-popover status-popover" role="status">
            <span>{statusPopoverTitle(expandedStatus)}</span>
            <strong>{expandedStatus.detail}</strong>
          </div>
        )}
      </div>
      <div className="top-machine-status" aria-label="Machine current status">
        <span>Machine</span>
        <strong>{machineSummary}</strong>
      </div>
      <div className="top-status-actions">{children}</div>
    </header>
  );
}

export function App() {
  const [page, setPage] = useState<Page>("brew");
  const [editingSlotIndex, setEditingSlotIndex] = useState<number | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [sleepPending, setSleepPending] = useState(false);
  const [brewPending, setBrewPending] = useState(false);
  const [skinUpdateBusy, setSkinUpdateBusy] = useState(false);
  const [skinUpdatePhase, setSkinUpdatePhase] = useState<SkinUpdatePhase>("idle");
  const [availableSkinVersion, setAvailableSkinVersion] = useState<string | null>(null);
  const [availableSkinUpdateSource, setAvailableSkinUpdateSource] = useState<SkinUpdateSource | null>(null);
  const [expandedStatusId, setExpandedStatusId] = useState<TopStatusIndicatorId | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [lastUseAt, setLastUseAt] = useState(() => Date.now());
  const [startupApplyTick, setStartupApplyTick] = useState(0);
  const [r2RefreshBusy, setR2RefreshBusy] = useState(false);
  const [lastCompletedProfileId, setLastCompletedProfileId] = useState<string | undefined>();
  const [fastMachineState, setFastMachineState] = useState<MachineState | null>(null);
  const [completedReviewShot, setCompletedReviewShot] = useState<ShotRecord | null>(null);
  const startupProfileApplyRef = useRef<{ profileId: string | null; attempts: number; pending: boolean; complete: boolean }>({
    profileId: null,
    attempts: 0,
    pending: false,
    complete: false
  });
  const startupConnectRef = useRef(false);
  const skinAutoUpdateRef = useRef(false);
  const knownLatestShotIdRef = useRef<string | null | undefined>(undefined);
  const autoReadR2ShotIdRef = useRef<string | null>(null);
  const [autoReadR2ShotId, setAutoReadR2ShotId] = useState<string | null>(null);
  const sleepMachineRef = useRef<(() => Promise<void>) | null>(null);
  const lastUseAtRef = useRef(lastUseAt);
  const autoSleepPendingRef = useRef(false);
  const completedActivityRef = useRef<{ activity: CompletedWorkflowActivity; profileId?: string } | null>(null);
  const completedActivityTimerRef = useRef<number | null>(null);
  const wasSleepingRef = useRef<boolean | null>(null);
  const api = useMemo(() => new ReaPrimeApi(), []);
  const data = useReaData(api);
  const liveTelemetry = useLiveTelemetry(undefined, { recordIdle: page === "live" });
  const latestShot = data.shots[0] ?? null;
  const detectedR2Sensor = findDifluidR2Sensor(data.sensors);
  const configuredR2Sensor = data.settings.r2SensorId ? data.sensors.find((sensor) => sensor.id === data.settings.r2SensorId) ?? null : null;
  const r2Sensor = configuredR2Sensor ?? detectedR2Sensor;
  const r2Available = Boolean(r2Sensor || data.settings.r2SensorId);
  const nativeDevices = data.devices ?? [];
  const r2DeviceConnected = Boolean(
    data.settings.r2SensorId &&
      nativeDevices.some((device) => (isConfiguredR2Device(device, data.settings.r2SensorId) || isR2Device(device)) && isConnectedDevice(device))
  );
  const selectedProfileId = selectedProfileIdFromWorkflow(data.workflow, data.profiles);
  const workflowPageProfileId = selectedProfileId ?? (page === "steam" || page === "review" ? lastCompletedProfileId : undefined);
  const activeProfile = data.profiles.find((profile) => profile.id === workflowPageProfileId);
  const refreshedCompletedReviewShot = completedReviewShot ? data.shots.find((shot) => shot.id === completedReviewShot.id) : undefined;
  const reviewShot = completedReviewShot ? mergeReviewShot(completedReviewShot, refreshedCompletedReviewShot) : latestShot;
  const activeProfileWorkflow = profileWorkflowFor(data.settings, workflowPageProfileId);
  const visualizerPlugin = data.plugins?.find((plugin) => plugin.id === "visualizer.reaplugin") ?? null;
  const shownProfiles = useMemo(
    () => data.profiles.filter((profile) => isProfileShown(data.settings, profile.id)),
    [data.profiles, data.settings.shownProfileIds]
  );
  const presetPickerProfiles = useMemo(() => {
    if (editingSlotIndex === null) return shownProfiles;
    const assignedProfileIds = new Set(
      data.settings.presetSlots
        .map((slot, index) => (index === editingSlotIndex ? undefined : slot.profileId))
        .filter((profileId): profileId is string => Boolean(profileId))
    );
    return shownProfiles.filter((profile) => !assignedProfileIds.has(profile.id));
  }, [data.settings.presetSlots, editingSlotIndex, shownProfiles]);
  const machineConnected = Boolean(data.machineState && data.machineState.connected !== false);
  const currentMachineMode = fastMachineState?.state?.state ?? liveTelemetry.machineMode?.state ?? data.machineState?.state?.state;
  const machineSleeping = isSleepingMode(currentMachineMode) || isSleepingMachine(data.machineState);
  const brewingCoffee = isBrewingMode(currentMachineMode);
  const steamingMilk = isSteamingMode(currentMachineMode);
  const statuses = useMemo(
    () =>
      buildConnectivityStatuses({
        apiHost: new URL(apiBaseUrl()).hostname,
        appInfo: data.appInfo,
        machineState: data.machineState,
        sensors: data.sensors,
        devices: nativeDevices,
        scaleConnected: liveTelemetry.scaleConnected,
        waterLevels: liveTelemetry.waterLevels,
        r2SensorId: data.settings.r2SensorId,
        r2Sensor,
        r2Connected: r2DeviceConnected
      }),
    [nativeDevices, data.machineState, data.sensors, data.settings.r2SensorId, liveTelemetry.scaleConnected, liveTelemetry.waterLevels, r2DeviceConnected, r2Sensor]
  );
  const visibleMenuIds = useMemo(
    () => visibleMainMenuItems(data.settings).filter((itemId) => itemId !== "live" || brewingCoffee),
    [brewingCoffee, data.settings.mainMenuItems, data.settings.hiddenMainMenuItemIds]
  );
  const workflowSkin = useMemo(() => workflowSkinFromList(data.webuiSkins, data.defaultWebuiSkin), [data.webuiSkins, data.defaultWebuiSkin]);
  const menuSkinVersion = workflowSkin?.version?.trim() || CURRENT_SKIN_VERSION;
  const menuSkinUpdateAvailable =
    Boolean(menuSkinVersion && availableSkinVersion) && compareVersionStrings(menuSkinVersion, availableSkinVersion ?? "") === -1;
  const topStatusIndicators = useMemo(
    () =>
      buildTopStatusIndicators({
        statuses,
        indicatorIds: topStatusIndicatorIdsForSettings(data.settings),
        machineState: data.machineState,
        liveMeasurements: liveTelemetry.measurements
      }),
    [statuses, data.settings.topStatusIndicatorIds, data.machineState, liveTelemetry.measurements]
  );
  const topLiveMachine = latestMachineSnapshot(liveTelemetry.measurements);
  const topMachineStatus = machineModeLabel(data.machineState, topLiveMachine);
  const topMachineTemperature = machineTemperature(data.machineState, topLiveMachine);
  const topMachineSummary = `${topMachineStatus}${topMachineTemperature === null ? "" : ` · ${topMachineTemperature.toFixed(1)}°C`}`;

  const applyProfile = async (profile: ProfileRecord, options: { optimistic?: boolean } = {}) => {
    const extras = data.workflow.context?.extras ?? {};
    const workflowSkin = extras.workflowSkin && typeof extras.workflowSkin === "object" && !Array.isArray(extras.workflowSkin) ? extras.workflowSkin : {};
    const nextWorkflow: Workflow = {
      profile: profile.profile,
      context: {
        ...data.workflow.context,
        extras: {
          ...extras,
          workflowSkin: {
            ...workflowSkin,
            selectedProfileId: profile.id
          }
        }
      }
    };
    const previousWorkflow = data.workflow;
    if (options.optimistic) data.setWorkflow(nextWorkflow);

    try {
      const updatedWorkflow = await api.updateWorkflow(nextWorkflow);
      data.setWorkflow(updatedWorkflow);
    } catch (error) {
      if (options.optimistic) data.setWorkflow(previousWorkflow);
      throw error;
    }
  };

  const resetStartupProfileApply = useCallback(() => {
    const startupProfileId = data.settings.startupProfileId;
    if (!startupProfileId) return;
    startupProfileApplyRef.current = { profileId: startupProfileId, attempts: 0, pending: false, complete: false };
    setStartupApplyTick((tick) => tick + 1);
  }, [data.settings.startupProfileId]);

  const connectConfiguredStartupDevices = useCallback(async () => {
    const attemptedDeviceIds = new Set<string>();
    const connectStartupDevices = async (quick: boolean) => {
      const scannedDevices = await api.scanDevices({ connect: true, quick }).catch(() => [] as DeviceInfo[]);
      const listedDevices = await api.listDevices().catch(() => data.devices ?? []);
      const devices = uniqueDevices([...scannedDevices, ...listedDevices]);

      for (const device of devices.filter((item) => isConnectableStartupDevice(item, data.settings.r2SensorId))) {
        if (attemptedDeviceIds.has(device.id)) continue;
        attemptedDeviceIds.add(device.id);
        await api.connectDevice(device.id).catch(() => undefined);
      }
    };

    await connectStartupDevices(true);
    if (data.settings.r2SensorId) await connectStartupDevices(false);
  }, [api, data.devices, data.settings.r2SensorId]);

  useEffect(() => {
    const startupProfileId = data.settings.startupProfileId;
    if (!data.loaded || !startupProfileId) {
      startupProfileApplyRef.current = { profileId: null, attempts: 0, pending: false, complete: false };
      return;
    }

    if (startupProfileApplyRef.current.profileId !== startupProfileId) {
      startupProfileApplyRef.current = { profileId: startupProfileId, attempts: 0, pending: false, complete: false };
    }

    if (machineSleeping) return;

    if (startupProfileApplyRef.current.complete) return;

    if (selectedProfileId === startupProfileId) {
      startupProfileApplyRef.current.pending = false;
      startupProfileApplyRef.current.complete = true;
      return;
    }

    if (startupProfileApplyRef.current.pending) return;
    if (startupProfileApplyRef.current.attempts >= 3) {
      startupProfileApplyRef.current.complete = true;
      return;
    }

    const startupProfile = data.profiles.find((profile) => profile.id === startupProfileId);
    if (!startupProfile) return;

    startupProfileApplyRef.current.attempts += 1;
    startupProfileApplyRef.current.pending = true;
    applyProfile(startupProfile).catch((error) => {
      setStatus({ type: "error", message: `Could not apply startup profile: ${errorMessage(error)}` });
    }).finally(() => {
      startupProfileApplyRef.current.pending = false;
      setStartupApplyTick((tick) => tick + 1);
    });
  }, [data.loaded, data.settings.startupProfileId, data.profiles, machineSleeping, selectedProfileId, startupApplyTick]);

  useEffect(() => {
    if (startupConnectRef.current || !data.loaded) return;
    startupConnectRef.current = true;

    const connectAndWake = async () => {
      await wakeMachineIfNeeded(api, data.machineState);
      await data.refresh();
      await connectConfiguredStartupDevices();
      await data.refresh();
      resetStartupProfileApply();
      window.setTimeout(() => {
        void data.refresh();
      }, 1500);
    };

    void connectAndWake();
  }, [api, connectConfiguredStartupDevices, data.loaded, data.machineState, data.refresh, resetStartupProfileApply]);

  useEffect(() => {
    if (!data.loaded) return;
    const wasSleeping = wasSleepingRef.current;
    wasSleepingRef.current = machineSleeping;
    if (wasSleeping === true && !machineSleeping) resetStartupProfileApply();
  }, [data.loaded, machineSleeping, resetStartupProfileApply]);

  useEffect(() => {
    if (!data.loaded || page === "screensaver") return;

    const request = data.settings.keepScreenAwake !== false ? api.requestWakeLock() : api.releaseWakeLock();
    request.catch(() => {
      // Optional tablet display APIs are absent on some ReaPrime builds/platforms.
    });
  }, [api, data.loaded, data.settings.keepScreenAwake, page]);

  useEffect(() => {
    if (!data.loaded || page === "live" || page === "screensaver") return;
    if (brewingCoffee) setPage("live");
  }, [brewingCoffee, data.loaded, page]);

  useEffect(() => {
    if (!data.loaded || page !== "live" || brewingCoffee) return;
    setPage("brew");
  }, [brewingCoffee, data.loaded, page]);

  useEffect(() => {
    if (!data.loaded) return;
    const shouldPollMachineState = Boolean(workflowActivityForMode(currentMachineMode) || completedActivityRef.current);
    if (!shouldPollMachineState) {
      setFastMachineState(null);
      return;
    }

    let cancelled = false;
    const pollMachineState = async () => {
      const nextState = await api.getMachineState().catch(() => null);
      if (!cancelled && nextState) setFastMachineState(nextState);
    };

    void pollMachineState();
    const interval = window.setInterval(() => {
      void pollMachineState();
    }, ACTIVE_MACHINE_STATE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [api, currentMachineMode, data.loaded, page]);

  const routeCompletedActivity = useCallback(
    async (completed: { activity: CompletedWorkflowActivity; profileId?: string }) => {
      await data.refresh();
      if (completed.activity === "brew") {
        const latestCompletedShot = await api.getLatestShot().catch(() => latestShot);
        const completedShotForReview = latestCompletedShot ? shotWithFallbackMeasurements(latestCompletedShot, liveTelemetry.measurements) : null;
        if (completedShotForReview) setCompletedReviewShot(completedShotForReview);

        if (completedShotForReview && r2Available && autoReadR2ShotIdRef.current !== completedShotForReview.id) {
          autoReadR2ShotIdRef.current = completedShotForReview.id;
          setAutoReadR2ShotId(completedShotForReview.id);
        }

        const completedProfileId = completed.profileId ?? selectedProfileIdFromWorkflow(completedShotForReview?.workflow, data.profiles);
        setLastCompletedProfileId(completedProfileId);
        const nextPage = postActivityPage("brew", completedProfileId, data.settings);
        setPage(nextPage ?? "brew");
        return;
      }

      setPage("review");
    },
    [api, data.profiles, data.refresh, data.settings, latestShot, liveTelemetry.measurements, r2Available]
  );

  useEffect(() => {
    if (!data.loaded) return;

    const activeActivity = workflowActivityForMode(currentMachineMode);
    if (activeActivity) {
      completedActivityRef.current = { activity: activeActivity, profileId: selectedProfileId };
      if (completedActivityTimerRef.current !== null) {
        window.clearTimeout(completedActivityTimerRef.current);
        completedActivityTimerRef.current = null;
      }
      return;
    }

    if (!isIdleMode(currentMachineMode) || !completedActivityRef.current || completedActivityTimerRef.current !== null) return;

    const completed = completedActivityRef.current;
    completedActivityTimerRef.current = window.setTimeout(() => {
      completedActivityTimerRef.current = null;
      completedActivityRef.current = null;
      void routeCompletedActivity(completed);
    }, POST_ACTIVITY_ROUTE_DELAY_MS);
  }, [currentMachineMode, data.loaded, routeCompletedActivity, selectedProfileId]);

  useEffect(() => {
    return () => {
      if (completedActivityTimerRef.current !== null) {
        window.clearTimeout(completedActivityTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const updateFullscreenState = () => setFullscreen(Boolean(currentFullscreenElement()));
    updateFullscreenState();
    document.addEventListener("fullscreenchange", updateFullscreenState);
    document.addEventListener("webkitfullscreenchange", updateFullscreenState);
    return () => {
      document.removeEventListener("fullscreenchange", updateFullscreenState);
      document.removeEventListener("webkitfullscreenchange", updateFullscreenState);
    };
  }, []);

  useEffect(() => {
    if (workflowActivityForMode(currentMachineMode)) setLastUseAt(Date.now());
  }, [currentMachineMode]);

  useEffect(() => {
    lastUseAtRef.current = lastUseAt;
  }, [lastUseAt]);

  useEffect(() => {
    const markUse = () => {
      const now = Date.now();
      autoSleepPendingRef.current = false;
      lastUseAtRef.current = now;
      setLastUseAt(now);
    };
    window.addEventListener("pointerdown", markUse);
    window.addEventListener("keydown", markUse);
    window.addEventListener("touchstart", markUse);
    return () => {
      window.removeEventListener("pointerdown", markUse);
      window.removeEventListener("keydown", markUse);
      window.removeEventListener("touchstart", markUse);
    };
  }, []);

  useEffect(() => {
    if (!data.loaded) return;
    const latestShotId = latestShot?.id ?? null;
    if (knownLatestShotIdRef.current === undefined) {
      knownLatestShotIdRef.current = latestShotId;
      return;
    }
    if (knownLatestShotIdRef.current === latestShotId) return;
    knownLatestShotIdRef.current = latestShotId;
    if (!latestShot) return;

    if (r2Available && autoReadR2ShotIdRef.current !== latestShot.id) {
      autoReadR2ShotIdRef.current = latestShot.id;
      setAutoReadR2ShotId(latestShot.id);
    }
  }, [data.loaded, latestShot, r2Available]);

  const toggleReview = async (profileId: string, enabled: boolean) => {
    try {
      await data.persistSettings({
        ...data.settings,
        reviewEnabledByProfile: { ...data.settings.reviewEnabledByProfile, [profileId]: enabled }
      });
    } catch (error) {
      setStatus({ type: "error", message: `Could not save profile setting: ${errorMessage(error)}` });
    }
  };

  const persistSettings = async (next: SkinSettings, successMessage?: string) => {
    try {
      await data.persistSettings(next);
      if (successMessage) setStatus({ type: "success", message: successMessage });
    } catch (error) {
      setStatus({ type: "error", message: `Could not save setting: ${errorMessage(error)}` });
    }
  };

  const setStartupProfile = async (profileId?: string) => {
    await persistSettings({ ...data.settings, startupProfileId: profileId }, "Startup profile saved.");
  };

  const updateProfileWorkflow = async (profileId: string, workflow: ProfileWorkflowSettings) => {
    await persistSettings({
      ...data.settings,
      profileWorkflows: { ...data.settings.profileWorkflows, [profileId]: workflow }
    });
  };

  const setProfileShown = async (profileId: string, shown: boolean) => {
    const shownProfileIds = shown
      ? Array.from(new Set([...data.settings.shownProfileIds, profileId]))
      : data.settings.shownProfileIds.filter((id) => id !== profileId);
    await persistSettings({ ...data.settings, shownProfileIds }, "Profile visibility saved.");
  };

  const refreshR2Sensor = async () => {
    setR2RefreshBusy(true);
    setStatus({ type: "success", message: "Looking for DiFluid R2." });
    try {
      await wakeMachineIfNeeded(api, data.machineState);
      await data.refresh();
      const collectR2Devices = async (knownDevices: DeviceInfo[] = []) => {
        const scannedDevices = await api.scanDevices({ connect: true, quick: false }).catch(() => [] as DeviceInfo[]);
        const listedDevices = await api.listDevices().catch(() => data.devices ?? []);
        return uniqueDevices([...knownDevices, ...scannedDevices, ...listedDevices]).filter(
          (item) => isR2Device(item) || isConfiguredR2Device(item, data.settings.r2SensorId)
        );
      };
      const attemptedDeviceIds = new Set<string>();
      const connectR2Devices = async (devices: DeviceInfo[], retryAttempted = false) => {
        let attempted = false;
        for (const device of devices.filter((item) => !isConnectedDevice(item))) {
          if (!retryAttempted && attemptedDeviceIds.has(device.id)) continue;
          attemptedDeviceIds.add(device.id);
          attempted = true;
          await api.connectDevice(device.id).catch(() => undefined);
        }
        return attempted;
      };

      let r2Devices = await collectR2Devices();
      const attemptedConnect = await connectR2Devices(r2Devices);
      if (attemptedConnect) {
        await waitForNativeUpdate(450);
        r2Devices = await collectR2Devices(r2Devices);
        await connectR2Devices(r2Devices, true);
      }

      const sensor = await findR2SensorWithRetry(api, data.sensors);
      const sensorId = sensor?.id ?? data.settings.r2SensorId ?? r2Devices[0]?.id;
      if (!sensorId) {
        await data.refresh();
        setStatus({ type: "error", message: "No DiFluid R2 detected after refresh." });
        return;
      }

      await data.persistSettings({ ...data.settings, r2SensorId: sensorId });
      await data.refresh();
      setStatus({ type: "success", message: `R2 connected through ReaPrime: ${sensorId}.` });
    } catch (error) {
      setStatus({ type: "error", message: `Could not refresh R2: ${errorMessage(error)}` });
    } finally {
      setR2RefreshBusy(false);
    }
  };

  const checkSkinUpdates = async (reportStatus = true) => {
    setSkinUpdateBusy(true);
    setSkinUpdatePhase("checking");
    try {
      const result = await api.updateWebUISkins();
      const repo = data.settings.skinUpdateRepo.trim();
      const branch = data.settings.skinUpdateBranch.trim();
      if (repo) {
        const [releaseVersion, manifestVersion] = await Promise.all([
          fetchLatestGithubReleaseVersion(repo, data.settings.skinUpdatePrerelease).catch(() => null),
          fetchGithubSkinManifestVersion(repo, branch).catch(() => null)
        ]);
        const update = newestSkinUpdate(releaseVersion, manifestVersion);
        setAvailableSkinVersion(update?.version ?? null);
        setAvailableSkinUpdateSource(update?.source ?? null);
      } else {
        setAvailableSkinVersion(null);
        setAvailableSkinUpdateSource(null);
      }
      await data.refresh();
      if (reportStatus) setStatus({ type: "success", message: statusSentence(result.message, "Skin update check completed") });
    } catch (error) {
      setStatus({ type: "error", message: `Could not check skin updates: ${errorMessage(error)}` });
      throw error;
    } finally {
      setSkinUpdateBusy(false);
      setSkinUpdatePhase("idle");
    }
  };

  useEffect(() => {
    if (!data.loaded) return;
    const repo = data.settings.skinUpdateRepo.trim();
    const branch = data.settings.skinUpdateBranch.trim();
    if (!repo) {
      setAvailableSkinVersion(null);
      setAvailableSkinUpdateSource(null);
      return;
    }
    setAvailableSkinUpdateSource(null);

    let canceled = false;
    const refreshAvailableVersion = async () => {
      const [releaseVersion, manifestVersion] = await Promise.all([
        fetchLatestGithubReleaseVersion(repo, data.settings.skinUpdatePrerelease).catch(() => null),
        fetchGithubSkinManifestVersion(repo, branch).catch(() => null)
      ]);
      if (canceled) return;
      const update = newestSkinUpdate(releaseVersion, manifestVersion);
      setAvailableSkinVersion(update?.version ?? null);
    };

    void refreshAvailableVersion();
    return () => {
      canceled = true;
    };
  }, [data.loaded, data.settings.skinUpdateRepo, data.settings.skinUpdateBranch, data.settings.skinUpdatePrerelease]);

  const installSkinUpdate = async (reportStatus = true) => {
    const repo = data.settings.skinUpdateRepo.trim();
    if (!repo) {
      setStatus({ type: "error", message: "Add a GitHub repo before installing skin updates." });
      return;
    }

    setSkinUpdateBusy(true);
    setSkinUpdatePhase("downloading");
    try {
      const asset = data.settings.skinUpdateAsset.trim();
      const branch = data.settings.skinUpdateBranch.trim();
      const branchZipUrl = availableSkinUpdateSource === "branch" ? githubWorkflowZipUrl(repo, branch, asset) : null;
      if (branchZipUrl) {
        const result = await api.installSkinFromUrl({ url: branchZipUrl });
        await data.refresh();
        if (reportStatus) setStatus({ type: "success", message: statusSentence(result.message, "Skin installed from committed workflow zip") });
        return;
      }
      const result = await api.installSkinFromGithubRelease({
        repo,
        ...(asset ? { asset } : {}),
        prerelease: data.settings.skinUpdatePrerelease
      });
      await data.refresh();
      if (reportStatus) setStatus({ type: "success", message: statusSentence(result.message, "Skin installed from GitHub release") });
    } catch (error) {
      const asset = data.settings.skinUpdateAsset.trim();
      const branch = data.settings.skinUpdateBranch.trim();
      const fallbackUrl = githubReleaseMissing(error) ? githubWorkflowZipUrl(repo, branch, asset) : null;
      if (fallbackUrl) {
        try {
          const result = await api.installSkinFromUrl({ url: fallbackUrl });
          await data.refresh();
          if (reportStatus) setStatus({ type: "success", message: statusSentence(result.message, "Skin installed from committed workflow zip") });
          return;
        } catch (fallbackError) {
          setStatus({ type: "error", message: `Could not install skin update: ${errorMessage(fallbackError)}` });
          throw fallbackError;
        }
      }
      setStatus({ type: "error", message: `Could not install skin update: ${errorMessage(error)}` });
      throw error;
    } finally {
      setSkinUpdateBusy(false);
      setSkinUpdatePhase("idle");
    }
  };

  useEffect(() => {
    if (skinAutoUpdateRef.current || !data.loaded || !data.settings.skinAutoUpdateEnabled) return;
    skinAutoUpdateRef.current = true;

    const runAutoUpdate = async () => {
      try {
        if (data.settings.skinUpdateRepo.trim()) {
          await installSkinUpdate(false);
          setStatus({ type: "success", message: "Skin auto-update checked from GitHub release." });
        } else {
          await checkSkinUpdates(false);
          setStatus({ type: "success", message: "Skin auto-update checked." });
        }
      } catch {
        // The action helper already writes a user-visible error.
      }
    };

    void runAutoUpdate();
  }, [data.loaded, data.settings.skinAutoUpdateEnabled]);

  const saveProfile = async (profileId: string, profile: Profile) => {
    try {
      const savedProfile = await api.updateProfile(profileId, { profile });
      if (savedProfile.id !== profileId) {
        await data.persistSettings(replaceProfileIdInSettings(data.settings, profileId, savedProfile.id));
      }
      await data.refresh();
      setStatus({ type: "success", message: "Profile saved." });
    } catch (error) {
      if (error instanceof ReaPrimeApiError && error.status === 400 && error.message.includes("Cannot modify default profile content")) {
        try {
          const createdProfile = await api.createProfile({ profile, parentId: profileId });
          await data.persistSettings({
            ...data.settings,
            shownProfileIds: Array.from(new Set([...data.settings.shownProfileIds, createdProfile.id]))
          });
          await data.refresh();
          setStatus({ type: "success", message: "Profile saved." });
          return;
        } catch (createError) {
          setStatus({ type: "error", message: `Could not save profile: ${errorMessage(createError)}` });
          throw createError;
        }
      }
      setStatus({ type: "error", message: `Could not save profile: ${errorMessage(error)}` });
      throw error;
    }
  };

  const assignPresetProfile = async (profile: ProfileRecord) => {
    if (editingSlotIndex === null) return;
    const slot = data.settings.presetSlots[editingSlotIndex];
    if (!slot) return;

    try {
      await data.persistSettings({
        ...data.settings,
        presetSlots: data.settings.presetSlots.map((item, index) => {
          if (index === editingSlotIndex) return { ...item, profileId: profile.id };
          if (item.profileId !== profile.id) return item;
          const { profileId: _profileId, ...rest } = item;
          return rest;
        })
      });
      setStatus({ type: "success", message: `Preset ${slot.label} set to ${profile.profile.title ?? profile.id}.` });
      setEditingSlotIndex(null);
    } catch (error) {
      setStatus({ type: "error", message: `Could not save preset: ${errorMessage(error)}` });
    }
  };

  const applyProfileForBrew = async (profile: ProfileRecord) => {
    await applyProfile(profile, { optimistic: true });
    setLastUseAt(Date.now());
  };

  const requestScaleConnection = async () => {
    await wakeMachineIfNeeded(api, data.machineState);
    await data.refresh();
    const scannedDevices = await api.scanDevices({ connect: true, quick: false }).catch(() => [] as DeviceInfo[]);
    const listedDevices = await api.listDevices().catch(() => data.devices ?? []);
    const devices = uniqueDevices([...scannedDevices, ...listedDevices]);
    const scanSawScale = scannedDevices.some((device) => isScaleDeviceCandidate(device) && !isR2Device(device));

    if (hasConnectedScale(devices)) {
      await data.refresh();
      return { connected: true, requested: false, found: true, scanSawScale, firstError: null };
    }

    const scaleDevices = devices.filter((device) => isScaleDeviceCandidate(device) && !isConnectedDevice(device) && !isR2Device(device));
    let requested = false;
    let firstError: unknown = null;
    for (const device of scaleDevices) {
      try {
        await api.connectDevice(device.id);
        requested = true;
      } catch (error) {
        firstError ??= error;
      }
    }

    if (requested) await waitForNativeUpdate(300);
    await data.refresh();
    const refreshedDevices = await api.listDevices().catch(() => [] as DeviceInfo[]);
    return {
      connected: hasConnectedScale(refreshedDevices),
      requested,
      found: scanSawScale || scaleDevices.length > 0,
      scanSawScale,
      firstError
    };
  };

  const startBrew = async () => {
    setBrewPending(true);
    setLastUseAt(Date.now());
    try {
      await requestScaleConnection().catch(() => undefined);
      await api.requestMachineState("espresso");
      const latestMachineState = await api.getMachineState().catch(() => null);
      if (latestMachineState) setFastMachineState(latestMachineState);
      if (isBrewingMode(latestMachineState?.state?.state)) {
        setPage("live");
        setStatus({ type: "success", message: "Brew started." });
      } else {
        await data.refresh();
        setStatus({ type: "success", message: "Brew start requested. Waiting for machine." });
      }
    } catch (error) {
      setStatus({ type: "error", message: `Could not start brew: ${errorMessage(error)}` });
    } finally {
      setBrewPending(false);
    }
  };

  const saveBag = async (bag: Bag) => {
    const bean = await api.createBean({
      roaster: bag.roaster?.trim() ?? "",
      name: bag.bean?.trim() ?? "",
      country: bag.country?.trim() || undefined,
      region: bag.region?.trim() || undefined,
      processing: bag.process?.trim() || undefined,
      notes: bag.notes?.trim() || undefined
    });

    try {
      await api.createBatch(bean.id, {
        roastDate: dateOnlyToIsoDateTime(bag.roastDate),
        roastLevel: bag.roastLevel?.trim() || undefined,
        notes: bag.notes?.trim() || undefined,
        extras: { workflowSkin: { createdFromBagForm: true, name: bag.name?.trim() || undefined } }
      });
    } catch (error) {
      try {
        await api.deleteBean(bean.id);
      } catch {
        throw new Error(`Could not save bag: batch creation failed; cleanup also failed. ${errorMessage(error)}`);
      }
      throw new Error(`Could not save bag: batch creation failed. ${errorMessage(error)}`);
    }

    await data.refresh();
  };

  const updateBag = async (bag: Bag) => {
    await Promise.all([
      api.updateBean(bag.beanId, {
        roaster: bag.roaster?.trim() ?? "",
        name: bag.bean?.trim() ?? "",
        country: bag.country?.trim() || undefined,
        region: bag.region?.trim() || undefined,
        processing: bag.process?.trim() || undefined,
        notes: bag.notes?.trim() || undefined
      }),
      api.updateBatch(bag.id, {
        roastDate: dateOnlyToIsoDateTime(bag.roastDate),
        roastLevel: bag.roastLevel?.trim() || undefined,
        notes: bag.notes?.trim() || undefined,
        extras: { workflowSkin: { name: bag.name?.trim() || undefined } }
      })
    ]);
    await data.refresh();
  };

  const archiveBag = async (bag: Bag) => {
    await api.updateBatch(bag.id, { archived: true });
    await data.refresh();
  };

  const createGrinder = async (payload: CreateGrinderPayload) => {
    await api.createGrinder(payload);
    await data.refresh();
  };

  const updateGrinder = async (id: string, payload: Partial<CreateGrinderPayload>) => {
    await api.updateGrinder(id, payload);
    await data.refresh();
  };

  const archiveGrinder = async (grinder: Grinder) => {
    await api.updateGrinder(grinder.id, { archived: true });
    await data.refresh();
  };

  const setDefaultGrinder = async (grinderId: string) => {
    await persistSettings({ ...data.settings, defaultGrinderId: grinderId, lastGrinderId: grinderId }, "Default grinder saved.");
  };

  const saveReview = async (shotId: string, annotations: ShotAnnotations) => {
    try {
      await api.updateShot(shotId, { annotations });
      await data.refresh();
      setStatus({ type: "success", message: "Review saved." });
    } catch (error) {
      setStatus({ type: "error", message: `Could not save review: ${errorMessage(error)}` });
    }
  };

  const uploadReviewToVisualizer = async () => {
    if (!reviewShot) return;
    try {
      await uploadShotToVisualizer({ baseUrl: apiBaseUrl() }, await api.getShot(reviewShot.id));
      setStatus({ type: "success", message: "Shot uploaded to Visualizer." });
    } catch (error) {
      setStatus({ type: "error", message: `Could not upload to Visualizer: ${errorMessage(error)}` });
    }
  };

  const startSteam = async () => {
    try {
      await api.requestMachineState("steam");
      setStatus({ type: "success", message: "Steam started." });
    } catch (error) {
      setStatus({ type: "error", message: `Could not start steam: ${errorMessage(error)}` });
    }
  };

  const stopSteam = async () => {
    try {
      await api.requestMachineState("idle");
      setStatus({ type: "success", message: "Steam stopped." });
    } catch (error) {
      setStatus({ type: "error", message: `Could not stop steam: ${errorMessage(error)}` });
    }
  };

  const reconnectR2ForMeasurement = async (sensorId: string): Promise<string> => {
    await wakeMachineIfNeeded(api, data.machineState);
    const scannedDevices = await api.scanDevices({ connect: true, quick: false }).catch(() => [] as DeviceInfo[]);
    const listedDevices = await api.listDevices().catch(() => data.devices ?? []);
    const r2Devices = uniqueDevices([...scannedDevices, ...listedDevices]).filter(
      (device) => isR2Device(device) || isConfiguredR2Device(device, sensorId) || isConfiguredR2Device(device, data.settings.r2SensorId)
    );
    const reconnectIds = new Set([sensorId, ...r2Devices.map((device) => device.id)]);
    for (const deviceId of reconnectIds) {
      await api.connectDevice(deviceId).catch(() => undefined);
    }

    await waitForNativeUpdate(750);
    const sensor = await findR2SensorWithRetry(api, data.sensors);
    const nextSensorId = sensor?.id ?? sensorId;
    if (sensor?.id && data.settings.r2SensorId !== sensor.id) {
      await Promise.resolve(data.persistSettings({ ...data.settings, r2SensorId: sensor.id })).catch(() => undefined);
    }
    await data.refresh();
    return nextSensorId;
  };

  const executeR2Measurement = async (sensorId: string) => {
    return api.executeSensor(sensorId, "measure", { timeout: 30 });
  };

  const readR2 = async () => {
    let sensorId = r2Sensor?.id ?? data.settings.r2SensorId;
    if (!sensorId) {
      setStatus({ type: "error", message: "No DiFluid R2 sensor detected." });
      return null;
    }

    try {
      let result;
      try {
        result = await executeR2Measurement(sensorId);
      } catch (error) {
        if (!r2MeasurementNeedsReconnect(errorMessage(error))) throw error;
        sensorId = await reconnectR2ForMeasurement(sensorId);
        result = await executeR2Measurement(sensorId);
      }

      if (result.status === "error") {
        if (r2MeasurementNeedsReconnect(result.message ?? "")) {
          sensorId = await reconnectR2ForMeasurement(sensorId);
          result = await executeR2Measurement(sensorId);
        }
      }

      if (result.status === "error") {
        setStatus({ type: "error", message: `Could not read R2: ${result.message ?? "Measurement command failed."}` });
        return null;
      }

      const tds = extractR2Tds(result.result);
      if (tds === null) {
        setStatus({ type: "error", message: "R2 did not return a TDS reading." });
        return null;
      }
      if (r2Sensor?.id && data.settings.r2SensorId !== r2Sensor.id) {
        await Promise.resolve(data.persistSettings({ ...data.settings, r2SensorId: r2Sensor.id })).catch(() => undefined);
      }
      return tds;
    } catch (error) {
      setStatus({ type: "error", message: `Could not read R2: ${errorMessage(error)}` });
      return null;
    }
  };

  const applyScreensaverDisplay = useCallback(async () => {
    const brightness = screensaverBrightnessValue(data.settings.screensaverBrightness);
    await Promise.all([
      api.setDisplayBrightness(brightness).catch(() => undefined),
      api.releaseWakeLock().catch(() => undefined)
    ]);
  }, [api, data.settings.screensaverBrightness]);

  const sleepMachine = useCallback(async () => {
    setSleepPending(true);
    try {
      await applyScreensaverDisplay();
      await api.sleepMachine();
      await data.refresh();
      await applyScreensaverDisplay();
      setStatus({ type: "success", message: "Machine sleep requested." });
      setPage("screensaver");
    } catch (error) {
      setStatus({ type: "error", message: `Could not sleep machine: ${errorMessage(error)}` });
    } finally {
      setSleepPending(false);
    }
  }, [api, applyScreensaverDisplay, data.refresh]);

  useEffect(() => {
    sleepMachineRef.current = sleepMachine;
  }, [sleepMachine]);

  const wakeScreen = async () => {
    const now = Date.now();
    autoSleepPendingRef.current = false;
    lastUseAtRef.current = now;
    setLastUseAt(now);
    setPage("brew");
    await api.setDisplayBrightness(100).catch(() => undefined);
    if (data.settings.keepScreenAwake !== false) {
      await api.requestWakeLock().catch(() => undefined);
    }
    await wakeMachineIfNeeded(api, data.machineState);
    await data.refresh();
    await connectConfiguredStartupDevices();
    resetStartupProfileApply();
    await data.refresh();
  };

  useEffect(() => {
    if (!data.loaded || page === "screensaver" || !machineConnected) return;
    if (isBrewingMode(currentMachineMode) || isSleepingMode(currentMachineMode)) return;

    const autoSleepMinutes = data.settings.autoSleepMinutes;
    if (!autoSleepMinutes) return;

    const idleLimitMs = autoSleepMinutes * 60_000;
    const checkIdle = () => {
      if (autoSleepPendingRef.current) return;
      if (Date.now() - lastUseAtRef.current >= idleLimitMs) {
        const sleep = sleepMachineRef.current;
        if (!sleep) return;
        autoSleepPendingRef.current = true;
        void sleep().finally(() => {
          autoSleepPendingRef.current = false;
        });
      }
    };

    checkIdle();
    const timer = window.setInterval(checkIdle, autoSleepCheckIntervalMs(idleLimitMs));
    return () => window.clearInterval(timer);
  }, [currentMachineMode, data.loaded, data.settings.autoSleepMinutes, lastUseAt, machineConnected, page]);

  const forceScaleConnection = async () => {
    setStatus({ type: "success", message: "Scanning for scale." });
    try {
      const result = await requestScaleConnection();
      if (result.connected) {
        setStatus({ type: "success", message: "Scale connected." });
        return;
      }

      if (!result.found) {
        setStatus({ type: "error", message: "No scale found after scan." });
        return;
      }

      if (result.requested) {
        setStatus({ type: "success", message: "Scale connection requested." });
        return;
      }

      if (result.scanSawScale && result.firstError) {
        setStatus({ type: "success", message: "Scale scan requested. Wake the scale if it stays disconnected." });
        return;
      }

      if (result.firstError) throw result.firstError;
      setStatus({ type: "success", message: "Scale scan requested. Wake the scale if it stays disconnected." });
    } catch (error) {
      setStatus({ type: "error", message: `Could not connect scale: ${errorMessage(error)}` });
    }
  };

  const toggleStatusPopover = (nextStatus: TopStatusIndicator) => {
    if (nextStatus.id === "scale" && !nextStatus.connected) {
      setExpandedStatusId(null);
      void forceScaleConnection();
      return;
    }
    if (nextStatus.id === "r2" && !nextStatus.connected) {
      setExpandedStatusId(null);
      void refreshR2Sensor();
      return;
    }
    setExpandedStatusId((current) => (current === nextStatus.id ? null : nextStatus.id));
  };

  const editingSlot = editingSlotIndex === null ? undefined : data.settings.presetSlots[editingSlotIndex];

  const toggleMenuCollapsed = async () => {
    await persistSettings({ ...data.settings, menuCollapsed: !data.settings.menuCollapsed });
  };

  const toggleFullscreen = async () => {
    try {
      if (currentFullscreenElement()) {
        await exitAppFullscreen();
      } else {
        await requestAppFullscreen();
      }
      setFullscreen(Boolean(currentFullscreenElement()));
    } catch (error) {
      setStatus({ type: "error", message: `Could not toggle fullscreen: ${errorMessage(error)}` });
    }
  };

  if (page === "screensaver") {
    return <ScreensaverPage title={data.settings.skinTitle} onWake={() => void wakeScreen()} />;
  }

  const navIconSize = 20;
  const theme = activeSkinTheme(data.settings);
  const shellStyle = {
    "--skin-bg": theme.background,
    "--skin-surface": theme.surface,
    "--skin-panel": theme.panel,
    "--skin-border": theme.border,
    "--skin-text": theme.text,
    "--skin-muted": theme.muted,
    "--skin-accent": theme.accent,
    "--skin-accent-alt": theme.accentAlt,
    fontSize: `${data.settings.skinFontScale}%`
  } as CSSProperties;

  return (
    <main className={data.settings.menuCollapsed ? "app-shell menu-collapsed" : "app-shell"} style={shellStyle}>
      <TopStatusBar
        indicators={topStatusIndicators}
        expandedStatusId={expandedStatusId}
        machineSummary={topMachineSummary}
        onStatusPress={toggleStatusPopover}
      >
        <button
          type="button"
          className="sleep-button"
          aria-label="Sleep machine"
          title={machineConnected ? "Sleep machine" : "Machine is not connected"}
          disabled={!machineConnected || sleepPending}
          onClick={() => void sleepMachine()}
        >
          <Moon size={17} />
          <span>{sleepPending ? "Sleeping" : "Sleep"}</span>
        </button>
        <button
          type="button"
          className="sleep-button fullscreen-button"
          aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          title={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          onClick={() => void toggleFullscreen()}
        >
          {fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </button>
      </TopStatusBar>
      <nav className="side-nav" aria-label="Workflow navigation">
        <div className="menu-brand" aria-label="WorkFlow menu title">
          <span className="menu-brand-full">WorkFlow</span>
          <span className="menu-brand-short">WF</span>
        </div>
        <button
          type="button"
          className="nav-button menu-toggle-button"
          aria-label={data.settings.menuCollapsed ? "Expand menu" : "Collapse menu"}
          title={data.settings.menuCollapsed ? "Expand menu" : "Collapse menu"}
          onClick={() => void toggleMenuCollapsed()}
        >
          {data.settings.menuCollapsed ? <PanelLeftOpen className="nav-icon" size={navIconSize} /> : <PanelLeftClose className="nav-icon" size={navIconSize} />}
          <span>{data.settings.menuCollapsed ? "Expand" : "Minimize"}</span>
        </button>
        {visibleMenuIds.map((itemId) => {
          const item = navById[itemId];
          const Icon = item.icon;
          const isReview = itemId === "review";
          const className = [page === itemId ? "nav-button active" : "nav-button", isReview ? "review-nav-button" : ""]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={itemId}
              aria-current={page === itemId ? "page" : undefined}
              aria-label={item.label}
              className={className}
              onClick={() => setPage(itemId)}
            >
              <Icon className={isReview ? "nav-icon review-nav-icon" : "nav-icon"} size={navIconSize} />
              <span>{item.label}</span>
            </button>
          );
        })}
        {!data.settings.menuCollapsed && (
          <div
            className={menuSkinUpdateAvailable ? "menu-version-footer update-available" : "menu-version-footer latest"}
            aria-label="Skin version"
            title={menuSkinUpdateAvailable ? `Update available: ${versionLabel(availableSkinVersion)}` : "Skin is up to date"}
          >
            <span>{versionLabel(menuSkinVersion)}</span>
            {menuSkinUpdateAvailable && <strong>Update {versionLabel(availableSkinVersion)}</strong>}
          </div>
        )}
      </nav>
      <section className="page-surface">
        {page !== "bags" && <h1>{navById[page].label}</h1>}
        {data.error && (
          <p className="muted" role="alert" aria-live="assertive">
            {data.error}
          </p>
        )}
        {status && !editingSlot && (
          <p
            className={status.type === "error" ? "status-message error" : "status-message"}
            role={status.type === "error" ? "alert" : "status"}
            aria-live={status.type === "error" ? "assertive" : "polite"}
          >
            {status.message}
          </p>
        )}
        {page === "brew" && (
          <BrewPage
            workflow={data.workflow}
            profiles={data.profiles}
            bags={data.bags}
            shots={data.shots}
            settings={data.settings}
            onApplyProfile={(profile) => {
              void applyProfileForBrew(profile);
            }}
            onEditSlot={(index) => {
              setStatus(null);
              setEditingSlotIndex(index);
            }}
            onStartBrew={() => {
              void startBrew();
            }}
            brewPending={brewPending}
            grinders={data.grinders ?? []}
            onUpdateRecipe={async ({ dose, yield: targetYield }) => {
              await api.updateWorkflow({
                context: {
                  ...data.workflow.context,
                  targetDoseWeight: dose,
                  targetYield
                }
              });
              await data.refresh();
            }}
            onSelectBag={async (bagId) => {
              const bag = data.bags.find((item) => item.id === bagId);
              await api.updateWorkflow({
                context: {
                  ...data.workflow.context,
                  beanBatchId: bagId || undefined,
                  coffeeName: bag?.bean,
                  coffeeRoaster: bag?.roaster
                }
              });
              await data.refresh();
            }}
          />
        )}
        {page === "live" && brewingCoffee && (
          <LivePage
            workflow={data.workflow}
            activeProfile={activeProfile}
            latestShot={reviewShot ?? latestShot}
            liveMeasurements={liveTelemetry.measurements}
            scaleSnapshot={liveTelemetry.scaleSnapshot}
          />
        )}
        {page === "review" &&
          (reviewShot ? (
            <ReviewPage
              key={reviewShot.id}
              shot={reviewShot}
              previousShots={data.shots}
              onSaveAnnotations={saveReview}
              onUploadVisualizer={uploadReviewToVisualizer}
              r2Sensor={r2Sensor}
              r2Available={r2Available}
              onReadR2={readR2}
              autoReadR2={autoReadR2ShotId === reviewShot.id}
              autoReadR2DelaySeconds={data.settings.r2MeasureDelaySeconds}
              grinders={data.grinders ?? []}
              defaultGrinderId={data.settings.defaultGrinderId ?? data.settings.lastGrinderId}
            />
          ) : (
            <div className="panel wide">
              <h2>Shot Review</h2>
              <p className="muted">Pull a shot to unlock post-shot review.</p>
            </div>
          ))}
        {page === "steam" && (
          <SteamPage
            profileTitle={activeProfile?.profile.title ?? data.workflow.profile?.title ?? "Milk profile"}
            timers={activeProfileWorkflow.steamTimers}
            onReview={() => setPage("review")}
            onStartSteam={startSteam}
            onStopSteam={stopSteam}
            steamActive={steamingMilk}
            steamHistory={data.steams ?? []}
          />
        )}
        {page === "bags" && (
          <BagsPage
            bags={data.bags}
            onSaveBag={saveBag}
            onUpdateBag={updateBag}
            onArchiveBag={archiveBag}
          />
        )}
        {page === "grinders" && (
          <GrindersPage
            grinders={data.grinders ?? []}
            defaultGrinderId={data.settings.defaultGrinderId ?? data.settings.lastGrinderId}
            onSetDefaultGrinder={setDefaultGrinder}
            onCreateGrinder={createGrinder}
            onUpdateGrinder={updateGrinder}
            onArchiveGrinder={archiveGrinder}
          />
        )}
        {page === "profiles" && (
          <ProfilesPage
            profiles={data.profiles}
            settings={data.settings}
            onToggleReview={toggleReview}
            onSetStartupProfile={setStartupProfile}
            onSetProfileShown={setProfileShown}
            onUpdateProfileWorkflow={updateProfileWorkflow}
            onSaveProfile={saveProfile}
          />
        )}
        {page === "history" && <HistoryPage shots={data.shots} bags={data.bags} />}
        {page === "settings" && (
          <SettingsPage
            settings={data.settings}
            r2Sensor={r2Sensor}
            displayState={data.displayState}
            visualizerPlugin={visualizerPlugin}
            visualizerSettings={data.visualizerSettings}
            visualizerStatus={data.visualizerStatus}
            webuiSkins={data.webuiSkins}
            defaultWebuiSkin={data.defaultWebuiSkin}
            skinUpdateStatus={status}
            skinUpdateBusy={skinUpdateBusy}
            skinUpdatePhase={skinUpdatePhase}
            availableSkinVersion={availableSkinVersion}
            r2RefreshBusy={r2RefreshBusy}
            onRefreshR2={refreshR2Sensor}
            onCheckSkinUpdates={() => checkSkinUpdates()}
            onInstallSkinUpdate={() => installSkinUpdate()}
            onUpdateSettings={(next) => void persistSettings(next, "Settings saved.")}
          />
        )}
        {editingSlot && (
          <div className="preset-editor" role="dialog" aria-modal="true" aria-labelledby="preset-editor-title">
            <div className="preset-editor-panel">
              <div className="form-header">
                <div>
                  <span className="eyebrow">Preset Slot</span>
                  <h2 id="preset-editor-title">Edit {editingSlot.label} preset</h2>
                </div>
                <button type="button" className="ghost-button" onClick={() => setEditingSlotIndex(null)}>
                  Cancel
                </button>
              </div>
              {status && (
                <p
                  className={status.type === "error" ? "status-message error" : "status-message"}
                  role={status.type === "error" ? "alert" : "status"}
                  aria-live={status.type === "error" ? "assertive" : "polite"}
                >
                  {status.message}
                </p>
              )}
              <div className="profile-picker" aria-label={`Choose a profile for ${editingSlot.label}`}>
                {shownProfiles.length === 0 && <p className="muted">No profiles are shown. Enable profiles from the Profiles page.</p>}
                {shownProfiles.length > 0 && presetPickerProfiles.length === 0 && (
                  <p className="muted">All shown profiles are already assigned to other presets.</p>
                )}
                {presetPickerProfiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    className="list-row"
                    aria-label={`Use ${profile.profile.title ?? profile.id}`}
                    onClick={() => {
                      void assignPresetProfile(profile);
                    }}
                  >
                    <strong>{profile.profile.title ?? profile.id}</strong>
                    <span>{profile.id === editingSlot.profileId ? "Current profile" : "Use this profile"}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
