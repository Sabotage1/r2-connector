import { Coffee, History, PackageOpen, Settings, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

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
        <p className="muted">Skin scaffold is ready. Core navigation is available.</p>
      </section>
    </main>
  );
}
