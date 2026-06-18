import { afterEach, describe, expect, it, vi } from "vitest";
import { CommunityApi } from "../api/community";

describe("CommunityApi", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists recommendations from the Worker", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ version: 1, updatedAt: "now", items: [] }), { status: 200 }));
    await expect(new CommunityApi("https://worker.example").listRecommendations()).resolves.toEqual({ version: 1, updatedAt: "now", items: [] });
    expect(fetch).toHaveBeenCalledWith("https://worker.example/api/recommendations", expect.objectContaining({ method: "GET" }));
  });

  it("throws readable errors from the Worker", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "bad upload" }), { status: 400 }));
    await expect(new CommunityApi("https://worker.example").listRecommendations()).rejects.toThrow("GET /api/recommendations failed: 400 bad upload");
  });
});
