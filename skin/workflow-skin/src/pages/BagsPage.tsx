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

export function BagsPage({ bags, onSaveBag }: { bags: Bag[]; onSaveBag: (bag: Bag) => Promise<void> | void }) {
  const [filters, setFilters] = useState<BagFilters>({});
  const [draft, setDraft] = useState<Bag>(emptyBag);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const visibleBags = useMemo(() => filterBags(bags, filters), [bags, filters]);

  const saveDraft = async () => {
    if (!isValidBag(draft)) {
      setStatus({ type: "error", message: "Roaster, bean, roast date, and process are required." });
      return;
    }

    try {
      await onSaveBag(draft);
      setDraft(emptyBag);
      setStatus({ type: "success", message: "Bag saved" });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <div className="workflow-grid">
      <section className="panel wide">
        <h2>Bag Filters</h2>
        <div className="form-grid">
          <label>
            Roaster
            <input value={filters.roaster ?? ""} onChange={(event) => setFilters({ ...filters, roaster: event.target.value })} />
          </label>
          <label>
            Bean
            <input value={filters.bean ?? ""} onChange={(event) => setFilters({ ...filters, bean: event.target.value })} />
          </label>
          <label>
            Country
            <input value={filters.country ?? ""} onChange={(event) => setFilters({ ...filters, country: event.target.value })} />
          </label>
          <label>
            Process
            <input value={filters.process ?? ""} onChange={(event) => setFilters({ ...filters, process: event.target.value })} />
          </label>
          <label>
            Roast Level
            <input value={filters.roastLevel ?? ""} onChange={(event) => setFilters({ ...filters, roastLevel: event.target.value })} />
          </label>
        </div>
      </section>
      <section className="panel">
        <h2>History</h2>
        {visibleBags.map((bag) => (
          <div className="list-row" key={bag.id}>
            <strong>
              {bag.roaster} {bag.bean}
            </strong>
            <span>{[bag.country, bag.process, bag.roastLevel].filter(Boolean).join(" · ")}</span>
          </div>
        ))}
      </section>
      <section className="wide">
        <BagForm
          value={draft}
          onChange={setDraft}
          onCancel={() => {
            setDraft(emptyBag);
            setStatus(null);
          }}
          onSave={saveDraft}
        />
        {status && (
          <p className={status.type === "error" ? "status-message error" : "status-message"} role={status.type === "error" ? "alert" : "status"}>
            {status.message}
          </p>
        )}
      </section>
    </div>
  );
}
