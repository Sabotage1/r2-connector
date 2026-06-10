import type { Bean, BeanBatch, Grinder, JsonMap, MachineState, ProfileRecord, SensorListItem, ShotPage, ShotRecord, Workflow } from "./types";

export interface CreateBeanPayload {
  roaster: string;
  name: string;
  country?: string;
  region?: string;
  processing?: string;
  notes?: string;
  extras?: JsonMap;
}

export interface CreateBatchPayload {
  roastDate?: string;
  roastLevel?: string;
  notes?: string;
  extras?: JsonMap;
}

export function apiBaseUrl(locationUrl?: URL): string {
  if (!locationUrl && typeof window === "undefined") return "http://localhost:8080";
  const url = locationUrl ?? new URL(window.location.href);
  return `${url.protocol}//${url.hostname}:8080`;
}

export class ReaPrimeApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ReaPrimeApiError";
  }
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
      throw new ReaPrimeApiError(`${method} ${path} failed: ${response.status} ${text}`, response.status);
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

  createBean(payload: CreateBeanPayload) {
    return this.request<Bean>("/api/v1/beans", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  deleteBean(id: string) {
    return this.request<void>(`/api/v1/beans/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
  }

  listBatches(beanId: string) {
    return this.request<BeanBatch[]>(`/api/v1/beans/${encodeURIComponent(beanId)}/batches?includeArchived=false`);
  }

  createBatch(beanId: string, payload: CreateBatchPayload) {
    return this.request<BeanBatch>(`/api/v1/beans/${encodeURIComponent(beanId)}/batches`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
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

  async getKv<T>(namespace: string, key: string): Promise<T | null> {
    try {
      return await this.request<T>(`/api/v1/kv/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`);
    } catch (error) {
      if (error instanceof ReaPrimeApiError && error.status === 404) return null;
      throw error;
    }
  }

  putKv(namespace: string, key: string, value: unknown) {
    return this.request<void>(`/api/v1/kv/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify(value)
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

  getMachineState() {
    return this.request<MachineState>("/api/v1/machine/state");
  }
}
