import { Coffee, History, PackageOpen, Settings, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { ReaPrimeApi } from "./api/reaprime";
import type { ProfileRecord } from "./api/types";
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
      <section className="page-surface" aria-live="polite">
        <h1>{nav.find((item) => item.id === page)?.label}</h1>
        {data.error && <p className="muted" role="alert">{data.error}</p>}
        {page === "brew" && (
          <BrewPage
            workflow={data.workflow}
            profiles={data.profiles}
            bags={data.bags}
            shots={data.shots}
            settings={data.settings}
            onApplyProfile={applyProfile}
            onEditSlot={() => undefined}
          />
        )}
        {page === "bags" && <BagsPage bags={data.bags} />}
        {page === "profiles" && <ProfilesPage profiles={data.profiles} settings={data.settings} onToggleReview={toggleReview} />}
        {page === "history" && <HistoryPage shots={data.shots} bags={data.bags} />}
        {page === "settings" && (
          <div className="panel wide">
            <h2>Settings</h2>
            <p className="muted">Workflow skin settings are stored in ReaPrime.</p>
          </div>
        )}
      </section>
    </main>
  );
}
