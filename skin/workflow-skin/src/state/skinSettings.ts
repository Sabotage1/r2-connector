export interface PresetSlot {
  label: string;
  profileId?: string;
}

export interface SkinSettings {
  presetSlots: PresetSlot[];
  defaultReviewEnabled: boolean;
  reviewEnabledByProfile: Record<string, boolean>;
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

function clonePresetSlots(slots: PresetSlot[]): PresetSlot[] {
  return slots.map((slot) => ({ ...slot }));
}

export function createDefaultSkinSettings(): SkinSettings {
  return {
    presetSlots: clonePresetSlots(DEFAULT_PRESET_SLOTS),
    defaultReviewEnabled: true,
    reviewEnabledByProfile: {}
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

export function normalizeSkinSettings(value: unknown): SkinSettings {
  if (!isPlainRecord(value)) return createDefaultSkinSettings();

  const settings: SkinSettings = {
    presetSlots: normalizePresetSlots(value.presetSlots),
    defaultReviewEnabled: typeof value.defaultReviewEnabled === "boolean" ? value.defaultReviewEnabled : true,
    reviewEnabledByProfile: normalizeReviewEnabledByProfile(value.reviewEnabledByProfile)
  };

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
