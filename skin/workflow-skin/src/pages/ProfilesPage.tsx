import type { ProfileRecord } from "../api/types";
import { profileWorkflowFor, type ProfileWorkflowSettings, type SkinSettings, type SteamTimers } from "../state/skinSettings";

export function ProfilesPage({
  profiles,
  settings,
  onToggleReview,
  onSetStartupProfile,
  onUpdateProfileWorkflow
}: {
  profiles: ProfileRecord[];
  settings: SkinSettings;
  onToggleReview: (profileId: string, enabled: boolean) => void;
  onSetStartupProfile: (profileId?: string) => void;
  onUpdateProfileWorkflow: (profileId: string, workflow: ProfileWorkflowSettings) => void;
}) {
  return (
    <div className="panel wide">
      <h2>Profiles</h2>
      {profiles.map((profile) => {
        const enabled = settings.reviewEnabledByProfile[profile.id] ?? settings.defaultReviewEnabled;
        const profileTitle = profile.profile.title ?? profile.id;
        const workflow = profileWorkflowFor(settings, profile.id);
        const updateTimer = (jug: keyof SteamTimers, seconds: number) => {
          onUpdateProfileWorkflow(profile.id, {
            ...workflow,
            steamTimers: { ...workflow.steamTimers, [jug]: seconds }
          });
        };

        return (
          <div className="list-row profile-workflow-row" role="group" aria-label={`${profileTitle} profile workflow`} key={profile.id}>
            <strong>{profileTitle}</strong>
            <div className="profile-workflow-controls">
              <label className="inline-toggle">
                <input
                  type="radio"
                  name="startup-profile"
                  checked={settings.startupProfileId === profile.id}
                  onChange={() => onSetStartupProfile(profile.id)}
                />
                Use {profileTitle} at startup
              </label>
              <label className="inline-toggle">
                <input type="checkbox" checked={enabled} onChange={(event) => onToggleReview(profile.id, event.target.checked)} />
                Open review after brew
              </label>
              <label className="inline-toggle">
                <input
                  type="checkbox"
                  checked={workflow.milkBased}
                  onChange={(event) => onUpdateProfileWorkflow(profile.id, { ...workflow, milkBased: event.target.checked })}
                />
                Milk drink
              </label>
            </div>
            {workflow.milkBased && (
              <div className="timer-grid">
                <label>
                  Small jug seconds
                  <input
                    type="number"
                    min="1"
                    value={workflow.steamTimers.small}
                    onChange={(event) => updateTimer("small", Number(event.target.value))}
                  />
                </label>
                <label>
                  Medium jug seconds
                  <input
                    type="number"
                    min="1"
                    value={workflow.steamTimers.medium}
                    onChange={(event) => updateTimer("medium", Number(event.target.value))}
                  />
                </label>
                <label>
                  Large jug seconds
                  <input
                    type="number"
                    min="1"
                    value={workflow.steamTimers.large}
                    onChange={(event) => updateTimer("large", Number(event.target.value))}
                  />
                </label>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
