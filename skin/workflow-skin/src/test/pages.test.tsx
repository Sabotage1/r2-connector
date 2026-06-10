import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProfilePresetGrid } from "../components/ProfilePresetGrid";
import { BagsPage } from "../pages/BagsPage";
import { ProfilesPage } from "../pages/ProfilesPage";
import { SettingsPage } from "../pages/SettingsPage";
import type { ProfileRecord } from "../api/types";
import { defaultSkinSettings } from "../state/skinSettings";

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

describe("ProfilesPage", () => {
  it("selects a startup default profile", async () => {
    const onSetStartupProfile = vi.fn();
    render(
      <ProfilesPage
        profiles={profiles}
        settings={defaultSkinSettings}
        onToggleReview={vi.fn()}
        onSetStartupProfile={onSetStartupProfile}
        onUpdateProfileWorkflow={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole("radio", { name: /Use Blooming at startup/i }));

    expect(onSetStartupProfile).toHaveBeenCalledWith("p1");
  });

  it("edits milk workflow timers for a profile", async () => {
    const onUpdateProfileWorkflow = vi.fn();
    render(
      <ProfilesPage
        profiles={profiles}
        settings={{
          ...defaultSkinSettings,
          profileWorkflows: {
            p1: { milkBased: true, steamTimers: { small: 20, medium: 30, large: 40 } }
          }
        }}
        onToggleReview={vi.fn()}
        onSetStartupProfile={vi.fn()}
        onUpdateProfileWorkflow={onUpdateProfileWorkflow}
      />
    );

    const row = screen.getByRole("group", { name: "Blooming profile workflow" });
    fireEvent.change(within(row).getByLabelText("Medium jug seconds"), { target: { value: "36" } });

    expect(onUpdateProfileWorkflow).toHaveBeenLastCalledWith("p1", {
      milkBased: true,
      steamTimers: { small: 20, medium: 36, large: 40 }
    });
  });
});

describe("SettingsPage", () => {
  it("edits the centered skin title shown above the menu", async () => {
    const onUpdateSettings = vi.fn();
    render(<SettingsPage settings={defaultSkinSettings} r2Sensor={null} onUpdateSettings={onUpdateSettings} />);

    await userEvent.clear(screen.getByLabelText("Skin title"));
    await userEvent.type(screen.getByLabelText("Skin title"), "Roy's DE1");

    expect(onUpdateSettings).toHaveBeenLastCalledWith({ ...defaultSkinSettings, skinTitle: "Roy's DE1" });
  });
});
