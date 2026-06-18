import { Download, RefreshCw, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Grinder, ProfileRecord, ShotRecord } from "../api/types";
import { matchesCommunitySearch } from "../community/search";
import type { CommunityRecommendation, CommunityShotEvidence, DownloadedCommunityProfile, UploadedCommunityProfile } from "../community/types";
import type { Bag } from "../lib/bags";
import { shotTasteRating, tasteScoreLabel } from "../lib/shotTaste";

type CommunityTab = "recommendations" | "recommend" | "downloaded" | "uploaded";
type BurrTypeFilter = "flat" | "conical";

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
  onRefresh: () => Promise<void> | void;
  onDownload: (recommendation: CommunityRecommendation) => Promise<void> | void;
  onUpload: (draft: UploadDraft) => Promise<void> | void;
  onEditUpload: (recommendation: CommunityRecommendation) => Promise<void> | void;
  initialDraft?: Partial<UploadDraft> | null;
  onInitialDraftApplied?: () => void;
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
  const date = formatDateOnly(shot.timestamp) ?? shot.id;
  const score = tasteScoreLabel(shotTasteRating(shot));
  return [date, profile, score].filter(Boolean).join(" - ");
}

function isBurrTypeFilter(value: unknown): value is BurrTypeFilter {
  return value === "flat" || value === "conical";
}

function burrTypeLabel(value: unknown): string | undefined {
  if (value === "flat") return "Flat burrs";
  if (value === "conical") return "Conical burrs";
  return undefined;
}

function formatDateOnly(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const isoDate = trimmed.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (isoDate) return isoDate;
  const date = new Date(trimmed);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : trimmed;
}

function scoreFromValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(10, Math.max(1, Math.round(value))) : null;
}

function shotScoreText(value: unknown): string | undefined {
  const score = scoreFromValue(value);
  return score === null ? undefined : `Shot score ${tasteScoreLabel(score)}`;
}

function recommendationShotScore(recommendation: CommunityRecommendation, evidence?: CommunityShotEvidence): string | undefined {
  return shotScoreText(evidence?.enjoyment ?? recommendation.shotScore);
}

function recommendationUploadSummary(recommendation: CommunityRecommendation): string | undefined {
  const date = formatDateOnly(recommendation.createdAt);
  return [date ? `Uploaded ${date}` : undefined, recommendationShotScore(recommendation)].filter(Boolean).join(" - ") || undefined;
}

function localUploadSummary(item: UploadedCommunityProfile): string | undefined {
  const date = formatDateOnly(item.uploadedAt);
  return [date ? `Uploaded ${date}` : undefined, recommendationShotScore(item.recommendation, item.evidence)].filter(Boolean).join(" - ") || undefined;
}

function recommendationBagSummary(recommendation: CommunityRecommendation): string {
  return [
    recommendation.bag.roaster,
    recommendation.bag.name,
    recommendation.bag.bean,
    recommendation.bag.country,
    recommendation.bag.process,
    formatDateOnly(recommendation.bag.roastDate) ?? recommendation.bag.roastDate
  ]
    .filter(Boolean)
    .join(" - ");
}

function recommendationBrewSummary(recommendation: CommunityRecommendation): string {
  return [
    recommendation.grinder.model,
    burrTypeLabel(recommendation.grinder.burrType),
    `Grind ${recommendation.brew.grindSetting}`,
    `${recommendation.brew.beansWeight}g in`,
    `${recommendation.brew.drinkWeight}g out`,
    `By ${recommendation.submittedBy}`
  ]
    .filter(Boolean)
    .join(" - ");
}

function grinderSearchText(recommendation: CommunityRecommendation): string {
  return [
    recommendation.grinder.id,
    recommendation.grinder.model,
    recommendation.grinder.burrType,
    burrTypeLabel(recommendation.grinder.burrType),
    recommendation.grinder.burrs,
    recommendation.grinder.settingType,
    recommendation.grinder.notes
  ]
    .map((value) => String(value ?? ""))
    .join(" ")
    .toLowerCase();
}

function matchesGrinderFilter(recommendation: CommunityRecommendation, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  return !normalizedQuery || grinderSearchText(recommendation).includes(normalizedQuery);
}

function hasText(value: string): boolean {
  return Boolean(value.trim());
}

function positiveFiniteNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isValidDraft(draft: UploadDraft, displayName: string): boolean {
  const beansWeight = positiveFiniteNumber(draft.beansWeight);
  const drinkWeight = positiveFiniteNumber(draft.drinkWeight);
  const secondsMin = positiveFiniteNumber(draft.secondsMin);
  const secondsMax = positiveFiniteNumber(draft.secondsMax);
  return Boolean(
    draft.bagId &&
      draft.profileId &&
      draft.grinderId &&
      hasText(displayName) &&
      hasText(draft.grindSetting) &&
      beansWeight &&
      drinkWeight &&
      secondsMin &&
      secondsMax &&
      secondsMax >= secondsMin &&
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
  onEditUpload,
  initialDraft,
  onInitialDraftApplied
}: CommunityPageProps) {
  const [activeTab, setActiveTab] = useState<CommunityTab>("recommendations");
  const [query, setQuery] = useState("");
  const [grinderQuery, setGrinderQuery] = useState("");
  const [draft, setDraft] = useState<UploadDraft>(emptyDraft);
  const [burrTypeFilters, setBurrTypeFilters] = useState<Record<BurrTypeFilter, boolean>>({ flat: false, conical: false });
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [pendingDownloadId, setPendingDownloadId] = useState<string | null>(null);
  const [pendingEditId, setPendingEditId] = useState<string | null>(null);
  const displayName = submittedByLocked ? submittedBy ?? "" : manualDisplayName;
  const activeBurrTypes = useMemo(
    () => (Object.entries(burrTypeFilters) as Array<[BurrTypeFilter, boolean]>).filter(([, active]) => active).map(([type]) => type),
    [burrTypeFilters]
  );
  const filteredRecommendations = useMemo(
    () =>
      recommendations.filter(
        (recommendation) =>
          matchesCommunitySearch(recommendation, query) &&
          matchesGrinderFilter(recommendation, grinderQuery) &&
          (activeBurrTypes.length === 0 || (isBurrTypeFilter(recommendation.grinder.burrType) && activeBurrTypes.includes(recommendation.grinder.burrType)))
      ),
    [activeBurrTypes, grinderQuery, recommendations, query]
  );

  useEffect(() => {
    if (!initialDraft) return;
    setDraft({ ...emptyDraft, ...initialDraft });
    setActiveTab("recommend");
    setStatus(null);
    onInitialDraftApplied?.();
  }, [initialDraft, onInitialDraftApplied]);

  const setDraftField = (field: keyof UploadDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setStatus(null);
  };

  const uploadDraft = async () => {
    if (!isValidDraft(draft, displayName)) {
      setStatus({
        type: "error",
        message: "Select a saved bag, profile, grinder, public display name, grind setting, weights, seconds, and notes."
      });
      return;
    }

    try {
      await onUpload(draft);
      setDraft(emptyDraft);
      setStatus({ type: "success", message: "Recommendation uploaded." });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : String(error) });
    }
  };

  const downloadRecommendation = async (recommendation: CommunityRecommendation) => {
    setPendingDownloadId(recommendation.id);
    setStatus(null);
    try {
      await onDownload(recommendation);
      setStatus({ type: "success", message: "Profile downloaded." });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setPendingDownloadId(null);
    }
  };

  const editUploadedRecommendation = async (recommendation: CommunityRecommendation) => {
    setPendingEditId(recommendation.id);
    setStatus(null);
    try {
      await onEditUpload(recommendation);
      setStatus({ type: "success", message: "Recommendation updated." });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setPendingEditId(null);
    }
  };

  return (
    <div className="community-page">
      <div className="page-title-row">
        <h1>Community</h1>
        <button type="button" className="ghost-button compact-button" onClick={() => void onRefresh()}>
          <RefreshCw aria-hidden="true" size={16} />
          Refresh
        </button>
      </div>

      <div className="settings-tabs community-tabs" role="tablist" aria-label="Community sections">
        {tabLabels.map((tab) => (
          <button
            key={tab.id}
            id={`community-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`community-panel-${tab.id}`}
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
        <section id="community-panel-recommendations" className="panel wide community-section" role="tabpanel" aria-labelledby="community-tab-recommendations">
          <div className="community-search-grid">
            <label className="settings-field">
              <span>Search recommendations</span>
              <input aria-label="Search recommendations" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <label className="settings-field">
              <span>Grinder</span>
              <input aria-label="Grinder recommendation filter" value={grinderQuery} onChange={(event) => setGrinderQuery(event.target.value)} />
            </label>
          </div>
          <div className="community-filter-row" role="group" aria-label="Burrs Type filters">
            <label className="inline-toggle">
              <input
                type="checkbox"
                checked={burrTypeFilters.flat}
                onChange={(event) => setBurrTypeFilters((current) => ({ ...current, flat: event.target.checked }))}
              />
              Flat burrs
            </label>
            <label className="inline-toggle">
              <input
                type="checkbox"
                checked={burrTypeFilters.conical}
                onChange={(event) => setBurrTypeFilters((current) => ({ ...current, conical: event.target.checked }))}
              />
              Conical burrs
            </label>
          </div>
          {error && (
            <p className="status-message error" role="alert">
              {error}
            </p>
          )}
          {status && (
            <p className={status.type === "error" ? "status-message error" : "status-message"} role={status.type === "error" ? "alert" : "status"}>
              {status.message}
            </p>
          )}
          {loading && <p className="muted">Loading community recommendations.</p>}
          {!loading && filteredRecommendations.length === 0 && <p className="muted">No recommendations found.</p>}
          {filteredRecommendations.map((recommendation) => {
            const title = recommendationTitle(recommendation);
            const downloadPending = pendingDownloadId === recommendation.id;
            return (
              <div className="list-row community-row" key={recommendation.id}>
                <strong>{title}</strong>
                {recommendationUploadSummary(recommendation) && <span>{recommendationUploadSummary(recommendation)}</span>}
                <span>{recommendationBagSummary(recommendation)}</span>
                <span>{recommendationBrewSummary(recommendation)}</span>
                <p>{recommendation.brew.notes}</p>
                <div className="row-actions">
                  <button
                    type="button"
                    className="primary-button compact-button"
                    aria-label={`Download ${title}`}
                    disabled={downloadPending}
                    onClick={() => void downloadRecommendation(recommendation)}
                  >
                    <Download aria-hidden="true" size={16} />
                    {downloadPending ? "Downloading" : "Download"}
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {activeTab === "recommend" && (
        <section id="community-panel-recommend" className="panel wide community-section" role="tabpanel" aria-labelledby="community-tab-recommend">
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
                    {[grinder.model, burrTypeLabel(grinder.burrType)].filter(Boolean).join(" - ")}
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
            <button type="button" className="primary-button" onClick={() => void uploadDraft()}>
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
        <section id="community-panel-downloaded" className="panel wide community-section" role="tabpanel" aria-labelledby="community-tab-downloaded">
          {downloaded.length === 0 && <p className="muted">No downloaded profiles yet.</p>}
          {downloaded.map((item) => (
            <div className="list-row community-row" key={`${item.recommendationId}-${item.localProfileId}`}>
              <strong>{item.localProfileTitle}</strong>
              <p>{item.recommendation.brew.notes}</p>
              {(item.evidence || recommendationShotScore(item.recommendation)) && (
                <div className="community-evidence-summary">
                  {recommendationShotScore(item.recommendation, item.evidence) && <span>{recommendationShotScore(item.recommendation, item.evidence)}</span>}
                  {typeof item.evidence?.tds === "number" && <span>TDS {item.evidence.tds}</span>}
                  {typeof item.evidence?.ey === "number" && <span>EY {item.evidence.ey}</span>}
                  {item.evidence?.notes && <span>{item.evidence.notes}</span>}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {activeTab === "uploaded" && (
        <section id="community-panel-uploaded" className="panel wide community-section" role="tabpanel" aria-labelledby="community-tab-uploaded">
          {status && (
            <p className={status.type === "error" ? "status-message error" : "status-message"} role={status.type === "error" ? "alert" : "status"}>
              {status.message}
            </p>
          )}
          {uploaded.length === 0 && <p className="muted">No uploaded profiles yet.</p>}
          {uploaded.map((item) => {
            const title = recommendationTitle(item.recommendation);
            const editPending = pendingEditId === item.recommendation.id;
            return (
              <div className="list-row community-row" key={item.recommendationId}>
                <strong>{title}</strong>
                {localUploadSummary(item) && <span>{localUploadSummary(item)}</span>}
                <span>{recommendationBagSummary(item.recommendation)}</span>
                <span>{recommendationBrewSummary(item.recommendation)}</span>
                <p>{item.recommendation.brew.notes}</p>
                {item.evidence && (
                  <div className="community-evidence-summary">
                    {typeof item.evidence.tds === "number" && <span>TDS {item.evidence.tds}</span>}
                    {typeof item.evidence.ey === "number" && <span>EY {item.evidence.ey}</span>}
                    {item.evidence.notes && <span>{item.evidence.notes}</span>}
                  </div>
                )}
                <div className="row-actions">
                  <button type="button" className="ghost-button compact-button" disabled={editPending} onClick={() => void editUploadedRecommendation(item.recommendation)}>
                    {editPending ? "Updating" : `Edit ${title}`}
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
