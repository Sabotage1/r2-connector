import { Coffee, History, PackageOpen, Settings, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { ReaPrimeApi } from "./api/reaprime";
import type { ProfileRecord } from "./api/types";
import type { Bag } from "./lib/bags";
import { BagsPage } from "./pages/BagsPage";
import { BrewPage } from "./pages/BrewPage";
import { HistoryPage } from "./pages/HistoryPage";
import { ProfilesPage } from "./pages/ProfilesPage";
import { useReaData } from "./state/useReaData";

type Page = "brew" | "bags" | "profiles" | "history" | "settings";

const nav: Array<{ id: Page; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: "brew", label: "Brew", icon: Coffee },
  { id: "bags", label: "Bags", icon: PackageOpen },
  { id: "profiles", label: "Profiles", icon: SlidersHorizontal },
  { id: "history", label: "History", icon: History },
  { id: "settings", label: "Settings", icon: Settings }
];

export function App() {
  const [page, setPage] = useState<Page>("brew");
  const [editingSlotIndex, setEditingSlotIndex] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const api = useMemo(() => new ReaPrimeApi(), []);
  const data = useReaData(api);

  const applyProfile = async (profile: ProfileRecord) => {
    await api.updateWorkflow({ profile: profile.profile });
    await data.refresh();
  };

  const toggleReview = async (profileId: string, enabled: boolean) => {
    await data.persistSettings({
      ...data.settings,
      reviewEnabledByProfile: { ...data.settings.reviewEnabledByProfile, [profileId]: enabled }
    });
  };

  const assignPresetProfile = async (profile: ProfileRecord) => {
    if (editingSlotIndex === null) return;
    const slot = data.settings.presetSlots[editingSlotIndex];
    if (!slot) return;

    await data.persistSettings({
      ...data.settings,
      presetSlots: data.settings.presetSlots.map((item, index) => (index === editingSlotIndex ? { ...item, profileId: profile.id } : item))
    });
    setStatus(`Preset ${slot.label} set to ${profile.profile.title ?? profile.id}.`);
    setEditingSlotIndex(null);
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
    await api.createBatch(bean.id, {
      roastDate: bag.roastDate?.trim() || undefined,
      roastLevel: bag.roastLevel?.trim() || undefined,
      notes: bag.notes?.trim() || undefined,
      extras: { workflowSkin: { createdFromBagForm: true } }
    });
    await data.refresh();
  };

  const editingSlot = editingSlotIndex === null ? undefined : data.settings.presetSlots[editingSlotIndex];

  return (
    <main className="app-shell">
      <nav className="side-nav" aria-label="Workflow navigation">
        <div className="brand">Workflow</div>
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
          <p className="status-message" role="status" aria-live="polite">
            {status}
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
            onEditSlot={setEditingSlotIndex}
          />
        )}
        {page === "bags" && <BagsPage bags={data.bags} onSaveBag={saveBag} />}
        {page === "profiles" && <ProfilesPage profiles={data.profiles} settings={data.settings} onToggleReview={toggleReview} />}
        {page === "history" && <HistoryPage shots={data.shots} bags={data.bags} />}
        {page === "settings" && (
          <div className="panel wide">
            <h2>Settings</h2>
            <p className="muted">Workflow skin settings are stored in ReaPrime.</p>
          </div>
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
                    onClick={() => void assignPresetProfile(profile)}
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
