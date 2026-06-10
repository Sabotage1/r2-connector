import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

export function SteamPage({
  profileTitle,
  timers,
  onReview
}: {
  profileTitle: string;
  timers: SteamTimers;
  onReview: () => void;
}) {
  const [selectedJug, setSelectedJug] = useState<keyof SteamTimers>("medium");
  const [remaining, setRemaining] = useState(timers.medium);
  const [running, setRunning] = useState(false);
  const selectedSeconds = timers[selectedJug];

  useEffect(() => {
    setRemaining(selectedSeconds);
    setRunning(false);
  }, [selectedSeconds]);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          setRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [running]);

  const timerText = useMemo(() => formatSeconds(remaining), [remaining]);

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
          <button type="button" className="primary-button" onClick={() => setRunning((current) => !current)}>
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
    </div>
  );
}
