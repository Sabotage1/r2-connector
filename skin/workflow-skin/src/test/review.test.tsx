import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ShotRecord } from "../api/types";
import { ReviewPage } from "../pages/ReviewPage";
import { defaultSkinSettings } from "../state/skinSettings";

const shot: ShotRecord = {
  id: "s1",
  timestamp: "2026-06-09T10:00:00Z",
  workflow: { context: { targetDoseWeight: 18, beanBatchId: "batch-1" } },
  annotations: { actualYield: 40 },
  measurements: []
};

const nextShot: ShotRecord = {
  id: "s2",
  timestamp: "2026-06-09T10:05:00Z",
  workflow: { context: { targetDoseWeight: 20, beanBatchId: "batch-1" } },
  annotations: { actualYield: 42, drinkTds: 8.1 },
  measurements: []
};

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

  it("remounts the review form when App receives a newer latest shot", async () => {
    const data = {
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
      persistSettings: vi.fn()
    };
    vi.doMock("../state/useReaData", () => ({ useReaData: () => data }));
    const { App } = await import("../App");
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
});
