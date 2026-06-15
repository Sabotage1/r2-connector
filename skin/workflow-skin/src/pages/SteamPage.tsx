import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SteamRecord } from "../api/types";
import type { SteamTimers } from "../state/skinSettings";

const jugLabels: Array<{ key: keyof SteamTimers; label: string }> = [
  { key: "small", label: "Small jug" },
  { key: "medium", label: "Medium jug" },
  { key: "large", label: "Large jug" }
];

function formatSeconds(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function steamRecordTitle(record: SteamRecord): string {
  const date = new Date(record.timestamp);
  if (Number.isNaN(date.getTime())) return record.id;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function steamNotes(record: SteamRecord): string {
  const notes = record.annotations?.notes ?? record.annotations?.steamNotes ?? record.annotations?.milkNotes;
  return typeof notes === "string" && notes.trim() ? notes : "No notes";
}

export function SteamPage({
  profileTitle,
  timers,
  onReview,
  onStartSteam,
  onStopSteam,
  steamActive = false,
  steamHistory = []
}: {
  profileTitle: string;
  timers: SteamTimers;
  onReview: () => void;
  onStartSteam?: () => Promise<void> | void;
  onStopSteam?: () => Promise<void> | void;
  steamActive?: boolean;
  steamHistory?: SteamRecord[];
}) {
  const [selectedJug, setSelectedJug] = useState<keyof SteamTimers>("medium");
  const [remaining, setRemaining] = useState(timers.medium);
  const [running, setRunning] = useState(false);
  const nativeSteamActiveRef = useRef(false);
  const onStopSteamRef = useRef(onStopSteam);
  const selectedSeconds = timers[selectedJug];

  useEffect(() => {
    onStopSteamRef.current = onStopSteam;
  }, [onStopSteam]);

  useEffect(() => {
    setRemaining(selectedSeconds);
    if (!steamActive) setRunning(false);
  }, [selectedSeconds, steamActive]);

  useEffect(() => {
    const wasActive = nativeSteamActiveRef.current;
    nativeSteamActiveRef.current = steamActive;
    if (steamActive && !wasActive) {
      setRemaining(selectedSeconds);
      setRunning(true);
      return;
    }
    if (!steamActive && wasActive) setRunning(false);
  }, [selectedSeconds, steamActive]);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          setRunning(false);
          void onStopSteamRef.current?.();
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [running]);

  const timerText = useMemo(() => formatSeconds(remaining), [remaining]);
  const toggleSteam = () => {
    if (running) {
      setRunning(false);
      void onStopSteam?.();
      return;
    }
    setRemaining((currentRemaining) => (currentRemaining <= 0 ? selectedSeconds : currentRemaining));
    setRunning(true);
    void onStartSteam?.();
  };

  return (
    <div className="workflow-grid">
      <section className="panel wide steam-panel">
        <div>
          <span className="eyebrow">Steam Workflow</span>
          <h2>{profileTitle}</h2>
        </div>
        <div className="steam-timer" aria-live="polite">
          {timerText}
        </div>
        <div className="jug-grid">
          {jugLabels.map((jug) => (
            <button
              key={jug.key}
              type="button"
              className={selectedJug === jug.key ? "jug-button active" : "jug-button"}
              onClick={() => setSelectedJug(jug.key)}
            >
              <span>{jug.label}</span>
              <strong>{timers[jug.key]}s</strong>
            </button>
          ))}
        </div>
        <div className="steam-actions">
          <button type="button" className="primary-button" onClick={toggleSteam}>
            {running ? <Pause size={18} /> : <Play size={18} />}
            {running ? "Pause" : "Start"}
          </button>
          <button type="button" className="ghost-button" onClick={() => setRemaining(selectedSeconds)}>
            <RotateCcw size={18} />
            Reset
          </button>
          <button type="button" className="ghost-button" onClick={onReview}>
            Shot Review
          </button>
        </div>
      </section>
      <section className="panel wide">
        <h2>Steam History</h2>
        {steamHistory.length === 0 ? (
          <p className="muted">No steam sessions recorded yet.</p>
        ) : (
          steamHistory.slice(0, 5).map((record) => {
            const sampleCount = record.measurements?.length ?? 0;
            return (
              <div className="list-row" key={record.id}>
                <strong>{steamRecordTitle(record)}</strong>
                <span>{steamNotes(record)}</span>
                <span>{sampleCount} samples</span>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
