import { describe, expect, it } from "vitest";
import type { MachineState, SensorListItem } from "../api/types";
import { buildConnectivityStatuses } from "../lib/connectivity";

const scaleSensor: SensorListItem = {
  id: "scale-1",
  info: {
    vendor: "DiFluid",
    name: "Microbalance",
    data: [{ key: "weight", type: "number", unit: "g" }]
  }
};

const r2Sensor: SensorListItem = {
  id: "r2-1",
  info: {
    vendor: "DiFluid",
    name: "R2",
    data: [{ key: "tds", type: "number", unit: "%" }],
    commands: [{ id: "measure" }]
  }
};

describe("buildConnectivityStatuses", () => {
  it("shows machine, wifi, and scale status with machine IP", () => {
    const machineState: MachineState = {
      connected: true,
      wifi: { connected: true, ipAddress: "192.168.1.88" }
    };

    expect(
      buildConnectivityStatuses({
        apiHost: "localhost",
        machineState,
        sensors: [scaleSensor],
        r2SensorId: undefined,
        r2Sensor: null
      })
    ).toEqual([
      { id: "machine", label: "Machine", detail: "Connected", connected: true },
      { id: "wifi", label: "WiFi", detail: "192.168.1.88", connected: true },
      { id: "scale", label: "Scale", detail: "Connected", connected: true }
    ]);
  });

  it("hides R2 status until it is configured in settings", () => {
    const statuses = buildConnectivityStatuses({
      apiHost: "192.168.1.88",
      machineState: { connected: true },
      sensors: [r2Sensor],
      r2SensorId: undefined,
      r2Sensor
    });

    expect(statuses.map((status) => status.id)).not.toContain("r2");
  });

  it("marks configured R2 red when the configured sensor is not detected", () => {
    const statuses = buildConnectivityStatuses({
      apiHost: "192.168.1.88",
      machineState: { connected: true },
      sensors: [],
      r2SensorId: "r2-1",
      r2Sensor: null
    });

    expect(statuses.find((status) => status.id === "r2")).toEqual({
      id: "r2",
      label: "R2",
      detail: "Not connected",
      connected: false
    });
  });
});
