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
    const request = api.getWorkflow();
    await expect(request).rejects.toThrow("GET /api/v1/workflow failed: 500 bad");
    await expect(request).rejects.toMatchObject({ status: 500 });
  });

  it("returns null for missing KV entries", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("missing", { status: 404 }));
    const api = new ReaPrimeApi("http://machine:8080");
    await expect(api.getKv("workflow skin", "settings/key")).resolves.toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      "http://machine:8080/api/v1/kv/workflow%20skin/settings%2Fkey",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("throws non-404 KV errors even when the response mentions 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("upstream mentioned 404", { status: 500 }));
    const api = new ReaPrimeApi("http://machine:8080");
    await expect(api.getKv("workflow-skin", "settings")).rejects.toThrow(
      "GET /api/v1/kv/workflow-skin/settings failed: 500 upstream mentioned 404"
    );
  });

  it("creates beans through the ReaPrime bean API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "bean-1", roaster: "Pilot", name: "Halo" }), { status: 200 })
    );
    const api = new ReaPrimeApi("http://machine:8080");

    await expect(
      api.createBean({
        roaster: "Pilot",
        name: "Halo",
        country: "Ethiopia",
        region: "Gedeb",
        processing: "Washed",
        notes: "Citrus",
        extras: { workflowSkin: true }
      })
    ).resolves.toEqual({ id: "bean-1", roaster: "Pilot", name: "Halo" });

    expect(fetch).toHaveBeenCalledWith(
      "http://machine:8080/api/v1/beans",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          roaster: "Pilot",
          name: "Halo",
          country: "Ethiopia",
          region: "Gedeb",
          processing: "Washed",
          notes: "Citrus",
          extras: { workflowSkin: true }
        })
      })
    );
  });

  it("creates batches for beans through the ReaPrime batch API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "batch-1", beanId: "bean/1", roastDate: "2026-06-01" }), { status: 200 })
    );
    const api = new ReaPrimeApi("http://machine:8080");

    await expect(
      api.createBatch("bean/1", {
        roastDate: "2026-06-01",
        roastLevel: "Light",
        notes: "Rest 10 days",
        extras: { workflowSkin: { createdFromBagForm: true } }
      })
    ).resolves.toEqual({ id: "batch-1", beanId: "bean/1", roastDate: "2026-06-01" });

    expect(fetch).toHaveBeenCalledWith(
      "http://machine:8080/api/v1/beans/bean%2F1/batches",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          roastDate: "2026-06-01",
          roastLevel: "Light",
          notes: "Rest 10 days",
          extras: { workflowSkin: { createdFromBagForm: true } }
        })
      })
    );
  });

  it("deletes beans through the ReaPrime bean API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 200 }));
    const api = new ReaPrimeApi("http://machine:8080");

    await expect(api.deleteBean("bean/1")).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledWith(
      "http://machine:8080/api/v1/beans/bean%2F1",
      expect.objectContaining({
        method: "DELETE"
      })
    );
  });
});
