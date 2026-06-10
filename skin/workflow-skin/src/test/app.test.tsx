import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import type { SkinSettings } from "../state/skinSettings";

const profiles = [
  { id: "p1", profile: { title: "Blooming" } },
  { id: "p2", profile: { title: "Classic" } }
];

function responseJson(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), { status }));
}

function mockReaFetch(initialSettings: SkinSettings) {
  let savedSettings = initialSettings;
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input, init = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? "GET";

    if (method === "GET" && url.pathname === "/api/v1/profiles") return responseJson(profiles);
    if (method === "GET" && url.pathname === "/api/v1/workflow") return responseJson({ context: { targetDoseWeight: 18, targetYield: 36 } });
    if (method === "GET" && url.pathname === "/api/v1/beans") return responseJson([]);
    if (method === "GET" && url.pathname === "/api/v1/grinders") return responseJson([]);
    if (method === "GET" && url.pathname === "/api/v1/shots") return responseJson({ items: [], total: 0, limit: 100, offset: 0 });
    if (method === "GET" && url.pathname === "/api/v1/kv/workflow-skin/settings") return responseJson(savedSettings);
    if (method === "PUT" && url.pathname === "/api/v1/kv/workflow-skin/settings") {
      savedSettings = JSON.parse(String(init.body)) as SkinSettings;
      return Promise.resolve(new Response("", { status: 200 }));
    }

    return Promise.reject(new Error(`Unhandled ${method} ${url.pathname}${url.search}`));
  });

  return {
    fetchMock,
    get savedSettings() {
      return savedSettings;
    }
  };
}

const initialSettings: SkinSettings = {
  presetSlots: [
    { label: "Light", profileId: "p1" },
    { label: "Sweet" },
    { label: "Turbo" },
    { label: "Classic" }
  ],
  defaultReviewEnabled: true,
  reviewEnabledByProfile: {}
};

describe("App shell", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
});
