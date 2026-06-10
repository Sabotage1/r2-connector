import { Activity, Coffee, Flame, History, PackageOpen, Settings, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiBaseUrl, ReaPrimeApi } from "./api/reaprime";
import { findDifluidR2Sensor, r2SocketUrl } from "./api/sensors";
import type { ProfileRecord, ShotAnnotations } from "./api/types";
import { uploadShotToVisualizer } from "./api/visualizer";
import type { Bag } from "./lib/bags";
import { buildConnectivityStatuses } from "./lib/connectivity";
import type { ConnectivityStatus } from "./lib/connectivity";
import { postShotPageForShot, selectedProfileIdFromWorkflow } from "./lib/workflowRouting";
import { BagsPage } from "./pages/BagsPage";
import { BrewPage } from "./pages/BrewPage";
import { HistoryPage } from "./pages/HistoryPage";
import { ProfilesPage } from "./pages/ProfilesPage";
import { ReviewPage } from "./pages/ReviewPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SteamPage } from "./pages/SteamPage";
import { profileWorkflowFor, type ProfileWorkflowSettings, type SkinSettings } from "./state/skinSettings";
import { useReaData } from "./state/useReaData";

type Page = "brew" | "review" | "steam" | "bags" | "editProfiles" | "history" | "settings";

const nav: Array<{ id: Page; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: "brew", label: "Brew", icon: Coffee },
  { id: "review", label: "Review", icon: Activity },
  { id: "steam", label: "Steam", icon: Flame },
  { id: "bags", label: "Bags", icon: PackageOpen },
  { id: "editProfiles", label: "Edit Profiles", icon: SlidersHorizontal },
  { id: "history", label: "History", icon: History },
  { id: "settings", label: "Settings", icon: Settings }
];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

function waitForR2Tds(apiBase: string, sensorId: string): Promise<number | null> {
  if (typeof WebSocket === "undefined") return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const socket = new WebSocket(r2SocketUrl(apiBase, sensorId));
    const timeout = window.setTimeout(() => finish(null), 2500);

    function finish(value: number | null) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      socket.close();
      resolve(value);
    }

    socket.onmessage = (event) => {
      try {
        const tds = extractNumericTds(JSON.parse(String(event.data)));
        if (tds !== null) finish(tds);
      } catch {
        return;
      }
    };
    socket.onerror = () => finish(null);
    socket.onclose = () => finish(null);
  });
}

function SidebarStatus({ title, statuses }: { title: string; statuses: ConnectivityStatus[] }) {
  return (
    <div className="sidebar-header">
      <div className="skin-title-card" aria-label="Current skin title">
        <span>{title}</span>
      </div>
      <div className="compact-status-bar" aria-label="Connection status">
        {statuses.map((status) => (
          <div className="compact-status-chip" key={status.id} title={`${status.label}: ${status.detail}`}>
            <span className={status.connected ? "status-dot connected" : "status-dot disconnected"} aria-hidden="true" />
            <span>{status.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function App() {
  const [page, setPage] = useState<Page>("brew");
  const [editingSlotIndex, setEditingSlotIndex] = useState<number | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const startupAppliedRef = useRef(false);
  const knownLatestShotIdRef = useRef<string | null | undefined>(undefined);
  const api = useMemo(() => new ReaPrimeApi(), []);
  const data = useReaData(api);
  const latestShot = data.shots[0] ?? null;
  const r2Sensor = findDifluidR2Sensor(data.sensors);
  const selectedProfileId = selectedProfileIdFromWorkflow(data.workflow, data.profiles);
  const activeProfile = data.profiles.find((profile) => profile.id === selectedProfileId);
  const activeProfileWorkflow = profileWorkflowFor(data.settings, selectedProfileId);
  const statuses = useMemo(
    () =>
      buildConnectivityStatuses({
        apiHost: new URL(apiBaseUrl()).hostname,
        machineState: data.machineState,
        sensors: data.sensors,
        r2SensorId: data.settings.r2SensorId,
        r2Sensor
      }),
    [data.machineState, data.sensors, data.settings.r2SensorId, r2Sensor]
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
    if (!r2Sensor) return null;
    try {
      const tdsPromise = waitForR2Tds(apiBaseUrl(), r2Sensor.id).catch(() => null);
      const result = await api.executeSensor(r2Sensor.id, "measure");
      if (result.status === "error") {
        setStatus({ type: "error", message: `Could not read R2: ${result.message ?? "Measurement command failed."}` });
        return null;
      }

      const tds = await tdsPromise;
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

  const editingSlot = editingSlotIndex === null ? undefined : data.settings.presetSlots[editingSlotIndex];

  return (
    <main className="app-shell">
      <nav className="side-nav" aria-label="Workflow navigation">
        <SidebarStatus title={data.settings.skinTitle} statuses={statuses} />
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
        <h1>{nav.find((item) => item.id === page)?.label}</h1>
        {data.error && (
          <p className="muted" role="alert" aria-live="assertive">
            {data.error}
          </p>
        )}
        {status && (
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
            onApplyProfile={applyProfile}
            onEditSlot={(index) => {
              setStatus(null);
              setEditingSlotIndex(index);
            }}
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
          />
        )}
        {page === "bags" && <BagsPage bags={data.bags} onSaveBag={saveBag} />}
        {page === "editProfiles" && (
          <ProfilesPage
            profiles={data.profiles}
            settings={data.settings}
            onToggleReview={toggleReview}
            onSetStartupProfile={setStartupProfile}
            onUpdateProfileWorkflow={updateProfileWorkflow}
          />
        )}
        {page === "history" && <HistoryPage shots={data.shots} bags={data.bags} />}
        {page === "settings" && (
          <SettingsPage settings={data.settings} r2Sensor={r2Sensor} onUpdateSettings={(next) => void persistSettings(next, "Settings saved.")} />
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
              <div className="profile-picker" aria-label={`Choose a profile for ${editingSlot.label}`}>
                {data.profiles.map((profile) => (
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
