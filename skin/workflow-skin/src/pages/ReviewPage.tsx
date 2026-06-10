import { useMemo, useState } from "react";
import type { SensorListItem, ShotAnnotations, ShotRecord } from "../api/types";
import { ShotGraph } from "../components/ShotGraph";
import { calculateEy, cleanNumber } from "../lib/ey";
import { grindSizeFromShot, previousFiveForBag, shotContext, shotStats } from "../lib/shotStats";

function formatStat(value: number | null, unit: string): string {
  return value == null ? "—" : `${value}${unit}`;
}

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
  onSaveAnnotations: (shotId: string, annotations: ShotAnnotations) => Promise<void> | void;
  onUploadVisualizer: () => Promise<void> | void;
  r2Sensor: SensorListItem | null;
  onReadR2: () => Promise<number | null> | number | null;
}) {
  const stats = shotStats(shot);
  const context = shotContext(shot);
  const [tdsText, setTdsText] = useState(String(shot.annotations?.drinkTds ?? ""));
  const [doseText, setDoseText] = useState(String(shot.annotations?.actualDoseWeight ?? context?.targetDoseWeight ?? ""));
  const [yieldText, setYieldText] = useState(String(shot.annotations?.actualYield ?? stats.finalYield ?? ""));
  const [grindSize, setGrindSize] = useState(grindSizeFromShot(shot) ?? "");
  const [notes, setNotes] = useState(shot.annotations?.espressoNotes ?? "");

  const ey = useMemo(
    () =>
      calculateEy({
        doseGrams: cleanNumber(doseText),
        yieldGrams: cleanNumber(yieldText),
        tdsPercent: cleanNumber(tdsText)
      }),
    [doseText, yieldText, tdsText]
  );

  const sameBagShots = context?.beanBatchId ? previousFiveForBag(previousShots, context.beanBatchId, shot.id) : [];

  async function save() {
    const workflowSkin = (shot.annotations?.extras?.workflowSkin as Record<string, unknown> | undefined) ?? {};
    await onSaveAnnotations(
      shot.id,
      {
        ...shot.annotations,
        actualDoseWeight: cleanNumber(doseText) ?? undefined,
        actualYield: cleanNumber(yieldText) ?? undefined,
        drinkTds: cleanNumber(tdsText) ?? undefined,
        drinkEy: ey ?? undefined,
        espressoNotes: notes,
        extras: {
          ...shot.annotations?.extras,
          workflowSkin: {
            ...workflowSkin,
            grindSize
          }
        }
      }
    );
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
        <p>Duration: {formatStat(stats.durationSeconds, "s")}</p>
        <p>Peak pressure: {formatStat(stats.peakPressure, " bar")}</p>
        <p>Average flow: {formatStat(stats.averageFlow, " mL/s")}</p>
      </section>
      <section className="panel review-form">
        <h2>Extraction</h2>
        <label>
          Dose
          <input value={doseText} onChange={(event) => setDoseText(event.target.value)} inputMode="decimal" />
        </label>
        <label>
          Yield
          <input value={yieldText} onChange={(event) => setYieldText(event.target.value)} inputMode="decimal" />
        </label>
        <label>
          TDS
          <input aria-label="TDS" value={tdsText} onChange={(event) => setTdsText(event.target.value)} inputMode="decimal" />
        </label>
        <p>EY: {ey ?? "—"}%</p>
        {r2Sensor && (
          <button type="button" className="ghost-button" onClick={readR2}>
            Read from R2
          </button>
        )}
      </section>
      <section className="panel review-form">
        <h2>Dial In</h2>
        <label>
          Grind size
          <input value={grindSize} onChange={(event) => setGrindSize(event.target.value)} />
        </label>
        <p>Previous grind sizes: {sameBagShots.map(grindSizeFromShot).filter(Boolean).join(", ") || "—"}</p>
      </section>
      <section className="panel wide">
        <h2>Tasting Notes</h2>
        <textarea aria-label="Tasting Notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
        <div className="form-actions review-actions">
          <button type="button" className="ghost-button" onClick={onUploadVisualizer}>
            Upload to Visualizer
          </button>
          <button type="button" className="primary-button" onClick={save}>
            Save Review
          </button>
        </div>
      </section>
    </div>
  );
}
