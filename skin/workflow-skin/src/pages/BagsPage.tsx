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
          onCancel={() => setDraft(emptyBag)}
          onSave={() =>
            window.alert(
              isValidBag(draft) ? "Use ReaPrime bean/batch APIs to save this bag." : "Roaster, bean, roast date, and process are required."
            )
          }
        />
      </section>
    </div>
  );
}
