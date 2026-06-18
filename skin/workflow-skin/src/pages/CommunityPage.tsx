import { Download, RefreshCw, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import type { Grinder, ProfileRecord, ShotRecord } from "../api/types";
import { matchesCommunitySearch } from "../community/search";
import type { CommunityRecommendation, DownloadedCommunityProfile, UploadedCommunityProfile } from "../community/types";
import type { Bag } from "../lib/bags";

type CommunityTab = "recommendations" | "recommend" | "downloaded" | "uploaded";

export interface UploadDraft {
  bagId: string;
  profileId: string;
  grinderId: string;
  grindSetting: string;
  beansWeight: string;
  drinkWeight: string;
  secondsMin: string;
  secondsMax: string;
  notes: string;
  visualizerUrl: string;
  shotId: string;
}

interface CommunityPageProps {
  recommendations: CommunityRecommendation[];
  loading: boolean;
  error: string | null;
  bags: Bag[];
  profiles: ProfileRecord[];
  grinders: Grinder[];
  shots: ShotRecord[];
  downloaded: DownloadedCommunityProfile[];
  uploaded: UploadedCommunityProfile[];
  submittedBy: string | null;
  submittedByLocked: boolean;
  manualDisplayName: string;
  onManualDisplayNameChange: (value: string) => void;
  onRefresh: () => void;
  onDownload: (recommendation: CommunityRecommendation) => void;
  onUpload: (draft: UploadDraft) => void;
  onEditUpload: (recommendation: CommunityRecommendation) => void;
}

const emptyDraft: UploadDraft = {
  bagId: "",
  profileId: "",
  grinderId: "",
  grindSetting: "",
  beansWeight: "",
  drinkWeight: "",
  secondsMin: "",
  secondsMax: "",
  notes: "",
  visualizerUrl: "",
  shotId: ""
};

const tabLabels: Array<{ id: CommunityTab; label: string }> = [
  { id: "recommendations", label: "Recommendations" },
  { id: "recommend", label: "Recommend Profile" },
  { id: "downloaded", label: "Downloaded Profiles" },
  { id: "uploaded", label: "Uploaded Profiles" }
];

function recommendationTitle(recommendation: CommunityRecommendation): string {
  return recommendation.profile.originalTitle.trim() || recommendation.profile.installedTitle.trim() || recommendation.id;
}

function bagTitle(bag: Bag): string {
  return bag.name?.trim() || [bag.roaster, bag.bean].filter(Boolean).join(" ") || bag.id;
}

function profileTitle(profile: ProfileRecord): string {
  return profile.profile.title?.trim() || profile.id;
}

function shotTitle(shot: ShotRecord): string {
  const profile = shot.workflow.profile?.title ?? shot.workflow.name;
  const date = shot.timestamp ? new Date(shot.timestamp).toLocaleString() : shot.id;
  return [date, profile].filter(Boolean).join(" - ");
}

function hasText(value: string): boolean {
  return Boolean(value.trim());
}

function isValidDraft(draft: UploadDraft, displayName: string): boolean {
  return Boolean(
    draft.bagId &&
      draft.profileId &&
      draft.grinderId &&
      hasText(displayName) &&
      hasText(draft.grindSetting) &&
      hasText(draft.beansWeight) &&
      hasText(draft.drinkWeight) &&
      hasText(draft.secondsMin) &&
      hasText(draft.secondsMax) &&
      hasText(draft.notes)
  );
}

export function CommunityPage({
  recommendations,
  loading,
  error,
  bags,
  profiles,
  grinders,
  shots,
  downloaded,
  uploaded,
  submittedBy,
  submittedByLocked,
  manualDisplayName,
  onManualDisplayNameChange,
  onRefresh,
  onDownload,
  onUpload,
  onEditUpload
}: CommunityPageProps) {
  const [activeTab, setActiveTab] = useState<CommunityTab>("recommendations");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<UploadDraft>(emptyDraft);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const displayName = submittedByLocked ? submittedBy ?? "" : manualDisplayName;
  const filteredRecommendations = useMemo(
    () => recommendations.filter((recommendation) => matchesCommunitySearch(recommendation, query)),
    [recommendations, query]
  );

  const setDraftField = (field: keyof UploadDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setStatus(null);
  };

  const uploadDraft = () => {
    if (!isValidDraft(draft, displayName)) {
      setStatus({
        type: "error",
        message: "Select a saved bag, profile, grinder, public display name, grind setting, weights, seconds, and notes."
      });
      return;
    }

    onUpload(draft);
    setDraft(emptyDraft);
    setStatus({ type: "success", message: "Recommendation uploaded." });
  };

  return (
    <div className="community-page">
      <div className="page-title-row">
        <h1>Community</h1>
        <button type="button" className="ghost-button compact-button" onClick={onRefresh}>
          <RefreshCw aria-hidden="true" size={16} />
          Refresh
        </button>
      </div>

      <div className="settings-tabs" role="tablist" aria-label="Community sections">
        {tabLabels.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? "settings-tab active" : "settings-tab"}
            onClick={() => {
              setActiveTab(tab.id);
              setStatus(null);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "recommendations" && (
        <section className="panel wide community-section">
          <label className="settings-field">
            <span>Search recommendations</span>
            <input aria-label="Search recommendations" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          {error && (
            <p className="status-message error" role="alert">
              {error}
            </p>
          )}
          {loading && <p className="muted">Loading community recommendations.</p>}
          {!loading && filteredRecommendations.length === 0 && <p className="muted">No recommendations found.</p>}
          {filteredRecommendations.map((recommendation) => {
            const title = recommendationTitle(recommendation);
            return (
              <div className="list-row community-row" key={recommendation.id}>
                <strong>{title}</strong>
                <span>
                  {[recommendation.bag.roaster, recommendation.bag.name, recommendation.bag.bean, recommendation.bag.country, recommendation.bag.process, recommendation.bag.roastDate]
                    .filter(Boolean)
                    .join(" - ")}
                </span>
                <span>
                  {[recommendation.grinder.model, `Grind ${recommendation.brew.grindSetting}`, `${recommendation.brew.beansWeight}g in`, `${recommendation.brew.drinkWeight}g out`, `By ${recommendation.submittedBy}`]
                    .filter(Boolean)
                    .join(" - ")}
                </span>
                <p>{recommendation.brew.notes}</p>
                <div className="row-actions">
                  <button type="button" className="primary-button compact-button" aria-label={`Download ${title}`} onClick={() => onDownload(recommendation)}>
                    <Download aria-hidden="true" size={16} />
                    Download
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {activeTab === "recommend" && (
        <section className="panel wide community-section">
          <p className="mandatory-help">Shot history is optional, but highly recommended so people can understand the profile from a real graph and shot details.</p>
          <div className="form-grid">
            {submittedByLocked ? (
              <p className="muted">Uploading as Decent account {submittedBy ?? "connected user"}.</p>
            ) : (
              <label className="settings-field">
                <span>Public display name</span>
                <input aria-label="Public display name" value={manualDisplayName} onChange={(event) => onManualDisplayNameChange(event.target.value)} />
              </label>
            )}
            <label className="settings-field">
              <span>Saved bag</span>
              <select aria-label="Saved bag" value={draft.bagId} onChange={(event) => setDraftField("bagId", event.target.value)}>
                <option value="">Select saved bag</option>
                {bags.map((bag) => (
                  <option key={bag.id} value={bag.id}>
                    {bagTitle(bag)}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-field">
              <span>Profile</span>
              <select aria-label="Profile" value={draft.profileId} onChange={(event) => setDraftField("profileId", event.target.value)}>
                <option value="">Select profile</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profileTitle(profile)}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-field">
              <span>Grinder</span>
              <select aria-label="Grinder" value={draft.grinderId} onChange={(event) => setDraftField("grinderId", event.target.value)}>
                <option value="">Select grinder</option>
                {grinders.map((grinder) => (
                  <option key={grinder.id} value={grinder.id}>
                    {grinder.model}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-field">
              <span>Grind setting</span>
              <input aria-label="Grind setting" value={draft.grindSetting} onChange={(event) => setDraftField("grindSetting", event.target.value)} />
            </label>
            <label className="settings-field">
              <span>Beans weight</span>
              <input aria-label="Beans weight" inputMode="decimal" value={draft.beansWeight} onChange={(event) => setDraftField("beansWeight", event.target.value)} />
            </label>
            <label className="settings-field">
              <span>Drink weight</span>
              <input aria-label="Drink weight" inputMode="decimal" value={draft.drinkWeight} onChange={(event) => setDraftField("drinkWeight", event.target.value)} />
            </label>
            <label className="settings-field">
              <span>Seconds min</span>
              <input aria-label="Seconds min" inputMode="decimal" value={draft.secondsMin} onChange={(event) => setDraftField("secondsMin", event.target.value)} />
            </label>
            <label className="settings-field">
              <span>Seconds max</span>
              <input aria-label="Seconds max" inputMode="decimal" value={draft.secondsMax} onChange={(event) => setDraftField("secondsMax", event.target.value)} />
            </label>
            <label className="settings-field">
              <span>Visualizer link</span>
              <input aria-label="Visualizer link" value={draft.visualizerUrl} onChange={(event) => setDraftField("visualizerUrl", event.target.value)} />
            </label>
            <label className="settings-field">
              <span>Shot evidence</span>
              <select aria-label="Shot evidence" value={draft.shotId} onChange={(event) => setDraftField("shotId", event.target.value)}>
                <option value="">No shot selected</option>
                {shots.map((shot) => (
                  <option key={shot.id} value={shot.id}>
                    {shotTitle(shot)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="settings-field notes-field">
            <span>Notes</span>
            <textarea aria-label="Notes" value={draft.notes} onChange={(event) => setDraftField("notes", event.target.value)} />
          </label>
          <div className="row-actions">
            <button type="button" className="primary-button" onClick={uploadDraft}>
              <Upload aria-hidden="true" size={16} />
              Upload recommendation
            </button>
          </div>
          {status && (
            <p className={status.type === "error" ? "status-message error" : "status-message"} role={status.type === "error" ? "alert" : "status"}>
              {status.message}
            </p>
          )}
        </section>
      )}

      {activeTab === "downloaded" && (
        <section className="panel wide community-section">
          {downloaded.length === 0 && <p className="muted">No downloaded profiles yet.</p>}
          {downloaded.map((item) => (
            <div className="list-row community-row" key={`${item.recommendationId}-${item.localProfileId}`}>
              <strong>{item.localProfileTitle}</strong>
              <p>{item.recommendation.brew.notes}</p>
            </div>
          ))}
        </section>
      )}

      {activeTab === "uploaded" && (
        <section className="panel wide community-section">
          {uploaded.length === 0 && <p className="muted">No uploaded profiles yet.</p>}
          {uploaded.map((item) => {
            const title = recommendationTitle(item.recommendation);
            return (
              <div className="list-row community-row" key={item.recommendationId}>
                <strong>{title}</strong>
                <p>{item.recommendation.brew.notes}</p>
                <div className="row-actions">
                  <button type="button" className="ghost-button compact-button" onClick={() => onEditUpload(item.recommendation)}>
                    Edit {title}
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
