# Community Profile Recommendations Design

Date: 2026-06-18

## Goal

Add a Community page to the WorkFlow ReaPrime skin where users can browse, search, download, upload, and edit community profile recommendations for specific saved coffee bags. Recommendations are published immediately through a Cloudflare Worker into `Sabotage1/WorkFlow-Skin/Profiles`, while the skin installs downloaded profiles into the local ReaPrime profile library.

## Scope

This design covers:

- A new `Community` menu item in the skin.
- Worker-backed community browsing, search, upload, edit, and download.
- Public recommendation files hosted in GitHub under `Profiles/`.
- Local downloaded-profile references.
- Local uploaded-profile ownership and editing.
- Optional shot evidence from Visualizer links or local shot history.

This design does not cover:

- Full user accounts for the WorkFlow community.
- Manual moderation before publication.
- Cross-machine editing recovery for v1.
- Migrating the whole skin into the new GitHub repo in the same implementation step, except for creating the target structure needed by this feature.

## Repository Shape

Create or move toward this structure in `Sabotage1/WorkFlow-Skin`:

```text
skin/workflow-skin/
Profiles/
  index.json
  recommendations/<recommendationId>.json
  profiles/<recommendationId>.json
  evidence/<recommendationId>.json
worker/
```

`Profiles/index.json` is a generated public index for fast listing and search. Canonical recommendation records live in `Profiles/recommendations/`. Uploaded ReaPrime profile JSON files live in `Profiles/profiles/`. Optional shot evidence files live in `Profiles/evidence/`.

## Data Model

Each recommendation has:

- Stable `id`.
- Timestamps: `createdAt`, `updatedAt`.
- Public `submittedBy` display name.
- Private ownership verifier: an owner-key hash only, never the raw owner key.
- Bag fields copied from an existing saved bag: roaster, bag name, bean, country, region, process, roast date, roast level, notes, ReaPrime bean id, and ReaPrime batch id when available.
- Selected local profile metadata: original profile id, original title, uploaded profile path, and normalized installed title.
- Selected grinder metadata: grinder id, model, burrs, setting type, and notes when available.
- Mandatory recommendation fields: recommended grind setting, beans weight, drink weight, seconds goal or range, and notes.
- Optional Visualizer URL.
- Optional evidence file reference.

The uploaded profile file is stored separately from the recommendation metadata so downloaders can fetch and install the profile without parsing UI-only fields.

## Identity Rules

The skin first reads the Decent account status from `GET /api/v1/account/decent`.

- If the account exposes a non-email username or display name, the skin uses it as `submittedBy` and locks it.
- If the account exposes only an email address, the email is not displayed or published.
- If no public-safe Decent name is available, the upload form requires a manual public display name.
- The manual public display name is saved in ReaPrime skin storage for future uploads.
- Published JSON stores only the public display name, never email.

For editing, the skin generates a machine-local private owner key on first upload and stores it in ReaPrime skin storage. The Worker stores only a hash of that key. Uploaded recommendations are editable from the same machine/skin storage that created them. Cross-machine recovery can be added later with an export/import owner key flow or real login.

## Skin UI

Add `Community` to the main menu.

The Community page has four tabs:

1. `Recommendations`
   - Lists community recommendations from the Worker.
   - Includes a single search field that searches every bag field plus profile title, grinder, grind setting, weights, seconds, notes, recommender, Visualizer URL, and evidence summary.
   - Opens a recommendation detail view with metadata, profile details, optional shot evidence, and download/update action.

2. `Recommend Profile`
   - Requires selecting one existing saved bag from the skin's bag list.
   - Requires selecting one local profile from the app profile list.
   - Requires selecting one configured grinder.
   - Requires recommended grind setting, beans weight, drink weight, seconds goal or range, and notes.
   - Allows optional Visualizer link.
   - Allows optional shot selection from local history.
   - Shows copy that shot evidence is highly recommended because it helps other users understand the profile.

3. `Downloaded Profiles`
   - Shows profiles installed from community recommendations.
   - Shows the saved recommendation JSON/reference data.
   - Shows whether the local profile is current with the community recommendation.
   - Allows updating an existing downloaded profile when the community record changes.

4. `Uploaded Profiles`
   - Shows recommendations uploaded from this machine.
   - Allows editing and republishing records where the local owner key matches.
   - Keeps drafts intact if publishing fails.

## Download Flow

The skin fetches recommendation, profile, and optional evidence data through the Worker.

When installing:

1. The skin builds a recognizable local profile title using bag, recommender, and a short recommendation id.
2. The skin calls ReaPrime's `/api/v1/profiles` API to create or update the local profile.
3. The skin stores a local downloaded-reference record in ReaPrime skin storage.
4. If the same recommendation was already downloaded, download updates the existing local profile and reference instead of creating a duplicate.

If profile install fails, the skin does not mark the recommendation as downloaded. If install succeeds but saving the local reference fails, the skin shows a warning because the profile exists locally but may not appear in the Downloaded Profiles reference list.

## Upload And Edit Flow

Uploads publish immediately.

On create:

1. Validate that all mandatory fields are present.
2. Validate that the selected bag exists in local saved bags.
3. Validate that the selected profile exists and has a basic ReaPrime profile shape.
4. Resolve `submittedBy` from public-safe Decent account data or saved/manual public display name.
5. Generate an owner key if one does not exist locally.
6. Send recommendation metadata, profile JSON, owner key proof, and optional evidence to the Worker.
7. Save the returned uploaded-reference record locally.

On edit:

1. Load the uploaded record from local storage.
2. Send the updated fields plus owner key proof to the Worker.
3. Worker verifies ownership by comparing owner-key hash.
4. Worker updates GitHub files and rebuilds the index.
5. Skin updates the local uploaded-reference record.

## Optional Shot Evidence

Shot evidence is optional.

Evidence can be:

- A Visualizer URL.
- A selected local shot from history.

When a local shot is selected, the skin uploads a sanitized evidence JSON containing graph measurements, timing, dose/yield, TDS/EY when present, enjoyment, tasting notes, grind setting, selected bag/grinder context, and profile context. The evidence file should omit private account data and unrelated app settings.

Downloaders can view the graph and shot details on the recommendation detail page without needing access to the uploader's machine or Visualizer account.

## Worker API

The Cloudflare Worker exposes:

```text
GET  /api/recommendations
GET  /api/recommendations/:id
POST /api/recommendations
PUT  /api/recommendations/:id
GET  /api/download/:id
```

The skin reads community data from the Worker, not directly from raw GitHub files.

The Worker:

- Validates mandatory fields.
- Rejects malformed profile JSON.
- Normalizes recommendation ids and filenames.
- Enforces payload-size limits.
- Applies basic rate limiting.
- Verifies owner-key hash on edit.
- Commits recommendation, profile, evidence, and index changes to GitHub using a GitHub token stored as a Worker secret.
- Returns indexed/searchable records to the skin.

The GitHub token is never included in the skin.

## Error Handling

- Community list failure shows an offline/error state without breaking the rest of the skin.
- Upload failure keeps the upload form draft.
- Edit failure keeps the edit draft.
- Download failure does not mark a recommendation as downloaded.
- Profile install success plus reference-save failure shows a warning.
- Worker unavailability disables browsing/upload/edit but leaves local profiles usable.

## Testing

Skin tests:

- Community menu item and tab navigation.
- Search includes every recommendation field.
- Upload form requires existing bag, profile, grinder, grind setting, beans weight, drink weight, seconds goal/range, and notes.
- Decent identity handling locks public-safe names, rejects email-only publication, and saves manual names locally.
- Download creates a renamed local profile.
- Duplicate downloads update the existing local profile/reference.
- Downloaded Profiles and Uploaded Profiles show the expected records.
- Optional shot evidence renders graph/details when present.
- Worker error states do not break the app.

Worker tests:

- Create recommendation writes recommendation/profile/evidence files and rebuilds index.
- Edit recommendation requires matching owner proof.
- Invalid mandatory fields are rejected.
- Email-only identity is rejected unless a public display name is supplied.
- Malformed profile payloads are rejected.
- Download endpoint returns profile plus recommendation metadata.

Verification:

- Run the skin unit/app test suite.
- Run Worker tests.
- Build/package the skin.
- Validate the Worker against a test GitHub branch or fixture repository before pointing it at production `Profiles/`.

## Open Future Enhancements

- Real login or GitHub OAuth for cross-machine editing.
- Export/import owner key recovery.
- Moderation or report flow.
- Community ratings or tasting feedback.
- Automatic profile update notifications for downloaded profiles.
