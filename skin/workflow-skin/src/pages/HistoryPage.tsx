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
            <span>
              EY {shot.annotations?.drinkEy ?? "—"} · Grind {grindSizeFromShot(shot) ?? "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
