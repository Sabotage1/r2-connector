import type { ProfileRecord, ShotRecord, Workflow } from "../api/types";
import { MetricTile } from "../components/MetricTile";
import { ProfilePresetGrid } from "../components/ProfilePresetGrid";
import type { Bag } from "../lib/bags";
import { recommendProfiles } from "../lib/recommendations";
import type { SkinSettings } from "../state/skinSettings";

export function BrewPage({
  workflow,
  profiles,
  bags,
  shots,
  settings,
  onApplyProfile,
  onEditSlot
}: {
  workflow: Workflow;
  profiles: ProfileRecord[];
  bags: Bag[];
  shots: ShotRecord[];
  settings: SkinSettings;
  onApplyProfile: (profile: ProfileRecord) => void;
  onEditSlot: (index: number) => void;
}) {
  const selectedBag = bags.find((bag) => bag.id === workflow.context?.beanBatchId);
  const recommendations = recommendProfiles({
    profiles,
    shots,
    selectedBag,
    bags,
    preferredEy: [settings.preferredEyMin ?? 18, settings.preferredEyMax ?? 23]
  });

  return (
    <div className="workflow-grid">
      <section className="panel wide">
        <h2>Presets</h2>
        <ProfilePresetGrid slots={settings.presetSlots} profiles={profiles} onApply={onApplyProfile} onEditSlot={onEditSlot} />
      </section>
      <section className="panel">
        <h2>Current Bag</h2>
        <p>{selectedBag ? `${selectedBag.roaster} ${selectedBag.bean}` : "No bag selected"}</p>
      </section>
      <section className="panel">
        <h2>Recipe</h2>
        <MetricTile label="Dose" value={workflow.context?.targetDoseWeight ?? null} unit="g" />
        <MetricTile label="Yield" value={workflow.context?.targetYield ?? workflow.profile?.target_weight ?? null} unit="g" />
      </section>
      <section className="panel wide">
        <h2>Recommended Profiles</h2>
        {recommendations.slice(0, 4).map((item) => (
          <button key={item.profile.id} type="button" className="recommendation-row" onClick={() => onApplyProfile(item.profile)}>
            <strong>{item.profile.profile.title ?? item.profile.id}</strong>
            <span>{item.reasons.join(" · ")}</span>
          </button>
        ))}
      </section>
    </div>
  );
}
