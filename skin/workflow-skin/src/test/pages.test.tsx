import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import skinManifest from "../../skin-manifest.json";
import { ProfilePresetGrid } from "../components/ProfilePresetGrid";
import { BagsPage } from "../pages/BagsPage";
import { BrewPage } from "../pages/BrewPage";
import { GrindersPage } from "../pages/GrindersPage";
import { LivePage } from "../pages/LivePage";
import { ProfilesPage } from "../pages/ProfilesPage";
import { ScreensaverPage } from "../pages/ScreensaverPage";
import { SettingsPage } from "../pages/SettingsPage";
import { SteamPage } from "../pages/SteamPage";
import { screensaverArt } from "../lib/screensaverArt";
import type { ProfileRecord } from "../api/types";
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
        activeProfile={profiles[0]}
        latestShot={null}
        liveMeasurements={[
          {
            machine: { timestamp: "2026-06-11T10:00:00.000Z", pressure: 2, flow: 1.2 },
            scale: { weight: 4 }
          },
          {
            machine: { timestamp: "2026-06-11T10:00:28.000Z", pressure: 8.5, flow: 2.1 },
            scale: { weight: 36 }
          }
        ]}
        scaleSnapshot={{ weight: 36, weightFlow: 1.8, timerValue: 28000 }}
      />
    );

    expect(screen.getByRole("heading", { name: "Live Brew" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Shot pressure graph" })).toBeInTheDocument();
    expect(screen.getByText("Blooming")).toBeInTheDocument();
    expect(screen.getByLabelText("Weight: 36 g")).toBeInTheDocument();
    expect(screen.getByLabelText("Brew Time: 28 s")).toBeInTheDocument();
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
    expect(screen.getByRole("alert")).toHaveTextContent("to consider this a bag for suggestions and future features fill all mandatory fields");
    expect(screen.getByText("Mandatory for bag suggestions: roaster, bean, process, and roast date.")).toBeInTheDocument();
  });

  it("includes an optional bag name field and marks mandatory bag fields", () => {
    render(<BagsPage bags={[]} onSaveBag={vi.fn()} />);

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByText("Roaster *")).toBeInTheDocument();
    expect(screen.getByText("Bean *")).toBeInTheDocument();
    expect(screen.getByText("Process *")).toBeInTheDocument();
    expect(screen.getByText("Roast Date *")).toBeInTheDocument();
  });

  it("edits existing bag and grinder records", async () => {
    const onUpdateBag = vi.fn().mockResolvedValue(undefined);
    const onCreateGrinder = vi.fn().mockResolvedValue(undefined);
    const onUpdateGrinder = vi.fn().mockResolvedValue(undefined);
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
          onArchiveBag: vi.fn(),
          onCreateGrinder,
          onUpdateGrinder,
          onArchiveGrinder: vi.fn()
        } as any)}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit Pilot Halo" }));
    const form = screen.getByRole("form", { name: /Edit a bag/i });
    await userEvent.clear(within(form).getByLabelText("Roaster"));
    await userEvent.type(within(form).getByLabelText("Roaster"), "April");
    await userEvent.click(within(form).getByRole("button", { name: "Save" }));

    expect(onUpdateBag).toHaveBeenCalledWith(expect.objectContaining({ id: "batch-1", beanId: "bean-1", roaster: "April" }));

    await userEvent.click(screen.getByRole("button", { name: "Edit ZP6" }));
    await userEvent.clear(screen.getByLabelText("Grinder model"));
    await userEvent.type(screen.getByLabelText("Grinder model"), "ZP6 Special");
    await userEvent.click(screen.getByRole("button", { name: "Save grinder" }));

    expect(onUpdateGrinder).toHaveBeenCalledWith("grinder-1", expect.objectContaining({ model: "ZP6 Special" }));
    expect(screen.getByRole("button", { name: "Add new grinder" })).toBeInTheDocument();
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
});

describe("SettingsPage", () => {
  it("edits the centered skin title shown above the menu", async () => {
    const onUpdateSettings = vi.fn();
    render(<SettingsPage settings={defaultSkinSettings} r2Sensor={null} onUpdateSettings={onUpdateSettings} />);

    await userEvent.clear(screen.getByLabelText("Skin title"));
    await userEvent.type(screen.getByLabelText("Skin title"), "Roy's DE1");

    expect(onUpdateSettings).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(onUpdateSettings).toHaveBeenLastCalledWith({ ...defaultSkinSettings, skinTitle: "Roy's DE1" });
  });

  it("shows the skin creator credit", () => {
    render(<SettingsPage settings={defaultSkinSettings} r2Sensor={null} onUpdateSettings={vi.fn()} />);

    expect(screen.getByText("Creator")).toBeInTheDocument();
    expect(screen.getByText("Roy Ackerman")).toBeInTheDocument();
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
    const brightnessSlider = screen.getByRole("slider", { name: "Screensaver brightness" });
    expect(brightnessSlider).toHaveValue("8");
    fireEvent.change(brightnessSlider, { target: { value: "24" } });

    expect(onUpdateSettings).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(onUpdateSettings).toHaveBeenLastCalledWith(expect.objectContaining({ screensaverBrightness: 24 }));
    expect(screen.getByText("Visualizer upload")).toBeInTheDocument();
    expect(screen.getByText("Loaded · Auto-load on · v1.3.0")).toBeInTheDocument();
    expect(screen.getByText("Credentials configured · Auto upload on · Back-sync on")).toBeInTheDocument();
    expect(screen.getByText("Last upload vis-1 from shot-1")).toBeInTheDocument();
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
          webuiSkins: [{ id: "workflow-skin", name: "Workflow Skin", version: "0.1.9", path: "/skins/workflow", isBundled: false }],
          defaultWebuiSkin: { id: "workflow-skin", name: "Workflow Skin", version: "0.1.9", path: "/skins/workflow", isBundled: false },
          skinUpdateStatus: { type: "success", message: "Skin update check completed." },
          onUpdateSettings,
          onCheckSkinUpdates,
          onInstallSkinUpdate
        } as any)}
      />
    );

    expect(screen.getByText("Skin updates")).toBeInTheDocument();
    expect(screen.getByText("Installed: Workflow Skin v0.1.9")).toBeInTheDocument();
    expect(screen.getByText("Default skin: Workflow Skin")).toBeInTheDocument();
    expect(screen.getByText("Skin update check completed.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Auto update this skin on startup" }));

    await userEvent.clear(screen.getByLabelText("GitHub repo"));
    await userEvent.type(screen.getByLabelText("GitHub repo"), "roy/new-workflow-skin");
    await userEvent.clear(screen.getByLabelText("Release asset"));
    await userEvent.type(screen.getByLabelText("Release asset"), "workflow-skin-v2.zip");

    expect(onUpdateSettings).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Install/update from GitHub release" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(onUpdateSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        skinAutoUpdateEnabled: true,
        skinUpdateRepo: "roy/new-workflow-skin",
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
      defaultWebuiSkin: { id: "workflow-skin", name: "Workflow Skin", version: currentSkinVersion, path: "/skins/workflow", isBundled: false }
    };
    const { rerender } = render(
      <SettingsPage
        {...commonProps}
        webuiSkins={[{ id: "workflow-skin", name: "Workflow Skin", version: currentSkinVersion, path: "/skins/workflow", isBundled: false }]}
      />
    );

    expect(screen.getByText("The skin is up-to-date.")).toBeInTheDocument();

    rerender(
      <SettingsPage
        {...commonProps}
        webuiSkins={[{ id: "workflow-skin", name: "Workflow Skin", version: "0.1.16", path: "/skins/workflow", isBundled: false }]}
      />
    );

    expect(screen.getByText(`Update available: v${currentSkinVersion} is available (installed v0.1.16).`)).toBeInTheDocument();
  });

  it("shows the downloading state while a skin update is installing", () => {
    render(
      <SettingsPage
        {...({
          settings: defaultSkinSettings,
          r2Sensor: null,
          onUpdateSettings: vi.fn(),
          webuiSkins: [{ id: "workflow-skin", name: "Workflow Skin", version: "0.1.15", path: "/skins/workflow", isBundled: false }],
          skinUpdatePhase: "downloading"
        } as any)}
      />
    );

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

  it("enables main menu editing in the sidebar from settings", async () => {
    const onToggleMainMenuEditing = vi.fn();
    const { rerender } = render(
      <SettingsPage
        settings={defaultSkinSettings}
        r2Sensor={null}
        onUpdateSettings={vi.fn()}
        mainMenuEditing={false}
        onToggleMainMenuEditing={onToggleMainMenuEditing}
      />
    );

    expect(screen.getByText("Main menu")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit main menu in sidebar" }));
    expect(onToggleMainMenuEditing).toHaveBeenCalledWith(true);

    rerender(
      <SettingsPage
        settings={defaultSkinSettings}
        r2Sensor={null}
        onUpdateSettings={vi.fn()}
        mainMenuEditing
        onToggleMainMenuEditing={onToggleMainMenuEditing}
      />
    );

    expect(screen.getByRole("button", { name: "Done editing main menu" })).toBeInTheDocument();
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
    render(<ScreensaverPage title="Workflow" onWake={vi.fn()} />);

    expect(screen.getByLabelText("Screensaver mode")).toHaveStyle({ backgroundColor: "#020506" });
  });
});
