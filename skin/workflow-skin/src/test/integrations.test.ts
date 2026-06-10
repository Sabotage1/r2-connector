import { afterEach, describe, expect, it, vi } from "vitest";
import type { SensorListItem } from "../api/types";
import { findDifluidR2Sensor } from "../api/sensors";
import { uploadShotToVisualizer } from "../api/visualizer";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("findDifluidR2Sensor", () => {
  it("matches a DiFluid R2 sensor by name and TDS channel", () => {
    const sensors: SensorListItem[] = [
      {
        id: "sensor-r2",
        info: {
          name: "DiFluid R2",
          vendor: "DiFluid",
          data: [{ key: "tds", type: "number", unit: "%" }],
          commands: [{ id: "measure" }]
        }
      }
    ];
    expect(findDifluidR2Sensor(sensors)?.id).toBe("sensor-r2");
  });

  it("does not match a DiFluid R2 sensor without a measure command", () => {
    const sensors: SensorListItem[] = [
      {
        id: "sensor-r2",
        info: {
          name: "DiFluid R2",
          vendor: "DiFluid",
          data: [{ key: "tds", type: "number", unit: "%" }],
          commands: [{ id: "calibrate" }]
        }
      }
    ];
    expect(findDifluidR2Sensor(sensors)).toBeNull();
  });
});

describe("uploadShotToVisualizer", () => {
  it("posts to the bundled Visualizer plugin upload endpoint", async () => {
    const api = { baseUrl: "http://machine:8080" };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "vis-1" }), { status: 200 }));
    await expect(uploadShotToVisualizer(api, { id: "shot-1" })).resolves.toEqual({ id: "vis-1" });
    expect(fetch).toHaveBeenCalledWith(
      "http://machine:8080/api/v1/plugins/visualizer.reaplugin/upload",
      expect.objectContaining({ method: "POST" })
    );
  });
});
