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
