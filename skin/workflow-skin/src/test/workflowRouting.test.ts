import { describe, expect, it } from "vitest";
import type { ProfileRecord, ShotRecord } from "../api/types";
import { postShotPageForShot } from "../lib/workflowRouting";
import { defaultSkinSettings } from "../state/skinSettings";

const profiles: ProfileRecord[] = [
  { id: "espresso", profile: { title: "Straight Espresso" } },
  { id: "milk", profile: { title: "Flat White" } }
];

function shotWithProfile(profileId: string): ShotRecord {
  return {
    id: "shot-1",
    timestamp: "2026-06-10T09:00:00Z",
    workflow: {
      profile: profiles.find((profile) => profile.id === profileId)?.profile,
      context: { extras: { workflowSkin: { selectedProfileId: profileId } } }
    }
  };
}

describe("postShotPageForShot", () => {
  it("routes milk profiles to review first when review is enabled", () => {
    const settings = {
      ...defaultSkinSettings,
      profileWorkflows: {
        milk: { milkBased: true, steamTimers: { small: 22, medium: 34, large: 48 } }
      }
    };

    expect(postShotPageForShot(shotWithProfile("milk"), settings, profiles)).toBe("review");
  });

  it("routes milk profiles to steam when review is disabled", () => {
    const settings = {
      ...defaultSkinSettings,
      profileWorkflows: {
        milk: { milkBased: true, steamTimers: { small: 22, medium: 34, large: 48 } }
      },
      reviewEnabledByProfile: { milk: false }
    };

    expect(postShotPageForShot(shotWithProfile("milk"), settings, profiles)).toBe("steam");
  });

  it("routes non-milk profiles to review when review is enabled", () => {
    expect(postShotPageForShot(shotWithProfile("espresso"), defaultSkinSettings, profiles)).toBe("review");
  });
});
