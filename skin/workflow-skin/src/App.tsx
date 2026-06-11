import { Activity, Coffee, Flame, History, Moon, PackageOpen, Settings, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiBaseUrl, ReaPrimeApi, ReaPrimeApiError } from "./api/reaprime";
import { findDifluidR2Sensor } from "./api/sensors";
import type { DeviceInfo, Grinder, MachineState, Profile, ProfileRecord, ShotAnnotations } from "./api/types";
import { uploadShotToVisualizer } from "./api/visualizer";
import type { Bag } from "./lib/bags";
import { buildConnectivityStatuses } from "./lib/connectivity";
import type { ConnectivityStatus } from "./lib/connectivity";
import { postShotPageForShot, selectedProfileIdFromWorkflow } from "./lib/workflowRouting";
import { BagsPage } from "./pages/BagsPage";
import { BrewPage } from "./pages/BrewPage";
import { HistoryPage } from "./pages/HistoryPage";
import { LivePage } from "./pages/LivePage";
import { ProfilesPage } from "./pages/ProfilesPage";
import { ReviewPage } from "./pages/ReviewPage";
import { ScreensaverPage } from "./pages/ScreensaverPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SteamPage } from "./pages/SteamPage";
import { isProfileShown, profileWorkflowFor, type ProfileWorkflowSettings, type SkinSettings } from "./state/skinSettings";
import { useLiveTelemetry } from "./state/useLiveTelemetry";
import { useReaData } from "./state/useReaData";

type Page = "brew" | "live" | "review" | "steam" | "bags" | "profiles" | "history" | "settings" | "screensaver";

const nav: Array<{ id: Page; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: "brew", label: "Brew", icon: Coffee },
  { id: "live", label: "Live", icon: Activity },
  { id: "review", label: "Review", icon: Activity },
  { id: "steam", label: "Steam", icon: Flame },
  { id: "bags", label: "Bags", icon: PackageOpen },
  { id: "profiles", label: "Profiles", icon: SlidersHorizontal },
  { id: "history", label: "History", icon: History },
  { id: "settings", label: "Settings", icon: Settings }
];

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

function isSleepingMachine(machineState: MachineState | null): boolean {
  return machineState?.state?.state === "sleeping";
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
  const [expandedStatusId, setExpandedStatusId] = useState<ConnectivityStatus["id"] | null>(null);
  const startupAppliedRef = useRef(false);
  const startupConnectRef = useRef(false);
  const skinAutoUpdateRef = useRef(false);
  const knownLatestShotIdRef = useRef<string | null | undefined>(undefined);
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
    if (startupAppliedRef.current || !data.loaded || !data.settings.startupProfileId) return;
    const startupProfile = data.profiles.find((profile) => profile.id === data.settings.startupProfileId);
    if (!startupProfile) return;
    startupAppliedRef.current = true;
    applyProfile(startupProfile).catch((error) => {
      setStatus({ type: "error", message: `Could not apply startup profile: ${errorMessage(error)}` });
    });
  }, [data.loaded, data.settings.startupProfileId, data.profiles]);

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
    if (currentMachineMode === "espresso") setPage("live");
  }, [currentMachineMode, data.loaded, page]);

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
    if (nextPage) setPage(nextPage);
  }, [data.loaded, latestShot, data.settings, data.profiles]);

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

  const checkSkinUpdates = async (reportStatus = true) => {
    setSkinUpdateBusy(true);
    try {
      const result = await api.updateWebUISkins();
      await data.refresh();
      if (reportStatus) setStatus({ type: "success", message: statusSentence(result.message, "Skin update check completed") });
    } catch (error) {
      setStatus({ type: "error", message: `Could not check skin updates: ${errorMessage(error)}` });
      throw error;
    } finally {
      setSkinUpdateBusy(false);
    }
  };

  const installSkinUpdate = async (reportStatus = true) => {
    const repo = data.settings.skinUpdateRepo.trim();
    if (!repo) {
      setStatus({ type: "error", message: "Add a GitHub repo before installing skin updates." });
      return;
    }

    setSkinUpdateBusy(true);
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

  const applyProfileAndOpenLive = async (profile: ProfileRecord) => {
    await applyProfile(profile);
    setPage("live");
  };

  const startBrew = async () => {
    setBrewPending(true);
    setPage("live");
    try {
      await api.requestMachineState("espresso");
      setStatus({ type: "success", message: "Brew started." });
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
        extras: { workflowSkin: { createdFromBagForm: true } }
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
        notes: bag.notes?.trim() || undefined
      })
    ]);
    await data.refresh();
  };

  const archiveBag = async (bag: Bag) => {
    await api.updateBatch(bag.id, { archived: true });
    await data.refresh();
  };

  const createGrinder = async (payload: Pick<Grinder, "model" | "settingType" | "notes">) => {
    await api.createGrinder(payload);
    await data.refresh();
  };

  const updateGrinder = async (id: string, payload: Pick<Grinder, "model" | "settingType" | "notes">) => {
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

  const sleepMachine = async () => {
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
  };

  const wakeScreen = async () => {
    await api.setDisplayBrightness(100).catch(() => undefined);
    if (data.settings.keepScreenAwake !== false) {
      await api.requestWakeLock().catch(() => undefined);
    }
    if (isSleepingMachine(data.machineState)) {
      await api.wakeMachine().catch(() => undefined);
    }
    setPage("brew");
  };

  const toggleStatusPopover = (nextStatus: ConnectivityStatus) => {
    setExpandedStatusId((current) => (current === nextStatus.id ? null : nextStatus.id));
  };

  const editingSlot = editingSlotIndex === null ? undefined : data.settings.presetSlots[editingSlotIndex];

  if (page === "screensaver") {
    return <ScreensaverPage title={data.settings.skinTitle} onWake={() => void wakeScreen()} />;
  }

  return (
    <main className="app-shell">
      <nav className="side-nav" aria-label="Workflow navigation">
        <SidebarStatus statuses={statuses} expandedStatusId={expandedStatusId} onStatusPress={toggleStatusPopover} />
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              aria-current={page === item.id ? "page" : undefined}
              aria-label={item.label}
              className={page === item.id ? "nav-button active" : "nav-button"}
              onClick={() => setPage(item.id)}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <section className="page-surface">
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
        </div>
        <AppHeadline title={data.settings.skinTitle} />
        <h1>{nav.find((item) => item.id === page)?.label}</h1>
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
              void applyProfileAndOpenLive(profile);
            }}
            onEditSlot={(index) => {
              setStatus(null);
              setEditingSlotIndex(index);
            }}
            onStartBrew={() => {
              void startBrew();
            }}
            brewPending={brewPending}
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
