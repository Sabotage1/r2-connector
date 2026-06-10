import type { ProfileRecord } from "../api/types";
import type { SkinSettings } from "../state/skinSettings";

export function ProfilesPage({
  profiles,
  settings,
  onToggleReview
}: {
  profiles: ProfileRecord[];
  settings: SkinSettings;
  onToggleReview: (profileId: string, enabled: boolean) => void;
}) {
  return (
    <div className="panel wide">
      <h2>Profiles</h2>
      {profiles.map((profile) => {
        const enabled = settings.reviewEnabledByProfile[profile.id] ?? settings.defaultReviewEnabled;
        return (
          <div className="list-row" key={profile.id}>
            <strong>{profile.profile.title ?? profile.id}</strong>
            <label className="inline-toggle">
              <input type="checkbox" checked={enabled} onChange={(event) => onToggleReview(profile.id, event.target.checked)} />
              Open review after brew
            </label>
          </div>
        );
      })}
    </div>
  );
}
