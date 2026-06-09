import type { Bean, BeanBatch, Grinder, ProfileRecord, SensorListItem, ShotPage, ShotRecord, Workflow } from "./types";

export function apiBaseUrl(locationUrl?: URL): string {
  if (!locationUrl && typeof window === "undefined") return "http://localhost:8080";
  const url = locationUrl ?? new URL(window.location.href);
  return `${url.protocol}//${url.hostname}:8080`;
}

export class ReaPrimeApi {
  constructor(private readonly baseUrl = apiBaseUrl()) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const method = init.method ?? "GET";
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {})
      }
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${method} ${path} failed: ${response.status} ${text}`);
    }
    return text ? (JSON.parse(text) as T) : (undefined as T);
  }

  listProfiles() {
    return this.request<ProfileRecord[]>("/api/v1/profiles");
  }

  listDefaultProfiles() {
    return this.request<ProfileRecord[]>("/api/v1/profiles/defaults");
  }

  getWorkflow() {
    return this.request<Workflow>("/api/v1/workflow");
  }

  updateWorkflow(patch: Partial<Workflow>) {
    return this.request<Workflow>("/api/v1/workflow", {
      method: "PUT",
      body: JSON.stringify(patch)
    });
  }

  listBeans() {
    return this.request<Bean[]>("/api/v1/beans?includeArchived=false");
  }

  listBatches(beanId: string) {
    return this.request<BeanBatch[]>(`/api/v1/beans/${encodeURIComponent(beanId)}/batches?includeArchived=false`);
  }

  listGrinders() {
    return this.request<Grinder[]>("/api/v1/grinders?includeArchived=false");
  }

  listShots(params: Record<string, string | number | undefined> = {}) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") search.set(key, String(value));
    }
    const query = search.toString();
    return this.request<ShotPage | ShotRecord[]>(`/api/v1/shots${query ? `?${query}` : ""}`);
  }

  getShot(id: string) {
    return this.request<ShotRecord>(`/api/v1/shots/${encodeURIComponent(id)}`);
  }

  getLatestShot() {
    return this.request<ShotRecord | null>("/api/v1/shots/latest");
  }

  updateShot(id: string, patch: Partial<ShotRecord>) {
    return this.request<ShotRecord>(`/api/v1/shots/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(patch)
    });
  }

  listSensors() {
    return this.request<SensorListItem[]>("/api/v1/sensors");
  }

  executeSensor(id: string, commandId: string, params?: Record<string, unknown>) {
    return this.request<{ status: "ok" | "error"; result?: unknown; message?: string }>(
      `/api/v1/sensors/${encodeURIComponent(id)}/execute`,
      {
        method: "POST",
        body: JSON.stringify({ commandId, params })
      }
    );
  }
}
