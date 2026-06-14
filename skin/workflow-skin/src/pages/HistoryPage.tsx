import { useMemo, useState } from "react";
import type { ShotRecord } from "../api/types";
import type { Bag } from "../lib/bags";
import { grindSizeFromShot } from "../lib/shotStats";

interface HistoryFilters {
  search: string;
  profile: string;
  bagName: string;
  roaster: string;
  bean: string;
  country: string;
  region: string;
  process: string;
  roastDate: string;
  roastLevel: string;
}

const emptyFilters: HistoryFilters = {
  search: "",
  profile: "",
  bagName: "",
  roaster: "",
  bean: "",
  country: "",
  region: "",
  process: "",
  roastDate: "",
  roastLevel: ""
};

function normalized(value: string | number | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function matchesFilter(value: string | number | null | undefined, filter: string): boolean {
  const needle = normalized(filter);
  return !needle || normalized(value).includes(needle);
}

function profileTitle(shot: ShotRecord): string {
  return shot.workflow.profile?.title ?? "Unknown profile";
}

function shotBag(shot: ShotRecord, bagById: Map<string, Bag>): Bag | undefined {
  const bagId = shot.workflow.context?.beanBatchId;
  return bagId ? bagById.get(bagId) : undefined;
}

function historySearchText(shot: ShotRecord, bag: Bag | undefined): string {
  return [
    shot.id,
    shot.timestamp,
    profileTitle(shot),
    shot.annotations?.drinkEy,
    shot.annotations?.drinkTds,
    shot.annotations?.espressoNotes,
    shot.shotNotes,
    grindSizeFromShot(shot),
    bag?.name,
    bag?.roaster,
    bag?.bean,
    bag?.country,
    bag?.region,
    bag?.process,
    bag?.roastDate,
    bag?.roastLevel,
    bag?.notes
  ]
    .map((value) => String(value ?? ""))
    .join(" ");
}

function isGoldenShot(shot: ShotRecord): boolean {
  const workflowSkin = shot.annotations?.extras?.workflowSkin;
  const markedGolden = Boolean(workflowSkin && typeof workflowSkin === "object" && !Array.isArray(workflowSkin) && (workflowSkin as { goldenShot?: unknown }).goldenShot === true);
  return markedGolden || shot.annotations?.enjoyment === 10;
}

export function HistoryPage({ shots, bags }: { shots: ShotRecord[]; bags: Bag[] }) {
  const [filters, setFilters] = useState<HistoryFilters>(emptyFilters);
  const [goldOnly, setGoldOnly] = useState(false);
  const bagById = useMemo(() => new Map(bags.map((bag) => [bag.id, bag])), [bags]);
  const filteredShots = useMemo(
    () =>
      shots.filter((shot) => {
        const bag = shotBag(shot, bagById);
        return (
          (!goldOnly || isGoldenShot(shot)) &&
          matchesFilter(historySearchText(shot, bag), filters.search) &&
          matchesFilter(profileTitle(shot), filters.profile) &&
          matchesFilter(bag?.name, filters.bagName) &&
          matchesFilter(bag?.roaster, filters.roaster) &&
          matchesFilter(bag?.bean, filters.bean) &&
          matchesFilter(bag?.country, filters.country) &&
          matchesFilter(bag?.region, filters.region) &&
          matchesFilter(bag?.process, filters.process) &&
          matchesFilter(bag?.roastDate, filters.roastDate) &&
          matchesFilter(bag?.roastLevel, filters.roastLevel)
        );
      }),
    [bagById, filters, goldOnly, shots]
  );

  const updateFilter = (key: keyof HistoryFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="panel wide">
      <div className="history-heading">
        <h2>Shot History</h2>
        <button type="button" className={goldOnly ? "gold-button active" : "gold-button"} aria-pressed={goldOnly} onClick={() => setGoldOnly((current) => !current)}>
          Gold shots
        </button>
      </div>
      <div className="form-grid history-filter-grid" aria-label="History filters">
        <label className="history-search-field">
          Search
          <input aria-label="History search" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} />
        </label>
        <label>
          Profile
          <input value={filters.profile} onChange={(event) => updateFilter("profile", event.target.value)} />
        </label>
        <label>
          Bag Name
          <input value={filters.bagName} onChange={(event) => updateFilter("bagName", event.target.value)} />
        </label>
        <label>
          Roaster
          <input value={filters.roaster} onChange={(event) => updateFilter("roaster", event.target.value)} />
        </label>
        <label>
          Bean
          <input value={filters.bean} onChange={(event) => updateFilter("bean", event.target.value)} />
        </label>
        <label>
          Country
          <input value={filters.country} onChange={(event) => updateFilter("country", event.target.value)} />
        </label>
        <label>
          Region
          <input value={filters.region} onChange={(event) => updateFilter("region", event.target.value)} />
        </label>
        <label>
          Process
          <input value={filters.process} onChange={(event) => updateFilter("process", event.target.value)} />
        </label>
        <label>
          Roast Date
          <input value={filters.roastDate} onChange={(event) => updateFilter("roastDate", event.target.value)} />
        </label>
        <label>
          Roast Type
          <input value={filters.roastLevel} onChange={(event) => updateFilter("roastLevel", event.target.value)} />
        </label>
      </div>
      <p className="history-result-count">
        Showing {filteredShots.length} of {shots.length} shots
      </p>
      {filteredShots.length === 0 && <p className="muted">No shots match these filters.</p>}
      {filteredShots.map((shot) => {
        const bag = shotBag(shot, bagById);
        return (
          <div className="list-row" key={shot.id}>
            <strong>{new Date(shot.timestamp).toLocaleString()}</strong>
            <span>{profileTitle(shot)}</span>
            <span>{bag ? `${bag.roaster} ${bag.bean}` : "No bag"}</span>
            <span>
              EY {shot.annotations?.drinkEy ?? "—"} · Grind {grindSizeFromShot(shot) ?? "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
