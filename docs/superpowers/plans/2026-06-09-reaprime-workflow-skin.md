# ReaPrime Workflow Skin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an installable ReaPrime WebUI skin with editable profile presets, valid bag history, explainable profile recommendations, post-shot review, manual TDS/EY, Visualizer upload, and R2-ready sensor detection.

**Architecture:** Add a standalone React/Vite skin under `skin/workflow-skin/`. Keep ReaPrime API access in typed client modules, keep pure recommendation/statistics logic in tested library modules, and keep UI pages thin. Native DiFluid R2 support is not implemented in this workspace; this skin detects an R2 only when a ReaPrime build exposes it through the existing sensor API.

**Tech Stack:** React 19, Vite, TypeScript, Vitest, Testing Library, Playwright, JSZip, ReaPrime REST/WebSocket APIs.

---

## Scope Boundary

This plan implements the skin MVP in this repository. Native DiFluid R2 adapter work requires a ReaPrime source checkout and hardware verification, so it gets a separate implementation plan after this skin is usable.

The skin must still provide manual TDS/EY entry when no R2 is connected.

## File Structure

- `skin/workflow-skin/package.json` - scripts, dependencies, and skin package metadata.
- `skin/workflow-skin/index.html` - Vite entry document served by ReaPrime.
- `skin/workflow-skin/skin-manifest.json` - ReaPrime skin metadata; ReaPrime uses this for skin id/name/version.
- `skin/workflow-skin/vite.config.ts` - Vite, Vitest, and dev-server proxy config.
- `skin/workflow-skin/tsconfig.json` - strict TypeScript config.
- `skin/workflow-skin/playwright.config.ts` - responsive UI smoke checks.
- `skin/workflow-skin/scripts/package-skin.mjs` - zips `dist/` to `workflow-skin.zip`.
- `skin/workflow-skin/src/api/types.ts` - ReaPrime JSON types used by the skin.
- `skin/workflow-skin/src/api/reaprime.ts` - HTTP/WebSocket client helpers.
- `skin/workflow-skin/src/api/visualizer.ts` - Visualizer plugin endpoint wrapper.
- `skin/workflow-skin/src/api/sensors.ts` - R2 sensor discovery/measurement helper.
- `skin/workflow-skin/src/lib/ey.ts` - TDS/EY calculations and validation.
- `skin/workflow-skin/src/lib/bags.ts` - bag validity, joins, and filters.
- `skin/workflow-skin/src/lib/recommendations.ts` - deterministic profile ranking.
- `skin/workflow-skin/src/lib/shotStats.ts` - graph/statistics/previous-five calculations.
- `skin/workflow-skin/src/state/skinSettings.ts` - KV-backed profile slots and review settings.
- `skin/workflow-skin/src/state/useReaData.ts` - shared data loading and refresh hooks.
- `skin/workflow-skin/src/pages/BrewPage.tsx` - main page with preset buttons and workflow controls.
- `skin/workflow-skin/src/pages/BagsPage.tsx` - bag history and editor form.
- `skin/workflow-skin/src/pages/ProfilesPage.tsx` - profile assignment and recommendation detail.
- `skin/workflow-skin/src/pages/HistoryPage.tsx` - filtered shot history.
- `skin/workflow-skin/src/pages/ReviewPage.tsx` - post-shot graph, stats, TDS/EY, grind size, notes, Visualizer.
- `skin/workflow-skin/src/pages/SettingsPage.tsx` - Visualizer/R2/status/preference controls.
- `skin/workflow-skin/src/components/*.tsx` - focused reusable controls.
- `skin/workflow-skin/src/styles.css` - global responsive dark UI system.
- `skin/workflow-skin/src/test/*.test.ts` and `*.test.tsx` - unit and component tests.
- `skin/workflow-skin/e2e/workflow.spec.ts` - Playwright smoke path.
- `docs/reaprime-workflow-skin.md` - install and verification instructions.

## Task 1: Scaffold The Skin Workspace

**Files:**
- Create: `skin/workflow-skin/package.json`
- Create: `skin/workflow-skin/index.html`
- Create: `skin/workflow-skin/skin-manifest.json`
- Create: `skin/workflow-skin/vite.config.ts`
- Create: `skin/workflow-skin/tsconfig.json`
- Create: `skin/workflow-skin/playwright.config.ts`
- Create: `skin/workflow-skin/src/main.tsx`
- Create: `skin/workflow-skin/src/App.tsx`
- Create: `skin/workflow-skin/src/styles.css`

- [ ] **Step 1: Create the project directories**

Run:

```bash
mkdir -p skin/workflow-skin/src/{api,components,lib,pages,state,test} skin/workflow-skin/e2e skin/workflow-skin/scripts
```

Expected: command exits with status 0.

- [ ] **Step 2: Create `package.json`**

Write `skin/workflow-skin/package.json`:

```json
{
  "name": "reaprime-workflow-skin",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "package": "npm run build && node scripts/package-skin.mjs"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "jszip": "^3.10.1",
    "lucide-react": "^0.468.0",
    "vite": "^7.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.45.0",
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.5.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 3: Create Vite and TypeScript config**

Write `skin/workflow-skin/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080",
      "/ws": {
        target: "ws://localhost:8080",
        ws: true
      }
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"]
  }
});
```

Write `skin/workflow-skin/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "vite.config.ts", "playwright.config.ts"]
}
```

- [ ] **Step 4: Create skin metadata and app entry**

Write `skin/workflow-skin/skin-manifest.json`:

```json
{
  "id": "workflow-skin",
  "name": "Workflow Skin",
  "description": "Profile presets, bag history, recommendations, post-shot review, TDS/EY, and Visualizer workflow for ReaPrime.",
  "version": "0.1.0"
}
```

Write `skin/workflow-skin/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Workflow Skin</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Write `skin/workflow-skin/src/main.tsx`:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Write `skin/workflow-skin/src/App.tsx`:

```tsx
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
```

Write `skin/workflow-skin/src/styles.css` with the base dark UI:

```css
:root {
  color-scheme: dark;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #11171c;
  color: #f5f7f8;
  line-height: 1.4;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background: #11171c;
}

button,
input,
select,
textarea {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 220px 1fr;
}

.side-nav {
  padding: 18px;
  border-right: 1px solid #29323a;
  background: #151c22;
}

.brand {
  font-size: 22px;
  font-weight: 800;
  margin-bottom: 24px;
}

.nav-button {
  width: 100%;
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid transparent;
  color: #aab5bf;
  background: transparent;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
}

.nav-button.active,
.nav-button:hover {
  color: #f5f7f8;
  background: #202a32;
  border-color: #34414b;
}

.page-surface {
  padding: 24px;
}

.page-surface h1 {
  margin: 0 0 10px;
  font-size: 28px;
  line-height: 1.1;
  letter-spacing: 0;
}

.muted {
  color: #9daab4;
}

@media (max-width: 760px) {
  .app-shell {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr auto;
  }

  .side-nav {
    order: 2;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
    padding: 8px;
    border-right: 0;
    border-top: 1px solid #29323a;
  }

  .brand {
    display: none;
  }

  .nav-button {
    justify-content: center;
    min-height: 54px;
  }

  .nav-button span {
    display: none;
  }
}
```

- [ ] **Step 5: Create test setup and a smoke test**

Write `skin/workflow-skin/src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Write `skin/workflow-skin/src/test/app.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../App";

describe("App shell", () => {
  it("starts on the brew page and switches navigation tabs", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Brew" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Bags/i }));
    expect(screen.getByRole("heading", { name: "Bags" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Install dependencies and verify scaffold**

Run:

```bash
cd skin/workflow-skin
npm install
npm test
npm run build
```

Expected: tests pass and Vite writes `dist/`.

- [ ] **Step 7: Commit scaffold**

Run:

```bash
git add skin/workflow-skin
git commit -m "feat: scaffold ReaPrime workflow skin"
```

Expected: commit succeeds.

## Task 2: Add Typed ReaPrime API Client

**Files:**
- Create: `skin/workflow-skin/src/api/types.ts`
- Create: `skin/workflow-skin/src/api/reaprime.ts`
- Test: `skin/workflow-skin/src/test/reaprime.test.ts`

- [ ] **Step 1: Write API client tests first**

Write `skin/workflow-skin/src/test/reaprime.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiBaseUrl, ReaPrimeApi } from "../api/reaprime";

describe("apiBaseUrl", () => {
  it("uses the current hostname on ReaPrime port 8080", () => {
    expect(apiBaseUrl(new URL("http://192.168.1.20:3000/"))).toBe("http://192.168.1.20:8080");
  });

  it("uses localhost when no browser location is supplied", () => {
    expect(apiBaseUrl()).toBe("http://localhost:8080");
  });
});

describe("ReaPrimeApi", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads profiles from ReaPrime", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ id: "p1", profile: { title: "Bloom" } }]), { status: 200 })
    );
    const api = new ReaPrimeApi("http://machine:8080");
    await expect(api.listProfiles()).resolves.toEqual([{ id: "p1", profile: { title: "Bloom" } }]);
    expect(fetch).toHaveBeenCalledWith("http://machine:8080/api/v1/profiles", expect.objectContaining({ method: "GET" }));
  });

  it("throws readable errors for non-2xx responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad", { status: 500 }));
    const api = new ReaPrimeApi("http://machine:8080");
    await expect(api.getWorkflow()).rejects.toThrow("GET /api/v1/workflow failed: 500 bad");
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
cd skin/workflow-skin
npm test -- src/test/reaprime.test.ts
```

Expected: FAIL because `../api/reaprime` does not exist.

- [ ] **Step 3: Add API types**

Write `skin/workflow-skin/src/api/types.ts`:

```ts
export type JsonMap = Record<string, unknown>;

export interface Profile {
  title?: string;
  author?: string;
  notes?: string;
  beverage_type?: string;
  target_weight?: number | null;
  steps?: Array<JsonMap>;
}

export interface ProfileRecord {
  id: string;
  profile: Profile;
  metadata?: JsonMap;
  visibility?: "visible" | "hidden";
}

export interface WorkflowContext {
  targetDoseWeight?: number;
  targetYield?: number;
  grinderId?: string;
  grinderModel?: string;
  grinderSetting?: string;
  beanBatchId?: string;
  coffeeName?: string;
  coffeeRoaster?: string;
  finalBeverageType?: string;
  baristaName?: string;
  drinkerName?: string;
  extras?: JsonMap;
}

export interface Workflow {
  id?: string;
  name?: string;
  description?: string;
  profile?: Profile;
  context?: WorkflowContext;
}

export interface Bean {
  id: string;
  roaster: string;
  name: string;
  country?: string;
  region?: string;
  processing?: string;
  notes?: string;
  archived?: boolean;
  extras?: JsonMap;
}

export interface BeanBatch {
  id: string;
  beanId: string;
  roastDate?: string;
  roastLevel?: string;
  openDate?: string;
  weight?: number;
  weightRemaining?: number;
  notes?: string;
  archived?: boolean;
  extras?: JsonMap;
}

export interface Grinder {
  id: string;
  manufacturer?: string;
  model: string;
  settingType?: "numeric" | "preset";
  notes?: string;
}

export interface ShotAnnotations {
  actualDoseWeight?: number;
  actualYield?: number;
  drinkTds?: number;
  drinkEy?: number;
  enjoyment?: number;
  espressoNotes?: string;
  extras?: JsonMap;
}

export interface ShotSnapshot {
  machine?: {
    timestamp?: string;
    pressure?: number;
    targetPressure?: number;
    flow?: number;
    targetFlow?: number;
    mixTemperature?: number;
    groupTemperature?: number;
    targetMixTemperature?: number;
    state?: { state?: string; substate?: string };
  };
  scale?: {
    weight?: number;
    weightFlow?: number;
  };
}

export interface ShotRecord {
  id: string;
  timestamp: string;
  workflow: Workflow;
  measurements?: ShotSnapshot[];
  annotations?: ShotAnnotations;
  shotNotes?: string;
  metadata?: JsonMap;
}

export interface ShotPage {
  items: ShotRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface SensorListItem {
  id: string;
  info: {
    name: string;
    vendor: string;
    data: Array<{ key: string; type: string; unit?: string }>;
    commands?: Array<{ id: string; name?: string; description?: string }>;
  };
}
```

- [ ] **Step 4: Add API client**

Write `skin/workflow-skin/src/api/reaprime.ts`:

```ts
import type { Bean, BeanBatch, Grinder, ProfileRecord, SensorListItem, ShotPage, ShotRecord, Workflow } from "./types";

export function apiBaseUrl(locationUrl?: URL): string {
  if (!locationUrl && typeof window === "undefined") return "http://localhost:8080";
  const url = locationUrl ?? new URL(window.location.href);
  return `${url.protocol}//${url.hostname}:8080`;
}

export class ReaPrimeApi {
  constructor(private readonly baseUrl = apiBaseUrl()) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const method = init.method ?? "GET";
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {})
      }
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${method} ${path} failed: ${response.status} ${text}`);
    }
    return text ? (JSON.parse(text) as T) : (undefined as T);
  }

  listProfiles() {
    return this.request<ProfileRecord[]>("/api/v1/profiles");
  }

  listDefaultProfiles() {
    return this.request<ProfileRecord[]>("/api/v1/profiles/defaults");
  }

  getWorkflow() {
    return this.request<Workflow>("/api/v1/workflow");
  }

  updateWorkflow(patch: Partial<Workflow>) {
    return this.request<Workflow>("/api/v1/workflow", {
      method: "PUT",
      body: JSON.stringify(patch)
    });
  }

  listBeans() {
    return this.request<Bean[]>("/api/v1/beans?includeArchived=false");
  }

  listBatches(beanId: string) {
    return this.request<BeanBatch[]>(`/api/v1/beans/${encodeURIComponent(beanId)}/batches?includeArchived=false`);
  }

  listGrinders() {
    return this.request<Grinder[]>("/api/v1/grinders?includeArchived=false");
  }

  listShots(params: Record<string, string | number | undefined> = {}) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") search.set(key, String(value));
    }
    const query = search.toString();
    return this.request<ShotPage | ShotRecord[]>(`/api/v1/shots${query ? `?${query}` : ""}`);
  }

  getShot(id: string) {
    return this.request<ShotRecord>(`/api/v1/shots/${encodeURIComponent(id)}`);
  }

  getLatestShot() {
    return this.request<ShotRecord | null>("/api/v1/shots/latest");
  }

  updateShot(id: string, patch: Partial<ShotRecord>) {
    return this.request<ShotRecord>(`/api/v1/shots/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(patch)
    });
  }

  listSensors() {
    return this.request<SensorListItem[]>("/api/v1/sensors");
  }

  executeSensor(id: string, commandId: string, params?: Record<string, unknown>) {
    return this.request<{ status: "ok" | "error"; result?: unknown; message?: string }>(
      `/api/v1/sensors/${encodeURIComponent(id)}/execute`,
      {
        method: "POST",
        body: JSON.stringify({ commandId, params })
      }
    );
  }
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
cd skin/workflow-skin
npm test -- src/test/reaprime.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit API client**

Run:

```bash
git add skin/workflow-skin/src/api skin/workflow-skin/src/test/reaprime.test.ts
git commit -m "feat: add ReaPrime API client"
```

Expected: commit succeeds.

## Task 3: Add Bag Validity, Filters, And EY Utilities

**Files:**
- Create: `skin/workflow-skin/src/lib/ey.ts`
- Create: `skin/workflow-skin/src/lib/bags.ts`
- Test: `skin/workflow-skin/src/test/ey.test.ts`
- Test: `skin/workflow-skin/src/test/bags.test.ts`

- [ ] **Step 1: Write EY tests**

Write `skin/workflow-skin/src/test/ey.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calculateEy, cleanNumber } from "../lib/ey";

describe("calculateEy", () => {
  it("calculates EY from yield, TDS percent, and dose", () => {
    expect(calculateEy({ yieldGrams: 40, tdsPercent: 9.5, doseGrams: 18 })).toBe(21.11);
  });

  it("returns null when dose is not positive", () => {
    expect(calculateEy({ yieldGrams: 40, tdsPercent: 9.5, doseGrams: 0 })).toBeNull();
  });
});

describe("cleanNumber", () => {
  it("parses finite text numbers and rejects blanks", () => {
    expect(cleanNumber(" 9.5 ")).toBe(9.5);
    expect(cleanNumber("")).toBeNull();
    expect(cleanNumber("abc")).toBeNull();
  });
});
```

- [ ] **Step 2: Write bag tests**

Write `skin/workflow-skin/src/test/bags.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Bean, BeanBatch, ShotRecord } from "../api/types";
import { buildBag, filterShotsByBagFields, isValidBag } from "../lib/bags";

const bean: Bean = {
  id: "bean-1",
  roaster: "April",
  name: "Ethiopia Anaerobic",
  country: "Ethiopia",
  region: "Sidama",
  processing: "anaerobic"
};

const batch: BeanBatch = {
  id: "batch-1",
  beanId: "bean-1",
  roastDate: "2026-06-01T00:00:00.000Z",
  roastLevel: "light"
};

describe("bag helpers", () => {
  it("requires roaster, bean, roast date, and process for valid bags", () => {
    expect(isValidBag(buildBag(bean, batch))).toBe(true);
    expect(isValidBag(buildBag({ ...bean, processing: undefined }, batch))).toBe(false);
  });

  it("filters shots by joined bag fields", () => {
    const shots: ShotRecord[] = [
      { id: "s1", timestamp: "2026-06-09T10:00:00Z", workflow: { context: { beanBatchId: "batch-1" } } },
      { id: "s2", timestamp: "2026-06-09T11:00:00Z", workflow: { context: { beanBatchId: "batch-2" } } }
    ];
    const result = filterShotsByBagFields(shots, [buildBag(bean, batch)], { country: "Ethiopia", process: "anaerobic" });
    expect(result.map((shot) => shot.id)).toEqual(["s1"]);
  });
});
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
cd skin/workflow-skin
npm test -- src/test/ey.test.ts src/test/bags.test.ts
```

Expected: FAIL because the `lib` files do not exist.

- [ ] **Step 4: Implement EY utilities**

Write `skin/workflow-skin/src/lib/ey.ts`:

```ts
export function cleanNumber(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateEy(input: { yieldGrams?: number | null; tdsPercent?: number | null; doseGrams?: number | null }): number | null {
  const dose = input.doseGrams;
  const yieldGrams = input.yieldGrams;
  const tds = input.tdsPercent;
  if (!dose || dose <= 0 || yieldGrams == null || tds == null) return null;
  return round2((yieldGrams * tds) / dose);
}
```

- [ ] **Step 5: Implement bag utilities**

Write `skin/workflow-skin/src/lib/bags.ts`:

```ts
import type { Bean, BeanBatch, ShotRecord } from "../api/types";

export interface Bag {
  id: string;
  beanId: string;
  roaster?: string;
  bean?: string;
  country?: string;
  region?: string;
  process?: string;
  roastDate?: string;
  roastLevel?: string;
  notes?: string;
}

export interface BagFilters {
  roaster?: string;
  bean?: string;
  country?: string;
  region?: string;
  process?: string;
  roastLevel?: string;
}

export function buildBag(bean: Bean, batch: BeanBatch): Bag {
  return {
    id: batch.id,
    beanId: bean.id,
    roaster: bean.roaster,
    bean: bean.name,
    country: bean.country,
    region: bean.region,
    process: bean.processing,
    roastDate: batch.roastDate,
    roastLevel: batch.roastLevel,
    notes: batch.notes ?? bean.notes
  };
}

export function isValidBag(bag: Bag): boolean {
  return Boolean(bag.roaster?.trim() && bag.bean?.trim() && bag.roastDate?.trim() && bag.process?.trim());
}

function matches(value: string | undefined, filter: string | undefined): boolean {
  if (!filter) return true;
  return (value ?? "").toLowerCase().includes(filter.toLowerCase());
}

export function filterBags(bags: Bag[], filters: BagFilters): Bag[] {
  return bags.filter((bag) =>
    matches(bag.roaster, filters.roaster) &&
    matches(bag.bean, filters.bean) &&
    matches(bag.country, filters.country) &&
    matches(bag.region, filters.region) &&
    matches(bag.process, filters.process) &&
    matches(bag.roastLevel, filters.roastLevel)
  );
}

export function filterShotsByBagFields(shots: ShotRecord[], bags: Bag[], filters: BagFilters): ShotRecord[] {
  const matchingBatchIds = new Set(filterBags(bags, filters).map((bag) => bag.id));
  return shots.filter((shot) => {
    const batchId = shot.workflow.context?.beanBatchId;
    return batchId ? matchingBatchIds.has(batchId) : false;
  });
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
cd skin/workflow-skin
npm test -- src/test/ey.test.ts src/test/bags.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit utilities**

Run:

```bash
git add skin/workflow-skin/src/lib skin/workflow-skin/src/test/ey.test.ts skin/workflow-skin/src/test/bags.test.ts
git commit -m "feat: add bag and EY utilities"
```

Expected: commit succeeds.

## Task 4: Add KV-Backed Skin Settings

**Files:**
- Create: `skin/workflow-skin/src/state/skinSettings.ts`
- Test: `skin/workflow-skin/src/test/skinSettings.test.ts`

- [ ] **Step 1: Write settings tests**

Write `skin/workflow-skin/src/test/skinSettings.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { defaultSkinSettings, loadSkinSettings, saveSkinSettings } from "../state/skinSettings";

describe("skin settings", () => {
  it("has post-shot review enabled by default", () => {
    expect(defaultSkinSettings.reviewEnabledByProfile).toEqual({});
    expect(defaultSkinSettings.defaultReviewEnabled).toBe(true);
  });

  it("loads default settings when KV is missing", async () => {
    const api = { getKv: vi.fn().mockResolvedValue(null), putKv: vi.fn() };
    await expect(loadSkinSettings(api)).resolves.toEqual(defaultSkinSettings);
  });

  it("saves settings to workflow-skin namespace", async () => {
    const api = { getKv: vi.fn(), putKv: vi.fn().mockResolvedValue(undefined) };
    await saveSkinSettings(api, { ...defaultSkinSettings, presetSlots: [{ label: "Light", profileId: "p1" }] });
    expect(api.putKv).toHaveBeenCalledWith("workflow-skin", "settings", expect.objectContaining({ presetSlots: [{ label: "Light", profileId: "p1" }] }));
  });
});
```

- [ ] **Step 2: Add KV methods to API client**

Modify `skin/workflow-skin/src/api/reaprime.ts` by adding these methods inside `ReaPrimeApi`:

```ts
  async getKv<T>(namespace: string, key: string): Promise<T | null> {
    try {
      return await this.request<T>(`/api/v1/kv/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) return null;
      throw error;
    }
  }

  putKv(namespace: string, key: string, value: unknown) {
    return this.request<void>(`/api/v1/kv/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify(value)
    });
  }
```

- [ ] **Step 3: Implement skin settings**

Write `skin/workflow-skin/src/state/skinSettings.ts`:

```ts
export interface PresetSlot {
  label: string;
  profileId?: string;
}

export interface SkinSettings {
  presetSlots: PresetSlot[];
  defaultReviewEnabled: boolean;
  reviewEnabledByProfile: Record<string, boolean>;
  lastBeanBatchId?: string;
  lastGrinderId?: string;
  preferredEyMin?: number;
  preferredEyMax?: number;
}

export const SKIN_NAMESPACE = "workflow-skin";
export const SETTINGS_KEY = "settings";

export const defaultSkinSettings: SkinSettings = {
  presetSlots: [
    { label: "Light" },
    { label: "Sweet" },
    { label: "Turbo" },
    { label: "Classic" }
  ],
  defaultReviewEnabled: true,
  reviewEnabledByProfile: {}
};

export interface KvApi {
  getKv<T>(namespace: string, key: string): Promise<T | null>;
  putKv(namespace: string, key: string, value: unknown): Promise<unknown>;
}

export async function loadSkinSettings(api: KvApi): Promise<SkinSettings> {
  const saved = await api.getKv<Partial<SkinSettings>>(SKIN_NAMESPACE, SETTINGS_KEY);
  return { ...defaultSkinSettings, ...(saved ?? {}) };
}

export async function saveSkinSettings(api: KvApi, settings: SkinSettings): Promise<void> {
  await api.putKv(SKIN_NAMESPACE, SETTINGS_KEY, settings);
}

export function isReviewEnabled(settings: SkinSettings, profileId?: string): boolean {
  if (!profileId) return settings.defaultReviewEnabled;
  return settings.reviewEnabledByProfile[profileId] ?? settings.defaultReviewEnabled;
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
cd skin/workflow-skin
npm test -- src/test/skinSettings.test.ts src/test/reaprime.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit settings**

Run:

```bash
git add skin/workflow-skin/src/state/skinSettings.ts skin/workflow-skin/src/api/reaprime.ts skin/workflow-skin/src/test/skinSettings.test.ts
git commit -m "feat: persist workflow skin settings"
```

Expected: commit succeeds.

## Task 5: Add Recommendation And Shot Statistics Engines

**Files:**
- Create: `skin/workflow-skin/src/lib/recommendations.ts`
- Create: `skin/workflow-skin/src/lib/shotStats.ts`
- Test: `skin/workflow-skin/src/test/recommendations.test.ts`
- Test: `skin/workflow-skin/src/test/shotStats.test.ts`

- [ ] **Step 1: Write recommendation tests**

Write `skin/workflow-skin/src/test/recommendations.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ProfileRecord, ShotRecord } from "../api/types";
import type { Bag } from "../lib/bags";
import { recommendProfiles } from "../lib/recommendations";

const bag: Bag = {
  id: "batch-1",
  beanId: "bean-1",
  roaster: "April",
  bean: "Ethiopia",
  country: "Ethiopia",
  process: "washed",
  roastDate: "2026-06-01T00:00:00Z",
  roastLevel: "light"
};

const profiles: ProfileRecord[] = [
  { id: "p1", profile: { title: "Blooming" } },
  { id: "p2", profile: { title: "Classic" } }
];

const shots: ShotRecord[] = [
  {
    id: "s1",
    timestamp: "2026-06-08T10:00:00Z",
    workflow: { profile: { title: "Blooming" }, context: { beanBatchId: "batch-1" } },
    annotations: { drinkEy: 21, enjoyment: 8 }
  },
  {
    id: "s2",
    timestamp: "2026-06-07T10:00:00Z",
    workflow: { profile: { title: "Classic" }, context: { beanBatchId: "other" } },
    annotations: { drinkEy: 17, enjoyment: 4 }
  }
];

describe("recommendProfiles", () => {
  it("ranks profiles with same-bag successful shots first and explains why", () => {
    const ranked = recommendProfiles({ profiles, shots, selectedBag: bag, bags: [bag], preferredEy: [19, 23] });
    expect(ranked[0].profile.id).toBe("p1");
    expect(ranked[0].reasons).toContain("1 previous shot on this bag");
    expect(ranked[0].reasons).toContain("average enjoyment 8.0");
  });
});
```

- [ ] **Step 2: Write shot statistics tests**

Write `skin/workflow-skin/src/test/shotStats.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ShotRecord } from "../api/types";
import { previousFiveForBag, shotStats } from "../lib/shotStats";

describe("shotStats", () => {
  it("summarizes duration, pressure, flow, and final yield", () => {
    const shot: ShotRecord = {
      id: "s1",
      timestamp: "2026-06-09T10:00:00Z",
      workflow: {},
      measurements: [
        { machine: { timestamp: "2026-06-09T10:00:00.000Z", pressure: 1, flow: 1 }, scale: { weight: 2 } },
        { machine: { timestamp: "2026-06-09T10:00:10.000Z", pressure: 9, flow: 2 }, scale: { weight: 36 } }
      ]
    };
    expect(shotStats(shot)).toMatchObject({ durationSeconds: 10, peakPressure: 9, averageFlow: 1.5, finalYield: 36 });
  });
});

describe("previousFiveForBag", () => {
  it("returns the five most recent shots for a batch excluding the current shot", () => {
    const shots = Array.from({ length: 7 }, (_, index): ShotRecord => ({
      id: `s${index}`,
      timestamp: `2026-06-0${index + 1}T10:00:00Z`,
      workflow: { context: { beanBatchId: "batch-1" } }
    }));
    expect(previousFiveForBag(shots, "batch-1", "s6").map((shot) => shot.id)).toEqual(["s5", "s4", "s3", "s2", "s1"]);
  });
});
```

- [ ] **Step 3: Implement recommendation engine**

Write `skin/workflow-skin/src/lib/recommendations.ts`:

```ts
import type { ProfileRecord, ShotRecord } from "../api/types";
import type { Bag } from "./bags";

export interface Recommendation {
  profile: ProfileRecord;
  score: number;
  reasons: string[];
}

export function recommendProfiles(input: {
  profiles: ProfileRecord[];
  shots: ShotRecord[];
  selectedBag?: Bag;
  bags: Bag[];
  preferredEy: [number, number];
}): Recommendation[] {
  const titleToProfile = new Map(input.profiles.map((profile) => [profile.profile.title, profile]));
  const bagById = new Map(input.bags.map((bag) => [bag.id, bag]));
  const scores = new Map<string, Recommendation>();

  for (const profile of input.profiles) {
    scores.set(profile.id, { profile, score: 0, reasons: [] });
  }

  for (const shot of input.shots) {
    const profile = titleToProfile.get(shot.workflow.profile?.title);
    if (!profile) continue;
    const rec = scores.get(profile.id);
    if (!rec) continue;
    const shotBagId = shot.workflow.context?.beanBatchId;
    const shotBag = shotBagId ? bagById.get(shotBagId) : undefined;
    const sameBag = input.selectedBag?.id && shotBagId === input.selectedBag.id;
    const sameProcess = input.selectedBag?.process && shotBag?.process === input.selectedBag.process;
    const sameCountry = input.selectedBag?.country && shotBag?.country === input.selectedBag.country;
    const ey = shot.annotations?.drinkEy;
    const enjoyment = shot.annotations?.enjoyment;

    if (sameBag) rec.score += 50;
    if (sameProcess) rec.score += 12;
    if (sameCountry) rec.score += 6;
    if (typeof enjoyment === "number") rec.score += enjoyment * 3;
    if (typeof ey === "number" && ey >= input.preferredEy[0] && ey <= input.preferredEy[1]) rec.score += 15;
  }

  for (const rec of scores.values()) {
    const matchingShots = input.shots.filter((shot) => shot.workflow.profile?.title === rec.profile.profile.title);
    const sameBagShots = matchingShots.filter((shot) => shot.workflow.context?.beanBatchId === input.selectedBag?.id);
    const enjoymentValues = matchingShots.map((shot) => shot.annotations?.enjoyment).filter((value): value is number => typeof value === "number");
    if (sameBagShots.length) rec.reasons.push(`${sameBagShots.length} previous shot${sameBagShots.length === 1 ? "" : "s"} on this bag`);
    if (enjoymentValues.length) {
      const avg = enjoymentValues.reduce((sum, value) => sum + value, 0) / enjoymentValues.length;
      rec.reasons.push(`average enjoyment ${avg.toFixed(1)}`);
    }
    if (rec.reasons.length === 0) rec.reasons.push("available profile with no matching history");
  }

  return [...scores.values()].sort((a, b) => b.score - a.score || a.profile.profile.title!.localeCompare(b.profile.profile.title!));
}
```

- [ ] **Step 4: Implement shot statistics**

Write `skin/workflow-skin/src/lib/shotStats.ts`:

```ts
import type { ShotRecord, ShotSnapshot } from "../api/types";

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

export function shotStats(shot: ShotRecord) {
  const measurements = shot.measurements ?? [];
  const timestamps = measurements
    .map((sample) => sample.machine?.timestamp)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime());
  const durationSeconds = timestamps.length >= 2 ? Math.round((timestamps[timestamps.length - 1] - timestamps[0]) / 1000) : null;
  const pressures = measurements.map((sample) => sample.machine?.pressure).filter((value): value is number => typeof value === "number");
  const flows = measurements.map((sample) => sample.machine?.flow).filter((value): value is number => typeof value === "number");
  const weights = measurements.map((sample) => sample.scale?.weight).filter((value): value is number => typeof value === "number" && value > 0);
  return {
    durationSeconds,
    peakPressure: pressures.length ? Math.max(...pressures) : null,
    averagePressure: average(pressures),
    peakFlow: flows.length ? Math.max(...flows) : null,
    averageFlow: average(flows),
    finalYield: shot.annotations?.actualYield ?? weights.at(-1) ?? null
  };
}

export function previousFiveForBag(shots: ShotRecord[], beanBatchId: string, currentShotId?: string): ShotRecord[] {
  return shots
    .filter((shot) => shot.id !== currentShotId && shot.workflow.context?.beanBatchId === beanBatchId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);
}

export function grindSizeFromShot(shot: ShotRecord): string | undefined {
  const extras = shot.annotations?.extras;
  const workflowSkin = extras?.workflowSkin as { grindSize?: string } | undefined;
  return workflowSkin?.grindSize ?? shot.workflow.context?.grinderSetting;
}

export function graphSeries(measurements: ShotSnapshot[]) {
  return measurements.map((sample, index) => ({
    index,
    pressure: sample.machine?.pressure ?? 0,
    targetPressure: sample.machine?.targetPressure ?? 0,
    flow: sample.machine?.flow ?? 0,
    targetFlow: sample.machine?.targetFlow ?? 0,
    weight: sample.scale?.weight ?? 0
  }));
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
cd skin/workflow-skin
npm test -- src/test/recommendations.test.ts src/test/shotStats.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit recommendation/statistics**

Run:

```bash
git add skin/workflow-skin/src/lib/recommendations.ts skin/workflow-skin/src/lib/shotStats.ts skin/workflow-skin/src/test/recommendations.test.ts skin/workflow-skin/src/test/shotStats.test.ts
git commit -m "feat: add recommendation and shot statistics engines"
```

Expected: commit succeeds.

## Task 6: Build Data Loading Hooks And Core Pages

**Files:**
- Create: `skin/workflow-skin/src/state/useReaData.ts`
- Create: `skin/workflow-skin/src/components/MetricTile.tsx`
- Create: `skin/workflow-skin/src/components/ProfilePresetGrid.tsx`
- Create: `skin/workflow-skin/src/components/BagForm.tsx`
- Create: `skin/workflow-skin/src/pages/BrewPage.tsx`
- Create: `skin/workflow-skin/src/pages/BagsPage.tsx`
- Create: `skin/workflow-skin/src/pages/ProfilesPage.tsx`
- Create: `skin/workflow-skin/src/pages/HistoryPage.tsx`
- Modify: `skin/workflow-skin/src/App.tsx`
- Modify: `skin/workflow-skin/src/styles.css`
- Test: `skin/workflow-skin/src/test/pages.test.tsx`

- [ ] **Step 1: Write page tests**

Write `skin/workflow-skin/src/test/pages.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProfilePresetGrid } from "../components/ProfilePresetGrid";
import type { ProfileRecord } from "../api/types";

const profiles: ProfileRecord[] = [
  { id: "p1", profile: { title: "Blooming" } },
  { id: "p2", profile: { title: "Classic" } }
];

describe("ProfilePresetGrid", () => {
  it("applies a slot profile when selected", async () => {
    const onApply = vi.fn();
    render(
      <ProfilePresetGrid
        slots={[{ label: "Light", profileId: "p1" }]}
        profiles={profiles}
        onApply={onApply}
        onEditSlot={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /Light Blooming/i }));
    expect(onApply).toHaveBeenCalledWith(profiles[0]);
  });

  it("opens slot editing when the edit control is pressed", async () => {
    const onEditSlot = vi.fn();
    render(
      <ProfilePresetGrid
        slots={[{ label: "Light" }]}
        profiles={profiles}
        onApply={vi.fn()}
        onEditSlot={onEditSlot}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /Edit Light/i }));
    expect(onEditSlot).toHaveBeenCalledWith(0);
  });
});
```

- [ ] **Step 2: Implement reusable components**

Write `skin/workflow-skin/src/components/MetricTile.tsx`:

```tsx
export function MetricTile({ label, value, unit }: { label: string; value: string | number | null | undefined; unit?: string }) {
  return (
    <div className="metric-tile">
      <span>{label}</span>
      <strong>{value ?? "—"}{unit ? ` ${unit}` : ""}</strong>
    </div>
  );
}
```

Write `skin/workflow-skin/src/components/ProfilePresetGrid.tsx`:

```tsx
import { Pencil } from "lucide-react";
import type { ProfileRecord } from "../api/types";
import type { PresetSlot } from "../state/skinSettings";

export function ProfilePresetGrid({
  slots,
  profiles,
  onApply,
  onEditSlot
}: {
  slots: PresetSlot[];
  profiles: ProfileRecord[];
  onApply: (profile: ProfileRecord) => void;
  onEditSlot: (index: number) => void;
}) {
  return (
    <div className="preset-grid">
      {slots.map((slot, index) => {
        const profile = profiles.find((item) => item.id === slot.profileId);
        return (
          <div className="preset-button" key={`${slot.label}-${index}`}>
            <button disabled={!profile} onClick={() => profile && onApply(profile)}>
              <span>{slot.label}</span>
              <strong>{profile?.profile.title ?? "Choose profile"}</strong>
            </button>
            <button className="icon-button" aria-label={`Edit ${slot.label}`} onClick={() => onEditSlot(index)}>
              <Pencil size={18} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

Write `skin/workflow-skin/src/components/BagForm.tsx` with the screenshot-inspired field layout:

```tsx
import type { Bag } from "../lib/bags";

const fields: Array<{ key: keyof Bag; label: string; type?: string }> = [
  { key: "roaster", label: "Roaster" },
  { key: "bean", label: "Bean" },
  { key: "country", label: "Country" },
  { key: "region", label: "Region" },
  { key: "process", label: "Process" },
  { key: "roastDate", label: "Roast Date", type: "date" },
  { key: "roastLevel", label: "Roast Level" }
];

export function BagForm({
  value,
  onChange,
  onCancel,
  onSave
}: {
  value: Bag;
  onChange: (value: Bag) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <form className="bag-form" onSubmit={(event) => { event.preventDefault(); onSave(); }}>
      <div className="form-header">
        <div>
          <span className="eyebrow">New Bean</span>
          <h2>Add a bag</h2>
        </div>
        <div className="form-actions">
          <button type="button" className="ghost-button" onClick={onCancel}>Cancel</button>
          <button type="submit" className="primary-button">Save</button>
        </div>
      </div>
      <div className="form-grid">
        {fields.map((field) => (
          <label key={field.key}>
            <span>{field.label}</span>
            <input
              type={field.type ?? "text"}
              value={(value[field.key] as string | undefined) ?? ""}
              onChange={(event) => onChange({ ...value, [field.key]: event.target.value })}
            />
          </label>
        ))}
      </div>
      <label className="notes-field">
        <span>Notes</span>
        <textarea value={value.notes ?? ""} onChange={(event) => onChange({ ...value, notes: event.target.value })} />
      </label>
    </form>
  );
}
```

- [ ] **Step 3: Implement data hook**

Write `skin/workflow-skin/src/state/useReaData.ts`:

```ts
import { useCallback, useEffect, useMemo, useState } from "react";
import { ReaPrimeApi } from "../api/reaprime";
import type { Bean, BeanBatch, Grinder, ProfileRecord, ShotRecord, Workflow } from "../api/types";
import { buildBag, type Bag } from "../lib/bags";
import { defaultSkinSettings, loadSkinSettings, saveSkinSettings, type SkinSettings } from "./skinSettings";

export function useReaData(api = new ReaPrimeApi()) {
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [workflow, setWorkflow] = useState<Workflow>({});
  const [beans, setBeans] = useState<Bean[]>([]);
  const [batches, setBatches] = useState<BeanBatch[]>([]);
  const [grinders, setGrinders] = useState<Grinder[]>([]);
  const [shots, setShots] = useState<ShotRecord[]>([]);
  const [settings, setSettings] = useState<SkinSettings>(defaultSkinSettings);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [profileList, workflowData, beanList, grinderList, shotPage, savedSettings] = await Promise.all([
        api.listProfiles(),
        api.getWorkflow(),
        api.listBeans(),
        api.listGrinders(),
        api.listShots({ limit: 100, order: "desc" }),
        loadSkinSettings(api)
      ]);
      const batchLists = await Promise.all(beanList.map((bean) => api.listBatches(bean.id)));
      setProfiles(profileList);
      setWorkflow(workflowData);
      setBeans(beanList);
      setBatches(batchLists.flat());
      setGrinders(grinderList);
      setShots(Array.isArray(shotPage) ? shotPage : shotPage.items);
      setSettings(savedSettings);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [api]);

  useEffect(() => { void refresh(); }, [refresh]);

  const bags = useMemo<Bag[]>(() => {
    const beanById = new Map(beans.map((bean) => [bean.id, bean]));
    return batches.flatMap((batch) => {
      const bean = beanById.get(batch.beanId);
      return bean ? [buildBag(bean, batch)] : [];
    });
  }, [beans, batches]);

  const persistSettings = useCallback(async (next: SkinSettings) => {
    setSettings(next);
    await saveSkinSettings(api, next);
  }, [api]);

  return { api, profiles, workflow, beans, batches, bags, grinders, shots, settings, error, refresh, persistSettings };
}
```

- [ ] **Step 4: Replace `App.tsx` scaffold pages with real pages**

Create page components that use props rather than doing their own API work. Write `skin/workflow-skin/src/pages/BrewPage.tsx`:

```tsx
import type { ProfileRecord, Workflow } from "../api/types";
import type { Bag } from "../lib/bags";
import { recommendProfiles } from "../lib/recommendations";
import type { SkinSettings } from "../state/skinSettings";
import { MetricTile } from "../components/MetricTile";
import { ProfilePresetGrid } from "../components/ProfilePresetGrid";

export function BrewPage({
  workflow,
  profiles,
  bags,
  shots,
  settings,
  onApplyProfile,
  onEditSlot
}: {
  workflow: Workflow;
  profiles: ProfileRecord[];
  bags: Bag[];
  shots: import("../api/types").ShotRecord[];
  settings: SkinSettings;
  onApplyProfile: (profile: ProfileRecord) => void;
  onEditSlot: (index: number) => void;
}) {
  const selectedBag = bags.find((bag) => bag.id === workflow.context?.beanBatchId);
  const recommendations = recommendProfiles({ profiles, shots, selectedBag, bags, preferredEy: [settings.preferredEyMin ?? 18, settings.preferredEyMax ?? 23] });
  return (
    <div className="workflow-grid">
      <section className="panel wide">
        <h2>Presets</h2>
        <ProfilePresetGrid slots={settings.presetSlots} profiles={profiles} onApply={onApplyProfile} onEditSlot={onEditSlot} />
      </section>
      <section className="panel">
        <h2>Current Bag</h2>
        <p>{selectedBag ? `${selectedBag.roaster} ${selectedBag.bean}` : "No bag selected"}</p>
      </section>
      <section className="panel">
        <h2>Recipe</h2>
        <MetricTile label="Dose" value={workflow.context?.targetDoseWeight ?? null} unit="g" />
        <MetricTile label="Yield" value={workflow.context?.targetYield ?? workflow.profile?.target_weight ?? null} unit="g" />
      </section>
      <section className="panel wide">
        <h2>Recommended Profiles</h2>
        {recommendations.slice(0, 4).map((item) => (
          <button key={item.profile.id} className="recommendation-row" onClick={() => onApplyProfile(item.profile)}>
            <strong>{item.profile.profile.title}</strong>
            <span>{item.reasons.join(" · ")}</span>
          </button>
        ))}
      </section>
    </div>
  );
}
```

Write `skin/workflow-skin/src/pages/BagsPage.tsx`:

```tsx
import { useMemo, useState } from "react";
import { BagForm } from "../components/BagForm";
import { filterBags, isValidBag, type Bag, type BagFilters } from "../lib/bags";

const emptyBag: Bag = {
  id: "draft",
  beanId: "draft",
  roaster: "",
  bean: "",
  country: "",
  region: "",
  process: "",
  roastDate: "",
  roastLevel: "",
  notes: ""
};

export function BagsPage({ bags }: { bags: Bag[] }) {
  const [filters, setFilters] = useState<BagFilters>({});
  const [draft, setDraft] = useState<Bag>(emptyBag);
  const visibleBags = useMemo(() => filterBags(bags, filters), [bags, filters]);
  return (
    <div className="workflow-grid">
      <section className="panel wide">
        <h2>Bag Filters</h2>
        <div className="form-grid">
          <label>Roaster<input value={filters.roaster ?? ""} onChange={(event) => setFilters({ ...filters, roaster: event.target.value })} /></label>
          <label>Bean<input value={filters.bean ?? ""} onChange={(event) => setFilters({ ...filters, bean: event.target.value })} /></label>
          <label>Country<input value={filters.country ?? ""} onChange={(event) => setFilters({ ...filters, country: event.target.value })} /></label>
          <label>Process<input value={filters.process ?? ""} onChange={(event) => setFilters({ ...filters, process: event.target.value })} /></label>
          <label>Roast Level<input value={filters.roastLevel ?? ""} onChange={(event) => setFilters({ ...filters, roastLevel: event.target.value })} /></label>
        </div>
      </section>
      <section className="panel">
        <h2>History</h2>
        {visibleBags.map((bag) => (
          <div className="list-row" key={bag.id}>
            <strong>{bag.roaster} {bag.bean}</strong>
            <span>{[bag.country, bag.process, bag.roastLevel].filter(Boolean).join(" · ")}</span>
          </div>
        ))}
      </section>
      <section className="wide">
        <BagForm
          value={draft}
          onChange={setDraft}
          onCancel={() => setDraft(emptyBag)}
          onSave={() => window.alert(isValidBag(draft) ? "Use ReaPrime bean/batch APIs to save this bag." : "Roaster, bean, roast date, and process are required.")}
        />
      </section>
    </div>
  );
}
```

Write `skin/workflow-skin/src/pages/ProfilesPage.tsx`:

```tsx
import type { ProfileRecord } from "../api/types";
import type { SkinSettings } from "../state/skinSettings";

export function ProfilesPage({
  profiles,
  settings,
  onToggleReview
}: {
  profiles: ProfileRecord[];
  settings: SkinSettings;
  onToggleReview: (profileId: string, enabled: boolean) => void;
}) {
  return (
    <div className="panel wide">
      <h2>Profiles</h2>
      {profiles.map((profile) => {
        const enabled = settings.reviewEnabledByProfile[profile.id] ?? settings.defaultReviewEnabled;
        return (
          <div className="list-row" key={profile.id}>
            <strong>{profile.profile.title}</strong>
            <label className="inline-toggle">
              <input type="checkbox" checked={enabled} onChange={(event) => onToggleReview(profile.id, event.target.checked)} />
              Open review after brew
            </label>
          </div>
        );
      })}
    </div>
  );
}
```

Write `skin/workflow-skin/src/pages/HistoryPage.tsx`:

```tsx
import type { ShotRecord } from "../api/types";
import type { Bag } from "../lib/bags";
import { grindSizeFromShot } from "../lib/shotStats";

export function HistoryPage({ shots, bags }: { shots: ShotRecord[]; bags: Bag[] }) {
  const bagById = new Map(bags.map((bag) => [bag.id, bag]));
  return (
    <div className="panel wide">
      <h2>Shot History</h2>
      {shots.map((shot) => {
        const bag = shot.workflow.context?.beanBatchId ? bagById.get(shot.workflow.context.beanBatchId) : undefined;
        return (
          <div className="list-row" key={shot.id}>
            <strong>{new Date(shot.timestamp).toLocaleString()}</strong>
            <span>{shot.workflow.profile?.title ?? "Unknown profile"}</span>
            <span>{bag ? `${bag.roaster} ${bag.bean}` : "No bag"}</span>
            <span>EY {shot.annotations?.drinkEy ?? "—"} · Grind {grindSizeFromShot(shot) ?? "—"}</span>
          </div>
        );
      })}
    </div>
  );
}
```

Then wire these pages in `App.tsx`:

```tsx
// Add imports:
import { useMemo } from "react";
import type { ProfileRecord } from "./api/types";
import { ReaPrimeApi } from "./api/reaprime";
import { BrewPage } from "./pages/BrewPage";
import { BagsPage } from "./pages/BagsPage";
import { ProfilesPage } from "./pages/ProfilesPage";
import { HistoryPage } from "./pages/HistoryPage";
import { useReaData } from "./state/useReaData";

// Inside App:
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

// In the page surface:
{page === "brew" && <BrewPage workflow={data.workflow} profiles={data.profiles} bags={data.bags} shots={data.shots} settings={data.settings} onApplyProfile={applyProfile} onEditSlot={() => undefined} />}
{page === "bags" && <BagsPage bags={data.bags} />}
{page === "profiles" && <ProfilesPage profiles={data.profiles} settings={data.settings} onToggleReview={toggleReview} />}
{page === "history" && <HistoryPage shots={data.shots} bags={data.bags} />}
```

- [ ] **Step 5: Extend CSS for panels and form style**

Append to `skin/workflow-skin/src/styles.css`:

```css
.workflow-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.panel {
  border: 1px solid #303a43;
  background: #151c22;
  border-radius: 8px;
  padding: 18px;
}

.wide {
  grid-column: 1 / -1;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.preset-button {
  display: grid;
  grid-template-columns: 1fr 44px;
  border: 1px solid #34414b;
  border-radius: 8px;
  overflow: hidden;
  background: #10161b;
}

.preset-button button {
  color: #f5f7f8;
  background: transparent;
  border: 0;
  padding: 12px;
  text-align: left;
  cursor: pointer;
}

.icon-button {
  display: grid;
  place-items: center;
  border-left: 1px solid #34414b !important;
}

.metric-tile {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
}

.bag-form {
  border: 1px solid #303a43;
  border-radius: 8px;
  padding: 18px;
  background: #151c22;
}

.form-header,
.form-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.eyebrow,
.bag-form label span {
  display: block;
  color: #9daab4;
  text-transform: uppercase;
  font-weight: 800;
  margin-bottom: 8px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

input,
select,
textarea {
  width: 100%;
  border: 1px solid #303a43;
  border-radius: 8px;
  min-height: 48px;
  padding: 10px 12px;
  color: #f5f7f8;
  background: #12191f;
}

textarea {
  min-height: 120px;
  resize: vertical;
}

.primary-button,
.ghost-button {
  min-height: 44px;
  border-radius: 8px;
  padding: 0 18px;
  font-weight: 800;
  cursor: pointer;
}

.primary-button {
  border: 0;
  color: #11171c;
  background: #f5f7f8;
}

.ghost-button {
  border: 1px solid #303a43;
  color: #f5f7f8;
  background: #151c22;
}
```

- [ ] **Step 6: Run tests and build**

Run:

```bash
cd skin/workflow-skin
npm test -- src/test/pages.test.tsx
npm run build
```

Expected: PASS and successful build.

- [ ] **Step 7: Commit core pages**

Run:

```bash
git add skin/workflow-skin/src
git commit -m "feat: add workflow skin core pages"
```

Expected: commit succeeds.

## Task 7: Add Post-Shot Review, TDS/EY Persistence, Visualizer, And R2 UI

**Files:**
- Create: `skin/workflow-skin/src/api/visualizer.ts`
- Create: `skin/workflow-skin/src/api/sensors.ts`
- Create: `skin/workflow-skin/src/components/ShotGraph.tsx`
- Create: `skin/workflow-skin/src/pages/ReviewPage.tsx`
- Test: `skin/workflow-skin/src/test/review.test.tsx`
- Test: `skin/workflow-skin/src/test/integrations.test.ts`

- [ ] **Step 1: Write integration tests**

Write `skin/workflow-skin/src/test/integrations.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { SensorListItem } from "../api/types";
import { findDifluidR2Sensor } from "../api/sensors";
import { uploadShotToVisualizer } from "../api/visualizer";

describe("findDifluidR2Sensor", () => {
  it("matches a DiFluid R2 sensor by name and TDS channel", () => {
    const sensors: SensorListItem[] = [{
      id: "sensor-r2",
      info: { name: "DiFluid R2", vendor: "DiFluid", data: [{ key: "tds", type: "number", unit: "%" }], commands: [{ id: "measure" }] }
    }];
    expect(findDifluidR2Sensor(sensors)?.id).toBe("sensor-r2");
  });
});

describe("uploadShotToVisualizer", () => {
  it("posts to the bundled Visualizer plugin upload endpoint", async () => {
    const api = { baseUrl: "http://machine:8080" };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "vis-1" }), { status: 200 }));
    await expect(uploadShotToVisualizer(api, { id: "shot-1" })).resolves.toEqual({ id: "vis-1" });
    expect(fetch).toHaveBeenCalledWith("http://machine:8080/api/v1/plugins/visualizer.reaplugin/upload", expect.objectContaining({ method: "POST" }));
  });
});
```

- [ ] **Step 2: Write review component tests**

Write `skin/workflow-skin/src/test/review.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ShotRecord } from "../api/types";
import { ReviewPage } from "../pages/ReviewPage";

const shot: ShotRecord = {
  id: "s1",
  timestamp: "2026-06-09T10:00:00Z",
  workflow: { context: { targetDoseWeight: 18, beanBatchId: "batch-1" } },
  annotations: { actualYield: 40 },
  measurements: []
};

describe("ReviewPage", () => {
  it("calculates and saves manual TDS/EY", async () => {
    const onSave = vi.fn();
    render(<ReviewPage shot={shot} previousShots={[]} onSaveAnnotations={onSave} onUploadVisualizer={vi.fn()} r2Sensor={null} onReadR2={vi.fn()} />);
    await userEvent.clear(screen.getByLabelText("TDS"));
    await userEvent.type(screen.getByLabelText("TDS"), "9.5");
    await userEvent.click(screen.getByRole("button", { name: /Save Review/i }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ drinkTds: 9.5, drinkEy: 21.11 }));
  });
});
```

- [ ] **Step 3: Implement Visualizer and sensor helpers**

Write `skin/workflow-skin/src/api/visualizer.ts`:

```ts
export async function uploadShotToVisualizer(api: { baseUrl: string }, shot: unknown) {
  const response = await fetch(`${api.baseUrl}/api/v1/plugins/visualizer.reaplugin/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(shot)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Visualizer upload failed: ${response.status} ${text}`);
  return text ? JSON.parse(text) : {};
}
```

Write `skin/workflow-skin/src/api/sensors.ts`:

```ts
import type { SensorListItem } from "./types";

export interface R2Reading {
  tds?: number;
  temperature?: number;
  refractiveIndex?: number;
  status?: string;
  error?: string;
}

export function findDifluidR2Sensor(sensors: SensorListItem[]): SensorListItem | null {
  return sensors.find((sensor) => {
    const name = `${sensor.info.vendor} ${sensor.info.name}`.toLowerCase();
    const hasTds = sensor.info.data.some((channel) => channel.key.toLowerCase() === "tds");
    return name.includes("difluid") && name.includes("r2") && hasTds;
  }) ?? null;
}

export function r2SocketUrl(apiBase: string, sensorId: string): string {
  const url = new URL(apiBase);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/ws/v1/sensors/${encodeURIComponent(sensorId)}/snapshot`;
  return url.toString();
}
```

- [ ] **Step 4: Implement graph and review page**

Write `skin/workflow-skin/src/components/ShotGraph.tsx`:

```tsx
import type { ShotSnapshot } from "../api/types";
import { graphSeries } from "../lib/shotStats";

export function ShotGraph({ measurements }: { measurements: ShotSnapshot[] }) {
  const series = graphSeries(measurements);
  const width = 640;
  const height = 220;
  const points = series.map((sample, index) => {
    const x = series.length <= 1 ? 0 : (index / (series.length - 1)) * width;
    const y = height - Math.min(1, sample.pressure / 12) * height;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg className="shot-graph" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Shot pressure graph">
      <rect width={width} height={height} rx="8" fill="#10161b" />
      <polyline points={points} fill="none" stroke="#77d1c2" strokeWidth="4" />
    </svg>
  );
}
```

Write `skin/workflow-skin/src/pages/ReviewPage.tsx`:

```tsx
import { useMemo, useState } from "react";
import type { SensorListItem, ShotAnnotations, ShotRecord } from "../api/types";
import { ShotGraph } from "../components/ShotGraph";
import { calculateEy, cleanNumber } from "../lib/ey";
import { grindSizeFromShot, previousFiveForBag, shotStats } from "../lib/shotStats";

export function ReviewPage({
  shot,
  previousShots,
  onSaveAnnotations,
  onUploadVisualizer,
  r2Sensor,
  onReadR2
}: {
  shot: ShotRecord;
  previousShots: ShotRecord[];
  onSaveAnnotations: (annotations: ShotAnnotations) => Promise<void> | void;
  onUploadVisualizer: () => Promise<void> | void;
  r2Sensor: SensorListItem | null;
  onReadR2: () => Promise<number | null> | number | null;
}) {
  const stats = shotStats(shot);
  const [tdsText, setTdsText] = useState(String(shot.annotations?.drinkTds ?? ""));
  const [doseText, setDoseText] = useState(String(shot.annotations?.actualDoseWeight ?? shot.workflow.context?.targetDoseWeight ?? ""));
  const [yieldText, setYieldText] = useState(String(shot.annotations?.actualYield ?? stats.finalYield ?? ""));
  const [grindSize, setGrindSize] = useState(grindSizeFromShot(shot) ?? "");
  const [notes, setNotes] = useState(shot.annotations?.espressoNotes ?? "");

  const ey = useMemo(() => calculateEy({
    doseGrams: cleanNumber(doseText),
    yieldGrams: cleanNumber(yieldText),
    tdsPercent: cleanNumber(tdsText)
  }), [doseText, yieldText, tdsText]);

  const sameBagShots = shot.workflow.context?.beanBatchId
    ? previousFiveForBag(previousShots, shot.workflow.context.beanBatchId, shot.id)
    : [];

  async function save() {
    await onSaveAnnotations({
      actualDoseWeight: cleanNumber(doseText) ?? undefined,
      actualYield: cleanNumber(yieldText) ?? undefined,
      drinkTds: cleanNumber(tdsText) ?? undefined,
      drinkEy: ey ?? undefined,
      espressoNotes: notes,
      extras: { workflowSkin: { grindSize } }
    });
  }

  async function readR2() {
    const value = await onReadR2();
    if (typeof value === "number") setTdsText(String(value));
  }

  return (
    <div className="workflow-grid">
      <section className="panel wide">
        <h2>Shot Review</h2>
        <ShotGraph measurements={shot.measurements ?? []} />
      </section>
      <section className="panel">
        <h2>Stats</h2>
        <p>Duration: {stats.durationSeconds ?? "—"}s</p>
        <p>Peak pressure: {stats.peakPressure ?? "—"} bar</p>
        <p>Average flow: {stats.averageFlow ?? "—"} mL/s</p>
      </section>
      <section className="panel">
        <h2>Extraction</h2>
        <label>Dose<input value={doseText} onChange={(event) => setDoseText(event.target.value)} inputMode="decimal" /></label>
        <label>Yield<input value={yieldText} onChange={(event) => setYieldText(event.target.value)} inputMode="decimal" /></label>
        <label>TDS<input aria-label="TDS" value={tdsText} onChange={(event) => setTdsText(event.target.value)} inputMode="decimal" /></label>
        <p>EY: {ey ?? "—"}%</p>
        {r2Sensor && <button className="ghost-button" onClick={readR2}>Read from R2</button>}
      </section>
      <section className="panel">
        <h2>Dial In</h2>
        <label>Grind size<input value={grindSize} onChange={(event) => setGrindSize(event.target.value)} /></label>
        <p>Previous grind sizes: {sameBagShots.map(grindSizeFromShot).filter(Boolean).join(", ") || "—"}</p>
      </section>
      <section className="panel wide">
        <h2>Tasting Notes</h2>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
        <div className="form-actions">
          <button className="ghost-button" onClick={onUploadVisualizer}>Upload to Visualizer</button>
          <button className="primary-button" onClick={save}>Save Review</button>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Wire Review page into `App.tsx`**

Add `ReviewPage` as a route/page. When a latest shot exists, show it in Review; save annotations with:

```ts
await api.updateShot(shot.id, { annotations });
```

Upload with:

```ts
await uploadShotToVisualizer({ baseUrl: apiBaseUrl() }, await api.getShot(shot.id));
```

R2 read should call `api.executeSensor(r2.id, "measure")` and use the WebSocket reading when native ReaPrime exposes it. Until then, return `null` and keep manual TDS focused.

- [ ] **Step 6: Run tests and build**

Run:

```bash
cd skin/workflow-skin
npm test -- src/test/integrations.test.ts src/test/review.test.tsx
npm run build
```

Expected: PASS and successful build.

- [ ] **Step 7: Commit review flow**

Run:

```bash
git add skin/workflow-skin/src
git commit -m "feat: add post-shot review workflow"
```

Expected: commit succeeds.

## Task 8: Add Packaging, Documentation, And Browser Verification

**Files:**
- Create: `skin/workflow-skin/scripts/package-skin.mjs`
- Create: `skin/workflow-skin/e2e/workflow.spec.ts`
- Create: `docs/reaprime-workflow-skin.md`
- Modify: `skin/workflow-skin/package.json`

- [ ] **Step 1: Write package script**

Write `skin/workflow-skin/scripts/package-skin.mjs`:

```js
import { readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { readdir } from "node:fs/promises";
import JSZip from "jszip";

const root = join(fileURLToPath(new URL("..", import.meta.url)), "..");
const dist = join(root, "dist");
const manifest = JSON.parse(await readFile(join(root, "skin-manifest.json"), "utf8"));
const zip = new JSZip();

async function addDir(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await addDir(full);
    } else {
      zip.file(relative(dist, full), await readFile(full));
    }
  }
}

await addDir(dist);
zip.file("skin-manifest.json", JSON.stringify(manifest, null, 2));
const bytes = await zip.generateAsync({ type: "uint8array" });
await writeFile(join(root, "workflow-skin.zip"), bytes);
console.log(`Created workflow-skin.zip for ${manifest.id} ${manifest.version}`);
```

- [ ] **Step 2: Write Playwright smoke test**

Write `skin/workflow-skin/playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  webServer: {
    command: "npm run dev -- --port 5173",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true
  },
  use: {
    baseURL: "http://127.0.0.1:5173"
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "tablet", use: { ...devices["iPad Pro 11"] } }
  ]
});
```

Write `skin/workflow-skin/e2e/workflow.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("skin shell renders without overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Brew" })).toBeVisible();
  await page.getByRole("button", { name: /Bags/i }).click();
  await expect(page.getByRole("heading", { name: "Bags" })).toBeVisible();
  const bodyBox = await page.locator("body").boundingBox();
  expect(bodyBox?.width).toBeGreaterThan(300);
});
```

- [ ] **Step 3: Write install docs**

Write `docs/reaprime-workflow-skin.md`:

```markdown
# ReaPrime Workflow Skin

This skin targets ReaPrime/Decent.app v0.7.6 or newer.

## Build

```bash
cd skin/workflow-skin
npm install
npm run package
```

The package script creates `skin/workflow-skin/workflow-skin.zip`.

## Install In ReaPrime

1. Open ReaPrime settings for WebUI skins.
2. Install a skin from the ZIP URL or copy the ZIP to a reachable location and use the URL installer.
3. Set `workflow-skin` as the default skin.
4. Start the WebUI server and open the skin in the in-app WebView.

## Verification

- Assign at least one profile preset.
- Select a valid bag with roaster, bean, roast date, and process.
- Pull a shot.
- Open Review.
- Enter TDS manually and save EY.
- Upload to Visualizer when the bundled Visualizer plugin is configured.
- If a native ReaPrime build exposes DiFluid R2 as a sensor, use Read from R2 and confirm the imported TDS remains editable.
```

- [ ] **Step 4: Run full verification**

Run:

```bash
cd skin/workflow-skin
npm test
npm run build
npm run package
npm run e2e
```

Expected:

- Unit/component tests pass.
- Build completes.
- `workflow-skin.zip` exists.
- Playwright desktop and tablet projects pass.

- [ ] **Step 5: Commit packaging and docs**

Run:

```bash
git add skin/workflow-skin docs/reaprime-workflow-skin.md
git commit -m "feat: package ReaPrime workflow skin"
```

Expected: commit succeeds.

## Task 9: Final Verification Pass

**Files:**
- Modify only files needed to fix failures found in this task.

- [ ] **Step 1: Run repository status**

Run:

```bash
git status --short
```

Expected: clean or only intentional uncommitted verification artifacts. Remove generated temporary artifacts except the committed source and docs.

- [ ] **Step 2: Run final test suite**

Run:

```bash
cd skin/workflow-skin
npm test
npm run build
npm run package
npm run e2e
```

Expected: all commands pass.

- [ ] **Step 3: Start local dev server for user preview**

Run:

```bash
cd skin/workflow-skin
npm run dev -- --host 0.0.0.0
```

Expected: Vite prints a local URL such as `http://localhost:5173/`. Keep this session running until the user has the URL.

- [ ] **Step 4: Browser verification**

Open `http://localhost:5173/` in the in-app Browser. Verify:

- Desktop viewport renders without overlap.
- Tablet/mobile viewport renders without overlap.
- Navigation switches pages.
- Buttons have stable dimensions and text does not overflow.
- The dark bag form resembles the supplied visual direction.

- [ ] **Step 5: Commit any verification fixes**

If fixes were made, run:

```bash
git add skin/workflow-skin docs/reaprime-workflow-skin.md
git commit -m "fix: polish workflow skin verification issues"
```

Expected: commit succeeds only if fixes were needed.

## Plan Self-Review

- Spec coverage: The skin MVP covers editable profile presets, valid bag history, filtering, recommendations, post-shot review, manual TDS/EY, Visualizer upload, grind size, tasting notes, previous five-shot comparison, and R2-ready detection. Native R2 adapter implementation is intentionally excluded and requires its own ReaPrime-source plan.
- Gap scan: No task uses open-ended work; each step names files, commands, and expected outcomes.
- Type consistency: Shared ReaPrime types are defined in Task 2 and reused by utilities, state hooks, and pages in later tasks.
