import type { ProfileRecord, ShotRecord, ShotSnapshot, WeightSnapshot, Workflow } from "../api/types";
import { MetricTile } from "../components/MetricTile";
import { ShotGraph } from "../components/ShotGraph";
import { shotStats } from "../lib/shotStats";

function formatSeconds(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? String(Math.round(value)) : "—";
}

function formatLiveNumber(value: number | null | undefined): string | null {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : null;
}

function latestMeasurement(measurements: ShotSnapshot[]): ShotSnapshot | undefined {
  return measurements.length ? measurements[measurements.length - 1] : undefined;
}

function scaleTimerSeconds(scaleSnapshot: WeightSnapshot | null): number | null {
  return typeof scaleSnapshot?.timerValue === "number" && Number.isFinite(scaleSnapshot.timerValue)
    ? Math.round(scaleSnapshot.timerValue / 1000)
    : null;
}

function liveWeight(measurements: ShotSnapshot[], scaleSnapshot: WeightSnapshot | null): number | null {
  if (typeof scaleSnapshot?.weight === "number" && Number.isFinite(scaleSnapshot.weight)) return scaleSnapshot.weight;
  const weight = latestMeasurement(measurements)?.scale?.weight;
  return typeof weight === "number" && Number.isFinite(weight) ? weight : null;
}

function liveFlow(measurements: ShotSnapshot[], scaleSnapshot: WeightSnapshot | null): number | null {
  if (typeof scaleSnapshot?.weightFlow === "number" && Number.isFinite(scaleSnapshot.weightFlow)) return scaleSnapshot.weightFlow;
  const flow = latestMeasurement(measurements)?.machine?.flow;
  return typeof flow === "number" && Number.isFinite(flow) ? flow : null;
}

function profileName(activeProfile: ProfileRecord | undefined, workflow: Workflow): string {
  return activeProfile?.profile.title ?? workflow.profile?.title ?? "Selected profile";
}

export function LivePage({
  workflow,
  activeProfile,
  latestShot,
  liveMeasurements,
  scaleSnapshot
}: {
  workflow: Workflow;
  activeProfile?: ProfileRecord;
  latestShot: ShotRecord | null;
  liveMeasurements: ShotSnapshot[];
  scaleSnapshot: WeightSnapshot | null;
}) {
  const measurements = liveMeasurements.length ? liveMeasurements : latestShot?.measurements ?? [];
  const stats = latestShot ? shotStats({ ...latestShot, measurements }) : shotStats({ id: "live", timestamp: new Date().toISOString(), workflow, measurements });
  const latest = latestMeasurement(measurements);
  const weight = liveWeight(measurements, scaleSnapshot) ?? stats.finalYield;
  const time = scaleTimerSeconds(scaleSnapshot) ?? stats.durationSeconds;
  const pressure = latest?.machine?.pressure ?? stats.averagePressure;
  const flow = liveFlow(measurements, scaleSnapshot) ?? stats.averageFlow;
  const waitingForData = measurements.length === 0 && !scaleSnapshot;

  return (
    <div className="live-grid">
      <section className="panel wide live-hero">
        <div>
          <span className="eyebrow">{profileName(activeProfile, workflow)}</span>
          <h2>Live Brew</h2>
          {waitingForData && <p className="muted live-waiting">Waiting for live espresso data</p>}
        </div>
        <div className="live-primary-stats">
          <MetricTile label="Weight" value={formatLiveNumber(weight)} unit="g" />
          <MetricTile label="Brew Time" value={formatSeconds(time)} unit="s" />
        </div>
      </section>
      <section className="panel wide light-graph-panel">
        <ShotGraph measurements={measurements} />
      </section>
      <section className="panel">
        <h2>Live Details</h2>
        <MetricTile label="Pressure" value={formatLiveNumber(pressure)} unit="bar" />
        <MetricTile label="Flow" value={formatLiveNumber(flow)} unit="g/s" />
        <MetricTile label="Target Dose" value={workflow.context?.targetDoseWeight ?? null} unit="g" />
        <MetricTile label="Target Yield" value={workflow.context?.targetYield ?? workflow.profile?.target_weight ?? null} unit="g" />
      </section>
      <section className="panel">
        <h2>Machine</h2>
        <MetricTile label="State" value={latest?.machine?.state?.state ?? "Waiting"} />
        <MetricTile label="Substate" value={latest?.machine?.state?.substate ?? "—"} />
        <MetricTile label="Group Temp" value={formatLiveNumber(latest?.machine?.groupTemperature)} unit="°C" />
        <MetricTile label="Mix Temp" value={formatLiveNumber(latest?.machine?.mixTemperature)} unit="°C" />
      </section>
    </div>
  );
}
