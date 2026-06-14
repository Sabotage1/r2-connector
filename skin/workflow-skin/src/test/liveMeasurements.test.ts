import { describe, expect, it } from "vitest";
import type { ShotSnapshot } from "../api/types";
import { trimLiveGraphWarmup } from "../lib/liveMeasurements";

describe("live measurement trimming", () => {
  it("removes the first two seconds of live graph samples", () => {
    const measurements: ShotSnapshot[] = [
      { machine: { timestamp: "2026-06-14T10:00:00.000Z", pressure: 9 } },
      { machine: { timestamp: "2026-06-14T10:00:00.900Z", pressure: 11 } },
      { machine: { timestamp: "2026-06-14T10:00:01.000Z", pressure: 4 } },
      { machine: { timestamp: "2026-06-14T10:00:02.000Z", pressure: 5 } },
      { machine: { timestamp: "2026-06-14T10:00:03.000Z", pressure: 7 } }
    ];

    expect(trimLiveGraphWarmup(measurements).map((sample) => sample.machine?.pressure)).toEqual([5, 7]);
  });

  it("leaves untimed samples unchanged because their first second cannot be identified", () => {
    const measurements: ShotSnapshot[] = [{ machine: { pressure: 9 } }, { machine: { pressure: 7 } }];

    expect(trimLiveGraphWarmup(measurements)).toBe(measurements);
  });
});
