import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProfilePresetGrid } from "../components/ProfilePresetGrid";
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
