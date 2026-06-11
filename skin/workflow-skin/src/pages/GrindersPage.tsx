import { useState } from "react";
import type { Grinder } from "../api/types";

interface GrinderDraft {
  id?: string;
  model: string;
  burrs: string;
  settingType: "numeric" | "preset";
  notes: string;
}

const emptyGrinder: GrinderDraft = { model: "", burrs: "", settingType: "numeric", notes: "" };

function grinderDraftFrom(grinder: Grinder): GrinderDraft {
  return {
    id: grinder.id,
    model: grinder.model,
    burrs: grinder.burrs ?? "",
    settingType: grinder.settingType ?? "numeric",
    notes: grinder.notes ?? ""
  };
}

function grinderPayload(draft: GrinderDraft) {
  return {
    model: draft.model.trim(),
    burrs: draft.burrs.trim() || undefined,
    settingType: draft.settingType,
    notes: draft.notes.trim() || undefined
  };
}

export function GrindersPage({
  grinders,
  onCreateGrinder,
  onUpdateGrinder,
  onArchiveGrinder
}: {
  grinders: Grinder[];
  onCreateGrinder: (payload: ReturnType<typeof grinderPayload>) => Promise<void> | void;
  onUpdateGrinder: (id: string, payload: ReturnType<typeof grinderPayload>) => Promise<void> | void;
  onArchiveGrinder: (grinder: Grinder) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<GrinderDraft>(emptyGrinder);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const saveGrinder = async () => {
    if (!draft.model.trim()) {
      setStatus({ type: "error", message: "Grinder model is required." });
      return;
    }

    try {
      const payload = grinderPayload(draft);
      if (draft.id) {
        await onUpdateGrinder(draft.id, payload);
      } else {
        await onCreateGrinder(payload);
      }
      setDraft(emptyGrinder);
      setStatus({ type: "success", message: draft.id ? "Grinder updated" : "Grinder saved" });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : String(error) });
    }
  };

  const archiveGrinder = async (grinder: Grinder) => {
    try {
      await onArchiveGrinder(grinder);
      setStatus({ type: "success", message: "Grinder archived" });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <div className="workflow-grid">
      <section className="panel">
        <h2>Configured Grinders</h2>
        {grinders.length === 0 && <p className="muted">No grinders configured.</p>}
        {grinders.map((grinder) => (
          <div className="list-row" key={grinder.id}>
            <strong>{grinder.model}</strong>
            <span>{[grinder.burrs, grinder.settingType, grinder.notes].filter(Boolean).join(" · ")}</span>
            <div className="row-actions">
              <button type="button" className="ghost-button compact-button" onClick={() => setDraft(grinderDraftFrom(grinder))}>
                Edit {grinder.model}
              </button>
              <button type="button" className="ghost-button compact-button" onClick={() => void archiveGrinder(grinder)}>
                Archive
              </button>
            </div>
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>{draft.id ? "Edit Grinder" : "Add Grinder"}</h2>
        <form
          className="profile-edit-form"
          aria-label={draft.id ? "Edit grinder" : "Add grinder"}
          onSubmit={(event) => {
            event.preventDefault();
            void saveGrinder();
          }}
        >
          <label>
            <span>Grinder model</span>
            <input aria-label="Grinder model" value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} />
          </label>
          <label>
            <span>Burrs</span>
            <input aria-label="Burrs" value={draft.burrs} onChange={(event) => setDraft({ ...draft, burrs: event.target.value })} />
          </label>
          <label>
            <span>Setting type</span>
            <select
              aria-label="Setting type"
              value={draft.settingType}
              onChange={(event) => setDraft({ ...draft, settingType: event.target.value as GrinderDraft["settingType"] })}
            >
              <option value="numeric">Numeric</option>
              <option value="preset">Preset</option>
            </select>
          </label>
          <label>
            <span>Grinder notes</span>
            <input aria-label="Grinder notes" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
          </label>
          <div className="row-actions">
            <button type="submit" className="primary-button">
              Save grinder
            </button>
            <button type="button" className="ghost-button" onClick={() => setDraft(emptyGrinder)}>
              Add new grinder
            </button>
          </div>
        </form>
        {status && (
          <p className={status.type === "error" ? "status-message error" : "status-message"} role={status.type === "error" ? "alert" : "status"}>
            {status.message}
          </p>
        )}
      </section>
    </div>
  );
}
