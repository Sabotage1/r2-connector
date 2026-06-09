import { afterEach, describe, expect, it, vi } from "vitest";
import { apiBaseUrl, ReaPrimeApi } from "../api/reaprime";

describe("apiBaseUrl", () => {
  it("uses the current hostname on ReaPrime port 8080", () => {
    expect(apiBaseUrl(new URL("http://192.168.1.20:3000/"))).toBe("http://192.168.1.20:8080");
  });

  it("uses localhost when no browser location is supplied", () => {
    expect(apiBaseUrl()).toBe("http://localhost:8080");
  });
});

describe("ReaPrimeApi", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads profiles from ReaPrime", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ id: "p1", profile: { title: "Bloom" } }]), { status: 200 })
    );
    const api = new ReaPrimeApi("http://machine:8080");
    await expect(api.listProfiles()).resolves.toEqual([{ id: "p1", profile: { title: "Bloom" } }]);
    expect(fetch).toHaveBeenCalledWith("http://machine:8080/api/v1/profiles", expect.objectContaining({ method: "GET" }));
  });

  it("throws readable errors for non-2xx responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad", { status: 500 }));
    const api = new ReaPrimeApi("http://machine:8080");
    await expect(api.getWorkflow()).rejects.toThrow("GET /api/v1/workflow failed: 500 bad");
  });
});
