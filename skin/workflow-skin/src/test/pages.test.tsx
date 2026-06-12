import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import skinManifest from "../../skin-manifest.json";
import { ProfilePresetGrid } from "../components/ProfilePresetGrid";
import { BagsPage } from "../pages/BagsPage";
import { BrewPage } from "../pages/BrewPage";
import { GrindersPage } from "../pages/GrindersPage";
import { HistoryPage } from "../pages/HistoryPage";
import { LivePage } from "../pages/LivePage";
import { ProfilesPage } from "../pages/ProfilesPage";
import { ScreensaverPage } from "../pages/ScreensaverPage";
import { SettingsPage } from "../pages/SettingsPage";
import { SteamPage } from "../pages/SteamPage";
import { screensaverArt } from "../lib/screensaverArt";
import { screensaverQuotes } from "../lib/screensaverQuotes";
import type { ProfileRecord, ShotRecord } from "../api/types";
import { defaultSkinSettings } from "../state/skinSettings";

const profiles: ProfileRecord[] = [
  { id: "p1", profile: { title: "Blooming" } },
  { id: "p2", profile: { title: "Classic" } }
];
const currentSkinVersion = skinManifest.version;

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

  it("highlights the preset using the selected workflow profile", () => {
    render(
      <ProfilePresetGrid
        slots={[
          { label: "Light", profileId: "p1" },
          { label: "Sweet", profileId: "p2" }
        ]}
        profiles={profiles}
        selectedProfileId="p2"
        onApply={vi.fn()}
        onEditSlot={vi.fn()}
      />
    );

    const selectedPreset = screen.getByRole("button", { name: /Sweet Classic/i });

    expect(selectedPreset).toHaveAttribute("aria-current", "true");
    expect(selectedPreset.closest(".preset-button")).toHaveClass("selected");
    expect(screen.getByRole("button", { name: /Light Blooming/i })).not.toHaveAttribute("aria-current");
  });
});

describe("BrewPage", () => {
  it("highlights the preset that matches the selected workflow profile", () => {
    const onStartBrew = vi.fn();
    render(
      <BrewPage
        workflow={{ context: { extras: { workflowSkin: { selectedProfileId: "p2" } } } }}
        profiles={profiles}
        bags={[]}
        shots={[]}
        settings={{
          ...defaultSkinSettings,
          shownProfileIds: ["p1", "p2"],
          presetSlots: [
            { label: "Light", profileId: "p1" },
            { label: "Sweet", profileId: "p2" }
          ]
        }}
        onApplyProfile={vi.fn()}
        onEditSlot={vi.fn()}
        onStartBrew={onStartBrew}
      />
    );

    expect(screen.getByRole("button", { name: /Sweet Classic/i })).toHaveAttribute("aria-current", "true");
  });

  it("shows a dedicated start brew button", async () => {
    const onStartBrew = vi.fn();
    render(
      <BrewPage
        workflow={{ context: { targetDoseWeight: 18, targetYield: 36 } }}
        profiles={profiles}
        bags={[]}
        shots={[]}
        settings={{ ...defaultSkinSettings, shownProfileIds: ["p1", "p2"] }}
        onApplyProfile={vi.fn()}
        onEditSlot={vi.fn()}
        onStartBrew={onStartBrew}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Start Brew" }));

    expect(onStartBrew).toHaveBeenCalledTimes(1);
  });
});

describe("LivePage", () => {
  it("renders a nonblank waiting state when no live samples are available", () => {
    render(<LivePage workflow={{ context: { targetDoseWeight: 18, targetYield: 36 } }} latestShot={null} liveMeasurements={[]} scaleSnapshot={null} />);

    expect(screen.getByRole("heading", { name: "Live Brew" })).toBeInTheDocument();
    expect(screen.getByText("Waiting for live espresso data")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Shot pressure graph" })).toBeInTheDocument();
  });

  it("shows live brew graph and key details", () => {
    render(
      <LivePage
        workflow={{ context: { targetDoseWeight: 18, targetYield: 36 } }}
        activeProfile={{
          id: "p1",
          profile: {
            title: "Blooming",
            steps: [
              { name: "Preinfusion", pump: "pressure", transition: "smooth", seconds: 8, pressure: 3, temperature: 92, sensor: "coffee" },
              {
                name: "Ramp",
                pump: "flow",
                transition: "fast",
                seconds: 20,
                flow: 2.5,
                temperature: 93,
                weight: 36,
                sensor: "coffee",
                exit: { type: "flow", condition: "under", value: 1.4 },
                limiter: { value: 9, range: 0.6 }
              }
            ]
          }
        }}
        latestShot={null}
        liveMeasurements={[
          {
            machine: { timestamp: "2026-06-11T10:00:00.000Z", pressure: 2, flow: 1.2 },
            scale: { weight: 4 }
          },
          {
            machine: {
              timestamp: "2026-06-11T10:00:28.000Z",
              pressure: 8.567,
              targetPressure: 9,
              flow: 2.1,
              targetFlow: 2.4,
              groupTemperature: 92.236,
              targetGroupTemperature: 93,
              mixTemperature: 88.124,
              targetMixTemperature: 93,
              state: { state: "PreparingForShot", substate: "heating" }
            },
            scale: { weight: 36, weightFlow: 1.4 }
          }
        ]}
        scaleSnapshot={{ weight: 36.346, weightFlow: 1.847, timerValue: 28000 }}
      />
    );

    expect(screen.getByRole("heading", { name: "Live Brew" })).toBeInTheDocument();
    const graph = screen.getByRole("img", { name: "Shot pressure graph" });
    expect(graph).toBeInTheDocument();
    expect(graph.closest("section")).toHaveClass("dark-graph-panel");
    expect(graph.closest("section")).not.toHaveClass("light-graph-panel");
    expect(graph.querySelector(".shot-graph-series.pressure")).toHaveAttribute("stroke", "#76d99b");
    expect(graph.querySelector(".shot-graph-series.groupTemperature")).toHaveAttribute("stroke", "#f0a46c");
    expect(graph.querySelectorAll(".shot-graph-series")).toHaveLength(7);
    expect(within(graph).getByText("Target pressure")).toBeInTheDocument();
    expect(within(graph).getByText("Target flow")).toBeInTheDocument();
    expect(within(graph).getByText("Temp / 10")).toBeInTheDocument();
    expect(within(graph).getByText("Target temp")).toBeInTheDocument();
    expect(within(graph).getByText("Weight flow")).toBeInTheDocument();
    expect(screen.getByText("Blooming")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Step" })).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 2")).toBeInTheDocument();
    expect(screen.getByText("Ramp")).toBeInTheDocument();
    expect(screen.getByText("Flow 2.50 mL/s")).toBeInTheDocument();
    expect(screen.getByText("Temp 93.00 °C")).toBeInTheDocument();
    expect(screen.getByText("Weight 36.00 g")).toBeInTheDocument();
    expect(screen.getByText("Exit flow under 1.40")).toBeInTheDocument();
    expect(screen.getByText("Limiter 9.00 +/- 0.60")).toBeInTheDocument();
    expect(screen.getByText("Ends at 28s")).toBeInTheDocument();
    expect(screen.getByLabelText("Weight: 36.35 g")).toBeInTheDocument();
    expect(screen.getByLabelText("Pressure: 8.57 bar")).toBeInTheDocument();
    expect(screen.getByLabelText("Flow: 1.85 g/s")).toBeInTheDocument();
    expect(screen.getByLabelText("Group Temp: 92.24 °C")).toBeInTheDocument();
    expect(screen.getByLabelText("Mix Temp: 88.12 °C")).toBeInTheDocument();
    expect(screen.getByLabelText("State: Heating")).toBeInTheDocument();
    expect(screen.getByLabelText("Substate: Heating")).toBeInTheDocument();
    expect(screen.queryByText("PreparingForShot")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Shot Timer: 28 s")).toBeInTheDocument();
  });
});

describe("BagsPage", () => {
  it("saves a valid draft bag through the provided callback", async () => {
    const onSaveBag = vi.fn().mockResolvedValue(undefined);
    render(<BagsPage bags={[]} onSaveBag={onSaveBag} />);
    const form = screen.getByRole("form", { name: /Create a bag/i });

    await userEvent.type(within(form).getByLabelText("Bag Name"), "Morning bag");
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
        name: "Morning bag",
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
    expect(screen.getByRole("alert")).toHaveTextContent("to consider this a bag for suggestions and future features fill all mandatory fields");
    expect(screen.getByText("Mandatory for bag suggestions: roaster, bean, process, and roast date.")).toBeInTheDocument();
  });

  it("includes an optional bag name field and marks mandatory bag fields", () => {
    render(<BagsPage bags={[]} onSaveBag={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Create a bag" })).toBeInTheDocument();
    expect(screen.getByLabelText("Bag Name")).toBeInTheDocument();
    expect(screen.getByText("Roaster *")).toBeInTheDocument();
    expect(screen.getByText("Bean *")).toBeInTheDocument();
    expect(screen.getByText("Process *")).toBeInTheDocument();
    expect(screen.getByText("Roast Date *")).toBeInTheDocument();
  });

  it("edits existing bag records without showing grinder setup", async () => {
    const onUpdateBag = vi.fn().mockResolvedValue(undefined);
    render(
      <BagsPage
        {...({
          bags: [
            {
              id: "batch-1",
              beanId: "bean-1",
              roaster: "Pilot",
              bean: "Halo",
              country: "Ethiopia",
              process: "Washed",
              roastDate: "2026-06-01",
              roastLevel: "Light"
            }
          ],
          grinders: [{ id: "grinder-1", model: "ZP6", settingType: "numeric", notes: "Travel" }],
          onSaveBag: vi.fn(),
          onUpdateBag,
          onArchiveBag: vi.fn()
        } as any)}
      />
    );

    expect(screen.queryByRole("heading", { name: "Grinders" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Grinder model")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Edit Pilot Halo" }));
    const form = screen.getByRole("form", { name: /Edit a bag/i });
    await userEvent.clear(within(form).getByLabelText("Roaster"));
    await userEvent.type(within(form).getByLabelText("Roaster"), "April");
    await userEvent.click(within(form).getByRole("button", { name: "Save" }));

    expect(onUpdateBag).toHaveBeenCalledWith(expect.objectContaining({ id: "batch-1", beanId: "bean-1", roaster: "April" }));
  });
});

describe("HistoryPage", () => {
  const historyBags = [
    {
      id: "bag-1",
      beanId: "bean-1",
      name: "Morning bag",
      roaster: "Pilot",
      bean: "Halo",
      country: "Ethiopia",
      region: "Yirgacheffe",
      process: "Washed",
      roastDate: "2026-06-01",
      roastLevel: "Light"
    },
    {
      id: "bag-2",
      beanId: "bean-2",
      name: "Night bag",
      roaster: "April",
      bean: "Finca Las Flores",
      country: "Colombia",
      region: "Huila",
      process: "Natural",
      roastDate: "2026-05-18",
      roastLevel: "Medium"
    }
  ];
  const historyShots: ShotRecord[] = [
    {
      id: "shot-1",
      timestamp: "2026-06-12T08:00:00.000Z",
      workflow: { profile: { title: "Blooming espresso" }, context: { beanBatchId: "bag-1" } },
      annotations: { drinkEy: 20.1, espressoNotes: "Citrus" }
    },
    {
      id: "shot-2",
      timestamp: "2026-06-12T09:00:00.000Z",
      workflow: { profile: { title: "Turbo flow" }, context: { beanBatchId: "bag-2" } },
      annotations: { drinkEy: 18.4 }
    }
  ];

  it("searches history by profile and every bag filter", async () => {
    render(<HistoryPage shots={historyShots} bags={historyBags} />);

    expect(screen.getByText("Blooming espresso")).toBeInTheDocument();
    expect(screen.getByText("Turbo flow")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("History search"), "citrus");
    expect(screen.getByText("Blooming espresso")).toBeInTheDocument();
    expect(screen.queryByText("Turbo flow")).not.toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("History search"));

    await userEvent.type(screen.getByLabelText("Profile"), "turbo");
    expect(screen.queryByText("Blooming espresso")).not.toBeInTheDocument();
    expect(screen.getByText("Turbo flow")).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Profile"));

    for (const [label, value, visibleProfile, hiddenProfile] of [
      ["Bag Name", "morning", "Blooming espresso", "Turbo flow"],
      ["Roaster", "april", "Turbo flow", "Blooming espresso"],
      ["Bean", "halo", "Blooming espresso", "Turbo flow"],
      ["Country", "colombia", "Turbo flow", "Blooming espresso"],
      ["Region", "yirgacheffe", "Blooming espresso", "Turbo flow"],
      ["Process", "natural", "Turbo flow", "Blooming espresso"],
      ["Roast Date", "2026-06-01", "Blooming espresso", "Turbo flow"],
      ["Roast Type", "medium", "Turbo flow", "Blooming espresso"]
    ] as const) {
      await userEvent.type(screen.getByLabelText(label), value);
      expect(screen.getByText(visibleProfile)).toBeInTheDocument();
      expect(screen.queryByText(hiddenProfile)).not.toBeInTheDocument();
      await userEvent.clear(screen.getByLabelText(label));
    }
  });
});

describe("SteamPage", () => {
  it("shows recent ReaPrime steam history", () => {
    render(
      <SteamPage
        {...({
          profileTitle: "Flat white",
          timers: { small: 20, medium: 30, large: 40 },
          onReview: vi.fn(),
          steamHistory: [
            {
              id: "steam-1",
              timestamp: "2026-06-11T08:15:00.000Z",
              measurements: [{ steam: { temperature: 42 } }, { steam: { temperature: 58 } }],
              annotations: { notes: "Silky 150ml" }
            }
          ]
        } as any)}
      />
    );

    expect(screen.getByRole("heading", { name: "Steam History" })).toBeInTheDocument();
    expect(screen.getByText("Silky 150ml")).toBeInTheDocument();
    expect(screen.getByText(/2 samples/i)).toBeInTheDocument();
  });
});

describe("ProfilesPage", () => {
  it("searches profiles and filters pressure based profiles", async () => {
    render(
      <ProfilesPage
        profiles={[
          { id: "pressure", profile: { title: "Spring Lever", steps: [{ pressure: 8 }] } },
          { id: "flow", profile: { title: "Turbo Flow", steps: [{ flow: 4 }] } }
        ]}
        settings={defaultSkinSettings}
        onToggleReview={vi.fn()}
        onSetStartupProfile={vi.fn()}
        onSetProfileShown={vi.fn()}
        onUpdateProfileWorkflow={vi.fn()}
        onSaveProfile={vi.fn()}
      />
    );

    await userEvent.type(screen.getByLabelText("Search profiles"), "spring");
    expect(screen.getByText("Spring Lever")).toBeInTheDocument();
    expect(screen.queryByText("Turbo Flow")).not.toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Search profiles"));
    await userEvent.selectOptions(screen.getByLabelText("Profile type"), "pressure");

    expect(screen.getByText("Spring Lever")).toBeInTheDocument();
    expect(screen.queryByText("Turbo Flow")).not.toBeInTheDocument();
  });

  it("selects a startup default profile", async () => {
    const onSetStartupProfile = vi.fn();
    render(
      <ProfilesPage
        profiles={profiles}
        settings={defaultSkinSettings}
        onToggleReview={vi.fn()}
        onSetStartupProfile={onSetStartupProfile}
        onSetProfileShown={vi.fn()}
        onUpdateProfileWorkflow={vi.fn()}
        onSaveProfile={vi.fn()}
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
        onSetProfileShown={vi.fn()}
        onUpdateProfileWorkflow={onUpdateProfileWorkflow}
        onSaveProfile={vi.fn()}
      />
    );

    const row = screen.getByRole("group", { name: "Blooming profile workflow" });
    fireEvent.change(within(row).getByLabelText("Medium jug seconds"), { target: { value: "36" } });

    expect(onUpdateProfileWorkflow).toHaveBeenLastCalledWith("p1", {
      milkBased: true,
      steamTimers: { small: 20, medium: 36, large: 40 }
    });
  });

  it("toggles whether a profile is shown in the skin picker", async () => {
    const onSetProfileShown = vi.fn();
    render(
      <ProfilesPage
        profiles={profiles}
        settings={defaultSkinSettings}
        onToggleReview={vi.fn()}
        onSetStartupProfile={vi.fn()}
        onSetProfileShown={onSetProfileShown}
        onUpdateProfileWorkflow={vi.fn()}
        onSaveProfile={vi.fn()}
      />
    );

    const row = screen.getByRole("group", { name: "Blooming profile workflow" });
    const toggle = within(row).getByRole("checkbox", { name: "Show in preset picker" });

    expect(toggle).not.toBeChecked();
    await userEvent.click(toggle);

    expect(onSetProfileShown).toHaveBeenCalledWith("p1", true);
  });

  it("edits and saves profile details", async () => {
    const onSaveProfile = vi.fn().mockResolvedValue(undefined);
    render(
      <ProfilesPage
        profiles={profiles}
        settings={defaultSkinSettings}
        onToggleReview={vi.fn()}
        onSetStartupProfile={vi.fn()}
        onSetProfileShown={vi.fn()}
        onUpdateProfileWorkflow={vi.fn()}
        onSaveProfile={onSaveProfile}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit Blooming" }));
    await userEvent.clear(screen.getByLabelText("Profile title"));
    await userEvent.type(screen.getByLabelText("Profile title"), "Blooming v2");
    await userEvent.type(screen.getByLabelText("Author"), "Roy");
    await userEvent.click(screen.getByRole("button", { name: "Save Blooming" }));

    expect(onSaveProfile).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({
        title: "Blooming v2",
        author: "Roy"
      })
    );
  });

  it("edits profile steps, exits, and limits while preserving unknown step fields", async () => {
    const onSaveProfile = vi.fn().mockResolvedValue(undefined);
    render(
      <ProfilesPage
        profiles={[
          {
            id: "p1",
            profile: {
              title: "Blooming",
              steps: [
                {
                  name: "Bloom",
                  pump: "pressure",
                  transition: "smooth",
                  seconds: 10,
                  weight: 0,
                  volume: 40,
                  temperature: 92,
                  sensor: "coffee",
                  pressure: 2,
                  exit: { type: "pressure", condition: "over", value: 3 },
                  limiter: { value: 8, range: 0.6 },
                  customField: "keep-me"
                }
              ]
            }
          }
        ]}
        settings={defaultSkinSettings}
        onToggleReview={vi.fn()}
        onSetStartupProfile={vi.fn()}
        onSetProfileShown={vi.fn()}
        onUpdateProfileWorkflow={vi.fn()}
        onSaveProfile={onSaveProfile}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit Blooming" }));

    expect(screen.getByRole("heading", { name: "Profile Steps" })).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Step 1 name"));
    await userEvent.type(screen.getByLabelText("Step 1 name"), "Saturate");
    fireEvent.change(screen.getByLabelText("Step 1 pressure goal"), { target: { value: "3.5" } });
    fireEvent.change(screen.getByLabelText("Step 1 limiter value"), { target: { value: "9" } });
    fireEvent.change(screen.getByLabelText("Step 1 limiter range"), { target: { value: "0.4" } });
    fireEvent.change(screen.getByLabelText("Step 1 exit type"), { target: { value: "flow" } });
    fireEvent.change(screen.getByLabelText("Step 1 exit condition"), { target: { value: "under" } });
    fireEvent.change(screen.getByLabelText("Step 1 exit value"), { target: { value: "1.4" } });
    await userEvent.click(screen.getByRole("button", { name: "Add step" }));
    await userEvent.click(screen.getByRole("button", { name: "Save Blooming" }));

    expect(onSaveProfile).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({
        steps: [
          expect.objectContaining({
            name: "Saturate",
            pump: "pressure",
            pressure: 3.5,
            exit: { type: "flow", condition: "under", value: 1.4 },
            limiter: { value: 9, range: 0.4 },
            customField: "keep-me"
          }),
          expect.objectContaining({
            name: "New step",
            pump: "pressure"
          })
        ]
      })
    );
  });
});

describe("SettingsPage", () => {
  it("does not show the removed skin title setting", () => {
    render(<SettingsPage settings={defaultSkinSettings} r2Sensor={null} onUpdateSettings={vi.fn()} />);

    fireEvent.click(screen.getByRole("tab", { name: "Skin settings" }));

    expect(screen.queryByLabelText("Skin title")).not.toBeInTheDocument();
  });

  it("does not show the removed creator setting", async () => {
    render(<SettingsPage settings={defaultSkinSettings} r2Sensor={null} onUpdateSettings={vi.fn()} />);

    expect(screen.queryByText("Creator")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Skin settings" }));
    expect(screen.queryByText("Roy Ackerman")).not.toBeInTheDocument();
  });

  it("shows native display controls and Visualizer plugin status", async () => {
    const onUpdateSettings = vi.fn();
    render(
      <SettingsPage
        {...({
          settings: { ...defaultSkinSettings, keepScreenAwake: true, screensaverBrightness: 8 },
          r2Sensor: null,
          visualizerPlugin: { id: "visualizer.reaplugin", name: "Visualizer upload", loaded: true, autoLoad: true, version: "1.3.0" },
          visualizerSettings: { Username: "roy", Password: "secret", AutoUpload: true, BackSync: true },
          visualizerStatus: {
            status: { status: "online" },
            lastUpload: { reaId: "shot-1", visId: "vis-1" },
            backSyncStatus: { enabled: true, lastResult: "applied 2", lastError: null },
            forwardSyncStatus: { lastResult: "synced", lastError: null }
          },
          displayState: { brightness: 72, wakeLockOverride: true },
          onUpdateSettings
        } as any)}
      />
    );

    expect(screen.getByText("Native display")).toBeInTheDocument();
    expect(screen.getByText("Brightness 72%")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Keep screen awake while the skin is open" })).toBeChecked();
    expect(screen.getByLabelText("Auto sleep after last use")).toHaveValue(30);
    const brightnessSlider = screen.getByRole("slider", { name: "Screensaver brightness" });
    expect(brightnessSlider).toHaveValue("8");
    fireEvent.change(brightnessSlider, { target: { value: "24" } });

    expect(onUpdateSettings).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(onUpdateSettings).toHaveBeenLastCalledWith(expect.objectContaining({ screensaverBrightness: 24 }));
    await userEvent.click(screen.getByRole("tab", { name: "App settings" }));
    expect(screen.getByText("Visualizer upload")).toBeInTheDocument();
    expect(screen.getByText("Loaded · Auto-load on · v1.3.0")).toBeInTheDocument();
    expect(screen.getByText("Credentials configured · Auto upload on · Back-sync on")).toBeInTheDocument();
    expect(screen.getByText("Last upload vis-1 from shot-1")).toBeInTheDocument();
  });

  it("edits the auto sleep timer before saving settings", async () => {
    const onUpdateSettings = vi.fn();
    render(<SettingsPage settings={defaultSkinSettings} r2Sensor={null} onUpdateSettings={onUpdateSettings} />);

    fireEvent.change(screen.getByLabelText("Auto sleep after last use"), { target: { value: "45" } });

    expect(onUpdateSettings).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(onUpdateSettings).toHaveBeenLastCalledWith(expect.objectContaining({ autoSleepMinutes: 45 }));
  });

  it("edits skin updater settings and triggers native update actions", async () => {
    const onUpdateSettings = vi.fn();
    const onCheckSkinUpdates = vi.fn().mockResolvedValue(undefined);
    const onInstallSkinUpdate = vi.fn().mockResolvedValue(undefined);
    render(
      <SettingsPage
        {...({
          settings: {
            ...defaultSkinSettings,
            skinUpdateRepo: "roy/workflow-skin",
            skinUpdateAsset: "workflow-skin.zip",
            skinUpdatePrerelease: false
          },
          r2Sensor: null,
          webuiSkins: [{ id: "workflow-skin", name: "WorkFlow", version: "0.1.9", path: "/skins/workflow", isBundled: false }],
          defaultWebuiSkin: { id: "workflow-skin", name: "WorkFlow", version: "0.1.9", path: "/skins/workflow", isBundled: false },
          skinUpdateStatus: { type: "success", message: "Skin update check completed." },
          onUpdateSettings,
          onCheckSkinUpdates,
          onInstallSkinUpdate
        } as any)}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Skin settings" }));
    expect(screen.getByText("Skin updates")).toBeInTheDocument();
    expect(screen.getByText("Installed: WorkFlow v0.1.9")).toBeInTheDocument();
    expect(screen.getByText("Default skin: WorkFlow")).toBeInTheDocument();
    expect(screen.getByText("Skin update check completed.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Auto update this skin on startup" }));

    await userEvent.clear(screen.getByLabelText("GitHub repo"));
    await userEvent.type(screen.getByLabelText("GitHub repo"), "roy/new-workflow-skin");
    await userEvent.clear(screen.getByLabelText("GitHub branch"));
    await userEvent.type(screen.getByLabelText("GitHub branch"), "release/test-skin");
    await userEvent.clear(screen.getByLabelText("Release asset"));
    await userEvent.type(screen.getByLabelText("Release asset"), "workflow-skin-v2.zip");

    expect(onUpdateSettings).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Install/update from GitHub release" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(onUpdateSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        skinAutoUpdateEnabled: true,
        skinUpdateRepo: "roy/new-workflow-skin",
        skinUpdateBranch: "release/test-skin",
        skinUpdateAsset: "workflow-skin-v2.zip"
      })
    );

    await userEvent.click(screen.getByRole("button", { name: "Check for skin updates" }));
    await userEvent.click(screen.getByRole("button", { name: "Install/update from GitHub release" }));

    expect(onCheckSkinUpdates).toHaveBeenCalledTimes(1);
    expect(onInstallSkinUpdate).toHaveBeenCalledTimes(1);
  });

  it("shows whether the workflow skin is up-to-date or has an available update", () => {
    const commonProps = {
      settings: defaultSkinSettings,
      r2Sensor: null,
      onUpdateSettings: vi.fn(),
      defaultWebuiSkin: { id: "workflow-skin", name: "WorkFlow", version: currentSkinVersion, path: "/skins/workflow", isBundled: false }
    };
    const { rerender } = render(
      <SettingsPage
        {...commonProps}
        webuiSkins={[{ id: "workflow-skin", name: "WorkFlow", version: currentSkinVersion, path: "/skins/workflow", isBundled: false }]}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Skin settings" }));
    expect(screen.getByText("The skin is up-to-date.")).toBeInTheDocument();

    rerender(
      <SettingsPage
        {...commonProps}
        webuiSkins={[{ id: "workflow-skin", name: "WorkFlow", version: "0.1.16", path: "/skins/workflow", isBundled: false }]}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Skin settings" }));
    expect(screen.getByText(`Update available: v${currentSkinVersion} is available (installed v0.1.16).`)).toBeInTheDocument();
  });

  it("uses the checked GitHub release version when the installed skin is stale but the running bundle is also stale", () => {
    render(
      <SettingsPage
        settings={defaultSkinSettings}
        r2Sensor={null}
        onUpdateSettings={vi.fn()}
        webuiSkins={[{ id: "workflow-skin", name: "WorkFlow", version: currentSkinVersion, path: "/skins/workflow", isBundled: false }]}
        defaultWebuiSkin={{ id: "workflow-skin", name: "WorkFlow", version: currentSkinVersion, path: "/skins/workflow", isBundled: false }}
        availableSkinVersion="99.0.0"
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Skin settings" }));
    expect(screen.queryByText("The skin is up-to-date.")).not.toBeInTheDocument();
    expect(screen.getByText(`Update available: v99.0.0 is available (installed v${currentSkinVersion}).`)).toBeInTheDocument();
  });

  it("shows the downloading state while a skin update is installing", () => {
    render(
      <SettingsPage
        {...({
          settings: defaultSkinSettings,
          r2Sensor: null,
          onUpdateSettings: vi.fn(),
          webuiSkins: [{ id: "workflow-skin", name: "WorkFlow", version: "0.1.15", path: "/skins/workflow", isBundled: false }],
          skinUpdatePhase: "downloading"
        } as any)}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Skin settings" }));
    expect(screen.getByText("Downloading update...")).toBeInTheDocument();
  });

  it("edits the number of preset cards and their titles before saving settings", async () => {
    const onUpdateSettings = vi.fn();
    render(
      <SettingsPage
        settings={{
          ...defaultSkinSettings,
          presetSlotCount: 2,
          presetSlots: [
            { label: "Light", profileId: "p1" },
            { label: "Turbo", profileId: "p2" }
          ]
        }}
        r2Sensor={null}
        onUpdateSettings={onUpdateSettings}
      />
    );

    await userEvent.click(screen.getByRole("tab", { name: "Skin settings" }));
    fireEvent.change(screen.getByLabelText("Preset cards on main page"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Preset 2 title"), { target: { value: "Milk" } });

    expect(onUpdateSettings).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(onUpdateSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        presetSlotCount: 3,
        presetSlots: [
          { label: "Light", profileId: "p1" },
          { label: "Milk", profileId: "p2" },
          { label: "Turbo" }
        ]
      })
    );
  });

  it("edits skin font size and editable theme options before saving settings", async () => {
    const onUpdateSettings = vi.fn();
    render(<SettingsPage settings={defaultSkinSettings} r2Sensor={null} onUpdateSettings={onUpdateSettings} />);

    await userEvent.click(screen.getByRole("tab", { name: "Skin settings" }));
    fireEvent.change(screen.getByRole("slider", { name: "Skin font size" }), { target: { value: "112" } });
    await userEvent.clear(screen.getByLabelText("Slate Citrus theme name"));
    await userEvent.type(screen.getByLabelText("Slate Citrus theme name"), "Roy Slate");
    fireEvent.change(screen.getByLabelText("Slate Citrus accent color"), { target: { value: "#66ccff" } });
    await userEvent.click(screen.getByRole("checkbox", { name: "Scale" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Pressure" }));
    await userEvent.click(screen.getByRole("button", { name: "Use Roy Slate" }));
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(onUpdateSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        skinFontScale: 112,
        skinThemeId: "slate",
        customSkinThemes: expect.objectContaining({
          slate: expect.objectContaining({ name: "Roy Slate", accent: "#66ccff" })
        }),
        topStatusIndicatorIds: expect.arrayContaining(["pressure"])
      })
    );
    const savedSettings = onUpdateSettings.mock.calls[onUpdateSettings.mock.calls.length - 1]?.[0];
    expect(savedSettings.topStatusIndicatorIds).not.toContain("scale");
  });

  it("keeps main menu editing out of app settings", () => {
    render(<SettingsPage settings={defaultSkinSettings} r2Sensor={null} onUpdateSettings={vi.fn()} />);

    fireEvent.click(screen.getByRole("tab", { name: "App settings" }));

    expect(screen.queryByText("Main menu")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit main menu in sidebar" })).not.toBeInTheDocument();
  });
});

describe("BrewPage workflow controls", () => {
  it("edits recipe, changes the current bag, and shows bag-based grind guidance", async () => {
    const onUpdateRecipe = vi.fn();
    const onSelectBag = vi.fn();
    render(
      <BrewPage
        workflow={{ context: { beanBatchId: "bag-1", targetDoseWeight: 18, targetYield: 40 } }}
        profiles={profiles}
        bags={[
          { id: "bag-1", beanId: "bean-1", roaster: "Pilot", bean: "Halo", process: "Washed", roastDate: "2026-06-01" },
          { id: "bag-2", beanId: "bean-2", roaster: "April", bean: "Nansebo", process: "Natural", roastDate: "2026-06-02" }
        ]}
        grinders={[]}
        shots={[
          {
            id: "shot-1",
            timestamp: "2026-06-11T10:00:00Z",
            workflow: { context: { beanBatchId: "bag-1", targetDoseWeight: 19, targetYield: 42, grinderSetting: "5.2" } },
            annotations: { actualDoseWeight: 19, actualYield: 42 }
          },
          {
            id: "shot-2",
            timestamp: "2026-06-10T10:00:00Z",
            workflow: { context: { beanBatchId: "bag-1", targetDoseWeight: 18, targetYield: 40, grinderSetting: "5.4" } },
            annotations: { actualDoseWeight: 18, actualYield: 40 }
          }
        ]}
        settings={{ ...defaultSkinSettings, presetSlotCount: 2, shownProfileIds: ["p1", "p2"] }}
        onApplyProfile={vi.fn()}
        onEditSlot={vi.fn()}
        onStartBrew={vi.fn()}
        onUpdateRecipe={onUpdateRecipe}
        onSelectBag={onSelectBag}
      />
    );

    await userEvent.selectOptions(screen.getByLabelText("Current bag"), "bag-2");
    expect(onSelectBag).toHaveBeenCalledWith("bag-2");
    expect(screen.getByText("Suggested grind: 5.2")).toBeInTheDocument();
    expect(screen.getByText("Suggested recipe: 18.5g in / 41g out")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Dose"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Yield"), { target: { value: "45" } });
    await userEvent.click(screen.getByRole("button", { name: "Save recipe" }));

    expect(onUpdateRecipe).toHaveBeenCalledWith({ dose: 20, yield: 45 });
  });
});

describe("GrindersPage", () => {
  it("saves grinder burr data", async () => {
    const onCreateGrinder = vi.fn().mockResolvedValue(undefined);
    render(<GrindersPage grinders={[]} onCreateGrinder={onCreateGrinder} onUpdateGrinder={vi.fn()} onArchiveGrinder={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Grinder model"), "ZP6");
    await userEvent.type(screen.getByLabelText("Burrs"), "MP burrs");
    await userEvent.click(screen.getByRole("button", { name: "Save grinder" }));

    expect(onCreateGrinder).toHaveBeenCalledWith(expect.objectContaining({ model: "ZP6", burrs: "MP burrs" }));
  });
});

describe("ScreensaverPage", () => {
  it("has 15 dark generated coffee pictures for sleep mode", () => {
    expect(screensaverArt).toHaveLength(15);
    expect(screensaverQuotes.length).toBeGreaterThanOrEqual(15);
    render(<ScreensaverPage title="WorkFlow" onWake={vi.fn()} />);

    expect(screen.getByLabelText("Screensaver mode")).toHaveStyle({ backgroundColor: "#020506" });
  });

  it("always shows the WorkFlow brand on the screensaver", () => {
    render(<ScreensaverPage title="Roy Decent" onWake={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "WorkFlow" })).toBeInTheDocument();
    expect(screen.queryByText("Roy Decent")).not.toBeInTheDocument();
    const visibleQuote = screensaverQuotes.map((quote) => screen.queryByText(quote)).find(Boolean);
    expect(visibleQuote).toHaveClass("screensaver-subtitle");
  });
});
