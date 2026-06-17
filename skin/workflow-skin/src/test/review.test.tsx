import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import type { Grinder, SensorListItem, ShotRecord } from "../api/types";
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
    devices: unknown[];
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

const grinders: Grinder[] = [
  { id: "g1", model: "EK43" },
  { id: "g2", model: "ZP6" }
];

function appData(overrides: Partial<NonNullable<typeof appMocks.data>> = {}) {
  return {
    api: {},
    profiles: [],
    workflow: {},
    beans: [],
    batches: [],
    bags: [],
    grinders: [],
    devices: [],
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
  vi.useRealTimers();
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

  it("does not show the old live graph return button", () => {
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

    expect(screen.queryByRole("button", { name: "Back to graph" })).not.toBeInTheDocument();
    expect(onBackToGraph).not.toHaveBeenCalled();
  });

  it("shows last shot details and same-bag comparison from previous shots", () => {
    const currentShot: ShotRecord = {
      ...shot,
      annotations: {
        actualDoseWeight: 18,
        actualYield: 40,
        drinkTds: 9,
        drinkEy: 20,
        extras: { workflowSkin: { grindSize: "7.2" } }
      },
      measurements: [
        { machine: { timestamp: "2026-06-09T10:00:00.000Z", pressure: 2, flow: 1 }, scale: { weight: 5 } },
        { machine: { timestamp: "2026-06-09T10:00:28.000Z", pressure: 9, flow: 2 }, scale: { weight: 40 } }
      ]
    };
    const previousSameBag: ShotRecord[] = [
      {
        id: "same-1",
        timestamp: "2026-06-09T09:55:00Z",
        workflow: { context: { beanBatchId: "batch-1" } },
        annotations: { actualYield: 38, drinkTds: 8.8, drinkEy: 18.1, extras: { workflowSkin: { grindSize: "7.0" } } },
        measurements: [
          { machine: { timestamp: "2026-06-09T09:55:00.000Z", pressure: 2, flow: 1 } },
          { machine: { timestamp: "2026-06-09T09:55:27.000Z", pressure: 8, flow: 2 } }
        ]
      },
      {
        id: "same-2",
        timestamp: "2026-06-09T09:45:00Z",
        workflow: { context: { beanBatchId: "batch-1" } },
        annotations: { actualYield: 39, drinkTds: 8.9, drinkEy: 18.3, extras: { workflowSkin: { grindSize: "7.1" } } },
        measurements: [
          { machine: { timestamp: "2026-06-09T09:45:00.000Z", pressure: 2, flow: 1 } },
          { machine: { timestamp: "2026-06-09T09:45:29.000Z", pressure: 8.5, flow: 2.1 } }
        ]
      },
      {
        id: "other-bag",
        timestamp: "2026-06-09T09:35:00Z",
        workflow: { context: { beanBatchId: "batch-2" } },
        annotations: { actualYield: 50, drinkTds: 12, drinkEy: 30 },
        measurements: []
      }
    ];

    const { container } = render(
      <ReviewPage
        shot={currentShot}
        previousShots={previousSameBag}
        onSaveAnnotations={vi.fn()}
        onUploadVisualizer={vi.fn()}
        r2Sensor={null}
        onReadR2={vi.fn()}
      />
    );

    expect(screen.getByRole("img", { name: "Shot pressure graph" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Last Shot Details" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Extraction Yield" })).toBeInTheDocument();
    expect(screen.getByText("Duration: 28s")).toBeInTheDocument();
    expect(screen.getByText("Yield: 40 g")).toBeInTheDocument();
    expect(screen.getByText("TDS: 9%")).toBeInTheDocument();
    expect(screen.getByText("Current EY: 20%")).toBeInTheDocument();
    expect(screen.getByText("Grind: 7.2")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Same Bag Comparison" })).toBeInTheDocument();
    expect(screen.getByText("Previous same-bag shots: 2")).toBeInTheDocument();
    expect(screen.getByText("Avg yield: 38.5 g")).toBeInTheDocument();
    expect(screen.getByText("Avg TDS: 8.85%")).toBeInTheDocument();
    expect(screen.getByText("Avg EY: 18.2%")).toBeInTheDocument();
    expect(screen.getByText("Avg duration: 28s")).toBeInTheDocument();
    expect(screen.getByText("Grinds: 7.0, 7.1")).toBeInTheDocument();
    expect(screen.queryByText("50 g")).not.toBeInTheDocument();

    const sections = Array.from(container.querySelectorAll(".workflow-grid > section"));
    const detailsSection = screen.getByRole("heading", { name: "Last Shot Details" }).closest("section");
    const extractionSection = screen.getByRole("heading", { name: "Extraction Yield" }).closest("section");
    const comparisonSection = screen.getByRole("heading", { name: "Same Bag Comparison" }).closest("section");

    expect(sections.indexOf(extractionSection as Element)).toBe(sections.indexOf(detailsSection as Element) + 1);
    expect(sections.indexOf(extractionSection as Element)).toBeLessThan(sections.indexOf(comparisonSection as Element));
  });

  it("starts on the latest shot and scrubs through previous same-bag shot details", () => {
    const currentShot: ShotRecord = {
      ...shot,
      workflow: { profile: { title: "Blooming profile" }, context: { ...shot.workflow.context } },
      annotations: {
        actualDoseWeight: 18,
        actualYield: 40,
        drinkTds: 9,
        drinkEy: 20,
        extras: { workflowSkin: { grindSize: "7.2" } }
      },
      measurements: [
        { machine: { timestamp: "2026-06-09T10:00:00.000Z", pressure: 2, flow: 1 }, scale: { weight: 5 } },
        { machine: { timestamp: "2026-06-09T10:00:28.000Z", pressure: 9, flow: 2 }, scale: { weight: 40 } }
      ]
    };
    const previousShot: ShotRecord = {
      id: "same-1",
      timestamp: "2026-06-09T09:55:00Z",
      workflow: { profile: { title: "Turbo milk profile" }, context: { beanBatchId: "batch-1" } },
      annotations: { actualYield: 38, drinkTds: 8.8, drinkEy: 18.1, extras: { workflowSkin: { grindSize: "7.0" } } },
      measurements: [
        { machine: { timestamp: "2026-06-09T09:55:00.000Z", pressure: 2, flow: 1 } },
        { machine: { timestamp: "2026-06-09T09:55:27.000Z", pressure: 8, flow: 2 } }
      ]
    };

    render(
      <ReviewPage
        shot={currentShot}
        previousShots={[previousShot]}
        onSaveAnnotations={vi.fn()}
        onUploadVisualizer={vi.fn()}
        r2Sensor={null}
        onReadR2={vi.fn()}
      />
    );

    expect(screen.getByText("Selected shot: Latest shot")).toBeInTheDocument();
    expect(screen.getByText("Yield: 40 g")).toBeInTheDocument();
    const reviewCard = screen.getByRole("heading", { name: "Shot Review" }).closest("section")!;
    expect(within(reviewCard).getByText("Blooming profile")).toHaveClass("review-profile-title");

    fireEvent.change(screen.getByLabelText("Shot scrubber"), { target: { value: "1" } });

    expect(screen.getByText("Selected shot: 2026-06-09 09:55")).toBeInTheDocument();
    expect(within(reviewCard).getByText("Turbo milk profile")).toHaveClass("review-profile-title");
    expect(screen.getByText("Duration: 27s")).toBeInTheDocument();
    expect(screen.getByText("Yield: 38 g")).toBeInTheDocument();
    expect(screen.getByText("TDS: 8.8%")).toBeInTheDocument();
    expect(screen.getByText("Current EY: 18.1%")).toBeInTheDocument();
    expect(screen.getByText("Grind: 7.0")).toBeInTheDocument();
  });

  it("loads full selected shot data when the scrubbed previous shot has no graph measurements", async () => {
    const currentShot: ShotRecord = {
      ...shot,
      measurements: [{ machine: { timestamp: "2026-06-09T10:00:00.000Z", pressure: 7 } }]
    };
    const previousSummary: ShotRecord = {
      id: "same-1",
      timestamp: "2026-06-09T09:55:00Z",
      workflow: { context: { beanBatchId: "batch-1" } },
      annotations: { actualYield: 38, drinkTds: 8.8, drinkEy: 18.1 },
      measurements: []
    };
    const previousFull: ShotRecord = {
      ...previousSummary,
      measurements: [
        { machine: { timestamp: "2026-06-09T09:55:00.000Z", pressure: 2, flow: 1 } },
        { machine: { timestamp: "2026-06-09T09:55:27.000Z", pressure: 8, flow: 2 } }
      ]
    };
    const onLoadShot = vi.fn().mockResolvedValue(previousFull);

    render(
      <ReviewPage
        shot={currentShot}
        previousShots={[previousSummary]}
        onSaveAnnotations={vi.fn()}
        onUploadVisualizer={vi.fn()}
        r2Sensor={null}
        onReadR2={vi.fn()}
        onLoadShot={onLoadShot}
      />
    );

    expect(screen.queryByText("Flow")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Shot scrubber"), { target: { value: "1" } });

    expect(onLoadShot).toHaveBeenCalledWith("same-1");
    expect(await screen.findByText("Flow")).toBeInTheDocument();
    expect(screen.getByText("Duration: 27s")).toBeInTheDocument();
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

  it("saves taste rating and marks a ten as a golden shot", async () => {
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

    expect(screen.getByRole("heading", { name: "Taste" })).toBeInTheDocument();
    const tasteScore = screen.getByText("7/10");
    const tasteField = tasteScore.closest(".taste-slider-field")!;
    const tasteSlider = screen.getByRole("slider", { name: "Taste rating" });
    expect(tasteScore).toHaveClass("taste-score", "green");
    expect(tasteScore.closest(".taste-slider-shell")).toBeNull();
    expect(tasteField.querySelector(".taste-slider-shell")).toContainElement(tasteSlider);
    expect(tasteField.lastElementChild).toBe(tasteScore);

    fireEvent.change(tasteSlider, { target: { value: "10" } });

    expect(screen.getByRole("slider", { name: "Taste rating" })).toHaveClass("gold");
    expect(screen.getByText("10/10 🔥")).toHaveClass("taste-score", "gold");
    await userEvent.click(screen.getByRole("button", { name: /Save Review/i }));

    expect(onSave).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({
        enjoyment: 10,
        extras: expect.objectContaining({
          workflowSkin: expect.objectContaining({ goldenShot: true })
        })
      })
    );
  });

  it("defaults grinder correction to the default grinder and saves it with the review", async () => {
    const onSave = vi.fn();
    render(
      <ReviewPage
        shot={{ ...shot, workflow: { context: { ...shot.workflow.context, grinderId: "g1", grinderModel: "EK43" } } }}
        previousShots={[]}
        onSaveAnnotations={onSave}
        onUploadVisualizer={vi.fn()}
        r2Sensor={null}
        onReadR2={vi.fn()}
        grinders={grinders}
        defaultGrinderId="g2"
      />
    );

    expect(screen.getByLabelText("Grinder")).toHaveValue("g2");
    await userEvent.click(screen.getByRole("button", { name: /Save Review/i }));

    expect(onSave).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({
        extras: expect.objectContaining({
          workflowSkin: expect.objectContaining({ grinderId: "g2", grinderModel: "ZP6" })
        })
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

  it("loads a full previous shot through App when scrubbing to a summary-only shot", async () => {
    const currentShot: ShotRecord = {
      ...shot,
      measurements: [{ machine: { timestamp: "2026-06-09T10:00:00.000Z", pressure: 7 } }]
    };
    const previousSummary: ShotRecord = {
      id: "same-1",
      timestamp: "2026-06-09T09:55:00Z",
      workflow: { context: { beanBatchId: "batch-1" } },
      annotations: { actualYield: 38 },
      measurements: []
    };
    const previousFull: ShotRecord = {
      ...previousSummary,
      measurements: [
        { machine: { timestamp: "2026-06-09T09:55:00.000Z", pressure: 2, flow: 1 } },
        { machine: { timestamp: "2026-06-09T09:55:27.000Z", pressure: 8, flow: 2 } }
      ]
    };
    appMocks.data = appData({ shots: [currentShot, previousSummary] });
    appMocks.getShot.mockResolvedValue(previousFull);

    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.queryByText("Flow")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Shot scrubber"), { target: { value: "1" } });

    expect(appMocks.getShot).toHaveBeenCalledWith("same-1");
    expect(await screen.findByText("Flow")).toBeInTheDocument();
    expect(screen.getByText("Duration: 27s")).toBeInTheDocument();
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
    appMocks.executeSensor.mockResolvedValue({ status: "error", message: "Measurement command failed" });

    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    await userEvent.click(screen.getByRole("button", { name: "Read from R2" }));

    expect(await screen.findByText("Could not read R2: Measurement command failed")).toBeInTheDocument();
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

    expect(await screen.findByDisplayValue("9.7")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("imports an R2 TDS reading from the configured native ReaPrime id when sensors are stale", async () => {
    appMocks.data = appData({ settings: { ...defaultSkinSettings, r2SensorId: "F4:12:FA:FA:AC:E3" } });
    appMocks.executeSensor.mockResolvedValue({
      status: "ok",
      result: { reading: { tds: 9.4 } }
    });

    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    await userEvent.click(screen.getByRole("button", { name: "Read from R2" }));

    expect(await screen.findByDisplayValue("9.4")).toBeInTheDocument();
    expect(appMocks.executeSensor).toHaveBeenCalledWith("F4:12:FA:FA:AC:E3", "measure", { timeout: 30 });
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

  it("waits for the configured delay before automatically reading R2 after a brew", async () => {
    vi.useFakeTimers();
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
        autoReadR2DelaySeconds={30}
      />
    );

    expect(onReadR2).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(29_999);
    });
    expect(onReadR2).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(screen.getByText("R2 TDS 9.8 imported.")).toBeInTheDocument();
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
