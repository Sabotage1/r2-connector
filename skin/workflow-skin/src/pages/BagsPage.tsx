import { useMemo, useState } from "react";
import type { Grinder } from "../api/types";
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

interface GrinderDraft {
  id?: string;
  model: string;
  settingType: "numeric" | "preset";
  notes: string;
}

const emptyGrinder: GrinderDraft = { model: "", settingType: "numeric", notes: "" };

function grinderDraftFrom(grinder: Grinder): GrinderDraft {
  return {
    id: grinder.id,
    model: grinder.model,
    settingType: grinder.settingType ?? "numeric",
    notes: grinder.notes ?? ""
  };
}

function grinderPayload(draft: GrinderDraft) {
  return {
    model: draft.model.trim(),
    settingType: draft.settingType,
    notes: draft.notes.trim() || undefined
  };
}

export function BagsPage({
  bags,
  grinders = [],
  onSaveBag,
  onUpdateBag,
  onArchiveBag,
  onCreateGrinder,
  onUpdateGrinder,
  onArchiveGrinder
}: {
  bags: Bag[];
  grinders?: Grinder[];
  onSaveBag: (bag: Bag) => Promise<void> | void;
  onUpdateBag?: (bag: Bag) => Promise<void> | void;
  onArchiveBag?: (bag: Bag) => Promise<void> | void;
  onCreateGrinder?: (payload: ReturnType<typeof grinderPayload>) => Promise<void> | void;
  onUpdateGrinder?: (id: string, payload: ReturnType<typeof grinderPayload>) => Promise<void> | void;
  onArchiveGrinder?: (grinder: Grinder) => Promise<void> | void;
}) {
  const [filters, setFilters] = useState<BagFilters>({});
  const [draft, setDraft] = useState<Bag>(emptyBag);
  const [editingBagId, setEditingBagId] = useState<string | null>(null);
  const [grinderDraft, setGrinderDraft] = useState<GrinderDraft>(emptyGrinder);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const visibleBags = useMemo(() => filterBags(bags, filters), [bags, filters]);
  const editingBag = editingBagId ? bags.find((bag) => bag.id === editingBagId) : undefined;

  const saveDraft = async () => {
    if (!isValidBag(draft)) {
      setStatus({ type: "error", message: "Roaster, bean, roast date, and process are required." });
      return;
    }

    try {
      if (editingBag && onUpdateBag) {
        await onUpdateBag(draft);
      } else {
        await onSaveBag(draft);
      }
      setDraft(emptyBag);
      setEditingBagId(null);
      setStatus({ type: "success", message: editingBag ? "Bag updated" : "Bag saved" });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : String(error) });
    }
  };

  const archiveBag = async (bag: Bag) => {
    if (!onArchiveBag) return;
    try {
      await onArchiveBag(bag);
      setStatus({ type: "success", message: "Bag archived" });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : String(error) });
    }
  };

  const saveGrinder = async () => {
    if (!grinderDraft.model.trim()) {
      setStatus({ type: "error", message: "Grinder model is required." });
      return;
    }

    try {
      const payload = grinderPayload(grinderDraft);
      if (grinderDraft.id && onUpdateGrinder) {
        await onUpdateGrinder(grinderDraft.id, payload);
      } else if (onCreateGrinder) {
        await onCreateGrinder(payload);
      }
      setGrinderDraft(emptyGrinder);
      setStatus({ type: "success", message: grinderDraft.id ? "Grinder updated" : "Grinder saved" });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : String(error) });
    }
  };

  const archiveGrinder = async (grinder: Grinder) => {
    if (!onArchiveGrinder) return;
    try {
      await onArchiveGrinder(grinder);
      setStatus({ type: "success", message: "Grinder archived" });
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
            <div className="row-actions">
              <button
                type="button"
                className="ghost-button compact-button"
                onClick={() => {
                  setDraft(bag);
                  setEditingBagId(bag.id);
                  setStatus(null);
                }}
              >
                Edit {bag.roaster} {bag.bean}
              </button>
              {onArchiveBag && (
                <button type="button" className="ghost-button compact-button" onClick={() => void archiveBag(bag)}>
                  Archive
                </button>
              )}
            </div>
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>Grinders</h2>
        {grinders.map((grinder) => (
          <div className="list-row" key={grinder.id}>
            <strong>{grinder.model}</strong>
            <span>{[grinder.settingType, grinder.notes].filter(Boolean).join(" · ")}</span>
            <div className="row-actions">
              <button type="button" className="ghost-button compact-button" onClick={() => setGrinderDraft(grinderDraftFrom(grinder))}>
                Edit {grinder.model}
              </button>
              {onArchiveGrinder && (
                <button type="button" className="ghost-button compact-button" onClick={() => void archiveGrinder(grinder)}>
                  Archive
                </button>
              )}
            </div>
          </div>
        ))}
        <form
          className="profile-edit-form"
          aria-label={grinderDraft.id ? "Edit grinder" : "Add grinder"}
          onSubmit={(event) => {
            event.preventDefault();
            void saveGrinder();
          }}
        >
          <label>
            <span>Grinder model</span>
            <input value={grinderDraft.model} onChange={(event) => setGrinderDraft({ ...grinderDraft, model: event.target.value })} />
          </label>
          <label>
            <span>Setting type</span>
            <select
              value={grinderDraft.settingType}
              onChange={(event) => setGrinderDraft({ ...grinderDraft, settingType: event.target.value as GrinderDraft["settingType"] })}
            >
              <option value="numeric">Numeric</option>
              <option value="preset">Preset</option>
            </select>
          </label>
          <label>
            <span>Grinder notes</span>
            <input value={grinderDraft.notes} onChange={(event) => setGrinderDraft({ ...grinderDraft, notes: event.target.value })} />
          </label>
          <div className="row-actions">
            <button type="submit" className="primary-button">
              Save grinder
            </button>
            <button type="button" className="ghost-button" onClick={() => setGrinderDraft(emptyGrinder)}>
              Add new grinder
            </button>
          </div>
        </form>
      </section>
      <section className="wide">
        <BagForm
          value={draft}
          onChange={setDraft}
          mode={editingBag ? "edit" : "create"}
          onCancel={() => {
            setDraft(emptyBag);
            setEditingBagId(null);
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
