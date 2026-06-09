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

export const defaultSkinSettings: SkinSettings = {
  presetSlots: [
    { label: "Light" },
    { label: "Sweet" },
    { label: "Turbo" },
    { label: "Classic" }
  ],
  defaultReviewEnabled: true,
  reviewEnabledByProfile: {}
};

export interface KvApi {
  getKv<T>(namespace: string, key: string): Promise<T | null>;
  putKv(namespace: string, key: string, value: unknown): Promise<unknown>;
}

export async function loadSkinSettings(api: KvApi): Promise<SkinSettings> {
  const saved = await api.getKv<Partial<SkinSettings>>(SKIN_NAMESPACE, SETTINGS_KEY);
  return { ...defaultSkinSettings, ...(saved ?? {}) };
}

export async function saveSkinSettings(api: KvApi, settings: SkinSettings): Promise<void> {
  await api.putKv(SKIN_NAMESPACE, SETTINGS_KEY, settings);
}

export function isReviewEnabled(settings: SkinSettings, profileId?: string): boolean {
  if (!profileId) return settings.defaultReviewEnabled;
  return settings.reviewEnabledByProfile[profileId] ?? settings.defaultReviewEnabled;
}
