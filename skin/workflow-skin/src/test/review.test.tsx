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
  apiWebSocketBaseUrl: () => "ws://machine:8080",
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

  it("can return to the live graph from review", async () => {
    const onBackToGraph = vi.fn();
    render(
      <ReviewPage
        shot={shot}
        previousShots={[]}
        onSaveAnnotations={vi.fn()}
        onUploadVisualizer={vi.fn()}
        r2Sensor={null}
        onReadR2={vi.fn()}
        onBackToGraph={onBackToGraph}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Back to graph" }));

    expect(onBackToGraph).toHaveBeenCalledTimes(1);
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

  it("shows an error when no native R2 sensor is detected", async () => {
    appMocks.data = appData();

    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    await userEvent.click(screen.getByRole("button", { name: "Read from R2" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No DiFluid R2 sensor detected.");
    expect(appMocks.executeSensor).not.toHaveBeenCalled();
  });

  it("shows the native R2 sensor error message when measurement fails", async () => {
    appMocks.data = appData({ sensors: [r2Sensor] });
    appMocks.executeSensor.mockResolvedValue({ status: "error", message: "R2 is not connected" });

    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    await userEvent.click(screen.getByRole("button", { name: "Read from R2" }));

    expect(await screen.findByText("Could not read R2: R2 is not connected")).toBeInTheDocument();
    expect(screen.getByText("R2 did not return a TDS reading.")).toBeInTheDocument();
    expect(appMocks.executeSensor).toHaveBeenCalledWith("sensor-r2", "measure", { timeout: 30 });
  });

  it("imports an R2 TDS reading from the native sensor endpoint", async () => {
    appMocks.data = appData({ sensors: [r2Sensor] });
    appMocks.executeSensor.mockResolvedValue({
      status: "ok",
      result: { reading: { tds: 9.7, temperatureC: 27.2, refractiveIndex: 1.3332 } }
    });

    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    await userEvent.click(screen.getByRole("button", { name: "Read from R2" }));

    expect(screen.getByLabelText("TDS")).toHaveValue("9.7");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows local R2 reading feedback in the extraction panel", async () => {
    const onReadR2 = vi.fn().mockResolvedValue(9.7);
    render(
      <ReviewPage
        shot={shot}
        previousShots={[]}
        onSaveAnnotations={vi.fn()}
        onUploadVisualizer={vi.fn()}
        r2Sensor={r2Sensor}
        onReadR2={onReadR2}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Read from R2" }));

    expect(await screen.findByText("R2 TDS 9.7 imported.")).toBeInTheDocument();
    expect(screen.getByLabelText("TDS")).toHaveValue("9.7");
  });

  it("automatically reads R2 when review opens after a brew", async () => {
    const onReadR2 = vi.fn().mockResolvedValue(9.8);
    render(
      <ReviewPage
        shot={shot}
        previousShots={[]}
        onSaveAnnotations={vi.fn()}
        onUploadVisualizer={vi.fn()}
        r2Sensor={r2Sensor}
        onReadR2={onReadR2}
        autoReadR2
      />
    );

    expect(await screen.findByText("R2 TDS 9.8 imported.")).toBeInTheDocument();
    expect(screen.getByLabelText("TDS")).toHaveValue("9.8");
    expect(onReadR2).toHaveBeenCalledTimes(1);
  });

  it("shows local feedback when R2 is unavailable", async () => {
    render(
      <ReviewPage
        shot={shot}
        previousShots={[]}
        onSaveAnnotations={vi.fn()}
        onUploadVisualizer={vi.fn()}
        r2Sensor={null}
        onReadR2={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Read from R2" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No DiFluid R2 sensor detected.");
  });

  it("shows an error when R2 does not return a TDS reading", async () => {
    appMocks.data = appData({ sensors: [r2Sensor] });
    appMocks.executeSensor.mockResolvedValue({ status: "ok", result: { reading: {} } });

    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    await userEvent.click(screen.getByRole("button", { name: "Read from R2" }));

    expect(await screen.findAllByText("R2 did not return a TDS reading.")).toHaveLength(2);
  });
});
