import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import type { SensorListItem, ShotRecord } from "../api/types";
import { ReviewPage } from "../pages/ReviewPage";
import { defaultSkinSettings } from "../state/skinSettings";

const appMocks = vi.hoisted(() => ({
  data: null as null | {
    api: unknown;
    profiles: unknown[];
    workflow: Record<string, unknown>;
    beans: unknown[];
    batches: unknown[];
    bags: unknown[];
    grinders: unknown[];
    sensors: SensorListItem[];
    shots: ShotRecord[];
    settings: typeof defaultSkinSettings;
    error: string | null;
    refresh: ReturnType<typeof vi.fn>;
    persistSettings: ReturnType<typeof vi.fn>;
  },
  executeSensor: vi.fn(),
  getShot: vi.fn(),
  updateShot: vi.fn()
}));

vi.mock("../api/reaprime", () => ({
  apiBaseUrl: () => "http://machine:8080",
  ReaPrimeApi: class {
    executeSensor = appMocks.executeSensor;
    getShot = appMocks.getShot;
    updateShot = appMocks.updateShot;
  }
}));

vi.mock("../state/useReaData", () => ({
  useReaData: () => appMocks.data
}));

const shot: ShotRecord = {
  id: "s1",
  timestamp: "2026-06-09T10:00:00Z",
  workflow: { context: { targetDoseWeight: 18, beanBatchId: "batch-1" } },
  annotations: { actualYield: 40 },
  measurements: []
};

const r2Sensor: SensorListItem = {
  id: "sensor-r2",
  info: {
    name: "DiFluid R2",
    vendor: "DiFluid",
    data: [{ key: "tds", type: "number", unit: "%" }],
    commands: [{ id: "measure" }]
  }
};

const nextShot: ShotRecord = {
  id: "s2",
  timestamp: "2026-06-09T10:05:00Z",
  workflow: { context: { targetDoseWeight: 20, beanBatchId: "batch-1" } },
  annotations: { actualYield: 42, drinkTds: 8.1 },
  measurements: []
};

function appData(overrides: Partial<NonNullable<typeof appMocks.data>> = {}) {
  return {
    api: {},
    profiles: [],
    workflow: {},
    beans: [],
    batches: [],
    bags: [],
    grinders: [],
    sensors: [],
    shots: [shot],
    settings: defaultSkinSettings,
    error: null,
    refresh: vi.fn(),
    persistSettings: vi.fn(),
    ...overrides
  };
}

function stubClosingWebSocket() {
  class ClosingWebSocket {
    onclose: (() => void) | null = null;

    constructor() {
      window.setTimeout(() => this.onclose?.(), 0);
    }

    close() {}
  }

  vi.stubGlobal("WebSocket", ClosingWebSocket);
}

function stubMeasurementWebSocket() {
  let activeSocket: MeasurementWebSocket | null = null;
  let measurementRanBeforeSocket = false;

  class MeasurementWebSocket {
    onmessage: ((event: { data: string }) => void) | null = null;
    onclose: (() => void) | null = null;

    constructor() {
      activeSocket = this;
      if (measurementRanBeforeSocket) window.setTimeout(() => this.onclose?.(), 0);
    }

    close() {}
  }

  vi.stubGlobal("WebSocket", MeasurementWebSocket);

  return {
    emitDuringMeasure(tds: number) {
      if (activeSocket?.onmessage) {
        activeSocket.onmessage({ data: JSON.stringify({ tds }) });
        return;
      }
      measurementRanBeforeSocket = true;
    }
  };
}

afterEach(() => {
  appMocks.data = null;
  appMocks.executeSensor.mockReset();
  appMocks.getShot.mockReset();
  appMocks.updateShot.mockReset();
  vi.unstubAllGlobals();
});

describe("ReviewPage", () => {
  it("calculates and saves manual TDS/EY", async () => {
    const onSave = vi.fn();
    render(
      <ReviewPage
        shot={shot}
        previousShots={[]}
        onSaveAnnotations={onSave}
        onUploadVisualizer={vi.fn()}
        r2Sensor={null}
        onReadR2={vi.fn()}
      />
    );
    await userEvent.clear(screen.getByLabelText("TDS"));
    await userEvent.type(screen.getByLabelText("TDS"), "9.5");
    await userEvent.click(screen.getByRole("button", { name: /Save Review/i }));
    expect(onSave).toHaveBeenCalledWith("s1", expect.objectContaining({ drinkTds: 9.5, drinkEy: 21.11 }));
  });

  it("preserves unrelated annotation extras when saving review fields", async () => {
    const onSave = vi.fn();
    render(
      <ReviewPage
        shot={{
          ...shot,
          annotations: {
            actualYield: 40,
            extras: {
              visualizer: { id: "vis-1" },
              workflowSkin: { grinderModel: "EK43", grindSize: "7.0" }
            }
          }
        }}
        previousShots={[]}
        onSaveAnnotations={onSave}
        onUploadVisualizer={vi.fn()}
        r2Sensor={null}
        onReadR2={vi.fn()}
      />
    );

    await userEvent.clear(screen.getByLabelText("Grind size"));
    await userEvent.type(screen.getByLabelText("Grind size"), "7.5");
    await userEvent.click(screen.getByRole("button", { name: /Save Review/i }));

    expect(onSave).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({
        extras: {
          visualizer: { id: "vis-1" },
          workflowSkin: { grinderModel: "EK43", grindSize: "7.5" }
        }
      })
    );
  });

  it("renders imperfect shot workflow data without crashing", () => {
    const imperfectShot = {
      id: "imperfect",
      timestamp: "2026-06-09T10:10:00Z",
      workflow: null,
      annotations: { actualYield: 33 },
      measurements: [{ machine: { pressure: 8 } }]
    } as unknown as ShotRecord;
    const imperfectPreviousShot = {
      id: "previous",
      timestamp: "2026-06-09T09:50:00Z",
      workflow: null,
      annotations: {}
    } as unknown as ShotRecord;

    render(
      <ReviewPage
        shot={imperfectShot}
        previousShots={[imperfectPreviousShot]}
        onSaveAnnotations={vi.fn()}
        onUploadVisualizer={vi.fn()}
        r2Sensor={null}
        onReadR2={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Shot Review" })).toBeInTheDocument();
    expect(screen.getByLabelText("Dose")).toHaveValue("");
    expect(screen.getByText("Previous grind sizes: —")).toBeInTheDocument();
  });

  it("ignores previous shots with missing workflow when listing grind sizes", () => {
    const imperfectPreviousShot = {
      id: "previous",
      timestamp: "2026-06-09T09:50:00Z",
      workflow: null,
      annotations: {}
    } as unknown as ShotRecord;

    render(
      <ReviewPage
        shot={shot}
        previousShots={[imperfectPreviousShot]}
        onSaveAnnotations={vi.fn()}
        onUploadVisualizer={vi.fn()}
        r2Sensor={null}
        onReadR2={vi.fn()}
      />
    );

    expect(screen.getByText("Previous grind sizes: —")).toBeInTheDocument();
  });

  it("remounts the review form when App receives a newer latest shot", async () => {
    const data = appData({ shots: [shot] });
    appMocks.data = data;
    const { rerender } = render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    await userEvent.clear(screen.getByLabelText("TDS"));
    await userEvent.type(screen.getByLabelText("TDS"), "9.5");
    expect(screen.getByLabelText("TDS")).toHaveValue("9.5");

    data.shots = [nextShot, shot];
    rerender(<App />);

    expect(screen.getByLabelText("TDS")).toHaveValue("8.1");
    expect(screen.getByLabelText("Dose")).toHaveValue("20");
  });

  it("shows the R2 command error message when measurement fails", async () => {
    stubClosingWebSocket();
    appMocks.data = appData({ sensors: [r2Sensor] });
    appMocks.executeSensor.mockResolvedValue({ status: "error", message: "Sensor busy" });

    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    await userEvent.click(screen.getByRole("button", { name: "Read from R2" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Sensor busy");
    expect(appMocks.executeSensor).toHaveBeenCalledWith("sensor-r2", "measure");
  });

  it("imports an R2 TDS reading emitted during the measurement command", async () => {
    const socket = stubMeasurementWebSocket();
    appMocks.data = appData({ sensors: [r2Sensor] });
    appMocks.executeSensor.mockImplementation(async () => {
      socket.emitDuringMeasure(9.7);
      return { status: "ok" };
    });

    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    await userEvent.click(screen.getByRole("button", { name: "Read from R2" }));

    expect(screen.getByLabelText("TDS")).toHaveValue("9.7");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an error when R2 does not return a TDS reading", async () => {
    stubClosingWebSocket();
    appMocks.data = appData({ sensors: [r2Sensor] });
    appMocks.executeSensor.mockResolvedValue({ status: "ok" });

    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    await userEvent.click(screen.getByRole("button", { name: "Read from R2" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("R2 did not return a TDS reading.");
  });
});
