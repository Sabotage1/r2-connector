import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import skinManifest from "../../skin-manifest.json";
import { App } from "../App";
import type { AppInfo, DeviceInfo, MachineState, ProfileRecord, SensorListItem, ShotRecord, WebUISkin } from "../api/types";
import { defaultSkinSettings, type SkinSettings } from "../state/skinSettings";

let profiles: ProfileRecord[] = [
  { id: "p1", profile: { title: "Blooming" } },
  { id: "p2", profile: { title: "Classic" } }
];

function responseJson(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), { status }));
}

function mockReaFetch(
  initialSettings: SkinSettings,
  options: {
    failSettingsPut?: boolean;
    failBatchCreate?: boolean;
    settingsStorageMissing?: boolean;
    rejectProfileUpdate?: boolean;
    updatedProfileId?: string;
    machineState?: MachineState;
    appInfo?: AppInfo;
    devices?: DeviceInfo[];
    devicesAfterScan?: DeviceInfo[];
    scanDevicesResult?: DeviceInfo[];
    sensors?: SensorListItem[];
    sensorsAfterScan?: SensorListItem[];
    shots?: ShotRecord[];
    workflow?: unknown;
    workflowUpdateStaleCount?: number;
    steams?: unknown[];
    plugins?: unknown[];
    pluginSettings?: unknown;
    visualizerStatus?: Record<string, unknown>;
    displayState?: Record<string, unknown>;
    webuiSkins?: WebUISkin[];
    defaultWebuiSkin?: WebUISkin;
    failGithubReleaseInstall?: boolean;
    githubReleaseInstallWait?: Promise<void>;
    githubLatestTag?: string;
    githubReleaseStatus?: number;
    githubManifestVersion?: string;
    githubManifestStatus?: number;
    connectDeviceStatus?: number;
  } = {}
) {
  let savedSettings = initialSettings;
  let workflow = options.workflow ?? { context: { targetDoseWeight: 18, targetYield: 36 } };
  let shots = options.shots ?? [];
  let workflowUpdateCount = 0;
  let displayState = options.displayState ?? { brightness: 100, wakeLockOverride: true };
  let machineState = options.machineState ?? { connected: true, wifi: { connected: true, ipAddress: "192.168.1.20" } };
  let devices = options.devices ?? [];
  let sensors = options.sensors ?? [];
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input, init = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? "GET";

    if (method === "GET" && url.hostname === "api.github.com" && url.pathname.startsWith("/repos/")) {
      if (options.githubReleaseStatus) return Promise.resolve(new Response("release unavailable", { status: options.githubReleaseStatus }));
      return responseJson({ tag_name: options.githubLatestTag ?? "v0.1.20" });
    }

    if (method === "GET" && url.hostname === "raw.githubusercontent.com" && url.pathname.endsWith("/skin/workflow-skin/skin-manifest.json")) {
      if (options.githubManifestStatus) return Promise.resolve(new Response("manifest unavailable", { status: options.githubManifestStatus }));
      return responseJson({ id: "workflow-skin", name: "WorkFlow", version: options.githubManifestVersion ?? skinManifest.version });
    }

    if (method === "GET" && url.pathname === "/api/v1/profiles") return responseJson(profiles);
    if (method === "PUT" && url.pathname.startsWith("/api/v1/profiles/")) {
      const profileId = decodeURIComponent(url.pathname.split("/").pop() ?? "");
      if (options.rejectProfileUpdate) return Promise.resolve(new Response("Cannot modify default profile content", { status: 400 }));
      const body = JSON.parse(String(init.body)) as { profile?: (typeof profiles)[number]["profile"] };
      const current = profiles.find((profile) => profile.id === profileId);
      const updated = { id: options.updatedProfileId ?? profileId, profile: body.profile ?? current?.profile ?? {} };
      profiles = profiles.map((profile) => (profile.id === profileId ? updated : profile));
      return responseJson(updated);
    }
    if (method === "POST" && url.pathname === "/api/v1/profiles") {
      const body = JSON.parse(String(init.body)) as { profile: (typeof profiles)[number]["profile"]; parentId?: string };
      const created = { id: "p3", parentId: body.parentId, profile: body.profile };
      profiles = [...profiles, created];
      return responseJson(created, 201);
    }
    if (method === "GET" && url.pathname === "/api/v1/workflow") return responseJson(workflow);
    if (method === "PUT" && url.pathname === "/api/v1/workflow") {
      workflowUpdateCount += 1;
      const nextWorkflow = JSON.parse(String(init.body));
      if (workflowUpdateCount > (options.workflowUpdateStaleCount ?? 0)) workflow = nextWorkflow;
      return responseJson(workflow);
    }
    if (method === "PUT" && url.pathname === "/api/v1/machine/state/sleeping") {
      machineState = { ...machineState, connected: true, state: { state: "sleeping", substate: "idle" } };
      return Promise.resolve(new Response("", { status: 200 }));
    }
    if (method === "PUT" && url.pathname === "/api/v1/machine/state/idle") {
      machineState = { ...machineState, connected: true, state: { state: "idle" } };
      return Promise.resolve(new Response("", { status: 200 }));
    }
    if (method === "PUT" && url.pathname === "/api/v1/machine/state/espresso") {
      machineState = { ...machineState, connected: true, state: { state: "espresso", substate: "preinfusion" } };
      return Promise.resolve(new Response("", { status: 200 }));
    }
    if (method === "GET" && url.pathname === "/api/v1/machine/state") {
      return responseJson(machineState);
    }
    if (method === "GET" && url.pathname === "/api/v1/info") return responseJson(options.appInfo ?? { localIp: "192.168.1.20", version: "0.7.6" });
    if (method === "GET" && url.pathname === "/api/v1/devices") return responseJson(devices);
    if (method === "GET" && url.pathname === "/api/v1/devices/scan") {
      devices = options.devicesAfterScan ?? devices;
      sensors = options.sensorsAfterScan ?? sensors;
      return responseJson(options.scanDevicesResult ?? devices);
    }
    if ((method === "PUT" || method === "POST") && url.pathname === "/api/v1/devices/connect") {
      if (options.connectDeviceStatus) return Promise.resolve(new Response(`connect failed for ${String(init.body)}`, { status: options.connectDeviceStatus }));
      return Promise.resolve(new Response("", { status: 200 }));
    }
    if (method === "GET" && url.pathname === "/api/v1/display") return responseJson(displayState);
    if (method === "PUT" && url.pathname === "/api/v1/display/brightness") {
      displayState = { ...displayState, ...JSON.parse(String(init.body)) };
      return responseJson(displayState);
    }
    if (method === "POST" && url.pathname === "/api/v1/display/wakelock") {
      displayState = { ...displayState, wakeLockOverride: true };
      return responseJson(displayState);
    }
    if (method === "DELETE" && url.pathname === "/api/v1/display/wakelock") {
      displayState = { ...displayState, wakeLockOverride: false };
      return responseJson(displayState);
    }
    if (method === "GET" && url.pathname === "/api/v1/beans") return responseJson([]);
    if (method === "GET" && url.pathname === "/api/v1/grinders") return responseJson([]);
    if (method === "GET" && url.pathname === "/api/v1/shots") return responseJson({ items: shots, total: shots.length, limit: 100, offset: 0 });
    if (method === "GET" && url.pathname === "/api/v1/shots/latest") return responseJson(shots[0] ?? null);
    if (method === "GET" && url.pathname.startsWith("/api/v1/shots/")) {
      const shotId = decodeURIComponent(url.pathname.split("/").pop() ?? "");
      const shot = shots.find((item) => item.id === shotId);
      return shot ? responseJson(shot) : Promise.resolve(new Response("Shot not found", { status: 404 }));
    }
    if (method === "GET" && url.pathname === "/api/v1/steams") return responseJson(options.steams ?? []);
    if (method === "GET" && url.pathname === "/api/v1/sensors") return responseJson(sensors);
    if (method === "GET" && url.pathname === "/api/v1/plugins") return responseJson(options.plugins ?? []);
    if (method === "GET" && url.pathname === "/api/v1/plugins/visualizer.reaplugin/settings") return responseJson(options.pluginSettings ?? {});
    if (method === "GET" && url.pathname.startsWith("/api/v1/plugins/visualizer.reaplugin/")) {
      const endpoint = url.pathname.split("/").pop() ?? "";
      return responseJson(options.visualizerStatus?.[endpoint] ?? {});
    }
    if (method === "GET" && url.pathname === "/api/v1/webui/skins") {
      return responseJson(
        options.webuiSkins ?? [{ id: "workflow-skin", name: "WorkFlow", version: "0.1.9", path: "/skins/workflow", isBundled: false }]
      );
    }
    if (method === "GET" && url.pathname === "/api/v1/webui/skins/default") {
      return responseJson(options.defaultWebuiSkin ?? { id: "workflow-skin", name: "WorkFlow", version: "0.1.9", path: "/skins/workflow", isBundled: false });
    }
    if (method === "POST" && url.pathname === "/api/v1/webui/skins/update") {
      return responseJson({ message: "Skin update check completed" });
    }
    if (method === "POST" && url.pathname === "/api/v1/webui/skins/install/github-release") {
      if (options.failGithubReleaseInstall) {
        return Promise.resolve(new Response("error: Exception: Failed to fetch Github release: 404", { status: 500 }));
      }
      if (options.githubReleaseInstallWait) {
        return options.githubReleaseInstallWait.then(() => responseJson({ success: true, repo: JSON.parse(String(init.body)).repo }));
      }
      return responseJson({ success: true, repo: JSON.parse(String(init.body)).repo });
    }
    if (method === "POST" && url.pathname === "/api/v1/webui/skins/install/url") {
      return responseJson({ message: "Skin installed from committed workflow zip", url: JSON.parse(String(init.body)).url });
    }
    if (options.settingsStorageMissing && url.pathname === "/api/v1/store/workflow-skin/settings") {
      return Promise.resolve(new Response("Route not found", { status: 404 }));
    }
    if (options.settingsStorageMissing && url.pathname === "/api/v1/plugins/workflow-skin/settings") {
      return Promise.resolve(new Response("Route not found", { status: 404 }));
    }
    if (options.settingsStorageMissing && url.pathname === "/api/v1/kv/workflow-skin/settings") {
      return Promise.resolve(new Response("Route not found", { status: 404 }));
    }
    if (method === "GET" && url.pathname === "/api/v1/store/workflow-skin/settings") return responseJson(savedSettings);
    if (method === "POST" && url.pathname === "/api/v1/store/workflow-skin/settings") {
      if (options.failSettingsPut) return Promise.resolve(new Response("store unavailable", { status: 500 }));
      savedSettings = JSON.parse(String(init.body)) as SkinSettings;
      return Promise.resolve(new Response("", { status: 200 }));
    }
    if (method === "GET" && url.pathname === "/api/v1/kv/workflow-skin/settings") return responseJson(savedSettings);
    if (method === "PUT" && url.pathname === "/api/v1/kv/workflow-skin/settings") {
      if (options.failSettingsPut) return Promise.resolve(new Response("kv unavailable", { status: 500 }));
      savedSettings = JSON.parse(String(init.body)) as SkinSettings;
      return Promise.resolve(new Response("", { status: 200 }));
    }
    if (method === "POST" && url.pathname === "/api/v1/beans") return responseJson({ id: "bean-1", roaster: "Pilot", name: "Halo" });
    if (method === "POST" && url.pathname === "/api/v1/beans/bean-1/batches") {
      if (options.failBatchCreate) return Promise.resolve(new Response("batch failed", { status: 500 }));
      return responseJson({ id: "batch-1", beanId: "bean-1" });
    }
    if (method === "DELETE" && url.pathname === "/api/v1/beans/bean-1") return Promise.resolve(new Response("", { status: 200 }));

    return Promise.reject(new Error(`Unhandled ${method} ${url.pathname}${url.search}`));
  });

  return {
    fetchMock,
    get savedSettings() {
      return savedSettings;
    },
    get workflow() {
      return workflow;
    },
    get workflowUpdateCount() {
      return workflowUpdateCount;
    },
    get displayState() {
      return displayState;
    },
    setMachineState(next: MachineState) {
      machineState = next;
    },
    setShots(next: ShotRecord[]) {
      shots = next;
    }
  };
}

const initialSettings: SkinSettings = {
  ...defaultSkinSettings,
  presetSlots: [
    { label: "Light", profileId: "p1" },
    { label: "Sweet" },
    { label: "Turbo" },
    { label: "Classic" }
  ],
  defaultReviewEnabled: true,
  reviewEnabledByProfile: {},
  skinTitle: "WorkFlow",
  shownProfileIds: ["p1", "p2"],
  profileWorkflows: {}
};

const detectedR2Sensor: SensorListItem = {
  id: "F4:12:FA:FA:AC:E3",
  info: {
    name: "DiFluid R2",
    vendor: "DiFluid",
    data: [{ key: "tds", type: "number", unit: "%" }],
    commands: [{ id: "measure" }]
  }
};

describe("App shell", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    profiles = [
      { id: "p1", profile: { title: "Blooming" } },
      { id: "p2", profile: { title: "Classic" } }
    ];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    localStorage.clear();
  });

  it("starts on the brew page and switches navigation tabs", async () => {
    mockReaFetch(initialSettings);
    render(<App />);
    expect(screen.getByRole("heading", { name: "Brew" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Light Blooming" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Bags/i }));

    expect(screen.getByRole("heading", { name: "Bags" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bag Filters" })).toBeInTheDocument();
  });

  it("renders WorkFlow in the menu and machine status in the fixed top bar", async () => {
    mockReaFetch({
      ...initialSettings,
      menuCollapsed: false
    }, {
      machineState: { connected: true, state: { state: "heating" }, groupTemperature: 91.2, wifi: { connected: true, ipAddress: "192.168.1.20" } }
    });
    render(<App />);

    const topbar = await screen.findByRole("banner", { name: "Machine status bar" });
    const menuTitle = screen.getByLabelText("WorkFlow menu title");

    expect(menuTitle).toHaveTextContent("WorkFlow");
    expect(topbar).toHaveTextContent("Heating");
    expect(topbar).toHaveTextContent("91.2°C");
    expect(within(topbar).getByRole("button", { name: "WiFi" })).toBeInTheDocument();
    expect(screen.queryByLabelText("App title")).not.toBeInTheDocument();
  });

  it("shows PreparingForShot as Heating in the machine header", async () => {
    mockReaFetch(initialSettings, {
      machineState: { connected: true, state: { state: "PreparingForShot" }, groupTemperature: 88.3 }
    });
    render(<App />);

    const topbar = await screen.findByRole("banner", { name: "Machine status bar" });

    expect(topbar).toHaveTextContent("Heating");
    expect(topbar).not.toHaveTextContent("PreparingForShot");
  });

  it("shows spaced Preparing for shot as Heating when the machine is warming up", async () => {
    mockReaFetch(initialSettings, {
      machineState: { connected: true, state: { state: "Preparing for shot", substate: "heating" }, groupTemperature: 88.3, targetGroupTemperature: 93 }
    });
    render(<App />);

    const topbar = await screen.findByRole("banner", { name: "Machine status bar" });

    expect(topbar).toHaveTextContent("Heating");
    expect(topbar).not.toHaveTextContent("Preparing for shot");
  });

  it("renders on older WebViews without Array.prototype.at", async () => {
    const originalAtDescriptor = Object.getOwnPropertyDescriptor(Array.prototype, "at");
    Object.defineProperty(Array.prototype, "at", { configurable: true, value: undefined });
    try {
      mockReaFetch(initialSettings);
      render(<App />);

      expect(await screen.findByRole("heading", { name: "Brew" })).toBeInTheDocument();
      expect(screen.getByLabelText("WorkFlow menu title")).toHaveTextContent("WorkFlow");
    } finally {
      if (originalAtDescriptor) {
        Object.defineProperty(Array.prototype, "at", originalAtDescriptor);
      } else {
        delete (Array.prototype as unknown as Record<string, unknown>).at;
      }
    }
  });

  it("has a dedicated menu item for profiles", async () => {
    mockReaFetch(initialSettings);
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Profiles" }));

    expect(screen.getByRole("heading", { name: "Profiles", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Blooming profile workflow" })).toBeInTheDocument();
  });

  it("orders grinders below profiles in the default main menu", async () => {
    mockReaFetch(initialSettings);
    render(<App />);

    const navigation = await screen.findByRole("navigation", { name: "Workflow navigation" });
    const labels = Array.from(navigation.querySelectorAll(".nav-button")).map((button) => button.getAttribute("aria-label"));

    expect(labels.indexOf("Profiles")).toBeGreaterThan(-1);
    expect(labels.indexOf("Grinders")).toBeGreaterThan(-1);
    expect(labels.indexOf("Profiles")).toBeLessThan(labels.indexOf("Grinders"));
  });

  it("uses saved main menu visibility and order", async () => {
    mockReaFetch({
      ...initialSettings,
      mainMenuItems: ["brew", "profiles", "grinders", "history", "settings", "live", "review", "steam", "bags"],
      hiddenMainMenuItemIds: ["history", "steam"]
    });
    render(<App />);

    const navigation = await screen.findByRole("navigation", { name: "Workflow navigation" });
    const labels = Array.from(navigation.querySelectorAll(".nav-button")).map((button) => button.getAttribute("aria-label"));

    expect(labels).toEqual(["Collapse menu", "Brew", "Profiles", "Grinders", "Settings", "Live", "Review", "Bags"]);
    expect(screen.queryByRole("button", { name: "History" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Steam" })).not.toBeInTheDocument();
  });

  it("uses compact icons and a notepad edit icon in the collapsed menu", async () => {
    mockReaFetch({ ...initialSettings, menuCollapsed: true });
    render(<App />);

    const reviewButton = await screen.findByRole("button", { name: "Review" });
    const reviewIcon = reviewButton.querySelector("svg");
    const menuTitle = screen.getByLabelText("WorkFlow menu title");

    expect(menuTitle).toHaveTextContent("WF");
    expect(reviewButton).toHaveClass("review-nav-button");
    expect(reviewIcon).toHaveClass("review-nav-icon");
    expect(reviewIcon).toHaveAttribute("width", "20");
    expect(reviewIcon).toHaveAttribute("height", "20");
  });

  it("hides connection status indicators when the menu is collapsed", async () => {
    mockReaFetch({ ...initialSettings, menuCollapsed: true });
    render(<App />);

    await screen.findByRole("navigation", { name: "Workflow navigation" });

    expect(screen.queryByLabelText("Connection status")).not.toBeInTheDocument();
    expect(screen.getByRole("banner", { name: "Machine status bar" })).toBeInTheDocument();
  });

  it("has a dedicated menu item for grinders", async () => {
    mockReaFetch(initialSettings);
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Grinders" }));

    expect(screen.getByRole("heading", { name: "Grinders", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Add grinder" })).toBeInTheDocument();
  });

  it("collapses the menu to icons and remembers the state", async () => {
    const fetchState = mockReaFetch(initialSettings);
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Collapse menu" }));

    expect(await screen.findByRole("button", { name: "Expand menu" })).toBeInTheDocument();
    expect(fetchState.savedSettings.menuCollapsed).toBe(true);
  });

  it("only lists shown profiles when choosing a preset profile", async () => {
    mockReaFetch({ ...initialSettings, shownProfileIds: ["p2"] });
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Edit Light" }));

    expect(screen.getByRole("button", { name: "Use Classic" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use Blooming" })).not.toBeInTheDocument();
  });

  it("does not list profiles already assigned to another preset slot", async () => {
    mockReaFetch(initialSettings);
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Edit Sweet" }));

    expect(screen.getByRole("dialog", { name: "Edit Sweet preset" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use Blooming" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use Classic" })).toBeInTheDocument();
  });

  it("creates an editable copy when saving a default profile is rejected", async () => {
    const fetchState = mockReaFetch(initialSettings, { rejectProfileUpdate: true });
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Profiles" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit Blooming" }));
    await userEvent.clear(screen.getByLabelText("Profile title"));
    await userEvent.type(screen.getByLabelText("Profile title"), "Blooming Copy");
    await userEvent.click(screen.getByRole("button", { name: "Save Blooming" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Profile saved.");
    expect(fetchState.fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/profiles/p1",
      expect.objectContaining({ method: "PUT" })
    );
    expect(fetchState.fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/profiles",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"parentId":"p1"')
      })
    );
  });

  it("keeps skin settings attached when ReaPrime changes an edited profile id", async () => {
    const fetchState = mockReaFetch(
      {
        ...initialSettings,
        startupProfileId: "p1",
        reviewEnabledByProfile: { p1: false },
        profileWorkflows: { p1: { milkBased: true, steamTimers: { small: 25, medium: 35, large: 45 } } }
      },
      { updatedProfileId: "p1-copy" }
    );
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Profiles" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit Blooming" }));
    await userEvent.clear(screen.getByLabelText("Profile title"));
    await userEvent.type(screen.getByLabelText("Profile title"), "Blooming Edited");
    await userEvent.click(screen.getByRole("button", { name: "Save Blooming" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Profile saved.");
    expect(fetchState.savedSettings.startupProfileId).toBe("p1-copy");
    expect(fetchState.savedSettings.shownProfileIds).toContain("p1-copy");
    expect(fetchState.savedSettings.shownProfileIds).not.toContain("p1");
    expect(fetchState.savedSettings.presetSlots[0].profileId).toBe("p1-copy");
    expect(fetchState.savedSettings.reviewEnabledByProfile).toEqual({ "p1-copy": false });
    expect(fetchState.savedSettings.profileWorkflows["p1-copy"]).toEqual({ milkBased: true, steamTimers: { small: 25, medium: 35, large: 45 } });
  });

  it("persists preset slot assignment from the edit panel", async () => {
    const fetchState = mockReaFetch(initialSettings);
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Edit Light" }));
    expect(screen.getByRole("dialog", { name: "Edit Light preset" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Use Classic" }));

    expect(await screen.findByRole("button", { name: "Light Classic" })).toBeInTheDocument();
    expect(fetchState.savedSettings.presetSlots[0]).toEqual({ label: "Light", profileId: "p2" });
    expect(screen.queryByRole("dialog", { name: "Edit Light preset" })).not.toBeInTheDocument();
  });

  it("assigns a preset profile when only local settings storage is available", async () => {
    localStorage.setItem("reaprime-skin:workflow-skin:settings", JSON.stringify(initialSettings));
    mockReaFetch(initialSettings, { settingsStorageMissing: true });
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Edit Light" }));
    await userEvent.click(screen.getByRole("button", { name: "Use Classic" }));

    expect(await screen.findByRole("button", { name: "Light Classic" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Edit Light preset" })).not.toBeInTheDocument();
    expect(localStorage.getItem("reaprime-skin:workflow-skin:settings")).toContain('"profileId":"p2"');
  });

  it("applies the configured startup profile after loading", async () => {
    const fetchState = mockReaFetch({ ...initialSettings, startupProfileId: "p2" });
    render(<App />);

    await waitFor(() => {
      expect(fetchState.workflow).toEqual(
        expect.objectContaining({
          profile: profiles[1].profile,
          context: expect.objectContaining({
            extras: { workflowSkin: { selectedProfileId: "p2" } }
          })
        })
      );
    });
  });

  it("re-applies the startup profile when the first startup refresh does not confirm it", async () => {
    const fetchState = mockReaFetch(
      {
        ...initialSettings,
        startupProfileId: "p2",
        presetSlots: [
          { label: "Light", profileId: "p1" },
          { label: "Sweet", profileId: "p2" },
          { label: "Turbo" },
          { label: "Classic" }
        ]
      },
      {
        workflow: { context: { extras: { workflowSkin: { selectedProfileId: "p1" } } } },
        workflowUpdateStaleCount: 1
      }
    );
    render(<App />);

    await waitFor(() => expect(fetchState.workflowUpdateCount).toBeGreaterThanOrEqual(2));
    expect(await screen.findByRole("button", { name: "Sweet Classic" })).toHaveAttribute("aria-current", "true");
  });

  it("does not re-apply the startup profile after a manual preset change", async () => {
    const fetchState = mockReaFetch(
      {
        ...initialSettings,
        startupProfileId: "p2",
        presetSlots: [
          { label: "Light", profileId: "p1" },
          { label: "Sweet", profileId: "p2" },
          { label: "Turbo" },
          { label: "Classic" }
        ]
      },
      {
        workflow: { context: { extras: { workflowSkin: { selectedProfileId: "p2" } } } }
      }
    );
    render(<App />);

    expect(await screen.findByRole("button", { name: "Sweet Classic" })).toHaveAttribute("aria-current", "true");

    await userEvent.click(screen.getByRole("button", { name: "Light Blooming" }));

    await waitFor(() => expect(fetchState.workflowUpdateCount).toBe(1));
    expect(await screen.findByRole("button", { name: "Light Blooming" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Sweet Classic" })).not.toHaveAttribute("aria-current");
  });

  it("wakes the machine and auto-connects machine and scale devices on startup", async () => {
    const fetchState = mockReaFetch(initialSettings, {
      machineState: { connected: true, state: { state: "sleeping", substate: "idle" } },
      devices: [
        { id: "machine-1", name: "DE1", type: "machine", state: "disconnected" },
        { id: "scale-1", name: "Acaia", type: "scale", state: "discovered" }
      ]
    });
    render(<App />);

    await waitFor(() => {
      expect(fetchState.fetchMock).toHaveBeenCalledWith(
        "http://localhost:8080/api/v1/devices/scan?connect=true&quick=true",
        expect.objectContaining({ method: "GET" })
      );
    });
    expect(fetchState.fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/devices/connect",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ deviceId: "machine-1" }) })
    );
    expect(fetchState.fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/devices/connect",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ deviceId: "scale-1" }) })
    );
    expect(fetchState.fetchMock).toHaveBeenCalledWith("http://localhost:8080/api/v1/machine/state/idle", expect.objectContaining({ method: "PUT" }));
  });

  it("auto-connects a configured R2 on startup using the full scan when needed", async () => {
    const fetchState = mockReaFetch(
      { ...initialSettings, r2SensorId: "F4:12:FA:FA:AC:E3" },
      {
        devices: [],
        scanDevicesResult: [{ id: "F4:12:FA:FA:AC:E3", name: "DiFluid R2", type: "sensor", state: "discovered" }]
      }
    );
    render(<App />);

    await waitFor(() => {
      expect(fetchState.fetchMock).toHaveBeenCalledWith(
        "http://localhost:8080/api/v1/devices/scan?connect=true&quick=false",
        expect.objectContaining({ method: "GET" })
      );
    });
    expect(fetchState.fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/devices/connect",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ deviceId: "F4:12:FA:FA:AC:E3" }) })
    );
  });

  it("keeps the brew page after a preset is pressed until brewing starts", async () => {
    const fetchState = mockReaFetch(initialSettings, {
      machineState: { connected: true, state: { state: "idle" }, wifi: { connected: true, ipAddress: "192.168.1.20" } }
    });
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Light Blooming" }));

    expect(await screen.findByRole("heading", { name: "Brew" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Live Brew" })).not.toBeInTheDocument();
    expect(fetchState.fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/workflow",
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("starts espresso mode and opens live data when Start Brew is pressed", async () => {
    const fetchState = mockReaFetch(initialSettings);
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Start Brew" }));

    expect(await screen.findByRole("heading", { name: "Live Brew" })).toBeInTheDocument();
    expect(fetchState.fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/machine/state/espresso",
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("opens live data when the machine is already brewing", async () => {
    mockReaFetch(initialSettings, {
      machineState: { connected: true, state: { state: "espresso", substate: "pouring" } }
    });
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Live Brew" })).toBeInTheDocument();
  });

  it("routes one second after espresso returns idle without sending non-milk shots to steam", async () => {
    vi.useFakeTimers();
    const shot: ShotRecord = {
      id: "shot-idle-1",
      timestamp: "2026-06-12T10:00:00.000Z",
      workflow: {
        profile: profiles[0].profile,
        context: { extras: { workflowSkin: { selectedProfileId: "p1" } } }
      },
      measurements: []
    };
    const fetchState = mockReaFetch(
      { ...initialSettings, defaultReviewEnabled: false },
      {
        machineState: { connected: true, state: { state: "espresso", substate: "pouring" } },
        shots: [shot]
      }
    );
    render(<App />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("heading", { name: "Live Brew" })).toBeInTheDocument();

    fetchState.setMachineState({ connected: true, state: { state: "idle" } });
    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("heading", { name: "Live Brew" })).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(999);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("heading", { name: "Live Brew" })).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("heading", { name: "Brew" })).toBeInTheDocument();
    expect(screen.queryByText("Steam Workflow")).not.toBeInTheDocument();
  });

  it("reviews the completed latest shot with the captured live graph after brew returns idle", async () => {
    vi.useFakeTimers();
    const previousShot: ShotRecord = {
      id: "previous-shot",
      timestamp: "2026-06-12T09:30:00.000Z",
      workflow: { context: { extras: { workflowSkin: { selectedProfileId: "p1" } } } },
      measurements: [
        { machine: { timestamp: "2026-06-12T09:30:00.000Z", pressure: 1, flow: 1 }, scale: { weight: 2 } },
        { machine: { timestamp: "2026-06-12T09:30:20.000Z", pressure: 7, flow: 2 }, scale: { weight: 30 } }
      ]
    };
    const completedShot: ShotRecord = {
      id: "completed-shot",
      timestamp: "2026-06-12T10:00:00.000Z",
      workflow: {
        profile: profiles[0].profile,
        context: { extras: { workflowSkin: { selectedProfileId: "p1" } } }
      },
      measurements: [
        { machine: { timestamp: "2026-06-12T10:00:00.000Z", pressure: 2, flow: 1 }, scale: { weight: 5 } },
        { machine: { timestamp: "2026-06-12T10:00:28.000Z", pressure: 9, flow: 2 }, scale: { weight: 40 } }
      ]
    };
    const fetchState = mockReaFetch(initialSettings, {
      machineState: { connected: true, state: { state: "espresso", substate: "pouring" } },
      shots: [previousShot]
    });
    render(<App />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    fetchState.setShots([completedShot, previousShot]);
    fetchState.setMachineState({ connected: true, state: { state: "idle" } });

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("heading", { name: "Shot Review" })).toBeInTheDocument();
    expect(screen.getByText("Duration: 28s")).toBeInTheDocument();
    expect(screen.getByText("Yield: 40 g")).toBeInTheDocument();
    expect(screen.queryByText("Duration: 20s")).not.toBeInTheDocument();
  });

  it("routes milk profiles to steam one second after espresso returns idle when review is disabled", async () => {
    vi.useFakeTimers();
    const shot: ShotRecord = {
      id: "shot-milk-1",
      timestamp: "2026-06-12T10:00:00.000Z",
      workflow: {
        profile: profiles[0].profile,
        context: { extras: { workflowSkin: { selectedProfileId: "p1" } } }
      },
      measurements: []
    };
    const fetchState = mockReaFetch(
      {
        ...initialSettings,
        defaultReviewEnabled: false,
        profileWorkflows: { p1: { milkBased: true, steamTimers: { small: 20, medium: 30, large: 40 } } }
      },
      {
        machineState: { connected: true, state: { state: "espresso", substate: "pouring" } },
        shots: [shot]
      }
    );
    render(<App />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("heading", { name: "Live Brew" })).toBeInTheDocument();
    fetchState.setMachineState({ connected: true, state: { state: "idle" } });

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("Steam Workflow")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Blooming" })).toBeInTheDocument();
  });

  it("auto sleeps the machine after the configured idle timer", async () => {
    const fetchState = mockReaFetch(
      { ...initialSettings, autoSleepMinutes: 0.001, screensaverBrightness: 13 },
      {
        machineState: { connected: true, state: { state: "idle" }, wifi: { connected: true, ipAddress: "192.168.1.20" } }
      }
    );
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Brew" })).toBeInTheDocument();

    await waitFor(
      () => {
        expect(fetchState.fetchMock).toHaveBeenCalledWith(
          "http://localhost:8080/api/v1/machine/state/sleeping",
          expect.objectContaining({ method: "PUT" })
        );
      },
      { timeout: 1500 }
    );
    expect(fetchState.fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/display/brightness",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ brightness: 13 }) })
    );
    expect(fetchState.displayState).toEqual(expect.objectContaining({ brightness: 13, wakeLockOverride: false }));
    expect(await screen.findByText("Machine sleeping")).toBeInTheDocument();
  });

  it("puts the machine to sleep and moves into screensaver mode", async () => {
    const fetchState = mockReaFetch({ ...initialSettings, keepScreenAwake: true, screensaverBrightness: 8 } as SkinSettings);
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Sleep machine" }));

    expect(await screen.findByRole("heading", { name: "WorkFlow" })).toBeInTheDocument();
    expect(screen.getByText("Machine sleeping")).toBeInTheDocument();
    expect(screen.getByText("Tap the screen to wake")).toBeInTheDocument();
    expect(fetchState.fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/display/brightness",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ brightness: 8 }) })
    );
    expect(fetchState.fetchMock).toHaveBeenCalledWith("http://localhost:8080/api/v1/display/wakelock", expect.objectContaining({ method: "DELETE" }));
    expect(fetchState.fetchMock).toHaveBeenCalledWith("http://localhost:8080/api/v1/machine/state/sleeping", expect.objectContaining({ method: "PUT" }));

    await userEvent.click(screen.getByRole("button", { name: "Tap the screen to wake" }));

    expect(await screen.findByRole("heading", { name: "Brew" })).toBeInTheDocument();
    expect(fetchState.fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/display/brightness",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ brightness: 100 }) })
    );
    expect(fetchState.fetchMock).toHaveBeenCalledWith("http://localhost:8080/api/v1/display/wakelock", expect.objectContaining({ method: "POST" }));
  });

  it("shows a fullscreen button to the right of sleep and toggles native fullscreen", async () => {
    let fullscreenElement: Element | null = null;
    const requestFullscreen = vi.fn().mockImplementation(() => {
      fullscreenElement = document.documentElement;
      document.dispatchEvent(new Event("fullscreenchange"));
      return Promise.resolve();
    });
    const exitFullscreen = vi.fn().mockImplementation(() => {
      fullscreenElement = null;
      document.dispatchEvent(new Event("fullscreenchange"));
      return Promise.resolve();
    });
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreenElement });
    Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: requestFullscreen });
    Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exitFullscreen });

    mockReaFetch(initialSettings);
    const { container } = render(<App />);
    const actions = container.querySelector(".top-status-actions") as HTMLElement;

    expect(actions).toBeInTheDocument();
    expect(within(actions).getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual(["Sleep machine", "Enter fullscreen"]);

    await userEvent.click(await within(actions).findByRole("button", { name: "Enter fullscreen" }));

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(await within(actions).findByRole("button", { name: "Exit fullscreen" })).toBeInTheDocument();

    await userEvent.click(within(actions).getByRole("button", { name: "Exit fullscreen" }));

    expect(exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it("keeps the machine status screen-level and top action buttons grouped", async () => {
    mockReaFetch(initialSettings);
    const { container } = render(<App />);

    await screen.findByRole("heading", { name: "Brew" });
    const shell = container.querySelector(".app-shell") as HTMLElement;
    const topbar = screen.getByRole("banner", { name: "Machine status bar" });
    const actions = container.querySelector(".top-status-actions") as HTMLElement;
    const machineStatus = screen.getByLabelText("Machine current status");

    expect(shell).toContainElement(topbar);
    expect(topbar).toContainElement(machineStatus);
    expect(topbar).toBeInTheDocument();
    expect(topbar).toContainElement(actions);
    expect(within(actions).getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual(["Sleep machine", "Enter fullscreen"]);
    expect(within(actions).getByRole("button", { name: "Enter fullscreen" })).not.toHaveTextContent(/Full|Exit/);
  });

  it("refreshes and connects the R2 sensor from settings", async () => {
    const fetchState = mockReaFetch(initialSettings, {
      sensors: [],
      sensorsAfterScan: [detectedR2Sensor],
      devicesAfterScan: [{ id: "F4:12:FA:FA:AC:E3", name: "DiFluid R2", type: "sensor", state: "discovered" }]
    });
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));
    await userEvent.click(await screen.findByRole("button", { name: "Refresh R2" }));

    await waitFor(() => expect(fetchState.savedSettings.r2SensorId).toBe("F4:12:FA:FA:AC:E3"));
    expect(fetchState.fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/devices/scan?connect=true&quick=false",
      expect.objectContaining({ method: "GET" })
    );
    expect(fetchState.fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/devices/connect",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ deviceId: "F4:12:FA:FA:AC:E3" }) })
    );
  });

  it("connects an R2 device returned only by the scan response from settings refresh", async () => {
    const fetchState = mockReaFetch(initialSettings, {
      sensors: [],
      sensorsAfterScan: [detectedR2Sensor],
      scanDevicesResult: [{ id: "F4:12:FA:FA:AC:E3", name: "DiFluid R2", type: "sensor", state: "discovered" }]
    });
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));
    await userEvent.click(await screen.findByRole("button", { name: "Refresh R2" }));

    await waitFor(() => expect(fetchState.savedSettings.r2SensorId).toBe("F4:12:FA:FA:AC:E3"));
    expect(fetchState.fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/devices/connect",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ deviceId: "F4:12:FA:FA:AC:E3" }) })
    );
  });

  it("refreshes the native R2 connection when the disconnected R2 status is pressed", async () => {
    const fetchState = mockReaFetch(
      { ...initialSettings, r2SensorId: "F4:12:FA:FA:AC:E3" },
      {
        sensors: [],
        sensorsAfterScan: [detectedR2Sensor],
        scanDevicesResult: [{ id: "F4:12:FA:FA:AC:E3", name: "DiFluid R2", type: "sensor", state: "discovered" }]
      }
    );
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "R2" }));

    await waitFor(() => expect(fetchState.savedSettings.r2SensorId).toBe("F4:12:FA:FA:AC:E3"));
    expect(fetchState.fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/devices/scan?connect=true&quick=false",
      expect.objectContaining({ method: "GET" })
    );
    expect(fetchState.fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/devices/connect",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ deviceId: "F4:12:FA:FA:AC:E3" }) })
    );
  });

  it("reveals the machine IP when the WiFi status is pressed", async () => {
    mockReaFetch(initialSettings, {
      machineState: { connected: true, wifi: { connected: true, ipAddress: "10.0.0.25" } }
    });
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "WiFi" }));

    expect(screen.getByText("Machine IP address")).toBeInTheDocument();
    expect(screen.getByText("10.0.0.25")).toBeInTheDocument();
  });

  it("uses ReaPrime localIp for the WiFi status when machine state has no IP", async () => {
    mockReaFetch(initialSettings, {
      appInfo: { localIp: "10.0.0.200", version: "0.7.6" },
      machineState: { connected: true, state: { state: "idle" } }
    });
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "WiFi" }));

    expect(screen.getByText("Machine IP address")).toBeInTheDocument();
    expect(screen.getByText("10.0.0.200")).toBeInTheDocument();
    expect(screen.queryByText("localhost")).not.toBeInTheDocument();
  });

  it("tries to force scale connection when the disconnected Scale status is pressed", async () => {
    const fetchState = mockReaFetch(initialSettings, {
      devices: [{ id: "scale-1", name: "Acaia", type: "scale", state: "disconnected" }]
    });
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Scale" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Scale connection requested.");
    expect(fetchState.fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/devices/scan?connect=true&quick=false",
      expect.objectContaining({ method: "GET" })
    );
    expect(fetchState.fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/devices/connect",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ deviceId: "scale-1" }) })
    );
  });

  it("connects a scale returned only by the scan response", async () => {
    const fetchState = mockReaFetch(initialSettings, {
      devices: [],
      scanDevicesResult: [{ id: "acaia-lunar", name: "Acaia Lunar", type: "sensor", state: "discovered" }]
    });
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Scale" }));

    expect(fetchState.fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/devices/scan?connect=true&quick=false",
      expect.objectContaining({ method: "GET" })
    );
    await waitFor(() => {
      expect(fetchState.fetchMock).toHaveBeenCalledWith(
        "http://localhost:8080/api/v1/devices/connect",
        expect.objectContaining({ method: "PUT", body: JSON.stringify({ deviceId: "acaia-lunar" }) })
      );
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Scale connection requested.");
  });

  it("keeps force scale connection usable when explicit connect returns 404 after scan", async () => {
    const fetchState = mockReaFetch(initialSettings, {
      devices: [],
      scanDevicesResult: [{ id: "D4:41:89:DB:21:2E", name: "Acaia Pearl", type: "scale", state: "discovered" }],
      connectDeviceStatus: 404
    });
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Scale" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Scale scan requested. Wake the scale if it stays disconnected.");
    expect(screen.queryByText(/Could not connect scale/i)).not.toBeInTheDocument();
    expect(fetchState.fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/devices/scan?connect=true&quick=false",
      expect.objectContaining({ method: "GET" })
    );
  });

  it.each([
    ["BooKoo Themis", "bookoo-themis"],
    ["Decent Scale", "decent-scale"]
  ])("recognizes %s as a connectable scale", async (scaleName, scaleId) => {
    const fetchState = mockReaFetch(initialSettings, {
      devices: [],
      scanDevicesResult: [{ id: scaleId, name: scaleName, type: "sensor", state: "discovered" }]
    });
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Scale" }));

    await waitFor(() => {
      expect(fetchState.fetchMock).toHaveBeenCalledWith(
        "http://localhost:8080/api/v1/devices/connect",
        expect.objectContaining({ method: "PUT", body: JSON.stringify({ deviceId: scaleId }) })
      );
    });
  });

  it("installs the configured skin update on startup when auto-update is enabled", async () => {
    const fetchState = mockReaFetch({ ...initialSettings, skinAutoUpdateEnabled: true });
    render(<App />);

    await waitFor(() => {
      expect(fetchState.fetchMock).toHaveBeenCalledWith(
        "http://localhost:8080/api/v1/webui/skins/install/github-release",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ repo: "Sabotage1/r2-connector", asset: "workflow-skin.zip", prerelease: false })
        })
      );
    });
  });

  it("can check and install skin updates from Settings", async () => {
    const currentSkinVersion = typeof skinManifest.version === "string" ? skinManifest.version : "0.0.0";
    const fetchState = mockReaFetch({
      ...initialSettings,
      skinUpdateRepo: "roy/workflow-skin",
      skinUpdateAsset: "workflow-skin.zip",
      skinUpdatePrerelease: false
    }, {
      webuiSkins: [{ id: "workflow-skin", name: "WorkFlow", version: currentSkinVersion, path: "/skins/workflow", isBundled: false }],
      defaultWebuiSkin: { id: "workflow-skin", name: "WorkFlow", version: currentSkinVersion, path: "/skins/workflow", isBundled: false },
      githubLatestTag: "v99.0.0"
    });
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));
    await userEvent.click(await screen.findByRole("tab", { name: "Skin settings" }));
    await userEvent.click(await screen.findByRole("button", { name: "Check for skin updates" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Skin update check completed.");
    expect(screen.getByText(`Update available: v99.0.0 is available (installed v${currentSkinVersion}).`)).toBeInTheDocument();
    expect(fetchState.fetchMock).toHaveBeenCalledWith("http://localhost:8080/api/v1/webui/skins/update", expect.objectContaining({ method: "POST" }));

    await userEvent.click(screen.getByRole("button", { name: "Install/update from GitHub release" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Skin installed from GitHub release.");
    expect(fetchState.fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/webui/skins/install/github-release",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ repo: "roy/workflow-skin", asset: "workflow-skin.zip", prerelease: false })
      })
    );
  });

  it("finds git-committed skin updates from the configured branch when no GitHub release exists", async () => {
    const fetchState = mockReaFetch(
      {
        ...initialSettings,
        skinUpdateRepo: "Sabotage1/r2-connector",
        skinUpdateBranch: "codex/reaprime-workflow-skin",
        skinUpdateAsset: "workflow-skin.zip",
        skinUpdatePrerelease: false
      },
      {
        webuiSkins: [{ id: "workflow-skin", name: "WorkFlow", version: "0.1.25", path: "/skins/workflow", isBundled: false }],
        defaultWebuiSkin: { id: "workflow-skin", name: "WorkFlow", version: "0.1.25", path: "/skins/workflow", isBundled: false },
        githubReleaseStatus: 404,
        githubManifestVersion: "0.1.28"
      }
    );
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));
    await userEvent.click(await screen.findByRole("tab", { name: "Skin settings" }));
    await userEvent.click(await screen.findByRole("button", { name: "Check for skin updates" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Skin update check completed.");
    expect(screen.getByText("Update available: v0.1.28 is available (installed v0.1.25).")).toBeInTheDocument();
    expect(fetchState.fetchMock).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/Sabotage1/r2-connector/codex/reaprime-workflow-skin/skin/workflow-skin/skin-manifest.json",
      expect.objectContaining({ headers: { Accept: "application/json" } })
    );
  });

  it("installs the committed branch zip when the checked update came from the branch manifest", async () => {
    const fetchState = mockReaFetch(
      {
        ...initialSettings,
        skinUpdateRepo: "Sabotage1/r2-connector",
        skinUpdateBranch: "codex/reaprime-workflow-skin",
        skinUpdateAsset: "workflow-skin.zip",
        skinUpdatePrerelease: false
      },
      {
        webuiSkins: [{ id: "workflow-skin", name: "WorkFlow", version: "0.1.25", path: "/skins/workflow", isBundled: false }],
        defaultWebuiSkin: { id: "workflow-skin", name: "WorkFlow", version: "0.1.25", path: "/skins/workflow", isBundled: false },
        githubLatestTag: "v0.1.20",
        githubManifestVersion: "0.1.37"
      }
    );
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));
    await userEvent.click(await screen.findByRole("tab", { name: "Skin settings" }));
    await userEvent.click(await screen.findByRole("button", { name: "Check for skin updates" }));

    expect(await screen.findByText("Update available: v0.1.37 is available (installed v0.1.25).")).toBeInTheDocument();

    await userEvent.click(await screen.findByRole("button", { name: "Install/update from GitHub release" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Skin installed from committed workflow zip.");
    expect(fetchState.fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/webui/skins/install/url",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ url: "https://raw.githubusercontent.com/Sabotage1/r2-connector/codex/reaprime-workflow-skin/skin/workflow-skin/workflow-skin.zip" })
      })
    );
  });

  it("shows downloading update while the configured skin update is installing", async () => {
    let finishInstall!: () => void;
    const installWait = new Promise<void>((resolve) => {
      finishInstall = resolve;
    });
    mockReaFetch(
      {
        ...initialSettings,
        skinUpdateRepo: "roy/workflow-skin",
        skinUpdateAsset: "workflow-skin.zip",
        skinUpdatePrerelease: false
      },
      { githubReleaseInstallWait: installWait }
    );
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));
    await userEvent.click(await screen.findByRole("tab", { name: "Skin settings" }));
    await userEvent.click(await screen.findByRole("button", { name: "Install/update from GitHub release" }));

    expect(await screen.findByText("Downloading update...")).toBeInTheDocument();

    finishInstall();

    expect(await screen.findByRole("status")).toHaveTextContent("Skin installed from GitHub release.");
  });

  it("falls back to the committed workflow zip when GitHub release install is missing", async () => {
    const fetchState = mockReaFetch(
      {
        ...initialSettings,
        skinUpdateRepo: "Sabotage1/r2-connector",
        skinUpdateAsset: "workflow-skin.zip",
        skinUpdatePrerelease: false
      },
      { failGithubReleaseInstall: true }
    );
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));
    await userEvent.click(await screen.findByRole("tab", { name: "Skin settings" }));
    await userEvent.click(await screen.findByRole("button", { name: "Install/update from GitHub release" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Skin installed from committed workflow zip.");
    expect(fetchState.fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/webui/skins/install/github-release",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ repo: "Sabotage1/r2-connector", asset: "workflow-skin.zip", prerelease: false })
      })
    );
    expect(fetchState.fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/webui/skins/install/url",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ url: "https://raw.githubusercontent.com/Sabotage1/r2-connector/codex/reaprime-workflow-skin/skin/workflow-skin/workflow-skin.zip" })
      })
    );
  });

  it("reveals the current water level when the Water status is pressed", async () => {
    mockReaFetch(initialSettings, {
      machineState: { connected: true, waterLevels: { currentLevel: 38, refillLevel: 15 } }
    });
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Water" }));

    expect(screen.getByText("Current water level")).toBeInTheDocument();
    expect(screen.getByText("38mm · 63%")).toBeInTheDocument();
  });

  it("keeps preset editing open when saving the slot fails", async () => {
    mockReaFetch(initialSettings, { failSettingsPut: true });
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Edit Light" }));
    const dialog = screen.getByRole("dialog", { name: "Edit Light preset" });
    await userEvent.click(screen.getByRole("button", { name: "Use Classic" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Could not save preset");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Light Blooming" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Light Classic" })).not.toBeInTheDocument();
  });

  it("compensates created beans when batch creation fails and keeps the bag form intact", async () => {
    const fetchState = mockReaFetch(initialSettings, { failBatchCreate: true });
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /Bags/i }));
    await userEvent.click(screen.getByRole("button", { name: "Add Bag" }));
    const form = screen.getByRole("form", { name: /Create a bag/i });

    await userEvent.type(within(form).getByLabelText("Roaster"), "Pilot");
    await userEvent.type(within(form).getByLabelText("Bean"), "Halo");
    await userEvent.type(within(form).getByLabelText("Country"), "Ethiopia");
    await userEvent.type(within(form).getByLabelText("Process"), "Washed");
    await userEvent.type(within(form).getByLabelText("Roast Date"), "2026-06-01");
    await userEvent.click(within(form).getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save bag: batch creation failed");
    expect(within(form).getByLabelText("Roaster")).toHaveValue("Pilot");
    expect(within(form).getByLabelText("Bean")).toHaveValue("Halo");
    expect(fetchState.fetchMock).toHaveBeenCalledWith("http://localhost:8080/api/v1/beans/bean-1", expect.objectContaining({ method: "DELETE" }));
    expect(fetchState.fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/beans/bean-1/batches",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          roastDate: "2026-06-01T00:00:00Z",
          roastLevel: undefined,
          notes: undefined,
          extras: { workflowSkin: { createdFromBagForm: true } }
        })
      })
    );
  });
});
