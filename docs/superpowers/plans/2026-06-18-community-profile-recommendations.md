# Community Profile Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Worker-backed Community page in the WorkFlow skin where users can immediately publish, edit, browse, search, and download bag-specific profile recommendations stored under `Sabotage1/WorkFlow-Skin/Profiles`.

**Architecture:** The Cloudflare Worker owns the public recommendation API and serializes validated JSON/profile/evidence files into GitHub through the Contents API. The skin consumes the Worker API, installs profiles through ReaPrime's local `/api/v1/profiles` API, and stores owner keys plus downloaded/uploaded references in ReaPrime skin storage. The clean `Sabotage1/WorkFlow-Skin` repo starts with `Profiles/` and `worker/`; the existing skin remains in this checkout until a separate migration.

**Tech Stack:** React 19, Vite, TypeScript, Vitest, Testing Library, ReaPrime REST API, Cloudflare Workers ES modules, Wrangler 4, `@cloudflare/vitest-pool-workers`, GitHub REST Contents API.

---

## Current Context

- Existing skin root: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin`
- Existing design spec: `/Users/royackerman/Documents/Decent skin/docs/superpowers/specs/2026-06-18-community-profiles-design.md`
- New clean repo root to create: `/Users/royackerman/Documents/WorkFlow-Skin`
- GitHub target: `Sabotage1/WorkFlow-Skin`
- Worker compatibility date: `2026-06-18`
- Cloudflare docs checked on 2026-06-18:
  - Workers TypeScript should use `wrangler types` generated runtime/binding types.
  - Workers tests should use `@cloudflare/vitest-pool-workers` with Vitest 4.1+.
  - Wrangler config should use JSONC and can use `nodejs_compat_v2`.
  - GitHub Contents create/update uses `PUT /repos/{owner}/{repo}/contents/{path}` with Base64 content and `sha` for updates.

## File Structure

### New Clean Repo: `/Users/royackerman/Documents/WorkFlow-Skin`

- `README.md` - describes the community registry and Worker.
- `.gitignore` - excludes dependencies, local Wrangler files, and local secret files.
- `Profiles/index.json` - generated public search/list index.
- `Profiles/recommendations/.gitkeep` - keeps recommendation directory.
- `Profiles/profiles/.gitkeep` - keeps uploaded profile directory.
- `Profiles/evidence/.gitkeep` - keeps optional evidence directory.
- `worker/package.json` - Worker scripts and dev dependencies.
- `worker/tsconfig.json` - Worker TypeScript config.
- `worker/vitest.config.ts` - Cloudflare Workers Vitest integration.
- `worker/wrangler.jsonc` - Worker config, vars, compatibility date, observability.
- `worker/src/types.ts` - recommendation, upload, download, and GitHub API types.
- `worker/src/json.ts` - JSON response and body parsing helpers.
- `worker/src/validation.ts` - request validation, identity validation, profile validation, index text building.
- `worker/src/owner.ts` - owner-key hashing and constant-time comparison.
- `worker/src/github.ts` - GitHub Contents API wrapper with serialized writes.
- `worker/src/indexer.ts` - index rebuild helpers.
- `worker/src/index.ts` - Worker routes.
- `worker/test/validation.test.ts` - validation and search text tests.
- `worker/test/owner.test.ts` - owner hash and comparison tests.
- `worker/test/worker.test.ts` - route contract tests using mocked GitHub fetches.
- `worker/test/tsconfig.json` - test type config for `cloudflare:test`.

Deployment endpoint for this plan:

```text
https://workflow-skin-community.sabotage1.workers.dev
```

### Existing Skin: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin`

- `src/api/types.ts` - add Decent account status type.
- `src/api/reaprime.ts` - add `getDecentAccount()`.
- `src/api/community.ts` - Worker client.
- `src/community/types.ts` - skin-side community types.
- `src/community/identity.ts` - Decent/manual public name resolution.
- `src/community/profileInstall.ts` - community profile rename and install/update payload helpers.
- `src/community/search.ts` - local search helper for downloaded/uploaded references.
- `src/community/evidence.ts` - shot evidence sanitizer.
- `src/state/communityStorage.ts` - owner key, display name, downloaded/uploaded reference persistence.
- `src/pages/CommunityPage.tsx` - Community page tabs and flows.
- `src/App.tsx` - menu wiring, data passing, download/upload handlers.
- `src/state/skinSettings.ts` - add Community menu item and Worker endpoint setting.
- `src/pages/SettingsPage.tsx` - add Community API endpoint setting.
- `src/test/community.test.ts` - community helper tests.
- `src/test/reaprime.test.ts` - Decent account API test.
- `src/test/pages.test.tsx` - CommunityPage unit tests.
- `src/test/app.test.tsx` - full app wiring and Worker error tests.

---

### Task 1: Create Clean WorkFlow-Skin Repo And Registry Scaffold

**Files:**
- Create: `/Users/royackerman/Documents/WorkFlow-Skin/README.md`
- Create: `/Users/royackerman/Documents/WorkFlow-Skin/.gitignore`
- Create: `/Users/royackerman/Documents/WorkFlow-Skin/Profiles/index.json`
- Create: `/Users/royackerman/Documents/WorkFlow-Skin/Profiles/recommendations/.gitkeep`
- Create: `/Users/royackerman/Documents/WorkFlow-Skin/Profiles/profiles/.gitkeep`
- Create: `/Users/royackerman/Documents/WorkFlow-Skin/Profiles/evidence/.gitkeep`

- [ ] **Step 1: Create the clean local repo directory**

Run:

```bash
mkdir -p "/Users/royackerman/Documents/WorkFlow-Skin"
cd "/Users/royackerman/Documents/WorkFlow-Skin"
git init -b main
mkdir -p Profiles/recommendations Profiles/profiles Profiles/evidence worker
```

Expected: `Initialized empty Git repository` and the `Profiles/` plus `worker/` directories exist.

- [ ] **Step 2: Write the registry seed files**

Create `/Users/royackerman/Documents/WorkFlow-Skin/README.md`:

```markdown
# WorkFlow Skin Community Profiles

This repository hosts the public WorkFlow community profile recommendation registry.

The `Profiles/` directory stores public recommendation metadata, uploaded ReaPrime profile JSON files, optional shot evidence, and a generated index.

The `worker/` directory contains the Cloudflare Worker that validates submissions, writes files to GitHub, rebuilds the index, and serves the skin-facing API.
```

Create `/Users/royackerman/Documents/WorkFlow-Skin/.gitignore`:

```gitignore
node_modules/
.wrangler/
.dev.vars
.dev.vars*
.env*
dist/
coverage/
*.log
.DS_Store
```

Create `/Users/royackerman/Documents/WorkFlow-Skin/Profiles/index.json`:

```json
{
  "version": 1,
  "updatedAt": "1970-01-01T00:00:00.000Z",
  "items": []
}
```

Create empty keep files:

```bash
touch Profiles/recommendations/.gitkeep Profiles/profiles/.gitkeep Profiles/evidence/.gitkeep
```

Expected: `git status --short` shows six new files.

- [ ] **Step 3: Commit the clean registry scaffold**

Run:

```bash
cd "/Users/royackerman/Documents/WorkFlow-Skin"
git add README.md .gitignore Profiles
git commit -m "Initialize WorkFlow community registry"
```

Expected: commit succeeds with the scaffold files.

- [ ] **Step 4: Create the GitHub repo if it does not exist**

Run:

```bash
gh repo view Sabotage1/WorkFlow-Skin --json nameWithOwner,url
```

Expected if the repo already exists: JSON with `Sabotage1/WorkFlow-Skin`.

If the command returns `Could not resolve to a Repository`, run:

```bash
cd "/Users/royackerman/Documents/WorkFlow-Skin"
gh repo create Sabotage1/WorkFlow-Skin --public --source . --remote origin --push
```

Expected: GitHub repo is created and `origin` points to `https://github.com/Sabotage1/WorkFlow-Skin.git`.

- [ ] **Step 5: Push the scaffold when repo already existed**

Skip this step if Step 4 created and pushed the repo.

Run:

```bash
cd "/Users/royackerman/Documents/WorkFlow-Skin"
git remote add origin https://github.com/Sabotage1/WorkFlow-Skin.git
git push -u origin main
```

Expected: branch `main` is pushed.

---

### Task 2: Scaffold Worker Tooling And Types

**Files:**
- Create: `/Users/royackerman/Documents/WorkFlow-Skin/worker/package.json`
- Create: `/Users/royackerman/Documents/WorkFlow-Skin/worker/tsconfig.json`
- Create: `/Users/royackerman/Documents/WorkFlow-Skin/worker/vitest.config.ts`
- Create: `/Users/royackerman/Documents/WorkFlow-Skin/worker/wrangler.jsonc`
- Create: `/Users/royackerman/Documents/WorkFlow-Skin/worker/test/tsconfig.json`

- [ ] **Step 1: Write Worker package and config files**

Create `/Users/royackerman/Documents/WorkFlow-Skin/worker/package.json`:

```json
{
  "name": "workflow-skin-community-worker",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "check": "wrangler check",
    "generate-types": "wrangler types src/worker-configuration.d.ts",
    "typecheck": "npm run generate-types && tsc --noEmit",
    "test": "npm run generate-types && vitest run"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "latest",
    "typescript": "^5.5.0",
    "vitest": "^4.1.0",
    "wrangler": "latest"
  }
}
```

Create `/Users/royackerman/Documents/WorkFlow-Skin/worker/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "WebWorker"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "types": ["./src/worker-configuration.d.ts"]
  },
  "include": ["src/**/*.ts", "vitest.config.ts"]
}
```

Create `/Users/royackerman/Documents/WorkFlow-Skin/worker/wrangler.jsonc`:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "workflow-skin-community",
  "main": "src/index.ts",
  "compatibility_date": "2026-06-18",
  "compatibility_flags": ["nodejs_compat_v2"],
  "observability": {
    "enabled": true,
    "head_sampling_rate": 1
  },
  "vars": {
    "GITHUB_OWNER": "Sabotage1",
    "GITHUB_REPO": "WorkFlow-Skin",
    "GITHUB_BRANCH": "main",
    "PUBLIC_BASE_URL": "https://github.com/Sabotage1/WorkFlow-Skin/tree/main/Profiles",
    "CORS_ALLOW_ORIGIN": "*",
    "MAX_BODY_BYTES": "750000"
  },
  "secrets": {
    "required": ["GITHUB_TOKEN"]
  }
}
```

Create `/Users/royackerman/Documents/WorkFlow-Skin/worker/vitest.config.ts`:

```ts
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" }
    })
  ],
  test: {
    include: ["test/**/*.test.ts"]
  }
});
```

Create `/Users/royackerman/Documents/WorkFlow-Skin/worker/test/tsconfig.json`:

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "moduleResolution": "bundler",
    "types": ["@cloudflare/vitest-pool-workers/types"]
  },
  "include": ["./**/*.ts", "../src/**/*.ts", "../src/worker-configuration.d.ts"]
}
```

- [ ] **Step 2: Install Worker dependencies**

Run:

```bash
cd "/Users/royackerman/Documents/WorkFlow-Skin/worker"
npm install
```

Expected: `package-lock.json` is created and install exits with code 0.

- [ ] **Step 3: Create local test secret file**

Run:

```bash
cd "/Users/royackerman/Documents/WorkFlow-Skin/worker"
printf "GITHUB_TOKEN=test-token\n" > .dev.vars
```

Expected: `.dev.vars` exists locally and is ignored by git.

- [ ] **Step 4: Generate Worker runtime types**

Run:

```bash
cd "/Users/royackerman/Documents/WorkFlow-Skin/worker"
npm run generate-types
```

Expected: `src/worker-configuration.d.ts` is created with generated `Env` types.

- [ ] **Step 5: Commit Worker scaffold**

Run:

```bash
cd "/Users/royackerman/Documents/WorkFlow-Skin"
git add worker/package.json worker/package-lock.json worker/tsconfig.json worker/vitest.config.ts worker/wrangler.jsonc worker/test/tsconfig.json worker/src/worker-configuration.d.ts
git commit -m "Add community Worker scaffold"
```

Expected: commit succeeds.

---

### Task 3: Implement Worker Validation And Owner Proof Helpers

**Files:**
- Create: `/Users/royackerman/Documents/WorkFlow-Skin/worker/src/types.ts`
- Create: `/Users/royackerman/Documents/WorkFlow-Skin/worker/src/validation.ts`
- Create: `/Users/royackerman/Documents/WorkFlow-Skin/worker/src/owner.ts`
- Create: `/Users/royackerman/Documents/WorkFlow-Skin/worker/test/validation.test.ts`
- Create: `/Users/royackerman/Documents/WorkFlow-Skin/worker/test/owner.test.ts`

- [ ] **Step 1: Write failing validation tests**

Create `/Users/royackerman/Documents/WorkFlow-Skin/worker/test/validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildIndexItem, validateRecommendationInput } from "../src/validation";
import type { RecommendationInput } from "../src/types";

const validInput: RecommendationInput = {
  submittedBy: "Roy",
  bag: {
    id: "batch-1",
    beanId: "bean-1",
    roaster: "Pilot",
    name: "Halo",
    bean: "Ethiopia Halo",
    country: "Ethiopia",
    region: "Yirgacheffe",
    process: "Washed",
    roastDate: "2026-06-01",
    roastLevel: "Light",
    notes: "floral"
  },
  profile: {
    originalId: "profile-1",
    originalTitle: "Blooming",
    fileName: "rec-1.json",
    installedTitle: "Blooming - Halo - Roy"
  },
  grinder: {
    id: "grinder-1",
    model: "ZP6",
    burrs: "MP",
    settingType: "numeric",
    notes: "zero at chirp"
  },
  brew: {
    grindSetting: "4.2",
    beansWeight: 18,
    drinkWeight: 42,
    secondsMin: 28,
    secondsMax: 34,
    notes: "Gentle declining pressure after bloom"
  },
  visualizerUrl: "https://visualizer.coffee/shots/abc",
  evidenceFileName: "rec-1.json"
};

describe("validateRecommendationInput", () => {
  it("accepts a complete recommendation", () => {
    expect(validateRecommendationInput(validInput)).toEqual({ ok: true, value: validInput });
  });

  it("rejects email-only submittedBy", () => {
    const result = validateRecommendationInput({ ...validInput, submittedBy: "person@example.com" });
    expect(result).toEqual({ ok: false, error: "Public display name is required; email addresses are not allowed." });
  });

  it("requires existing bag fields and brew fields", () => {
    const result = validateRecommendationInput({
      ...validInput,
      bag: { ...validInput.bag, country: "" },
      brew: { ...validInput.brew, notes: "" }
    });
    expect(result).toEqual({ ok: false, error: "Missing required fields: bag.country, brew.notes." });
  });
});

describe("buildIndexItem", () => {
  it("indexes every searchable field", () => {
    const item = buildIndexItem({
      id: "rec-1",
      createdAt: "2026-06-18T00:00:00.000Z",
      updatedAt: "2026-06-18T00:00:00.000Z",
      ownerHash: "hash",
      ...validInput
    });

    expect(item.searchText).toContain("pilot");
    expect(item.searchText).toContain("halo");
    expect(item.searchText).toContain("zp6");
    expect(item.searchText).toContain("4.2");
    expect(item.searchText).toContain("gentle declining pressure");
    expect(item.searchText).toContain("visualizer.coffee");
  });
});
```

- [ ] **Step 2: Write failing owner tests**

Create `/Users/royackerman/Documents/WorkFlow-Skin/worker/test/owner.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hashOwnerKey, ownerHashesMatch } from "../src/owner";

describe("owner proof helpers", () => {
  it("hashes owner keys deterministically", async () => {
    await expect(hashOwnerKey("owner-key")).resolves.toBe(await hashOwnerKey("owner-key"));
    await expect(hashOwnerKey("owner-key")).resolves.not.toBe(await hashOwnerKey("other-key"));
  });

  it("compares hashes without accepting different values", async () => {
    const hash = await hashOwnerKey("owner-key");
    await expect(ownerHashesMatch(hash, "owner-key")).resolves.toBe(true);
    await expect(ownerHashesMatch(hash, "wrong-key")).resolves.toBe(false);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
cd "/Users/royackerman/Documents/WorkFlow-Skin/worker"
npm test -- validation.test.ts owner.test.ts
```

Expected: FAIL because `../src/validation` and `../src/owner` do not exist.

- [ ] **Step 4: Implement Worker types**

Create `/Users/royackerman/Documents/WorkFlow-Skin/worker/src/types.ts`:

```ts
export interface BagSnapshot {
  id: string;
  beanId: string;
  roaster: string;
  name?: string;
  bean: string;
  country: string;
  region?: string;
  process: string;
  roastDate: string;
  roastLevel?: string;
  notes?: string;
}

export interface ProfileSnapshot {
  originalId: string;
  originalTitle: string;
  fileName: string;
  installedTitle: string;
}

export interface GrinderSnapshot {
  id: string;
  model: string;
  burrs?: string;
  settingType?: "numeric" | "preset";
  notes?: string;
}

export interface BrewRecommendation {
  grindSetting: string;
  beansWeight: number;
  drinkWeight: number;
  secondsGoal?: number;
  secondsMin?: number;
  secondsMax?: number;
  notes: string;
}

export interface ShotEvidence {
  id: string;
  timestamp?: string;
  profileTitle?: string;
  doseWeight?: number;
  drinkWeight?: number;
  tds?: number;
  ey?: number;
  enjoyment?: number;
  notes?: string;
  measurements?: unknown[];
}

export interface RecommendationInput {
  submittedBy: string;
  bag: BagSnapshot;
  profile: ProfileSnapshot;
  grinder: GrinderSnapshot;
  brew: BrewRecommendation;
  visualizerUrl?: string;
  evidenceFileName?: string;
}

export interface RecommendationRecord extends RecommendationInput {
  id: string;
  createdAt: string;
  updatedAt: string;
  ownerHash: string;
}

export interface RecommendationIndexItem {
  id: string;
  updatedAt: string;
  submittedBy: string;
  bag: BagSnapshot;
  profile: ProfileSnapshot;
  grinder: GrinderSnapshot;
  brew: BrewRecommendation;
  visualizerUrl?: string;
  evidenceFileName?: string;
  searchText: string;
}

export interface RecommendationIndex {
  version: 1;
  updatedAt: string;
  items: RecommendationIndexItem[];
}

export interface CreateRecommendationRequest {
  ownerKey: string;
  recommendation: RecommendationInput;
  profileJson: unknown;
  evidence?: ShotEvidence;
}

export interface UpdateRecommendationRequest {
  ownerKey: string;
  recommendation: RecommendationInput;
  profileJson: unknown;
  evidence?: ShotEvidence;
}

export interface DownloadPayload {
  recommendation: RecommendationRecord;
  profileJson: unknown;
  evidence?: ShotEvidence;
}

export interface ValidationOk<T> {
  ok: true;
  value: T;
}

export interface ValidationError {
  ok: false;
  error: string;
}

export type ValidationResult<T> = ValidationOk<T> | ValidationError;
```

- [ ] **Step 5: Implement validation helpers**

Create `/Users/royackerman/Documents/WorkFlow-Skin/worker/src/validation.ts`:

```ts
import type { RecommendationIndexItem, RecommendationInput, RecommendationRecord, ValidationResult } from "./types";

const requiredStringFields: Array<[string, (input: RecommendationInput) => unknown]> = [
  ["submittedBy", (input) => input.submittedBy],
  ["bag.id", (input) => input.bag.id],
  ["bag.beanId", (input) => input.bag.beanId],
  ["bag.roaster", (input) => input.bag.roaster],
  ["bag.bean", (input) => input.bag.bean],
  ["bag.country", (input) => input.bag.country],
  ["bag.process", (input) => input.bag.process],
  ["bag.roastDate", (input) => input.bag.roastDate],
  ["profile.originalId", (input) => input.profile.originalId],
  ["profile.originalTitle", (input) => input.profile.originalTitle],
  ["profile.fileName", (input) => input.profile.fileName],
  ["profile.installedTitle", (input) => input.profile.installedTitle],
  ["grinder.id", (input) => input.grinder.id],
  ["grinder.model", (input) => input.grinder.model],
  ["brew.grindSetting", (input) => input.brew.grindSetting],
  ["brew.notes", (input) => input.brew.notes]
];

const requiredNumberFields: Array<[string, (input: RecommendationInput) => unknown]> = [
  ["brew.beansWeight", (input) => input.brew.beansWeight],
  ["brew.drinkWeight", (input) => input.brew.drinkWeight]
];

export function isEmailLike(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function validNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function secondsValid(input: RecommendationInput): boolean {
  if (validNumber(input.brew.secondsGoal)) return true;
  return validNumber(input.brew.secondsMin) && validNumber(input.brew.secondsMax) && Number(input.brew.secondsMin) <= Number(input.brew.secondsMax);
}

export function validateRecommendationInput(input: RecommendationInput): ValidationResult<RecommendationInput> {
  const missing: string[] = [];

  for (const [name, getter] of requiredStringFields) {
    if (!cleanText(getter(input))) missing.push(name);
  }

  for (const [name, getter] of requiredNumberFields) {
    if (!validNumber(getter(input))) missing.push(name);
  }

  if (!secondsValid(input)) missing.push("brew.secondsGoalOrRange");

  if (missing.length > 0) {
    return { ok: false, error: `Missing required fields: ${missing.join(", ")}.` };
  }

  if (isEmailLike(input.submittedBy)) {
    return { ok: false, error: "Public display name is required; email addresses are not allowed." };
  }

  if (input.visualizerUrl && !/^https?:\/\/[^\s]+$/i.test(input.visualizerUrl)) {
    return { ok: false, error: "Visualizer URL must be a valid HTTP or HTTPS URL." };
  }

  return { ok: true, value: input };
}

export function validateProfileJson(profileJson: unknown): ValidationResult<unknown> {
  if (!profileJson || typeof profileJson !== "object" || Array.isArray(profileJson)) {
    return { ok: false, error: "Profile JSON must be an object." };
  }
  const profile = profileJson as { title?: unknown; steps?: unknown };
  if (profile.title !== undefined && typeof profile.title !== "string") {
    return { ok: false, error: "Profile title must be a string when present." };
  }
  if (profile.steps !== undefined && !Array.isArray(profile.steps)) {
    return { ok: false, error: "Profile steps must be an array when present." };
  }
  return { ok: true, value: profileJson };
}

export function buildSearchText(record: RecommendationInput): string {
  return [
    record.submittedBy,
    record.bag.id,
    record.bag.beanId,
    record.bag.roaster,
    record.bag.name,
    record.bag.bean,
    record.bag.country,
    record.bag.region,
    record.bag.process,
    record.bag.roastDate,
    record.bag.roastLevel,
    record.bag.notes,
    record.profile.originalTitle,
    record.profile.installedTitle,
    record.grinder.model,
    record.grinder.burrs,
    record.grinder.settingType,
    record.grinder.notes,
    record.brew.grindSetting,
    record.brew.beansWeight,
    record.brew.drinkWeight,
    record.brew.secondsGoal,
    record.brew.secondsMin,
    record.brew.secondsMax,
    record.brew.notes,
    record.visualizerUrl,
    record.evidenceFileName
  ]
    .filter((value) => value !== undefined && value !== null && String(value).trim())
    .join(" ")
    .toLowerCase();
}

export function buildIndexItem(record: RecommendationRecord): RecommendationIndexItem {
  return {
    id: record.id,
    updatedAt: record.updatedAt,
    submittedBy: record.submittedBy,
    bag: record.bag,
    profile: record.profile,
    grinder: record.grinder,
    brew: record.brew,
    visualizerUrl: record.visualizerUrl,
    evidenceFileName: record.evidenceFileName,
    searchText: buildSearchText(record)
  };
}
```

- [ ] **Step 6: Implement owner helpers**

Create `/Users/royackerman/Documents/WorkFlow-Skin/worker/src/owner.ts`:

```ts
function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashOwnerKey(ownerKey: string): Promise<string> {
  const bytes = new TextEncoder().encode(ownerKey);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(digest));
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return diff === 0;
}

export async function ownerHashesMatch(storedHash: string, ownerKey: string): Promise<boolean> {
  return constantTimeEqual(storedHash, await hashOwnerKey(ownerKey));
}
```

- [ ] **Step 7: Run Worker helper tests**

Run:

```bash
cd "/Users/royackerman/Documents/WorkFlow-Skin/worker"
npm test -- validation.test.ts owner.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Worker validation**

Run:

```bash
cd "/Users/royackerman/Documents/WorkFlow-Skin"
git add worker/src/types.ts worker/src/validation.ts worker/src/owner.ts worker/test/validation.test.ts worker/test/owner.test.ts
git commit -m "Add community recommendation validation"
```

Expected: commit succeeds.

---

### Task 4: Implement Worker GitHub Persistence And Routes

**Files:**
- Create: `/Users/royackerman/Documents/WorkFlow-Skin/worker/src/json.ts`
- Create: `/Users/royackerman/Documents/WorkFlow-Skin/worker/src/github.ts`
- Create: `/Users/royackerman/Documents/WorkFlow-Skin/worker/src/indexer.ts`
- Create: `/Users/royackerman/Documents/WorkFlow-Skin/worker/src/index.ts`
- Create: `/Users/royackerman/Documents/WorkFlow-Skin/worker/test/worker.test.ts`

- [ ] **Step 1: Write failing Worker route tests**

Create `/Users/royackerman/Documents/WorkFlow-Skin/worker/test/worker.test.ts`:

```ts
import { SELF } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";

const profileJson = { title: "Blooming", steps: [{ name: "Bloom", seconds: 10 }] };
const recommendation = {
  submittedBy: "Roy",
  bag: {
    id: "batch-1",
    beanId: "bean-1",
    roaster: "Pilot",
    name: "Halo",
    bean: "Ethiopia Halo",
    country: "Ethiopia",
    region: "Yirgacheffe",
    process: "Washed",
    roastDate: "2026-06-01",
    roastLevel: "Light",
    notes: "floral"
  },
  profile: {
    originalId: "profile-1",
    originalTitle: "Blooming",
    fileName: "pending.json",
    installedTitle: "Blooming - Halo - Roy"
  },
  grinder: {
    id: "grinder-1",
    model: "ZP6",
    settingType: "numeric"
  },
  brew: {
    grindSetting: "4.2",
    beansWeight: 18,
    drinkWeight: 42,
    secondsMin: 28,
    secondsMax: 34,
    notes: "Gentle declining pressure"
  }
};

function jsonResponse(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } }));
}

describe("community Worker", () => {
  it("serves an empty recommendation index", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/Profiles/index.json")) {
        return jsonResponse({ content: btoa(JSON.stringify({ version: 1, updatedAt: "1970-01-01T00:00:00.000Z", items: [] })) });
      }
      return jsonResponse({ message: "not found" }, 404);
    });

    const response = await SELF.fetch("https://worker.test/api/recommendations");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ version: 1, updatedAt: "1970-01-01T00:00:00.000Z", items: [] });
  });

  it("creates a recommendation and returns the created id", async () => {
    const writes: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      if (init?.method === "PUT") {
        writes.push(url);
        return jsonResponse({ content: { sha: "new-sha" } }, 201);
      }
      if (url.endsWith("/Profiles/index.json")) {
        return jsonResponse({ content: btoa(JSON.stringify({ version: 1, updatedAt: "1970-01-01T00:00:00.000Z", items: [] })) });
      }
      return jsonResponse({ message: "not found" }, 404);
    });

    const response = await SELF.fetch("https://worker.test/api/recommendations", {
      method: "POST",
      body: JSON.stringify({ ownerKey: "owner-key", recommendation, profileJson })
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as { recommendation: { id: string } };
    expect(body.recommendation.id).toMatch(/^rec-/);
    expect(writes.some((url) => url.includes("/Profiles/recommendations/"))).toBe(true);
    expect(writes.some((url) => url.includes("/Profiles/profiles/"))).toBe(true);
    expect(writes.some((url) => url.includes("/Profiles/index.json"))).toBe(true);
  });

  it("rejects edits without the owner key", async () => {
    const response = await SELF.fetch("https://worker.test/api/recommendations/rec-1", {
      method: "PUT",
      body: JSON.stringify({ ownerKey: "", recommendation, profileJson })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Owner key is required." });
  });
});
```

- [ ] **Step 2: Run route tests to verify they fail**

Run:

```bash
cd "/Users/royackerman/Documents/WorkFlow-Skin/worker"
npm test -- worker.test.ts
```

Expected: FAIL because route modules do not exist.

- [ ] **Step 3: Implement JSON helpers**

Create `/Users/royackerman/Documents/WorkFlow-Skin/worker/src/json.ts`:

```ts
export function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
      "access-control-allow-headers": "content-type",
      ...(init.headers ?? {})
    }
  });
}

export function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, { status });
}

export async function readJsonBody<T>(request: Request, maxBytes: number): Promise<T> {
  const text = await request.text();
  if (text.length > maxBytes) throw new Error("Request body is too large.");
  return JSON.parse(text) as T;
}
```

- [ ] **Step 4: Implement GitHub Contents API wrapper**

Create `/Users/royackerman/Documents/WorkFlow-Skin/worker/src/github.ts`:

```ts
interface GithubContentResponse {
  content?: string;
  sha?: string;
  encoding?: string;
}

interface GithubConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

function githubHeaders(token: string): HeadersInit {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-github-api-version": "2026-03-10",
    "user-agent": "workflow-skin-community-worker"
  };
}

function base64EncodeUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64DecodeUtf8(value: string): string {
  const binary = atob(value.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export class GithubContents {
  constructor(private readonly config: GithubConfig) {}

  private fileUrl(path: string): string {
    return `https://api.github.com/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(this.config.repo)}/contents/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
  }

  async readJson<T>(path: string, fallback: T): Promise<T> {
    const response = await fetch(`${this.fileUrl(path)}?ref=${encodeURIComponent(this.config.branch)}`, {
      headers: githubHeaders(this.config.token)
    });

    if (response.status === 404) return fallback;
    if (!response.ok) throw new Error(`GitHub read failed for ${path}: ${response.status} ${await response.text()}`);

    const payload = (await response.json()) as GithubContentResponse;
    if (!payload.content) return fallback;
    return JSON.parse(base64DecodeUtf8(payload.content)) as T;
  }

  private async existingSha(path: string): Promise<string | undefined> {
    const response = await fetch(`${this.fileUrl(path)}?ref=${encodeURIComponent(this.config.branch)}`, {
      headers: githubHeaders(this.config.token)
    });
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error(`GitHub sha read failed for ${path}: ${response.status} ${await response.text()}`);
    return ((await response.json()) as GithubContentResponse).sha;
  }

  async writeJson(path: string, value: unknown, message: string): Promise<void> {
    const sha = await this.existingSha(path);
    const body = {
      message,
      content: base64EncodeUtf8(`${JSON.stringify(value, null, 2)}\n`),
      branch: this.config.branch,
      ...(sha ? { sha } : {})
    };

    const response = await fetch(this.fileUrl(path), {
      method: "PUT",
      headers: githubHeaders(this.config.token),
      body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error(`GitHub write failed for ${path}: ${response.status} ${await response.text()}`);
  }
}

export function githubFromEnv(env: Env): GithubContents {
  return new GithubContents({
    owner: env.GITHUB_OWNER,
    repo: env.GITHUB_REPO,
    branch: env.GITHUB_BRANCH,
    token: env.GITHUB_TOKEN
  });
}
```

- [ ] **Step 5: Implement indexer helpers**

Create `/Users/royackerman/Documents/WorkFlow-Skin/worker/src/indexer.ts`:

```ts
import type { GithubContents } from "./github";
import type { RecommendationIndex, RecommendationRecord } from "./types";
import { buildIndexItem } from "./validation";

export const emptyIndex: RecommendationIndex = {
  version: 1,
  updatedAt: "1970-01-01T00:00:00.000Z",
  items: []
};

export async function loadIndex(github: GithubContents): Promise<RecommendationIndex> {
  return github.readJson<RecommendationIndex>("Profiles/index.json", emptyIndex);
}

export async function saveIndex(github: GithubContents, records: RecommendationRecord[], now: string): Promise<RecommendationIndex> {
  const index: RecommendationIndex = {
    version: 1,
    updatedAt: now,
    items: records.map(buildIndexItem).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  };
  await github.writeJson("Profiles/index.json", index, "Update community recommendation index");
  return index;
}
```

- [ ] **Step 6: Implement Worker routes**

Create `/Users/royackerman/Documents/WorkFlow-Skin/worker/src/index.ts`:

```ts
import { githubFromEnv } from "./github";
import { errorResponse, jsonResponse, readJsonBody } from "./json";
import { hashOwnerKey, ownerHashesMatch } from "./owner";
import { loadIndex, saveIndex } from "./indexer";
import type { CreateRecommendationRequest, DownloadPayload, RecommendationRecord, ShotEvidence, UpdateRecommendationRequest } from "./types";
import { validateProfileJson, validateRecommendationInput } from "./validation";

function nowIso(): string {
  return new Date().toISOString();
}

function recommendationPath(id: string): string {
  return `Profiles/recommendations/${id}.json`;
}

function profilePath(id: string): string {
  return `Profiles/profiles/${id}.json`;
}

function evidencePath(id: string): string {
  return `Profiles/evidence/${id}.json`;
}

function validId(id: string): boolean {
  return /^rec-[a-z0-9-]+$/.test(id);
}

function createId(): string {
  return `rec-${crypto.randomUUID()}`;
}

async function allRecords(github: ReturnType<typeof githubFromEnv>): Promise<RecommendationRecord[]> {
  const index = await loadIndex(github);
  const records: RecommendationRecord[] = [];
  for (const item of index.items) {
    records.push(await github.readJson<RecommendationRecord>(recommendationPath(item.id), undefined as never));
  }
  return records.filter(Boolean);
}

async function handleCreate(request: Request, env: Env): Promise<Response> {
  const body = await readJsonBody<CreateRecommendationRequest>(request, Number(env.MAX_BODY_BYTES));
  if (!body.ownerKey?.trim()) return errorResponse("Owner key is required.", 400);

  const recommendationValidation = validateRecommendationInput(body.recommendation);
  if (!recommendationValidation.ok) return errorResponse(recommendationValidation.error, 400);

  const profileValidation = validateProfileJson(body.profileJson);
  if (!profileValidation.ok) return errorResponse(profileValidation.error, 400);

  const github = githubFromEnv(env);
  const id = createId();
  const timestamp = nowIso();
  const record: RecommendationRecord = {
    id,
    createdAt: timestamp,
    updatedAt: timestamp,
    ownerHash: await hashOwnerKey(body.ownerKey),
    ...body.recommendation,
    profile: {
      ...body.recommendation.profile,
      fileName: `${id}.json`
    },
    evidenceFileName: body.evidence ? `${id}.json` : undefined
  };

  const records = await allRecords(github);
  await github.writeJson(recommendationPath(id), record, `Create community recommendation ${id}`);
  await github.writeJson(profilePath(id), body.profileJson, `Create community profile ${id}`);
  if (body.evidence) await github.writeJson(evidencePath(id), body.evidence, `Create community evidence ${id}`);
  const index = await saveIndex(github, [...records, record], timestamp);

  return jsonResponse({ recommendation: record, index }, { status: 201 });
}

async function handleUpdate(id: string, request: Request, env: Env): Promise<Response> {
  if (!validId(id)) return errorResponse("Invalid recommendation id.", 400);
  const body = await readJsonBody<UpdateRecommendationRequest>(request, Number(env.MAX_BODY_BYTES));
  if (!body.ownerKey?.trim()) return errorResponse("Owner key is required.", 400);

  const recommendationValidation = validateRecommendationInput(body.recommendation);
  if (!recommendationValidation.ok) return errorResponse(recommendationValidation.error, 400);

  const profileValidation = validateProfileJson(body.profileJson);
  if (!profileValidation.ok) return errorResponse(profileValidation.error, 400);

  const github = githubFromEnv(env);
  const existing = await github.readJson<RecommendationRecord | null>(recommendationPath(id), null);
  if (!existing) return errorResponse("Recommendation not found.", 404);
  if (!(await ownerHashesMatch(existing.ownerHash, body.ownerKey))) return errorResponse("Owner key does not match this recommendation.", 403);

  const timestamp = nowIso();
  const updated: RecommendationRecord = {
    ...existing,
    ...body.recommendation,
    id,
    createdAt: existing.createdAt,
    updatedAt: timestamp,
    ownerHash: existing.ownerHash,
    profile: {
      ...body.recommendation.profile,
      fileName: `${id}.json`
    },
    evidenceFileName: body.evidence ? `${id}.json` : undefined
  };

  const records = (await allRecords(github)).filter((record) => record.id !== id);
  await github.writeJson(recommendationPath(id), updated, `Update community recommendation ${id}`);
  await github.writeJson(profilePath(id), body.profileJson, `Update community profile ${id}`);
  if (body.evidence) await github.writeJson(evidencePath(id), body.evidence, `Update community evidence ${id}`);
  const index = await saveIndex(github, [...records, updated], timestamp);

  return jsonResponse({ recommendation: updated, index });
}

async function handleDownload(id: string, env: Env): Promise<Response> {
  if (!validId(id)) return errorResponse("Invalid recommendation id.", 400);
  const github = githubFromEnv(env);
  const recommendation = await github.readJson<RecommendationRecord | null>(recommendationPath(id), null);
  if (!recommendation) return errorResponse("Recommendation not found.", 404);
  const profileJson = await github.readJson<unknown | null>(profilePath(id), null);
  if (!profileJson) return errorResponse("Profile file not found.", 404);
  const evidence = recommendation.evidenceFileName ? await github.readJson<ShotEvidence | undefined>(evidencePath(id), undefined) : undefined;
  const payload: DownloadPayload = { recommendation, profileJson, evidence };
  return jsonResponse(payload);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      if (request.method === "OPTIONS") return jsonResponse({});
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/api/recommendations") return jsonResponse(await loadIndex(githubFromEnv(env)));
      if (request.method === "POST" && url.pathname === "/api/recommendations") return handleCreate(request, env);
      const match = url.pathname.match(/^\/api\/recommendations\/([^/]+)$/);
      if (request.method === "GET" && match) return jsonResponse(await githubFromEnv(env).readJson(recommendationPath(match[1]), null));
      if (request.method === "PUT" && match) return handleUpdate(match[1], request, env);
      const downloadMatch = url.pathname.match(/^\/api\/download\/([^/]+)$/);
      if (request.method === "GET" && downloadMatch) return handleDownload(downloadMatch[1], env);
      return errorResponse("Not found.", 404);
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : String(error), 500);
    }
  }
} satisfies ExportedHandler<Env>;
```

- [ ] **Step 7: Run Worker route tests**

Run:

```bash
cd "/Users/royackerman/Documents/WorkFlow-Skin/worker"
npm test -- worker.test.ts
```

Expected: PASS.

- [ ] **Step 8: Run full Worker checks**

Run:

```bash
cd "/Users/royackerman/Documents/WorkFlow-Skin/worker"
npm run typecheck
npm test
npm run check
```

Expected: all commands exit 0.

- [ ] **Step 9: Commit Worker routes**

Run:

```bash
cd "/Users/royackerman/Documents/WorkFlow-Skin"
git add worker/src worker/test
git commit -m "Implement community Worker API"
```

Expected: commit succeeds.

---

### Task 5: Add Skin Community Domain Helpers

**Files:**
- Create: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/community/types.ts`
- Create: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/community/identity.ts`
- Create: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/community/profileInstall.ts`
- Create: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/community/search.ts`
- Create: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/community/evidence.ts`
- Create: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/test/community.test.ts`

- [ ] **Step 1: Write failing skin helper tests**

Create `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/test/community.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ShotRecord } from "../api/types";
import { sanitizeShotEvidence } from "../community/evidence";
import { publicNameFromDecentAccount } from "../community/identity";
import { communityProfileTitle, profilePayloadForCommunityInstall } from "../community/profileInstall";
import { matchesCommunitySearch } from "../community/search";
import type { CommunityRecommendation } from "../community/types";

const recommendation: CommunityRecommendation = {
  id: "rec-12345678",
  createdAt: "2026-06-18T00:00:00.000Z",
  updatedAt: "2026-06-18T00:00:00.000Z",
  submittedBy: "Roy",
  bag: {
    id: "batch-1",
    beanId: "bean-1",
    roaster: "Pilot",
    name: "Halo",
    bean: "Ethiopia Halo",
    country: "Ethiopia",
    region: "Yirgacheffe",
    process: "Washed",
    roastDate: "2026-06-01",
    roastLevel: "Light",
    notes: "floral"
  },
  profile: {
    originalId: "profile-1",
    originalTitle: "Blooming",
    fileName: "rec-12345678.json",
    installedTitle: "Blooming - Halo - Roy"
  },
  grinder: {
    id: "grinder-1",
    model: "ZP6",
    settingType: "numeric"
  },
  brew: {
    grindSetting: "4.2",
    beansWeight: 18,
    drinkWeight: 42,
    secondsMin: 28,
    secondsMax: 34,
    notes: "Gentle declining pressure"
  },
  visualizerUrl: "https://visualizer.coffee/shots/abc",
  evidenceFileName: "rec-12345678.json"
};

describe("community identity", () => {
  it("uses public Decent usernames and rejects email-only identities", () => {
    expect(publicNameFromDecentAccount({ connected: true, username: "royack" })).toBe("royack");
    expect(publicNameFromDecentAccount({ connected: true, username: "roy@example.com" })).toBeNull();
    expect(publicNameFromDecentAccount({ connected: false })).toBeNull();
  });
});

describe("community profile install helpers", () => {
  it("builds recognizable duplicate-safe profile titles", () => {
    expect(communityProfileTitle(recommendation)).toBe("Blooming - Halo - Roy - rec-12345678");
  });

  it("creates an install payload with renamed profile title and metadata", () => {
    const payload = profilePayloadForCommunityInstall(recommendation, { title: "Blooming", steps: [] });
    expect(payload.profile.title).toBe("Blooming - Halo - Roy - rec-12345678");
    expect(payload.metadata).toMatchObject({ communityRecommendationId: "rec-12345678" });
  });
});

describe("community search", () => {
  it("matches every bag and recommendation field", () => {
    expect(matchesCommunitySearch(recommendation, "yirgacheffe")).toBe(true);
    expect(matchesCommunitySearch(recommendation, "zp6")).toBe(true);
    expect(matchesCommunitySearch(recommendation, "gentle declining")).toBe(true);
    expect(matchesCommunitySearch(recommendation, "not-here")).toBe(false);
  });
});

describe("shot evidence", () => {
  it("keeps shot graph and review data but omits unrelated private metadata", () => {
    const shot: ShotRecord = {
      id: "shot-1",
      timestamp: "2026-06-18T08:00:00.000Z",
      workflow: { profile: { title: "Blooming" }, context: { grinderId: "grinder-1", grinderSetting: "4.2" } },
      measurements: [{ machine: { pressure: 7 }, scale: { weight: 20 } }],
      annotations: { actualDoseWeight: 18, actualYield: 42, drinkTds: 8.5, drinkEy: 20, enjoyment: 8, espressoNotes: "sweet" },
      metadata: { accountEmail: "private@example.com" }
    };

    expect(sanitizeShotEvidence(shot)).toEqual({
      id: "shot-1",
      timestamp: "2026-06-18T08:00:00.000Z",
      profileTitle: "Blooming",
      doseWeight: 18,
      drinkWeight: 42,
      tds: 8.5,
      ey: 20,
      enjoyment: 8,
      notes: "sweet",
      grindSetting: "4.2",
      grinderId: "grinder-1",
      measurements: [{ machine: { pressure: 7 }, scale: { weight: 20 } }]
    });
  });
});
```

- [ ] **Step 2: Run helper tests to verify they fail**

Run:

```bash
cd "/Users/royackerman/Documents/Decent skin/skin/workflow-skin"
npm test -- src/test/community.test.ts
```

Expected: FAIL because the community helper modules do not exist.

- [ ] **Step 3: Implement skin community types**

Create `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/community/types.ts`:

```ts
import type { JsonMap, Profile } from "../api/types";

export interface DecentAccountStatus {
  connected?: boolean;
  username?: string;
  displayName?: string;
  name?: string;
  email?: string;
  account?: JsonMap;
}

export interface CommunityBagSnapshot {
  id: string;
  beanId: string;
  roaster: string;
  name?: string;
  bean: string;
  country: string;
  region?: string;
  process: string;
  roastDate: string;
  roastLevel?: string;
  notes?: string;
}

export interface CommunityProfileSnapshot {
  originalId: string;
  originalTitle: string;
  fileName: string;
  installedTitle: string;
}

export interface CommunityGrinderSnapshot {
  id: string;
  model: string;
  burrs?: string;
  settingType?: "numeric" | "preset";
  notes?: string;
}

export interface CommunityBrewRecommendation {
  grindSetting: string;
  beansWeight: number;
  drinkWeight: number;
  secondsGoal?: number;
  secondsMin?: number;
  secondsMax?: number;
  notes: string;
}

export interface CommunityShotEvidence {
  id: string;
  timestamp?: string;
  profileTitle?: string;
  doseWeight?: number;
  drinkWeight?: number;
  tds?: number;
  ey?: number;
  enjoyment?: number;
  notes?: string;
  grindSetting?: string;
  grinderId?: string;
  measurements?: unknown[];
}

export interface CommunityRecommendation {
  id: string;
  createdAt: string;
  updatedAt: string;
  submittedBy: string;
  bag: CommunityBagSnapshot;
  profile: CommunityProfileSnapshot;
  grinder: CommunityGrinderSnapshot;
  brew: CommunityBrewRecommendation;
  visualizerUrl?: string;
  evidenceFileName?: string;
  searchText?: string;
}

export interface CommunityIndex {
  version: 1;
  updatedAt: string;
  items: CommunityRecommendation[];
}

export interface CommunityDownloadPayload {
  recommendation: CommunityRecommendation;
  profileJson: Profile;
  evidence?: CommunityShotEvidence;
}

export interface DownloadedCommunityProfile {
  recommendationId: string;
  localProfileId: string;
  localProfileTitle: string;
  downloadedAt: string;
  updatedAt: string;
  recommendation: CommunityRecommendation;
  evidence?: CommunityShotEvidence;
}

export interface UploadedCommunityProfile {
  recommendationId: string;
  uploadedAt: string;
  updatedAt: string;
  recommendation: CommunityRecommendation;
}
```

- [ ] **Step 4: Implement identity, install, search, and evidence helpers**

Create `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/community/identity.ts`:

```ts
import type { DecentAccountStatus } from "./types";

export function isEmailLike(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());
}

export function publicNameFromDecentAccount(account: DecentAccountStatus | null | undefined): string | null {
  if (!account?.connected) return null;
  const candidates = [account.displayName, account.username, account.name].filter((value): value is string => typeof value === "string");
  for (const candidate of candidates) {
    const clean = candidate.trim();
    if (clean && !isEmailLike(clean)) return clean;
  }
  return null;
}
```

Create `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/community/profileInstall.ts`:

```ts
import type { CreateProfilePayload } from "../api/reaprime";
import type { Profile } from "../api/types";
import type { CommunityRecommendation } from "./types";

function cleanPart(value: string | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

export function shortRecommendationId(id: string): string {
  return id.split("-").slice(0, 2).join("-") || id.slice(0, 12);
}

export function communityProfileTitle(recommendation: CommunityRecommendation): string {
  const base = cleanPart(recommendation.profile.originalTitle) || "Community Profile";
  const bag = cleanPart(recommendation.bag.name) || cleanPart(recommendation.bag.bean) || "Bag";
  const recommender = cleanPart(recommendation.submittedBy) || "Community";
  return `${base} - ${bag} - ${recommender} - ${shortRecommendationId(recommendation.id)}`;
}

export function profilePayloadForCommunityInstall(recommendation: CommunityRecommendation, profileJson: Profile): CreateProfilePayload {
  const title = communityProfileTitle(recommendation);
  return {
    profile: {
      ...profileJson,
      title,
      author: recommendation.submittedBy,
      notes: [profileJson.notes, `Community recommendation ${recommendation.id}`].filter(Boolean).join("\n")
    },
    metadata: {
      communityRecommendationId: recommendation.id,
      communityRecommendationUpdatedAt: recommendation.updatedAt,
      communitySubmittedBy: recommendation.submittedBy
    }
  };
}
```

Create `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/community/search.ts`:

```ts
import type { CommunityRecommendation } from "./types";

export function communitySearchText(recommendation: CommunityRecommendation): string {
  return [
    recommendation.searchText,
    recommendation.id,
    recommendation.submittedBy,
    recommendation.bag.id,
    recommendation.bag.beanId,
    recommendation.bag.roaster,
    recommendation.bag.name,
    recommendation.bag.bean,
    recommendation.bag.country,
    recommendation.bag.region,
    recommendation.bag.process,
    recommendation.bag.roastDate,
    recommendation.bag.roastLevel,
    recommendation.bag.notes,
    recommendation.profile.originalTitle,
    recommendation.profile.installedTitle,
    recommendation.grinder.model,
    recommendation.grinder.burrs,
    recommendation.grinder.settingType,
    recommendation.grinder.notes,
    recommendation.brew.grindSetting,
    recommendation.brew.beansWeight,
    recommendation.brew.drinkWeight,
    recommendation.brew.secondsGoal,
    recommendation.brew.secondsMin,
    recommendation.brew.secondsMax,
    recommendation.brew.notes,
    recommendation.visualizerUrl,
    recommendation.evidenceFileName
  ]
    .filter((value) => value !== undefined && value !== null && String(value).trim())
    .join(" ")
    .toLowerCase();
}

export function matchesCommunitySearch(recommendation: CommunityRecommendation, query: string): boolean {
  const clean = query.trim().toLowerCase();
  return !clean || communitySearchText(recommendation).includes(clean);
}
```

Create `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/community/evidence.ts`:

```ts
import type { ShotRecord } from "../api/types";
import type { CommunityShotEvidence } from "./types";

export function sanitizeShotEvidence(shot: ShotRecord): CommunityShotEvidence {
  return {
    id: shot.id,
    timestamp: shot.timestamp,
    profileTitle: shot.workflow.profile?.title,
    doseWeight: shot.annotations?.actualDoseWeight,
    drinkWeight: shot.annotations?.actualYield,
    tds: shot.annotations?.drinkTds,
    ey: shot.annotations?.drinkEy,
    enjoyment: shot.annotations?.enjoyment,
    notes: shot.annotations?.espressoNotes ?? shot.shotNotes,
    grindSetting: shot.workflow.context?.grinderSetting,
    grinderId: shot.workflow.context?.grinderId,
    measurements: shot.measurements
  };
}
```

- [ ] **Step 5: Run skin helper tests**

Run:

```bash
cd "/Users/royackerman/Documents/Decent skin/skin/workflow-skin"
npm test -- src/test/community.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit skin helpers**

Run:

```bash
cd "/Users/royackerman/Documents/Decent skin"
git add skin/workflow-skin/src/community skin/workflow-skin/src/test/community.test.ts
git commit -m "Add community profile helpers"
```

Expected: commit succeeds without staging unrelated dirty files.

---

### Task 6: Add Skin API Clients And Community Storage

**Files:**
- Modify: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/api/types.ts`
- Modify: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/api/reaprime.ts`
- Create: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/api/community.ts`
- Create: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/state/communityStorage.ts`
- Modify: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/test/reaprime.test.ts`
- Create: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/test/communityApi.test.ts`
- Create: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/test/communityStorage.test.ts`

- [ ] **Step 1: Write failing API/storage tests**

Add to `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/test/reaprime.test.ts`:

```ts
  it("loads Decent account status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ connected: true, username: "royack" }), { status: 200 }));
    const api = new ReaPrimeApi("http://machine:8080");
    await expect(api.getDecentAccount()).resolves.toEqual({ connected: true, username: "royack" });
    expect(fetch).toHaveBeenCalledWith("http://machine:8080/api/v1/account/decent", expect.objectContaining({ method: "GET" }));
  });
```

Create `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/test/communityApi.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommunityApi } from "../api/community";

describe("CommunityApi", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists recommendations from the Worker", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ version: 1, updatedAt: "now", items: [] }), { status: 200 }));
    await expect(new CommunityApi("https://worker.example").listRecommendations()).resolves.toEqual({ version: 1, updatedAt: "now", items: [] });
    expect(fetch).toHaveBeenCalledWith("https://worker.example/api/recommendations", expect.objectContaining({ method: "GET" }));
  });

  it("throws readable errors from the Worker", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "bad upload" }), { status: 400 }));
    await expect(new CommunityApi("https://worker.example").listRecommendations()).rejects.toThrow("GET /api/recommendations failed: 400 bad upload");
  });
});
```

Create `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/test/communityStorage.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { getOrCreateCommunityOwnerKey, loadCommunityDisplayName, saveCommunityDisplayName } from "../state/communityStorage";

describe("community storage", () => {
  it("creates and reuses an owner key", async () => {
    const api = { getKv: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce("owner-key"), putKv: vi.fn().mockResolvedValue(undefined) };
    const first = await getOrCreateCommunityOwnerKey(api);
    const second = await getOrCreateCommunityOwnerKey(api);
    expect(first).toMatch(/^workflow-owner-/);
    expect(second).toBe("owner-key");
    expect(api.putKv).toHaveBeenCalledTimes(1);
  });

  it("saves a manual display name locally", async () => {
    const api = { getKv: vi.fn().mockResolvedValue("Roy"), putKv: vi.fn().mockResolvedValue(undefined) };
    await saveCommunityDisplayName(api, " Roy ");
    expect(api.putKv).toHaveBeenCalledWith("workflow-skin", "community-display-name", "Roy");
    await expect(loadCommunityDisplayName(api)).resolves.toBe("Roy");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd "/Users/royackerman/Documents/Decent skin/skin/workflow-skin"
npm test -- src/test/reaprime.test.ts src/test/communityApi.test.ts src/test/communityStorage.test.ts
```

Expected: FAIL because new APIs and storage helpers are missing.

- [ ] **Step 3: Add Decent account API**

Modify `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/api/types.ts` by exporting:

```ts
export interface DecentAccountStatus {
  connected?: boolean;
  username?: string;
  displayName?: string;
  name?: string;
  email?: string;
  account?: JsonMap;
}
```

Modify imports in `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/api/reaprime.ts` to include `DecentAccountStatus`, then add this method to `ReaPrimeApi` near `getAppInfo()`:

```ts
  getDecentAccount() {
    return this.request<DecentAccountStatus>("/api/v1/account/decent");
  }
```

- [ ] **Step 4: Implement CommunityApi**

Create `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/api/community.ts`:

```ts
import type { CommunityDownloadPayload, CommunityIndex, CommunityRecommendation, CommunityShotEvidence } from "../community/types";
import type { Profile } from "./types";

export interface CommunityWritePayload {
  ownerKey: string;
  recommendation: Omit<CommunityRecommendation, "id" | "createdAt" | "updatedAt" | "searchText">;
  profileJson: Profile;
  evidence?: CommunityShotEvidence;
}

export class CommunityApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "CommunityApiError";
  }
}

export class CommunityApi {
  constructor(private readonly baseUrl: string) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const method = init.method ?? "GET";
    const response = await fetch(`${this.baseUrl.replace(/\/+$/, "")}${path}`, {
      ...init,
      method,
      headers: {
        "content-type": "application/json",
        ...(init.headers ?? {})
      }
    });
    const text = await response.text();
    if (!response.ok) {
      let message = text;
      try {
        const payload = JSON.parse(text) as { error?: unknown };
        if (typeof payload.error === "string") message = payload.error;
      } catch {
        message = text;
      }
      throw new CommunityApiError(`${method} ${path} failed: ${response.status} ${message}`, response.status);
    }
    return text ? (JSON.parse(text) as T) : (undefined as T);
  }

  listRecommendations() {
    return this.request<CommunityIndex>("/api/recommendations");
  }

  getRecommendation(id: string) {
    return this.request<CommunityRecommendation>(`/api/recommendations/${encodeURIComponent(id)}`);
  }

  download(id: string) {
    return this.request<CommunityDownloadPayload>(`/api/download/${encodeURIComponent(id)}`);
  }

  create(payload: CommunityWritePayload) {
    return this.request<{ recommendation: CommunityRecommendation; index: CommunityIndex }>("/api/recommendations", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  update(id: string, payload: CommunityWritePayload) {
    return this.request<{ recommendation: CommunityRecommendation; index: CommunityIndex }>(`/api/recommendations/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  }
}
```

- [ ] **Step 5: Implement community storage**

Create `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/state/communityStorage.ts`:

```ts
import type { DownloadedCommunityProfile, UploadedCommunityProfile } from "../community/types";
import { SKIN_NAMESPACE, type KvApi } from "./skinSettings";

export const COMMUNITY_OWNER_KEY = "community-owner-key";
export const COMMUNITY_DISPLAY_NAME_KEY = "community-display-name";
export const COMMUNITY_DOWNLOADED_KEY = "community-downloaded-profiles";
export const COMMUNITY_UPLOADED_KEY = "community-uploaded-profiles";

function ownerKey(): string {
  return `workflow-owner-${crypto.randomUUID()}`;
}

export async function getOrCreateCommunityOwnerKey(api: KvApi): Promise<string> {
  const existing = await api.getKv<string>(SKIN_NAMESPACE, COMMUNITY_OWNER_KEY);
  if (existing?.trim()) return existing.trim();
  const next = ownerKey();
  await api.putKv(SKIN_NAMESPACE, COMMUNITY_OWNER_KEY, next);
  return next;
}

export async function loadCommunityDisplayName(api: KvApi): Promise<string | null> {
  const value = await api.getKv<string>(SKIN_NAMESPACE, COMMUNITY_DISPLAY_NAME_KEY);
  return value?.trim() || null;
}

export async function saveCommunityDisplayName(api: KvApi, value: string): Promise<void> {
  await api.putKv(SKIN_NAMESPACE, COMMUNITY_DISPLAY_NAME_KEY, value.trim());
}

export async function loadDownloadedCommunityProfiles(api: KvApi): Promise<DownloadedCommunityProfile[]> {
  return (await api.getKv<DownloadedCommunityProfile[]>(SKIN_NAMESPACE, COMMUNITY_DOWNLOADED_KEY)) ?? [];
}

export async function saveDownloadedCommunityProfiles(api: KvApi, value: DownloadedCommunityProfile[]): Promise<void> {
  await api.putKv(SKIN_NAMESPACE, COMMUNITY_DOWNLOADED_KEY, value);
}

export async function loadUploadedCommunityProfiles(api: KvApi): Promise<UploadedCommunityProfile[]> {
  return (await api.getKv<UploadedCommunityProfile[]>(SKIN_NAMESPACE, COMMUNITY_UPLOADED_KEY)) ?? [];
}

export async function saveUploadedCommunityProfiles(api: KvApi, value: UploadedCommunityProfile[]): Promise<void> {
  await api.putKv(SKIN_NAMESPACE, COMMUNITY_UPLOADED_KEY, value);
}
```

- [ ] **Step 6: Run API/storage tests**

Run:

```bash
cd "/Users/royackerman/Documents/Decent skin/skin/workflow-skin"
npm test -- src/test/reaprime.test.ts src/test/communityApi.test.ts src/test/communityStorage.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit APIs and storage**

Run:

```bash
cd "/Users/royackerman/Documents/Decent skin"
git add skin/workflow-skin/src/api/types.ts skin/workflow-skin/src/api/reaprime.ts skin/workflow-skin/src/api/community.ts skin/workflow-skin/src/state/communityStorage.ts skin/workflow-skin/src/test/reaprime.test.ts skin/workflow-skin/src/test/communityApi.test.ts skin/workflow-skin/src/test/communityStorage.test.ts
git commit -m "Add community API and storage clients"
```

Expected: commit succeeds without staging unrelated dirty files.

---

### Task 7: Build Community Page UI

**Files:**
- Create: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/pages/CommunityPage.tsx`
- Modify: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/styles.css`
- Modify: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/test/pages.test.tsx`

- [ ] **Step 1: Write failing CommunityPage tests**

Add to `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/test/pages.test.tsx`:

```tsx
describe("CommunityPage", () => {
  const recommendation = {
    id: "rec-12345678",
    createdAt: "2026-06-18T00:00:00.000Z",
    updatedAt: "2026-06-18T00:00:00.000Z",
    submittedBy: "Roy",
    bag: { id: "bag-1", beanId: "bean-1", roaster: "Pilot", name: "Halo", bean: "Ethiopia Halo", country: "Ethiopia", process: "Washed", roastDate: "2026-06-01" },
    profile: { originalId: "p1", originalTitle: "Blooming", fileName: "rec-12345678.json", installedTitle: "Blooming - Halo - Roy" },
    grinder: { id: "g1", model: "ZP6", settingType: "numeric" as const },
    brew: { grindSetting: "4.2", beansWeight: 18, drinkWeight: 42, secondsMin: 28, secondsMax: 34, notes: "Gentle declining pressure" }
  };

  it("shows searchable recommendations and download actions", async () => {
    const { CommunityPage } = await import("../pages/CommunityPage");
    render(
      <CommunityPage
        recommendations={[recommendation]}
        loading={false}
        error={null}
        bags={[]}
        profiles={[]}
        grinders={[]}
        shots={[]}
        downloaded={[]}
        uploaded={[]}
        submittedBy="Roy"
        submittedByLocked
        manualDisplayName=""
        onManualDisplayNameChange={vi.fn()}
        onRefresh={vi.fn()}
        onDownload={vi.fn()}
        onUpload={vi.fn()}
        onEditUpload={vi.fn()}
      />
    );
    expect(screen.getByRole("heading", { name: "Community" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Search recommendations"), "zp6");
    expect(screen.getByText("Blooming")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download Blooming" })).toBeInTheDocument();
  });

  it("requires existing saved bag, profile, grinder, brew values, and notes before upload", async () => {
    const { CommunityPage } = await import("../pages/CommunityPage");
    const onUpload = vi.fn();
    render(
      <CommunityPage
        recommendations={[]}
        loading={false}
        error={null}
        bags={[]}
        profiles={[]}
        grinders={[]}
        shots={[]}
        downloaded={[]}
        uploaded={[]}
        submittedBy={null}
        submittedByLocked={false}
        manualDisplayName=""
        onManualDisplayNameChange={vi.fn()}
        onRefresh={vi.fn()}
        onDownload={vi.fn()}
        onUpload={onUpload}
        onEditUpload={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("tab", { name: "Recommend Profile" }));
    await userEvent.click(screen.getByRole("button", { name: "Upload recommendation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Select a saved bag, profile, grinder, public display name, grind setting, weights, seconds, and notes.");
    expect(onUpload).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run page tests to verify they fail**

Run:

```bash
cd "/Users/royackerman/Documents/Decent skin/skin/workflow-skin"
npm test -- src/test/pages.test.tsx
```

Expected: FAIL because `CommunityPage` does not exist.

- [ ] **Step 3: Implement CommunityPage**

Create `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/pages/CommunityPage.tsx` with a focused first version:

```tsx
import { Download, RefreshCw, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import type { Grinder, ProfileRecord, ShotRecord } from "../api/types";
import { matchesCommunitySearch } from "../community/search";
import type { CommunityRecommendation, DownloadedCommunityProfile, UploadedCommunityProfile } from "../community/types";
import type { Bag } from "../lib/bags";

interface UploadDraft {
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

function titleFor(recommendation: CommunityRecommendation): string {
  return recommendation.profile.originalTitle || recommendation.profile.installedTitle || recommendation.id;
}

function weightLine(recommendation: CommunityRecommendation): string {
  const seconds =
    typeof recommendation.brew.secondsGoal === "number"
      ? `${recommendation.brew.secondsGoal}s`
      : `${recommendation.brew.secondsMin ?? "?"}-${recommendation.brew.secondsMax ?? "?"}s`;
  return `${recommendation.brew.beansWeight}g in, ${recommendation.brew.drinkWeight}g out, ${seconds}`;
}

function validDraft(draft: UploadDraft, submittedBy: string | null): boolean {
  return Boolean(
    draft.bagId &&
      draft.profileId &&
      draft.grinderId &&
      submittedBy?.trim() &&
      draft.grindSetting.trim() &&
      Number(draft.beansWeight) > 0 &&
      Number(draft.drinkWeight) > 0 &&
      Number(draft.secondsMin) > 0 &&
      Number(draft.secondsMax) >= Number(draft.secondsMin) &&
      draft.notes.trim()
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
}: {
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
}) {
  const [activeTab, setActiveTab] = useState<"recommendations" | "recommend" | "downloaded" | "uploaded">("recommendations");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<UploadDraft>(emptyDraft);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const visibleRecommendations = useMemo(() => recommendations.filter((item) => matchesCommunitySearch(item, search)), [recommendations, search]);

  const submitUpload = async () => {
    if (!validDraft(draft, submittedBy)) {
      setStatus({ type: "error", message: "Select a saved bag, profile, grinder, public display name, grind setting, weights, seconds, and notes." });
      return;
    }
    await onUpload(draft);
    setDraft(emptyDraft);
    setStatus({ type: "success", message: "Recommendation uploaded." });
  };

  return (
    <div className="panel wide community-page">
      <div className="page-title-row">
        <h1>Community</h1>
        <button type="button" className="ghost-button compact-button" onClick={() => void onRefresh()}>
          <RefreshCw aria-hidden="true" size={16} />
          Refresh
        </button>
      </div>
      <div className="settings-tabs" role="tablist" aria-label="Community sections">
        {[
          ["recommendations", "Recommendations"],
          ["recommend", "Recommend Profile"],
          ["downloaded", "Downloaded Profiles"],
          ["uploaded", "Uploaded Profiles"]
        ].map(([id, label]) => (
          <button type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? "settings-tab active" : "settings-tab"} key={id} onClick={() => setActiveTab(id as typeof activeTab)}>
            {label}
          </button>
        ))}
      </div>

      {status && <p className={status.type === "error" ? "status-message error" : "status-message"} role={status.type === "error" ? "alert" : "status"}>{status.message}</p>}
      {error && <p className="status-message error" role="alert">{error}</p>}

      {activeTab === "recommendations" && (
        <section className="community-section">
          <label className="settings-field">
            Search recommendations
            <input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search recommendations" />
          </label>
          {loading && <p className="muted">Loading recommendations.</p>}
          {visibleRecommendations.map((recommendation) => (
            <div className="list-row community-row" key={recommendation.id}>
              <strong>{titleFor(recommendation)}</strong>
              <span>{[recommendation.bag.roaster, recommendation.bag.name || recommendation.bag.bean, recommendation.bag.country, recommendation.bag.process].filter(Boolean).join(" · ")}</span>
              <span>{[recommendation.grinder.model, recommendation.brew.grindSetting, weightLine(recommendation), `by ${recommendation.submittedBy}`].join(" · ")}</span>
              <p>{recommendation.brew.notes}</p>
              <button type="button" className="primary-button compact-button" onClick={() => void onDownload(recommendation)}>
                <Download aria-hidden="true" size={16} />
                Download {titleFor(recommendation)}
              </button>
            </div>
          ))}
        </section>
      )}

      {activeTab === "recommend" && (
        <section className="community-section">
          <p className="mandatory-help">Shot history is optional, but highly recommended so people can understand the profile from a real graph and shot details.</p>
          {!submittedByLocked && (
            <label className="settings-field mandatory-field">
              Public display name *
              <input value={manualDisplayName} onChange={(event) => onManualDisplayNameChange(event.target.value)} />
            </label>
          )}
          {submittedByLocked && <p className="muted">Uploading as {submittedBy} from your Decent account.</p>}
          <div className="form-grid">
            <label>Saved bag<select value={draft.bagId} onChange={(event) => setDraft({ ...draft, bagId: event.target.value })}><option value="">Select bag</option>{bags.map((bag) => <option value={bag.id} key={bag.id}>{[bag.roaster, bag.name || bag.bean].filter(Boolean).join(" - ")}</option>)}</select></label>
            <label>Profile<select value={draft.profileId} onChange={(event) => setDraft({ ...draft, profileId: event.target.value })}><option value="">Select profile</option>{profiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.profile.title || profile.id}</option>)}</select></label>
            <label>Grinder<select value={draft.grinderId} onChange={(event) => setDraft({ ...draft, grinderId: event.target.value })}><option value="">Select grinder</option>{grinders.map((grinder) => <option value={grinder.id} key={grinder.id}>{grinder.model}</option>)}</select></label>
            <label>Grind setting<input value={draft.grindSetting} onChange={(event) => setDraft({ ...draft, grindSetting: event.target.value })} /></label>
            <label>Beans weight<input type="number" value={draft.beansWeight} onChange={(event) => setDraft({ ...draft, beansWeight: event.target.value })} /></label>
            <label>Drink weight<input type="number" value={draft.drinkWeight} onChange={(event) => setDraft({ ...draft, drinkWeight: event.target.value })} /></label>
            <label>Seconds min<input type="number" value={draft.secondsMin} onChange={(event) => setDraft({ ...draft, secondsMin: event.target.value })} /></label>
            <label>Seconds max<input type="number" value={draft.secondsMax} onChange={(event) => setDraft({ ...draft, secondsMax: event.target.value })} /></label>
            <label>Visualizer link<input value={draft.visualizerUrl} onChange={(event) => setDraft({ ...draft, visualizerUrl: event.target.value })} /></label>
            <label>Shot evidence<select value={draft.shotId} onChange={(event) => setDraft({ ...draft, shotId: event.target.value })}><option value="">No shot selected</option>{shots.map((shot) => <option value={shot.id} key={shot.id}>{new Date(shot.timestamp).toLocaleString()}</option>)}</select></label>
          </div>
          <label className="notes-field">Notes<textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
          <button type="button" className="primary-button" onClick={() => void submitUpload()}>
            <Upload aria-hidden="true" size={16} />
            Upload recommendation
          </button>
        </section>
      )}

      {activeTab === "downloaded" && (
        <section className="community-section">
          {downloaded.map((item) => <div className="list-row" key={item.recommendationId}><strong>{item.localProfileTitle}</strong><span>{item.recommendation.brew.notes}</span></div>)}
        </section>
      )}

      {activeTab === "uploaded" && (
        <section className="community-section">
          {uploaded.map((item) => (
            <div className="list-row" key={item.recommendationId}>
              <strong>{titleFor(item.recommendation)}</strong>
              <span>{item.recommendation.brew.notes}</span>
              <button type="button" className="ghost-button compact-button" onClick={() => void onEditUpload(item.recommendation)}>Edit</button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add focused CSS**

Append to `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/styles.css`:

```css
.community-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.community-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.community-row p {
  margin: 0;
  color: var(--muted);
}
```

- [ ] **Step 5: Run CommunityPage tests**

Run:

```bash
cd "/Users/royackerman/Documents/Decent skin/skin/workflow-skin"
npm test -- src/test/pages.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit CommunityPage**

Run:

```bash
cd "/Users/royackerman/Documents/Decent skin"
git add skin/workflow-skin/src/pages/CommunityPage.tsx skin/workflow-skin/src/styles.css skin/workflow-skin/src/test/pages.test.tsx
git commit -m "Add community page UI"
```

Expected: commit succeeds without staging unrelated dirty files.

---

### Task 8: Wire Community Into App Shell

**Files:**
- Modify: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/state/skinSettings.ts`
- Modify: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/App.tsx`
- Modify: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/pages/SettingsPage.tsx`
- Modify: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/test/app.test.tsx`
- Modify: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/test/skinSettings.test.ts`

- [ ] **Step 1: Write failing app wiring tests**

Add to `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/test/app.test.tsx`:

```tsx
  it("has a dedicated menu item for community recommendations", async () => {
    render(<App />);
    expect(await screen.findByRole("button", { name: "Community" })).toBeInTheDocument();
  });

  it("shows community offline state when the Worker cannot be reached", async () => {
    fetchState.options.communityStatus = 500;
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Community" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("GET /api/recommendations failed: 500");
  });
```

Update the test fetch mock in `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/test/app.test.tsx` so Worker calls are handled:

```ts
    if (url.hostname === "workflow-skin-community.sabotage1.workers.dev" && url.pathname === "/api/recommendations") {
      if (options.communityStatus) return Promise.resolve(new Response("community unavailable", { status: options.communityStatus }));
      return responseJson({ version: 1, updatedAt: "2026-06-18T00:00:00.000Z", items: [] });
    }
```

Add `communityStatus?: number;` to the test options type.

- [ ] **Step 2: Run app tests to verify they fail**

Run:

```bash
cd "/Users/royackerman/Documents/Decent skin/skin/workflow-skin"
npm test -- src/test/app.test.tsx src/test/skinSettings.test.ts
```

Expected: FAIL because the menu item and setting do not exist.

- [ ] **Step 3: Add Community menu/settings defaults**

Modify `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/state/skinSettings.ts`:

```ts
export const DEFAULT_MAIN_MENU_ITEMS = ["brew", "live", "review", "steam", "bags", "profiles", "grinders", "community", "history", "settings"] as const;
```

Add label:

```ts
  community: "Community",
```

Add to `SkinSettings`:

```ts
  communityApiBaseUrl: string;
```

Add constant:

```ts
export const DEFAULT_COMMUNITY_API_BASE_URL = "https://workflow-skin-community.sabotage1.workers.dev";
```

Add default:

```ts
    communityApiBaseUrl: DEFAULT_COMMUNITY_API_BASE_URL,
```

Add normalization in `normalizeSkinSettings()`:

```ts
    communityApiBaseUrl: normalizeString(value.communityApiBaseUrl, DEFAULT_COMMUNITY_API_BASE_URL),
```

- [ ] **Step 4: Wire App community state and handlers**

Modify `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/App.tsx`:

- Import `Users` from `lucide-react`.
- Import `CommunityApi`.
- Import `CommunityPage`.
- Import `publicNameFromDecentAccount`, `profilePayloadForCommunityInstall`, `sanitizeShotEvidence`, and community storage helpers.

Add nav entry:

```ts
  community: { label: MAIN_MENU_ITEM_LABELS.community, icon: Users },
```

Add state near other `useState` calls:

```ts
  const [communityRecommendations, setCommunityRecommendations] = useState<CommunityRecommendation[]>([]);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityDisplayName, setCommunityDisplayName] = useState("");
  const [downloadedCommunityProfiles, setDownloadedCommunityProfiles] = useState<DownloadedCommunityProfile[]>([]);
  const [uploadedCommunityProfiles, setUploadedCommunityProfiles] = useState<UploadedCommunityProfile[]>([]);
  const [decentAccount, setDecentAccount] = useState<DecentAccountStatus | null>(null);
```

Add API memo:

```ts
  const communityApi = useMemo(() => new CommunityApi(data.settings.communityApiBaseUrl), [data.settings.communityApiBaseUrl]);
```

Add refresh function:

```ts
  const refreshCommunity = useCallback(async () => {
    setCommunityLoading(true);
    try {
      const [index, account, displayName, downloaded, uploaded] = await Promise.all([
        communityApi.listRecommendations(),
        api.getDecentAccount().catch(() => null),
        loadCommunityDisplayName(api),
        loadDownloadedCommunityProfiles(api),
        loadUploadedCommunityProfiles(api)
      ]);
      setCommunityRecommendations(index.items);
      setDecentAccount(account);
      setCommunityDisplayName(displayName ?? "");
      setDownloadedCommunityProfiles(downloaded);
      setUploadedCommunityProfiles(uploaded);
      setCommunityError(null);
    } catch (error) {
      setCommunityError(error instanceof Error ? error.message : String(error));
    } finally {
      setCommunityLoading(false);
    }
  }, [api, communityApi]);
```

Add download handler:

```ts
  const downloadCommunityProfile = useCallback(async (recommendation: CommunityRecommendation) => {
    const payload = await communityApi.download(recommendation.id);
    const existing = downloadedCommunityProfiles.find((item) => item.recommendationId === recommendation.id);
    const installPayload = profilePayloadForCommunityInstall(payload.recommendation, payload.profileJson);
    const savedProfile = existing
      ? await api.updateProfile(existing.localProfileId, installPayload)
      : await api.createProfile(installPayload);
    const record: DownloadedCommunityProfile = {
      recommendationId: recommendation.id,
      localProfileId: savedProfile.id,
      localProfileTitle: savedProfile.profile.title ?? recommendation.profile.installedTitle,
      downloadedAt: existing?.downloadedAt ?? new Date().toISOString(),
      updatedAt: recommendation.updatedAt,
      recommendation: payload.recommendation,
      evidence: payload.evidence
    };
    const next = [record, ...downloadedCommunityProfiles.filter((item) => item.recommendationId !== recommendation.id)];
    await saveDownloadedCommunityProfiles(api, next);
    setDownloadedCommunityProfiles(next);
    await data.refresh();
  }, [api, communityApi, data, downloadedCommunityProfiles]);
```

Add upload handler skeleton that maps draft fields:

```ts
  const uploadCommunityProfile = useCallback(async (draft: {
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
  }) => {
    const bag = data.bags.find((item) => item.id === draft.bagId);
    const profile = data.profiles.find((item) => item.id === draft.profileId);
    const grinder = data.grinders.find((item) => item.id === draft.grinderId);
    const submittedBy = publicNameFromDecentAccount(decentAccount) ?? communityDisplayName.trim();
    if (!bag || !profile || !grinder || !submittedBy) throw new Error("Community upload is missing required local records.");
    if (!publicNameFromDecentAccount(decentAccount)) await saveCommunityDisplayName(api, submittedBy);
    const ownerKey = await getOrCreateCommunityOwnerKey(api);
    const selectedShot = draft.shotId ? data.shots.find((shot) => shot.id === draft.shotId) : undefined;
    const result = await communityApi.create({
      ownerKey,
      recommendation: {
        submittedBy,
        bag: {
          id: bag.id,
          beanId: bag.beanId,
          roaster: bag.roaster ?? "",
          name: bag.name,
          bean: bag.bean ?? "",
          country: bag.country ?? "",
          region: bag.region,
          process: bag.process ?? "",
          roastDate: bag.roastDate ?? "",
          roastLevel: bag.roastLevel,
          notes: bag.notes
        },
        profile: {
          originalId: profile.id,
          originalTitle: profile.profile.title ?? profile.id,
          fileName: "pending.json",
          installedTitle: profile.profile.title ?? profile.id
        },
        grinder: {
          id: grinder.id,
          model: grinder.model,
          burrs: grinder.burrs,
          settingType: grinder.settingType,
          notes: grinder.notes
        },
        brew: {
          grindSetting: draft.grindSetting.trim(),
          beansWeight: Number(draft.beansWeight),
          drinkWeight: Number(draft.drinkWeight),
          secondsMin: Number(draft.secondsMin),
          secondsMax: Number(draft.secondsMax),
          notes: draft.notes.trim()
        },
        visualizerUrl: draft.visualizerUrl.trim() || undefined
      },
      profileJson: profile.profile,
      evidence: selectedShot ? sanitizeShotEvidence(selectedShot) : undefined
    });
    const record: UploadedCommunityProfile = {
      recommendationId: result.recommendation.id,
      uploadedAt: new Date().toISOString(),
      updatedAt: result.recommendation.updatedAt,
      recommendation: result.recommendation
    };
    const next = [record, ...uploadedCommunityProfiles.filter((item) => item.recommendationId !== record.recommendationId)];
    await saveUploadedCommunityProfiles(api, next);
    setUploadedCommunityProfiles(next);
    setCommunityRecommendations(result.index.items);
  }, [api, communityApi, communityDisplayName, data.bags, data.grinders, data.profiles, data.shots, decentAccount, uploadedCommunityProfiles]);
```

Render CommunityPage:

```tsx
        {page === "community" && (
          <CommunityPage
            recommendations={communityRecommendations}
            loading={communityLoading}
            error={communityError}
            bags={data.bags}
            profiles={data.profiles}
            grinders={data.grinders ?? []}
            shots={data.shots}
            downloaded={downloadedCommunityProfiles}
            uploaded={uploadedCommunityProfiles}
            submittedBy={publicNameFromDecentAccount(decentAccount) ?? communityDisplayName}
            submittedByLocked={Boolean(publicNameFromDecentAccount(decentAccount))}
            manualDisplayName={communityDisplayName}
            onManualDisplayNameChange={setCommunityDisplayName}
            onRefresh={refreshCommunity}
            onDownload={downloadCommunityProfile}
            onUpload={uploadCommunityProfile}
            onEditUpload={async () => refreshCommunity()}
          />
        )}
```

- [ ] **Step 5: Add Community endpoint setting**

Modify `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/pages/SettingsPage.tsx` in the Skin settings tab, near GitHub update settings:

```tsx
            <label className="settings-field">
              Community API
              <input
                aria-label="Community API"
                value={draftSettings.communityApiBaseUrl}
                onChange={(event) => setDraftSettings({ ...draftSettings, communityApiBaseUrl: event.target.value })}
              />
            </label>
```

- [ ] **Step 6: Run app wiring tests**

Run:

```bash
cd "/Users/royackerman/Documents/Decent skin/skin/workflow-skin"
npm test -- src/test/app.test.tsx src/test/skinSettings.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit app wiring**

Run:

```bash
cd "/Users/royackerman/Documents/Decent skin"
git add skin/workflow-skin/src/state/skinSettings.ts skin/workflow-skin/src/App.tsx skin/workflow-skin/src/pages/SettingsPage.tsx skin/workflow-skin/src/test/app.test.tsx skin/workflow-skin/src/test/skinSettings.test.ts
git commit -m "Wire community profiles into app"
```

Expected: commit succeeds without staging unrelated dirty files.

---

### Task 9: Add Edit Flow And Downloaded Evidence Detail

**Files:**
- Modify: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/pages/CommunityPage.tsx`
- Modify: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/App.tsx`
- Modify: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/test/pages.test.tsx`
- Modify: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/test/app.test.tsx`

- [ ] **Step 1: Add failing tests for Uploaded Profiles edit and evidence display**

Add to the `CommunityPage` describe block in `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/test/pages.test.tsx`:

```tsx
  it("shows downloaded evidence details and uploaded edit actions", async () => {
    const { CommunityPage } = await import("../pages/CommunityPage");
    const onEditUpload = vi.fn();
    render(
      <CommunityPage
        recommendations={[]}
        loading={false}
        error={null}
        bags={[]}
        profiles={[]}
        grinders={[]}
        shots={[]}
        downloaded={[{
          recommendationId: recommendation.id,
          localProfileId: "local-1",
          localProfileTitle: "Blooming - Halo - Roy - rec-12345678",
          downloadedAt: "2026-06-18T00:00:00.000Z",
          updatedAt: recommendation.updatedAt,
          recommendation,
          evidence: { id: "shot-1", tds: 8.5, ey: 20, notes: "sweet", measurements: [{ machine: { pressure: 7 } }] }
        }]}
        uploaded={[{ recommendationId: recommendation.id, uploadedAt: "2026-06-18T00:00:00.000Z", updatedAt: recommendation.updatedAt, recommendation }]}
        submittedBy="Roy"
        submittedByLocked
        manualDisplayName=""
        onManualDisplayNameChange={vi.fn()}
        onRefresh={vi.fn()}
        onDownload={vi.fn()}
        onUpload={vi.fn()}
        onEditUpload={onEditUpload}
      />
    );
    await userEvent.click(screen.getByRole("tab", { name: "Downloaded Profiles" }));
    expect(screen.getByText("TDS 8.5")).toBeInTheDocument();
    expect(screen.getByText("EY 20")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Uploaded Profiles" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit Blooming" }));
    expect(onEditUpload).toHaveBeenCalledWith(recommendation);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd "/Users/royackerman/Documents/Decent skin/skin/workflow-skin"
npm test -- src/test/pages.test.tsx
```

Expected: FAIL because evidence detail labels are not rendered and edit button name is incomplete.

- [ ] **Step 3: Render downloaded evidence summaries**

Modify the Downloaded Profiles section in `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/pages/CommunityPage.tsx`:

```tsx
          {downloaded.map((item) => (
            <div className="list-row" key={item.recommendationId}>
              <strong>{item.localProfileTitle}</strong>
              <span>{item.recommendation.brew.notes}</span>
              {item.evidence && (
                <div className="community-evidence-summary">
                  {typeof item.evidence.tds === "number" && <span>TDS {item.evidence.tds}</span>}
                  {typeof item.evidence.ey === "number" && <span>EY {item.evidence.ey}</span>}
                  {item.evidence.notes && <span>{item.evidence.notes}</span>}
                </div>
              )}
            </div>
          ))}
```

Modify the Uploaded Profiles edit button:

```tsx
              <button type="button" className="ghost-button compact-button" onClick={() => void onEditUpload(item.recommendation)}>
                Edit {titleFor(item.recommendation)}
              </button>
```

Append CSS:

```css
.community-evidence-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  color: var(--muted);
}
```

- [ ] **Step 4: Add App edit handler**

Replace the temporary `onEditUpload={async () => refreshCommunity()}` handler in `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/App.tsx` with:

```ts
  const editCommunityUpload = useCallback(async (recommendation: CommunityRecommendation) => {
    const ownerKey = await getOrCreateCommunityOwnerKey(api);
    const localUpload = uploadedCommunityProfiles.find((item) => item.recommendationId === recommendation.id);
    if (!localUpload) throw new Error("This recommendation is not owned by this machine.");
    const profile = data.profiles.find((item) => item.id === recommendation.profile.originalId);
    if (!profile) throw new Error("Original local profile is no longer available.");
    const result = await communityApi.update(recommendation.id, {
      ownerKey,
      recommendation: {
        submittedBy: recommendation.submittedBy,
        bag: recommendation.bag,
        profile: recommendation.profile,
        grinder: recommendation.grinder,
        brew: recommendation.brew,
        visualizerUrl: recommendation.visualizerUrl
      },
      profileJson: profile.profile
    });
    const next = uploadedCommunityProfiles.map((item) =>
      item.recommendationId === recommendation.id ? { ...item, updatedAt: result.recommendation.updatedAt, recommendation: result.recommendation } : item
    );
    await saveUploadedCommunityProfiles(api, next);
    setUploadedCommunityProfiles(next);
    setCommunityRecommendations(result.index.items);
  }, [api, communityApi, data.profiles, uploadedCommunityProfiles]);
```

Pass `onEditUpload={editCommunityUpload}` to `CommunityPage`.

- [ ] **Step 5: Run edit/evidence tests**

Run:

```bash
cd "/Users/royackerman/Documents/Decent skin/skin/workflow-skin"
npm test -- src/test/pages.test.tsx src/test/app.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit edit and evidence detail**

Run:

```bash
cd "/Users/royackerman/Documents/Decent skin"
git add skin/workflow-skin/src/pages/CommunityPage.tsx skin/workflow-skin/src/App.tsx skin/workflow-skin/src/styles.css skin/workflow-skin/src/test/pages.test.tsx skin/workflow-skin/src/test/app.test.tsx
git commit -m "Add community edit and evidence details"
```

Expected: commit succeeds without staging unrelated dirty files.

---

### Task 10: Verify, Deploy Worker, And Configure Skin Default Endpoint

**Files:**
- Modify: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/state/skinSettings.ts`
- Modify: `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/test/skinSettings.test.ts`
- Modify: `/Users/royackerman/Documents/WorkFlow-Skin/worker/wrangler.jsonc` only if Wrangler reports a different deployment name is needed.

- [ ] **Step 1: Run full skin verification**

Run:

```bash
cd "/Users/royackerman/Documents/Decent skin/skin/workflow-skin"
npm test
npm run build
npm run package
```

Expected: all commands exit 0 and `workflow-skin.zip` is rebuilt.

- [ ] **Step 2: Run full Worker verification**

Run:

```bash
cd "/Users/royackerman/Documents/WorkFlow-Skin/worker"
npm run typecheck
npm test
npm run check
```

Expected: all commands exit 0.

- [ ] **Step 3: Set GitHub token secret for Worker**

Create a fine-grained GitHub token with Contents read/write permission for `Sabotage1/WorkFlow-Skin`, then run:

```bash
cd "/Users/royackerman/Documents/WorkFlow-Skin/worker"
npx wrangler secret put GITHUB_TOKEN
```

Paste the GitHub token when prompted.

Expected: Wrangler reports that secret `GITHUB_TOKEN` was uploaded.

- [ ] **Step 4: Deploy the Worker**

Run:

```bash
cd "/Users/royackerman/Documents/WorkFlow-Skin/worker"
npm run deploy
```

Expected: Wrangler reports a deployed Worker URL for `workflow-skin-community`.

- [ ] **Step 5: Smoke-test deployed Worker**

Run:

```bash
curl -fsS "https://workflow-skin-community.sabotage1.workers.dev/api/recommendations"
```

Expected response:

```json
{"version":1,"updatedAt":"1970-01-01T00:00:00.000Z","items":[]}
```

If the response has an empty or newer index, that is also acceptable as long as the JSON shape has `version`, `updatedAt`, and `items`.

- [ ] **Step 6: Confirm the deployed Worker URL is the skin default**

Modify `/Users/royackerman/Documents/Decent skin/skin/workflow-skin/src/state/skinSettings.ts`:

```ts
export const DEFAULT_COMMUNITY_API_BASE_URL = "https://workflow-skin-community.sabotage1.workers.dev";
```

Update tests that mock the community host to use `workflow-skin-community.sabotage1.workers.dev` or override settings in the test setup.

- [ ] **Step 7: Run final verification**

Run:

```bash
cd "/Users/royackerman/Documents/Decent skin/skin/workflow-skin"
npm test
npm run package
cd "/Users/royackerman/Documents/WorkFlow-Skin/worker"
npm test
```

Expected: all commands exit 0.

- [ ] **Step 8: Commit final endpoint and generated skin package**

Run:

```bash
cd "/Users/royackerman/Documents/Decent skin"
git add skin/workflow-skin/src/state/skinSettings.ts skin/workflow-skin/src/test/skinSettings.test.ts skin/workflow-skin/workflow-skin.zip
git commit -m "Configure community Worker endpoint"
```

Expected: commit succeeds without staging unrelated dirty files.

- [ ] **Step 9: Push the clean WorkFlow-Skin repo**

Run:

```bash
cd "/Users/royackerman/Documents/WorkFlow-Skin"
git push
```

Expected: `Sabotage1/WorkFlow-Skin` contains `Profiles/` and `worker/`.

---

## Final Verification Checklist

- [ ] Existing skin tests pass: `cd "/Users/royackerman/Documents/Decent skin/skin/workflow-skin" && npm test`
- [ ] Existing skin packages: `cd "/Users/royackerman/Documents/Decent skin/skin/workflow-skin" && npm run package`
- [ ] Worker tests pass: `cd "/Users/royackerman/Documents/WorkFlow-Skin/worker" && npm test`
- [ ] Worker typecheck passes: `cd "/Users/royackerman/Documents/WorkFlow-Skin/worker" && npm run typecheck`
- [ ] Worker config check passes: `cd "/Users/royackerman/Documents/WorkFlow-Skin/worker" && npm run check`
- [ ] `curl "https://workflow-skin-community.sabotage1.workers.dev/api/recommendations"` returns a valid index.
- [ ] Uploading a recommendation from the skin creates files under `Profiles/recommendations/`, `Profiles/profiles/`, and updates `Profiles/index.json`.
- [ ] Downloading the same recommendation twice updates the same local profile reference.
- [ ] Public display name never publishes an email address.
- [ ] Uploaded Profiles can edit records from the same machine.
