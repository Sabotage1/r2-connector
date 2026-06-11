import { useState } from "react";
import type { Profile, ProfileRecord } from "../api/types";
import { isProfileShown, profileWorkflowFor, type ProfileWorkflowSettings, type SkinSettings, type SteamTimers } from "../state/skinSettings";

interface ProfileDraft {
  title: string;
  author: string;
  notes: string;
  beverageType: string;
  targetWeight: string;
}

function profileTitle(profile: ProfileRecord): string {
  return profile.profile.title?.trim() || profile.id;
}

function draftFromProfile(profile: Profile): ProfileDraft {
  return {
    title: profile.title ?? "",
    author: profile.author ?? "",
    notes: profile.notes ?? "",
    beverageType: profile.beverage_type ?? "",
    targetWeight: typeof profile.target_weight === "number" ? String(profile.target_weight) : ""
  };
}

function trimOptional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function draftToProfile(original: Profile, draft: ProfileDraft): Profile {
  const targetWeight = Number(draft.targetWeight);
  return {
    ...original,
    title: trimOptional(draft.title),
    author: trimOptional(draft.author),
    notes: trimOptional(draft.notes),
    beverage_type: trimOptional(draft.beverageType),
    target_weight: draft.targetWeight.trim() && Number.isFinite(targetWeight) ? targetWeight : undefined
  };
}

export function ProfilesPage({
  profiles,
  settings,
  onToggleReview,
  onSetStartupProfile,
  onSetProfileShown,
  onUpdateProfileWorkflow,
  onSaveProfile
}: {
  profiles: ProfileRecord[];
  settings: SkinSettings;
  onToggleReview: (profileId: string, enabled: boolean) => void;
  onSetStartupProfile: (profileId?: string) => void;
  onSetProfileShown: (profileId: string, shown: boolean) => void;
  onUpdateProfileWorkflow: (profileId: string, workflow: ProfileWorkflowSettings) => void;
  onSaveProfile: (profileId: string, profile: Profile) => Promise<void> | void;
}) {
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="panel wide">
      <h2>Profiles</h2>
      {profiles.map((profile) => {
        const enabled = settings.reviewEnabledByProfile[profile.id] ?? settings.defaultReviewEnabled;
        const title = profileTitle(profile);
        const workflow = profileWorkflowFor(settings, profile.id);
        const editing = editingProfileId === profile.id && draft;
        const updateTimer = (jug: keyof SteamTimers, seconds: number) => {
          onUpdateProfileWorkflow(profile.id, {
            ...workflow,
            steamTimers: { ...workflow.steamTimers, [jug]: seconds }
          });
        };

        return (
          <div className="list-row profile-workflow-row" role="group" aria-label={`${title} profile workflow`} key={profile.id}>
            <div className="profile-row-header">
              <strong>{title}</strong>
              <button
                type="button"
                className="ghost-button compact-button"
                aria-label={`Edit ${title}`}
                onClick={() => {
                  setError(null);
                  setEditingProfileId(profile.id);
                  setDraft(draftFromProfile(profile.profile));
                }}
              >
                Edit
              </button>
            </div>
            <div className="profile-workflow-controls">
              <label className="inline-toggle">
                <input
                  type="checkbox"
                  checked={isProfileShown(settings, profile.id)}
                  onChange={(event) => onSetProfileShown(profile.id, event.target.checked)}
                />
                Show in preset picker
              </label>
              <label className="inline-toggle">
                <input
                  type="radio"
                  name="startup-profile"
                  checked={settings.startupProfileId === profile.id}
                  onChange={() => onSetStartupProfile(profile.id)}
                />
                Use {title} at startup
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
            {editing && (
              <form
                className="profile-edit-form"
                aria-label={`Edit ${title} profile`}
                onSubmit={(event) => {
                  event.preventDefault();
                  setError(null);
                  setSavingProfileId(profile.id);
                  Promise.resolve(onSaveProfile(profile.id, draftToProfile(profile.profile, draft)))
                    .then(() => {
                      setEditingProfileId(null);
                      setDraft(null);
                    })
                    .catch((saveError) => {
                      setError(saveError instanceof Error ? saveError.message : String(saveError));
                    })
                    .finally(() => setSavingProfileId(null));
                }}
              >
                {error && (
                  <p className="status-message error" role="alert">
                    Could not save profile: {error}
                  </p>
                )}
                <div className="form-grid compact-form-grid">
                  <label>
                    <span>Profile title</span>
                    <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
                  </label>
                  <label>
                    <span>Author</span>
                    <input value={draft.author} onChange={(event) => setDraft({ ...draft, author: event.target.value })} />
                  </label>
                  <label>
                    <span>Beverage type</span>
                    <input value={draft.beverageType} onChange={(event) => setDraft({ ...draft, beverageType: event.target.value })} />
                  </label>
                  <label>
                    <span>Target weight</span>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={draft.targetWeight}
                      onChange={(event) => setDraft({ ...draft, targetWeight: event.target.value })}
                    />
                  </label>
                </div>
                <label className="notes-field">
                  <span>Notes</span>
                  <textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
                </label>
                <div className="form-actions">
                  <button type="button" className="ghost-button" onClick={() => setEditingProfileId(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-button" disabled={savingProfileId === profile.id}>
                    {savingProfileId === profile.id ? "Saving" : `Save ${title}`}
                  </button>
                </div>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}
