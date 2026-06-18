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
