import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ShotRecord } from "../api/types";
import { ReviewPage } from "../pages/ReviewPage";

const shot: ShotRecord = {
  id: "s1",
  timestamp: "2026-06-09T10:00:00Z",
  workflow: { context: { targetDoseWeight: 18, beanBatchId: "batch-1" } },
  annotations: { actualYield: 40 },
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
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ drinkTds: 9.5, drinkEy: 21.11 }));
  });
});
