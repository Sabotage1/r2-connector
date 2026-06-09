import { describe, expect, it, vi } from "vitest";
import { defaultSkinSettings, loadSkinSettings, saveSkinSettings } from "../state/skinSettings";

describe("skin settings", () => {
  it("has post-shot review enabled by default", () => {
    expect(defaultSkinSettings.reviewEnabledByProfile).toEqual({});
    expect(defaultSkinSettings.defaultReviewEnabled).toBe(true);
  });

  it("loads default settings when KV is missing", async () => {
    const api = { getKv: vi.fn().mockResolvedValue(null), putKv: vi.fn() };
    await expect(loadSkinSettings(api)).resolves.toEqual(defaultSkinSettings);
  });

  it("saves settings to workflow-skin namespace", async () => {
    const api = { getKv: vi.fn(), putKv: vi.fn().mockResolvedValue(undefined) };
    await saveSkinSettings(api, { ...defaultSkinSettings, presetSlots: [{ label: "Light", profileId: "p1" }] });
    expect(api.putKv).toHaveBeenCalledWith(
      "workflow-skin",
      "settings",
      expect.objectContaining({ presetSlots: [{ label: "Light", profileId: "p1" }] })
    );
  });
});
