import type { AppInfo, DeviceInfo, MachineState, SensorListItem, WaterLevels } from "../api/types";

export interface ConnectivityStatus {
  id: "machine" | "wifi" | "scale" | "water" | "r2";
  label: string;
  detail: string;
  connected: boolean;
}

function sensorName(sensor: SensorListItem): string {
  return `${sensor.info.vendor} ${sensor.info.name}`.toLowerCase();
}

function isScaleSensor(sensor: SensorListItem): boolean {
  const name = sensorName(sensor);
  const hasWeightChannel = sensor.info.data.some((channel) => {
    const key = channel.key.toLowerCase();
    return key === "weight" || key === "mass" || key.includes("weight");
  });
  return hasWeightChannel || name.includes("scale") || name.includes("microbalance") || name.includes("acaia") || name.includes("hiroia");
}

function usableIp(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "localhost" || trimmed === "127.0.0.1" || trimmed === "::1") return undefined;
  return trimmed;
}

function machineIp(machineState: MachineState | null, appInfo: AppInfo | null | undefined, apiHost: string): string {
  return (
    machineState?.wifi?.ipAddress ??
    machineState?.wifi?.ip ??
    machineState?.network?.ipAddress ??
    machineState?.network?.ip ??
    machineState?.ipAddress ??
    machineState?.machineIp ??
    machineState?.ip ??
    usableIp(appInfo?.localIp) ??
    apiHost
  );
}

function recordValue(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return (value as Record<string, unknown>)[key];
}

function connectedText(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.toLowerCase();
  if (["connected", "ready", "true", "online"].includes(normalized)) return true;
  if (["disconnected", "false", "offline"].includes(normalized)) return false;
  return undefined;
}

function scaleConnectedFromMachineState(machineState: MachineState | null): boolean {
  if (!machineState) return false;
  const direct =
    connectedText(machineState.scale?.connected) ??
    connectedText(machineState.scale?.status) ??
    connectedText(machineState.scaleConnected) ??
    connectedText(machineState.scaleStatus) ??
    connectedText(recordValue(machineState, "scale_connection_state")) ??
    connectedText(recordValue(machineState, "scaleConnectionState"));
  if (direct !== undefined) return direct;
  return machineState.connectionStatus?.phase === "ready" || typeof machineState.scale?.weight === "number";
}

function scaleConnectedFromDevices(devices: DeviceInfo[] | undefined): boolean {
  return Boolean(devices?.some((device) => device.type === "scale" && device.state === "connected"));
}

function waterStatus(waterLevels: WaterLevels | null | undefined): ConnectivityStatus {
  const currentLevel = waterLevels?.currentLevel;
  const refillLevel = waterLevels?.refillLevel;
  if (typeof currentLevel !== "number" || !Number.isFinite(currentLevel)) {
    return { id: "water", label: "Water", detail: "Unknown", connected: false };
  }
  const rounded = Math.round(currentLevel);
  const low = typeof refillLevel === "number" && Number.isFinite(refillLevel) && currentLevel <= refillLevel;
  return {
    id: "water",
    label: "Water",
    detail: low ? `Low ${rounded}ml` : `${rounded}ml`,
    connected: !low
  };
}

export function buildConnectivityStatuses({
  apiHost,
  appInfo,
  machineState,
  sensors,
  devices,
  scaleConnected,
  waterLevels,
  r2SensorId,
  r2Sensor
}: {
  apiHost: string;
  appInfo?: AppInfo | null;
  machineState: MachineState | null;
  sensors: SensorListItem[];
  devices?: DeviceInfo[];
  scaleConnected?: boolean;
  waterLevels?: WaterLevels | null;
  r2SensorId?: string;
  r2Sensor: SensorListItem | null;
}): ConnectivityStatus[] {
  const machineConnected = Boolean(machineState && machineState.connected !== false);
  const ip = machineIp(machineState, appInfo, apiHost);
  const wifiConnected = Boolean(machineState && ip && machineState.wifi?.connected !== false && machineState.network?.connected !== false);
  const hasScale = Boolean(scaleConnected) || scaleConnectedFromMachineState(machineState) || scaleConnectedFromDevices(devices) || sensors.some(isScaleSensor);

  const statuses: ConnectivityStatus[] = [
    { id: "machine", label: "Machine", detail: machineConnected ? "Connected" : "Not connected", connected: machineConnected },
    { id: "wifi", label: "WiFi", detail: ip || "No IP", connected: wifiConnected },
    { id: "scale", label: "Scale", detail: hasScale ? "Connected" : "Not connected", connected: hasScale },
    waterStatus(waterLevels ?? machineState?.waterLevels)
  ];

  if (r2SensorId) {
    const connected = r2Sensor?.id === r2SensorId;
    statuses.push({ id: "r2", label: "R2", detail: connected ? "Connected" : "Not connected", connected });
  }

  return statuses;
}
