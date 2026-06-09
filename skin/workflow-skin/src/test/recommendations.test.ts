import { describe, expect, it } from "vitest";
import type { ProfileRecord, ShotRecord } from "../api/types";
import type { Bag } from "../lib/bags";
import { recommendProfiles } from "../lib/recommendations";

const bag: Bag = {
  id: "batch-1",
  beanId: "bean-1",
  roaster: "April",
  bean: "Ethiopia",
  country: "Ethiopia",
  process: "washed",
  roastDate: "2026-06-01T00:00:00Z",
  roastLevel: "light"
};

const profiles: ProfileRecord[] = [
  { id: "p1", profile: { title: "Blooming" } },
  { id: "p2", profile: { title: "Classic" } }
];

const shots: ShotRecord[] = [
  {
    id: "s1",
    timestamp: "2026-06-08T10:00:00Z",
    workflow: { profile: { title: "Blooming" }, context: { beanBatchId: "batch-1" } },
    annotations: { drinkEy: 21, enjoyment: 8 }
  },
  {
    id: "s2",
    timestamp: "2026-06-07T10:00:00Z",
    workflow: { profile: { title: "Classic" }, context: { beanBatchId: "other" } },
    annotations: { drinkEy: 17, enjoyment: 4 }
  }
];

describe("recommendProfiles", () => {
  it("ranks profiles with same-bag successful shots first and explains why", () => {
    const ranked = recommendProfiles({ profiles, shots, selectedBag: bag, bags: [bag], preferredEy: [19, 23] });
    expect(ranked[0].profile.id).toBe("p1");
    expect(ranked[0].reasons).toContain("1 previous shot on this bag");
    expect(ranked[0].reasons).toContain("average enjoyment 8.0");
  });
});
