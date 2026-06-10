export interface PresetSlot {
  label: string;
  profileId?: string;
}

export interface SteamTimers {
  small: number;
  medium: number;
  large: number;
}

export interface ProfileWorkflowSettings {
  milkBased: boolean;
  steamTimers: SteamTimers;
}

export interface SkinSettings {
  presetSlots: PresetSlot[];
  defaultReviewEnabled: boolean;
  reviewEnabledByProfile: Record<string, boolean>;
  startupProfileId?: string;
  r2SensorId?: string;
  profileWorkflows: Record<string, ProfileWorkflowSettings>;
  lastBeanBatchId?: string;
  lastGrinderId?: string;
  preferredEyMin?: number;
  preferredEyMax?: number;
}

export const SKIN_NAMESPACE = "workflow-skin";
export const SETTINGS_KEY = "settings";

const DEFAULT_PRESET_SLOTS: PresetSlot[] = [
  { label: "Light" },
  { label: "Sweet" },
  { label: "Turbo" },
  { label: "Classic" }
];

export const DEFAULT_STEAM_TIMERS: SteamTimers = { small: 20, medium: 30, large: 40 };

function clonePresetSlots(slots: PresetSlot[]): PresetSlot[] {
  return slots.map((slot) => ({ ...slot }));
}

function cloneSteamTimers(timers: SteamTimers): SteamTimers {
  return { ...timers };
}

export function createDefaultSkinSettings(): SkinSettings {
  return {
    presetSlots: clonePresetSlots(DEFAULT_PRESET_SLOTS),
    defaultReviewEnabled: true,
    reviewEnabledByProfile: {},
    profileWorkflows: {}
  };
}

export const defaultSkinSettings: SkinSettings = createDefaultSkinSettings();

export interface KvApi {
  getKv<T>(namespace: string, key: string): Promise<T | null>;
  putKv(namespace: string, key: string, value: unknown): Promise<unknown>;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizePresetSlots(value: unknown): PresetSlot[] {
  if (!Array.isArray(value)) return clonePresetSlots(DEFAULT_PRESET_SLOTS);

  const slots: PresetSlot[] = [];
  for (const slot of value) {
    if (!isPlainRecord(slot) || typeof slot.label !== "string") return clonePresetSlots(DEFAULT_PRESET_SLOTS);
    if (slot.profileId !== undefined && typeof slot.profileId !== "string") return clonePresetSlots(DEFAULT_PRESET_SLOTS);
    slots.push(typeof slot.profileId === "string" ? { label: slot.label, profileId: slot.profileId } : { label: slot.label });
  }

  return slots;
}

function normalizeReviewEnabledByProfile(value: unknown): Record<string, boolean> {
  if (!isPlainRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, enabled]) => typeof enabled === "boolean")) as Record<string, boolean>;
}

function normalizeSteamTimer(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) return fallback;
  return Math.round(value);
}

function normalizeSteamTimers(value: unknown): SteamTimers {
  if (!isPlainRecord(value)) return cloneSteamTimers(DEFAULT_STEAM_TIMERS);
  return {
    small: normalizeSteamTimer(value.small, DEFAULT_STEAM_TIMERS.small),
    medium: normalizeSteamTimer(value.medium, DEFAULT_STEAM_TIMERS.medium),
    large: normalizeSteamTimer(value.large, DEFAULT_STEAM_TIMERS.large)
  };
}

function normalizeProfileWorkflows(value: unknown): Record<string, ProfileWorkflowSettings> {
  if (!isPlainRecord(value)) return {};

  const workflows: Record<string, ProfileWorkflowSettings> = {};
  for (const [profileId, workflow] of Object.entries(value)) {
    if (!isPlainRecord(workflow) || typeof workflow.milkBased !== "boolean") continue;
    workflows[profileId] = {
      milkBased: workflow.milkBased,
      steamTimers: normalizeSteamTimers(workflow.steamTimers)
    };
  }

  return workflows;
}

export function normalizeSkinSettings(value: unknown): SkinSettings {
  if (!isPlainRecord(value)) return createDefaultSkinSettings();

  const settings: SkinSettings = {
    presetSlots: normalizePresetSlots(value.presetSlots),
    defaultReviewEnabled: typeof value.defaultReviewEnabled === "boolean" ? value.defaultReviewEnabled : true,
    reviewEnabledByProfile: normalizeReviewEnabledByProfile(value.reviewEnabledByProfile),
    profileWorkflows: normalizeProfileWorkflows(value.profileWorkflows)
  };

  if (typeof value.startupProfileId === "string") settings.startupProfileId = value.startupProfileId;
  if (typeof value.r2SensorId === "string") settings.r2SensorId = value.r2SensorId;
  if (typeof value.lastBeanBatchId === "string") settings.lastBeanBatchId = value.lastBeanBatchId;
  if (typeof value.lastGrinderId === "string") settings.lastGrinderId = value.lastGrinderId;
  if (typeof value.preferredEyMin === "number" && Number.isFinite(value.preferredEyMin)) settings.preferredEyMin = value.preferredEyMin;
  if (typeof value.preferredEyMax === "number" && Number.isFinite(value.preferredEyMax)) settings.preferredEyMax = value.preferredEyMax;

  return settings;
}

export async function loadSkinSettings(api: KvApi): Promise<SkinSettings> {
  const saved = await api.getKv<unknown>(SKIN_NAMESPACE, SETTINGS_KEY);
  return normalizeSkinSettings(saved);
}

export async function saveSkinSettings(api: KvApi, settings: SkinSettings): Promise<void> {
  await api.putKv(SKIN_NAMESPACE, SETTINGS_KEY, settings);
}

export function isReviewEnabled(settings: SkinSettings, profileId?: string): boolean {
  const defaultEnabled = typeof settings.defaultReviewEnabled === "boolean" ? settings.defaultReviewEnabled : true;
  if (!profileId) return defaultEnabled;
  return normalizeReviewEnabledByProfile(settings.reviewEnabledByProfile)[profileId] ?? defaultEnabled;
}

export function profileWorkflowFor(settings: SkinSettings, profileId?: string): ProfileWorkflowSettings {
  if (!profileId) return { milkBased: false, steamTimers: cloneSteamTimers(DEFAULT_STEAM_TIMERS) };
  const workflow = settings.profileWorkflows[profileId];
  return workflow
    ? { milkBased: workflow.milkBased, steamTimers: cloneSteamTimers(workflow.steamTimers) }
    : { milkBased: false, steamTimers: cloneSteamTimers(DEFAULT_STEAM_TIMERS) };
}

export function isMilkProfile(settings: SkinSettings, profileId?: string): boolean {
  return profileWorkflowFor(settings, profileId).milkBased;
}
