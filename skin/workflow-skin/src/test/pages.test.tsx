import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProfilePresetGrid } from "../components/ProfilePresetGrid";
import { BagsPage } from "../pages/BagsPage";
import type { ProfileRecord } from "../api/types";

const profiles: ProfileRecord[] = [
  { id: "p1", profile: { title: "Blooming" } },
  { id: "p2", profile: { title: "Classic" } }
];

describe("ProfilePresetGrid", () => {
  it("applies a slot profile when selected", async () => {
    const onApply = vi.fn();
    render(
      <ProfilePresetGrid
        slots={[{ label: "Light", profileId: "p1" }]}
        profiles={profiles}
        onApply={onApply}
        onEditSlot={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /Light Blooming/i }));
    expect(onApply).toHaveBeenCalledWith(profiles[0]);
  });

  it("opens slot editing when the edit control is pressed", async () => {
    const onEditSlot = vi.fn();
    render(
      <ProfilePresetGrid
        slots={[{ label: "Light" }]}
        profiles={profiles}
        onApply={vi.fn()}
        onEditSlot={onEditSlot}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /Edit Light/i }));
    expect(onEditSlot).toHaveBeenCalledWith(0);
  });
});

describe("BagsPage", () => {
  it("saves a valid draft bag through the provided callback", async () => {
    const onSaveBag = vi.fn().mockResolvedValue(undefined);
    render(<BagsPage bags={[]} onSaveBag={onSaveBag} />);
    const form = screen.getByRole("form", { name: /Add a bag/i });

    await userEvent.type(within(form).getByLabelText("Roaster"), "Pilot");
    await userEvent.type(within(form).getByLabelText("Bean"), "Ethiopia Halo");
    await userEvent.type(within(form).getByLabelText("Country"), "Ethiopia");
    await userEvent.type(within(form).getByLabelText("Process"), "Washed");
    await userEvent.type(within(form).getByLabelText("Roast Date"), "2026-06-01");
    await userEvent.type(within(form).getByLabelText("Roast Level"), "Light");
    await userEvent.type(within(form).getByLabelText("Notes"), "Citrus");
    await userEvent.click(within(form).getByRole("button", { name: "Save" }));

    expect(onSaveBag).toHaveBeenCalledWith(
      expect.objectContaining({
        roaster: "Pilot",
        bean: "Ethiopia Halo",
        country: "Ethiopia",
        process: "Washed",
        roastDate: "2026-06-01",
        roastLevel: "Light",
        notes: "Citrus"
      })
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Bag saved");
    expect(within(form).getByLabelText("Roaster")).toHaveValue("");
  });

  it("shows an inline validation message for invalid draft bags", async () => {
    const onSaveBag = vi.fn();
    render(<BagsPage bags={[]} onSaveBag={onSaveBag} />);

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSaveBag).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Roaster, bean, roast date, and process are required.");
  });
});
