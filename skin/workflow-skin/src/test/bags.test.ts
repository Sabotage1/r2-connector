import { describe, expect, it } from "vitest";
import type { Bean, BeanBatch, ShotRecord } from "../api/types";
import { buildBag, filterShotsByBagFields, isValidBag } from "../lib/bags";

const bean: Bean = {
  id: "bean-1",
  roaster: "April",
  name: "Ethiopia Anaerobic",
  country: "Ethiopia",
  region: "Sidama",
  processing: "anaerobic"
};

const batch: BeanBatch = {
  id: "batch-1",
  beanId: "bean-1",
  roastDate: "2026-06-01T00:00:00.000Z",
  roastLevel: "light"
};

describe("bag helpers", () => {
  it("requires roaster, bean, roast date, and process for valid bags", () => {
    expect(isValidBag(buildBag(bean, batch))).toBe(true);
    expect(isValidBag(buildBag({ ...bean, processing: undefined }, batch))).toBe(false);
  });

  it("filters shots by joined bag fields", () => {
    const shots: ShotRecord[] = [
      { id: "s1", timestamp: "2026-06-09T10:00:00Z", workflow: { context: { beanBatchId: "batch-1" } } },
      { id: "s2", timestamp: "2026-06-09T11:00:00Z", workflow: { context: { beanBatchId: "batch-2" } } }
    ];
    const result = filterShotsByBagFields(shots, [buildBag(bean, batch)], { country: "Ethiopia", process: "anaerobic" });
    expect(result.map((shot) => shot.id)).toEqual(["s1"]);
  });
});
