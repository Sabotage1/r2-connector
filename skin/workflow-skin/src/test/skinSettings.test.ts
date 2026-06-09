import { describe, expect, it, vi } from "vitest";
import { defaultSkinSettings, isReviewEnabled, loadSkinSettings, saveSkinSettings } from "../state/skinSettings";

describe("skin settings", () => {
  it("has post-shot review enabled by default", () => {
    expect(defaultSkinSettings.reviewEnabledByProfile).toEqual({});
    expect(defaultSkinSettings.defaultReviewEnabled).toBe(true);
  });

  it("loads default settings when KV is missing", async () => {
    const api = { getKv: vi.fn().mockResolvedValue(null), putKv: vi.fn() };
    const settings = await loadSkinSettings(api);
    expect(settings).toEqual(defaultSkinSettings);
    expect(settings.presetSlots).not.toBe(defaultSkinSettings.presetSlots);
    expect(settings.presetSlots[0]).not.toBe(defaultSkinSettings.presetSlots[0]);
    expect(settings.reviewEnabledByProfile).not.toBe(defaultSkinSettings.reviewEnabledByProfile);
  });

  it("normalizes stale KV settings", async () => {
    const api = {
      getKv: vi.fn().mockResolvedValue({
        presetSlots: [{ label: "Valid" }, { label: 7 }],
        defaultReviewEnabled: "yes",
        reviewEnabledByProfile: { p1: false, p2: true, stale: "no" },
        lastBeanBatchId: 12,
        lastGrinderId: "g1",
        preferredEyMin: 18.5,
        preferredEyMax: Number.POSITIVE_INFINITY
      }),
      putKv: vi.fn()
    };

    const settings = await loadSkinSettings(api);

    expect(settings.presetSlots).toEqual(defaultSkinSettings.presetSlots);
    expect(settings.presetSlots).not.toBe(defaultSkinSettings.presetSlots);
    expect(settings.defaultReviewEnabled).toBe(true);
    expect(settings.reviewEnabledByProfile).toEqual({ p1: false, p2: true });
    expect(settings.lastBeanBatchId).toBeUndefined();
    expect(settings.lastGrinderId).toBe("g1");
    expect(settings.preferredEyMin).toBe(18.5);
    expect(settings.preferredEyMax).toBeUndefined();
  });

  it("loads corrupt review overrides as an empty record", async () => {
    const api = {
      getKv: vi.fn().mockResolvedValue({ defaultReviewEnabled: false, reviewEnabledByProfile: null }),
      putKv: vi.fn()
    };

    const settings = await loadSkinSettings(api);

    expect(settings.reviewEnabledByProfile).toEqual({});
    expect(isReviewEnabled(settings, "p1")).toBe(false);
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

  it("uses the default review setting for unknown profiles", () => {
    expect(isReviewEnabled({ ...defaultSkinSettings, defaultReviewEnabled: true }, "missing")).toBe(true);
    expect(isReviewEnabled({ ...defaultSkinSettings, defaultReviewEnabled: false }, "missing")).toBe(false);
  });

  it("uses false review overrides", () => {
    expect(isReviewEnabled({ ...defaultSkinSettings, reviewEnabledByProfile: { p1: false } }, "p1")).toBe(false);
  });

  it("uses true review overrides", () => {
    expect(isReviewEnabled({ ...defaultSkinSettings, defaultReviewEnabled: false, reviewEnabledByProfile: { p1: true } }, "p1")).toBe(true);
  });

  it("uses the default review setting when profileId is missing", () => {
    expect(isReviewEnabled({ ...defaultSkinSettings, defaultReviewEnabled: false })).toBe(false);
    expect(isReviewEnabled({ ...defaultSkinSettings, defaultReviewEnabled: true })).toBe(true);
  });
});
