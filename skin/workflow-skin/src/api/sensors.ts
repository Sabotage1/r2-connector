import type { SensorListItem } from "./types";

export interface R2Reading {
  tds?: number;
  temperature?: number;
  refractiveIndex?: number;
  status?: string;
  error?: string;
}

export function findDifluidR2Sensor(sensors: SensorListItem[]): SensorListItem | null {
  return (
    sensors.find((sensor) => {
      const name = `${sensor.info.vendor} ${sensor.info.name}`.toLowerCase();
      const hasTds = sensor.info.data.some((channel) => channel.key.toLowerCase() === "tds");
      return name.includes("difluid") && name.includes("r2") && hasTds;
    }) ?? null
  );
}

export function r2SocketUrl(apiBase: string, sensorId: string): string {
  const url = new URL(apiBase);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/ws/v1/sensors/${encodeURIComponent(sensorId)}/snapshot`;
  return url.toString();
}
