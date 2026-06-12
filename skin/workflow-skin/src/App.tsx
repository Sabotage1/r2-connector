import {
  Activity,
  ArrowDown,
  ArrowUp,
  Coffee,
  Eye,
  EyeOff,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiBaseUrl, ReaPrimeApi, ReaPrimeApiError, type CreateGrinderPayload } from "./api/reaprime";
import { findDifluidR2Sensor } from "./api/sensors";
import type { DeviceInfo, Grinder, MachineState, Profile, ProfileRecord, ShotAnnotations } from "./api/types";
import { uploadShotToVisualizer } from "./api/visualizer";
import type { Bag } from "./lib/bags";
import { buildConnectivityStatuses } from "./lib/connectivity";
import type { ConnectivityStatus } from "./lib/connectivity";
import { postShotPageForShot, selectedProfileIdFromWorkflow } from "./lib/workflowRouting";
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
  hiddenMainMenuItemIdsForSettings,
  MAIN_MENU_ITEM_LABELS,
  mainMenuItemsForSettings,
  visibleMainMenuItems,
  isProfileShown,
  profileWorkflowFor,
  type MainMenuItemId,
  type ProfileWorkflowSettings,
  type SkinSettings
} from "./state/skinSettings";
import { useLiveTelemetry } from "./state/useLiveTelemetry";
import { useReaData } from "./state/useReaData";

type Page = MainMenuItemId | "screensaver";

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

function githubWorkflowZipUrl(repo: string, asset: string): string | null {
  const normalizedRepo = repo
    .trim()
    .replace(/^https:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/^\/+|\/+$/g, "");
  const cleanAsset = asset.trim() || "workflow-skin.zip";

  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalizedRepo)) return null;
  if (!/^[A-Za-z0-9_.-]+\.zip$/.test(cleanAsset)) return null;

  return `https://raw.githubusercontent.com/${normalizedRepo}/main/skin/workflow-skin/${encodeURIComponent(cleanAsset)}`;
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

function statusPopoverTitle(status: ConnectivityStatus): string {
  if (status.id === "wifi") return "Machine IP address";
  if (status.id === "water") return "Current water level";
  return `${status.label} status`;
}

function isDisconnectedDevice(device: DeviceInfo): boolean {
  return (device.type === "machine" || device.type === "scale") && device.state !== "connected";
}

function isR2Device(device: DeviceInfo): boolean {
  const label = `${device.name ?? ""} ${device.id}`.toLowerCase();
  return label.includes("difluid") || label.includes("r2");
}

function isSleepingMachine(machineState: MachineState | null): boolean {
  return machineState?.state?.state === "sleeping";
}

function isBrewingMode(state: string | undefined): boolean {
  return state === "espresso" || state === "brewing";
}

function isSleepingMode(state: string | undefined): boolean {
  return state === "sleeping";
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

function SidebarStatus({
  statuses,
  expandedStatusId,
  onStatusPress
}: {
  statuses: ConnectivityStatus[];
  expandedStatusId: ConnectivityStatus["id"] | null;
  onStatusPress: (status: ConnectivityStatus) => void;
}) {
  const expandedStatus = statuses.find((status) => status.id === expandedStatusId);

  return (
    <div className="sidebar-header">
      <div className="compact-status-bar" aria-label="Connection status">
        {statuses.map((status) => (
          <button
            type="button"
            className="compact-status-chip"
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
      </div>
      {expandedStatus && (
        <div className="status-popover" role="status">
          <span>{statusPopoverTitle(expandedStatus)}</span>
          <strong>{expandedStatus.detail}</strong>
        </div>
      )}
    </div>
  );
}

function AppHeadline({ title }: { title: string }) {
  return (
    <header className="app-headline" aria-label="App title">
      <span>{title}</span>
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
  const [mainMenuEditing, setMainMenuEditing] = useState(false);
  const [expandedStatusId, setExpandedStatusId] = useState<ConnectivityStatus["id"] | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [lastUseAt, setLastUseAt] = useState(() => Date.now());
  const [startupApplyTick, setStartupApplyTick] = useState(0);
  const [r2RefreshBusy, setR2RefreshBusy] = useState(false);
  const startupProfileApplyRef = useRef<{ profileId: string | null; attempts: number; pending: boolean }>({ profileId: null, attempts: 0, pending: false });
  const startupConnectRef = useRef(false);
  const skinAutoUpdateRef = useRef(false);
  const knownLatestShotIdRef = useRef<string | null | undefined>(undefined);
  const autoReadR2ShotIdRef = useRef<string | null>(null);
  const [autoReadR2ShotId, setAutoReadR2ShotId] = useState<string | null>(null);
  const sleepMachineRef = useRef<(() => Promise<void>) | null>(null);
  const api = useMemo(() => new ReaPrimeApi(), []);
  const data = useReaData(api);
  const liveTelemetry = useLiveTelemetry(undefined, { recordIdle: page === "live" });
  const latestShot = data.shots[0] ?? null;
  const detectedR2Sensor = findDifluidR2Sensor(data.sensors);
  const configuredR2Sensor = data.settings.r2SensorId ? data.sensors.find((sensor) => sensor.id === data.settings.r2SensorId) ?? null : null;
  const r2Sensor = configuredR2Sensor ?? detectedR2Sensor;
  const selectedProfileId = selectedProfileIdFromWorkflow(data.workflow, data.profiles);
  const activeProfile = data.profiles.find((profile) => profile.id === selectedProfileId);
  const activeProfileWorkflow = profileWorkflowFor(data.settings, selectedProfileId);
  const visualizerPlugin = data.plugins?.find((plugin) => plugin.id === "visualizer.reaplugin") ?? null;
  const shownProfiles = useMemo(
    () => data.profiles.filter((profile) => isProfileShown(data.settings, profile.id)),
    [data.profiles, data.settings.shownProfileIds]
  );
  const machineConnected = Boolean(data.machineState && data.machineState.connected !== false);
  const currentMachineMode = liveTelemetry.machineMode?.state ?? data.machineState?.state?.state;
  const statuses = useMemo(
    () =>
      buildConnectivityStatuses({
        apiHost: new URL(apiBaseUrl()).hostname,
        appInfo: data.appInfo,
        machineState: data.machineState,
        sensors: data.sensors,
        devices: data.devices,
        scaleConnected: liveTelemetry.scaleConnected,
        waterLevels: liveTelemetry.waterLevels,
        r2SensorId: data.settings.r2SensorId,
        r2Sensor
      }),
    [data.machineState, data.sensors, data.settings.r2SensorId, liveTelemetry.scaleConnected, liveTelemetry.waterLevels, r2Sensor]
  );
  const orderedMenuIds = useMemo(() => mainMenuItemsForSettings(data.settings), [data.settings.mainMenuItems]);
  const visibleMenuIds = useMemo(() => visibleMainMenuItems(data.settings), [data.settings.mainMenuItems, data.settings.hiddenMainMenuItemIds]);
  const hiddenMenuIds = useMemo(() => new Set(hiddenMainMenuItemIdsForSettings(data.settings)), [data.settings.hiddenMainMenuItemIds]);
  const renderedMenuIds = mainMenuEditing ? orderedMenuIds : visibleMenuIds;

  const applyProfile = async (profile: ProfileRecord) => {
    const extras = data.workflow.context?.extras ?? {};
    const workflowSkin = extras.workflowSkin && typeof extras.workflowSkin === "object" && !Array.isArray(extras.workflowSkin) ? extras.workflowSkin : {};
    await api.updateWorkflow({
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
    });
    await data.refresh();
  };

  useEffect(() => {
    const startupProfileId = data.settings.startupProfileId;
    if (!data.loaded || !startupProfileId) {
      startupProfileApplyRef.current = { profileId: null, attempts: 0, pending: false };
      return;
    }

    if (startupProfileApplyRef.current.profileId !== startupProfileId) {
      startupProfileApplyRef.current = { profileId: startupProfileId, attempts: 0, pending: false };
    }

    if (selectedProfileId === startupProfileId) {
      startupProfileApplyRef.current.pending = false;
      return;
    }

    if (startupProfileApplyRef.current.pending || startupProfileApplyRef.current.attempts >= 3) return;

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
  }, [data.loaded, data.settings.startupProfileId, data.profiles, selectedProfileId, startupApplyTick]);

  useEffect(() => {
    if (startupConnectRef.current || !data.loaded) return;
    startupConnectRef.current = true;

    const connectAndWake = async () => {
      await api.scanDevices({ connect: true, quick: true }).catch(() => undefined);
      const devices = await api.listDevices().catch(() => data.devices ?? []);

      for (const device of devices.filter(isDisconnectedDevice)) {
        await api.connectDevice(device.id).catch(() => undefined);
      }

      const latestMachineState = await api.getMachineState().catch(() => data.machineState);
      if (isSleepingMachine(latestMachineState)) {
        await api.wakeMachine().catch(() => undefined);
      }

      await data.refresh();
      window.setTimeout(() => {
        void data.refresh();
      }, 1500);
    };

    void connectAndWake();
  }, [api, data.loaded]);

  useEffect(() => {
    if (!data.loaded || page === "screensaver") return;

    const request = data.settings.keepScreenAwake !== false ? api.requestWakeLock() : api.releaseWakeLock();
    request.catch(() => {
      // Optional tablet display APIs are absent on some ReaPrime builds/platforms.
    });
  }, [api, data.loaded, data.settings.keepScreenAwake, page]);

  useEffect(() => {
    if (!data.loaded || page === "live" || page === "screensaver") return;
    if (isBrewingMode(currentMachineMode)) setPage("live");
  }, [currentMachineMode, data.loaded, page]);

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
    if (isBrewingMode(currentMachineMode)) setLastUseAt(Date.now());
  }, [currentMachineMode]);

  useEffect(() => {
    const markUse = () => setLastUseAt(Date.now());
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

    const nextPage = postShotPageForShot(latestShot, data.settings, data.profiles);
    if (r2Sensor && autoReadR2ShotIdRef.current !== latestShot.id) {
      autoReadR2ShotIdRef.current = latestShot.id;
      setAutoReadR2ShotId(latestShot.id);
    }
    if (nextPage) setPage(nextPage);
  }, [data.loaded, latestShot, data.settings, data.profiles, r2Sensor]);

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

  const moveMainMenuItem = async (itemId: MainMenuItemId, direction: -1 | 1) => {
    const currentItems = mainMenuItemsForSettings(data.settings);
    const index = currentItems.indexOf(itemId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= currentItems.length) return;

    const nextItems = [...currentItems];
    [nextItems[index], nextItems[nextIndex]] = [nextItems[nextIndex], nextItems[index]];
    await persistSettings({ ...data.settings, mainMenuItems: nextItems }, "Main menu saved.");
  };

  const setMainMenuItemVisible = async (itemId: MainMenuItemId, visible: boolean) => {
    if (itemId === "settings") return;
    const hidden = new Set(hiddenMainMenuItemIdsForSettings(data.settings));
    if (visible) hidden.delete(itemId);
    else hidden.add(itemId);
    await persistSettings({ ...data.settings, hiddenMainMenuItemIds: Array.from(hidden) }, "Main menu saved.");
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
      const scannedDevices = await api.scanDevices({ connect: true, quick: false }).catch(() => [] as DeviceInfo[]);
      const devices = await api.listDevices().catch(() => scannedDevices.length ? scannedDevices : data.devices);

      for (const device of devices.filter(isR2Device).filter((device) => device.state !== "connected")) {
        await api.connectDevice(device.id).catch(() => undefined);
      }

      const sensors = await api.listSensors().catch(() => [] as typeof data.sensors);
      const sensor = findDifluidR2Sensor(sensors);
      if (!sensor) {
        await data.refresh();
        setStatus({ type: "error", message: "No DiFluid R2 detected after refresh." });
        return;
      }

      await data.persistSettings({ ...data.settings, r2SensorId: sensor.id });
      await data.refresh();
      setStatus({ type: "success", message: `R2 connected: ${sensor.id}.` });
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
      if (repo) {
        const remoteVersion = await fetchLatestGithubReleaseVersion(repo, data.settings.skinUpdatePrerelease).catch(() => null);
        setAvailableSkinVersion(remoteVersion);
      } else {
        setAvailableSkinVersion(null);
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
      const result = await api.installSkinFromGithubRelease({
        repo,
        ...(asset ? { asset } : {}),
        prerelease: data.settings.skinUpdatePrerelease
      });
      await data.refresh();
      if (reportStatus) setStatus({ type: "success", message: statusSentence(result.message, "Skin installed from GitHub release") });
    } catch (error) {
      const asset = data.settings.skinUpdateAsset.trim();
      const fallbackUrl = githubReleaseMissing(error) ? githubWorkflowZipUrl(repo, asset) : null;
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
        presetSlots: data.settings.presetSlots.map((item, index) => (index === editingSlotIndex ? { ...item, profileId: profile.id } : item))
      });
      setStatus({ type: "success", message: `Preset ${slot.label} set to ${profile.profile.title ?? profile.id}.` });
      setEditingSlotIndex(null);
    } catch (error) {
      setStatus({ type: "error", message: `Could not save preset: ${errorMessage(error)}` });
    }
  };

  const applyProfileForBrew = async (profile: ProfileRecord) => {
    await applyProfile(profile);
    setLastUseAt(Date.now());
  };

  const startBrew = async () => {
    setBrewPending(true);
    setLastUseAt(Date.now());
    try {
      await api.requestMachineState("espresso");
      const latestMachineState = await api.getMachineState().catch(() => null);
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
    if (!latestShot) return;
    try {
      await uploadShotToVisualizer({ baseUrl: apiBaseUrl() }, await api.getShot(latestShot.id));
      setStatus({ type: "success", message: "Shot uploaded to Visualizer." });
    } catch (error) {
      setStatus({ type: "error", message: `Could not upload to Visualizer: ${errorMessage(error)}` });
    }
  };

  const readR2 = async () => {
    if (!r2Sensor) {
      setStatus({ type: "error", message: "No DiFluid R2 sensor detected." });
      return null;
    }

    try {
      const result = await api.executeSensor(r2Sensor.id, "measure", { timeout: 30 });
      if (result.status === "error") {
        setStatus({ type: "error", message: `Could not read R2: ${result.message ?? "Measurement command failed."}` });
        return null;
      }

      const tds = extractR2Tds(result.result);
      if (tds === null) {
        setStatus({ type: "error", message: "R2 did not return a TDS reading." });
        return null;
      }
      return tds;
    } catch (error) {
      setStatus({ type: "error", message: `Could not read R2: ${errorMessage(error)}` });
      return null;
    }
  };

  const sleepMachine = useCallback(async () => {
    setSleepPending(true);
    try {
      await api.setDisplayBrightness(data.settings.screensaverBrightness ?? 8).catch(() => undefined);
      await api.releaseWakeLock().catch(() => undefined);
      await api.sleepMachine();
      await data.refresh();
      setStatus({ type: "success", message: "Machine sleep requested." });
      setPage("screensaver");
    } catch (error) {
      setStatus({ type: "error", message: `Could not sleep machine: ${errorMessage(error)}` });
    } finally {
      setSleepPending(false);
    }
  }, [api, data.refresh, data.settings.screensaverBrightness]);

  useEffect(() => {
    sleepMachineRef.current = sleepMachine;
  }, [sleepMachine]);

  const wakeScreen = async () => {
    await api.setDisplayBrightness(100).catch(() => undefined);
    if (data.settings.keepScreenAwake !== false) {
      await api.requestWakeLock().catch(() => undefined);
    }
    if (isSleepingMachine(data.machineState)) {
      await api.wakeMachine().catch(() => undefined);
    }
    setLastUseAt(Date.now());
    setPage("brew");
  };

  useEffect(() => {
    if (!data.loaded || page === "screensaver" || !machineConnected) return;
    if (isBrewingMode(currentMachineMode) || isSleepingMode(currentMachineMode)) return;

    const autoSleepMinutes = data.settings.autoSleepMinutes;
    if (!autoSleepMinutes) return;

    const idleLimitMs = autoSleepMinutes * 60_000;
    const delay = Math.max(50, idleLimitMs - (Date.now() - lastUseAt));
    const timer = window.setTimeout(() => {
      if (Date.now() - lastUseAt >= idleLimitMs) {
        void sleepMachineRef.current?.();
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [currentMachineMode, data.loaded, data.settings.autoSleepMinutes, lastUseAt, machineConnected, page]);

  const forceScaleConnection = async () => {
    setStatus({ type: "success", message: "Trying to connect scale." });
    try {
      await api.scanDevices({ connect: true, quick: false }).catch(() => undefined);
      const devices = await api.listDevices().catch(() => data.devices ?? []);
      for (const device of devices.filter((device) => device.type === "scale" && device.state !== "connected")) {
        await api.connectDevice(device.id).catch(() => undefined);
      }
      await data.refresh();
    } catch (error) {
      setStatus({ type: "error", message: `Could not connect scale: ${errorMessage(error)}` });
    }
  };

  const toggleStatusPopover = (nextStatus: ConnectivityStatus) => {
    if (nextStatus.id === "scale" && !nextStatus.connected) {
      setExpandedStatusId(null);
      void forceScaleConnection();
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

  return (
    <main className={data.settings.menuCollapsed ? "app-shell menu-collapsed" : "app-shell"}>
      <nav className={mainMenuEditing ? "side-nav menu-editing" : "side-nav"} aria-label="Workflow navigation">
        <SidebarStatus statuses={statuses} expandedStatusId={expandedStatusId} onStatusPress={toggleStatusPopover} />
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
        {renderedMenuIds.map((itemId) => {
          const item = navById[itemId];
          const Icon = item.icon;
          const isReview = itemId === "review";
          const itemIsHidden = hiddenMenuIds.has(itemId);
          const menuIndex = orderedMenuIds.indexOf(itemId);
          const className = [
            page === itemId ? "nav-button active" : "nav-button",
            isReview ? "review-nav-button" : "",
            itemIsHidden ? "hidden-menu-item" : ""
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div className={mainMenuEditing ? "nav-edit-row" : "nav-edit-row idle"} key={itemId}>
              <button
                aria-current={page === itemId ? "page" : undefined}
                aria-label={item.label}
                className={className}
                onClick={() => setPage(itemId)}
              >
                <Icon className={isReview ? "nav-icon review-nav-icon" : "nav-icon"} size={navIconSize} />
                <span>{item.label}</span>
              </button>
              {mainMenuEditing && (
                <div className="nav-edit-controls" aria-label={`${item.label} menu controls`}>
                  <button
                    type="button"
                    className="nav-edit-button"
                    aria-label={`Move ${item.label} up`}
                    disabled={menuIndex <= 0}
                    onClick={(event) => {
                      event.stopPropagation();
                      void moveMainMenuItem(itemId, -1);
                    }}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    className="nav-edit-button"
                    aria-label={`Move ${item.label} down`}
                    disabled={menuIndex === orderedMenuIds.length - 1}
                    onClick={(event) => {
                      event.stopPropagation();
                      void moveMainMenuItem(itemId, 1);
                    }}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    className="nav-edit-button"
                    aria-label={itemIsHidden ? `Show ${item.label}` : `Hide ${item.label}`}
                    disabled={itemId === "settings"}
                    onClick={(event) => {
                      event.stopPropagation();
                      void setMainMenuItemVisible(itemId, itemIsHidden);
                    }}
                  >
                    {itemIsHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <section className="page-surface">
        <div className="page-topbar">
          <AppHeadline title={data.settings.skinTitle} />
          <div className="page-top-actions">
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
              <span>{fullscreen ? "Exit" : "Full"}</span>
            </button>
          </div>
        </div>
        <h1>{navById[page].label}</h1>
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
        {page === "live" && (
          <LivePage
            workflow={data.workflow}
            activeProfile={activeProfile}
            latestShot={latestShot}
            liveMeasurements={liveTelemetry.measurements}
            scaleSnapshot={liveTelemetry.scaleSnapshot}
          />
        )}
        {page === "review" &&
          (latestShot ? (
            <ReviewPage
              key={latestShot.id}
              shot={latestShot}
              previousShots={data.shots}
              onSaveAnnotations={saveReview}
              onUploadVisualizer={uploadReviewToVisualizer}
              r2Sensor={r2Sensor}
              onReadR2={readR2}
              autoReadR2={autoReadR2ShotId === latestShot.id}
              onBackToGraph={() => setPage("live")}
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
            steamHistory={data.steams ?? []}
          />
        )}
        {page === "bags" && (
          <BagsPage
            bags={data.bags}
            grinders={data.grinders ?? []}
            onSaveBag={saveBag}
            onUpdateBag={updateBag}
            onArchiveBag={archiveBag}
            onCreateGrinder={createGrinder}
            onUpdateGrinder={updateGrinder}
            onArchiveGrinder={archiveGrinder}
          />
        )}
        {page === "grinders" && (
          <GrindersPage
            grinders={data.grinders ?? []}
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
            mainMenuEditing={mainMenuEditing}
            onToggleMainMenuEditing={setMainMenuEditing}
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
                {shownProfiles.map((profile) => (
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
