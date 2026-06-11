import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import skinManifest from "../../skin-manifest.json";
import { App } from "../App";
import type { AppInfo, DeviceInfo, MachineState, ProfileRecord, ShotRecord, WebUISkin } from "../api/types";
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
    shots?: ShotRecord[];
    workflow?: unknown;
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
  } = {}
) {
  let savedSettings = initialSettings;
  let workflow = options.workflow ?? { context: { targetDoseWeight: 18, targetYield: 36 } };
  let displayState = options.displayState ?? { brightness: 100, wakeLockOverride: true };
  let machineState = options.machineState ?? { connected: true, wifi: { connected: true, ipAddress: "192.168.1.20" } };
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input, init = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? "GET";

    if (method === "GET" && url.hostname === "api.github.com" && url.pathname.startsWith("/repos/")) {
      return responseJson({ tag_name: options.githubLatestTag ?? "v0.1.20" });
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
      workflow = JSON.parse(String(init.body));
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
    if (method === "GET" && url.pathname === "/api/v1/devices") return responseJson(options.devices ?? []);
    if (method === "GET" && url.pathname === "/api/v1/devices/scan") return responseJson([]);
    if (method === "PUT" && url.pathname === "/api/v1/devices/connect") return Promise.resolve(new Response("", { status: 200 }));
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
    if (method === "GET" && url.pathname === "/api/v1/shots") return responseJson({ items: options.shots ?? [], total: options.shots?.length ?? 0, limit: 100, offset: 0 });
    if (method === "GET" && url.pathname === "/api/v1/steams") return responseJson(options.steams ?? []);
    if (method === "GET" && url.pathname === "/api/v1/sensors") return responseJson([]);
    if (method === "GET" && url.pathname === "/api/v1/plugins") return responseJson(options.plugins ?? []);
    if (method === "GET" && url.pathname === "/api/v1/plugins/visualizer.reaplugin/settings") return responseJson(options.pluginSettings ?? {});
    if (method === "GET" && url.pathname.startsWith("/api/v1/plugins/visualizer.reaplugin/")) {
      const endpoint = url.pathname.split("/").pop() ?? "";
      return responseJson(options.visualizerStatus?.[endpoint] ?? {});
    }
    if (method === "GET" && url.pathname === "/api/v1/webui/skins") {
      return responseJson(
        options.webuiSkins ?? [{ id: "workflow-skin", name: "Workflow Skin", version: "0.1.9", path: "/skins/workflow", isBundled: false }]
      );
    }
    if (method === "GET" && url.pathname === "/api/v1/webui/skins/default") {
      return responseJson(options.defaultWebuiSkin ?? { id: "workflow-skin", name: "Workflow Skin", version: "0.1.9", path: "/skins/workflow", isBundled: false });
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
    get displayState() {
      return displayState;
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
  skinTitle: "Workflow",
  shownProfileIds: ["p1", "p2"],
  profileWorkflows: {}
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

  it("renders the skin title as a centered app headline outside the menu", async () => {
    mockReaFetch({ ...initialSettings, skinTitle: "Roy's Workflow" });
    render(<App />);

    const title = await screen.findByLabelText("App title");

    expect(title).toHaveTextContent("Roy's Workflow");
    expect(title.closest("nav")).toBeNull();
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

  it("edits main menu visibility and order from the sidebar", async () => {
    const fetchState = mockReaFetch(initialSettings);
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));
    await userEvent.click(await screen.findByRole("button", { name: "Edit main menu in sidebar" }));
    await userEvent.click(await screen.findByRole("button", { name: "Move Grinders up" }));
    await userEvent.click(screen.getByRole("button", { name: "Hide History" }));

    expect(fetchState.savedSettings.hiddenMainMenuItemIds).toEqual(["history"]);
    expect(fetchState.savedSettings.mainMenuItems.indexOf("grinders")).toBeLessThan(fetchState.savedSettings.mainMenuItems.indexOf("profiles"));
    expect(screen.getByRole("button", { name: "Show History" })).toBeInTheDocument();
  });

  it("uses larger icons and a notepad edit icon in the collapsed menu", async () => {
    mockReaFetch({ ...initialSettings, menuCollapsed: true });
    render(<App />);

    const reviewButton = await screen.findByRole("button", { name: "Review" });
    const reviewIcon = reviewButton.querySelector("svg");

    expect(reviewButton).toHaveClass("review-nav-button");
    expect(reviewIcon).toHaveClass("review-nav-icon");
    expect(reviewIcon).toHaveAttribute("width", "40");
    expect(reviewIcon).toHaveAttribute("height", "40");
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

  it("auto sleeps the machine after the configured idle timer", async () => {
    const fetchState = mockReaFetch(
      { ...initialSettings, autoSleepMinutes: 0.001 },
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
    expect(await screen.findByText("Machine sleeping")).toBeInTheDocument();
  });

  it("puts the machine to sleep and moves into screensaver mode", async () => {
    const fetchState = mockReaFetch({ ...initialSettings, keepScreenAwake: true, screensaverBrightness: 8 } as SkinSettings);
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Sleep machine" }));

    expect(await screen.findByRole("heading", { name: "Workflow" })).toBeInTheDocument();
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

    expect(await screen.findByRole("status")).toHaveTextContent("Trying to connect scale.");
    expect(fetchState.fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/devices/scan?connect=true&quick=false",
      expect.objectContaining({ method: "GET" })
    );
    expect(fetchState.fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/devices/connect",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ deviceId: "scale-1" }) })
    );
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
      webuiSkins: [{ id: "workflow-skin", name: "Workflow Skin", version: currentSkinVersion, path: "/skins/workflow", isBundled: false }],
      defaultWebuiSkin: { id: "workflow-skin", name: "Workflow Skin", version: currentSkinVersion, path: "/skins/workflow", isBundled: false },
      githubLatestTag: "v99.0.0"
    });
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));
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
        body: JSON.stringify({ url: "https://raw.githubusercontent.com/Sabotage1/r2-connector/main/skin/workflow-skin/workflow-skin.zip" })
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
    const form = screen.getByRole("form", { name: /Add a bag/i });

    await userEvent.type(within(form).getByLabelText("Roaster"), "Pilot");
    await userEvent.type(within(form).getByLabelText("Bean"), "Halo");
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
