import { describe, expect, it } from "vitest";
import type { ShotRecord } from "../api/types";
import { previousFiveForBag, shotStats } from "../lib/shotStats";

describe("shotStats", () => {
  it("summarizes duration, pressure, flow, and final yield", () => {
    const shot: ShotRecord = {
      id: "s1",
      timestamp: "2026-06-09T10:00:00Z",
      workflow: {},
      measurements: [
        { machine: { timestamp: "2026-06-09T10:00:00.000Z", pressure: 1, flow: 1 }, scale: { weight: 2 } },
        { machine: { timestamp: "2026-06-09T10:00:10.000Z", pressure: 9, flow: 2 }, scale: { weight: 36 } }
      ]
    };
    expect(shotStats(shot)).toMatchObject({ durationSeconds: 10, peakPressure: 9, averageFlow: 1.5, finalYield: 36 });
  });
});

describe("previousFiveForBag", () => {
  it("returns the five most recent shots for a batch excluding the current shot", () => {
    const shots = Array.from({ length: 7 }, (_, index): ShotRecord => ({
      id: `s${index}`,
      timestamp: `2026-06-0${index + 1}T10:00:00Z`,
      workflow: { context: { beanBatchId: "batch-1" } }
    }));
    expect(previousFiveForBag(shots, "batch-1", "s6").map((shot) => shot.id)).toEqual(["s5", "s4", "s3", "s2", "s1"]);
  });
});
