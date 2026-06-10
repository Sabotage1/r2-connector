import type { MachineState, SensorListItem } from "../api/types";

export interface ConnectivityStatus {
  id: "machine" | "wifi" | "scale" | "r2";
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
    return key === "weight" || key === "mass";
  });
  return hasWeightChannel || name.includes("scale") || name.includes("microbalance");
}

function machineIp(machineState: MachineState | null, apiHost: string): string {
  return (
    machineState?.wifi?.ipAddress ??
    machineState?.wifi?.ip ??
    machineState?.network?.ipAddress ??
    machineState?.network?.ip ??
    machineState?.ipAddress ??
    machineState?.machineIp ??
    machineState?.ip ??
    apiHost
  );
}

export function buildConnectivityStatuses({
  apiHost,
  machineState,
  sensors,
  r2SensorId,
  r2Sensor
}: {
  apiHost: string;
  machineState: MachineState | null;
  sensors: SensorListItem[];
  r2SensorId?: string;
  r2Sensor: SensorListItem | null;
}): ConnectivityStatus[] {
  const machineConnected = Boolean(machineState && machineState.connected !== false);
  const ip = machineIp(machineState, apiHost);
  const wifiConnected = Boolean(machineState && ip && machineState.wifi?.connected !== false && machineState.network?.connected !== false);
  const scaleConnected = Boolean(machineState?.scale?.connected) || sensors.some(isScaleSensor);

  const statuses: ConnectivityStatus[] = [
    { id: "machine", label: "Machine", detail: machineConnected ? "Connected" : "Not connected", connected: machineConnected },
    { id: "wifi", label: "WiFi", detail: ip || "No IP", connected: wifiConnected },
    { id: "scale", label: "Scale", detail: scaleConnected ? "Connected" : "Not connected", connected: scaleConnected }
  ];

  if (r2SensorId) {
    const connected = r2Sensor?.id === r2SensorId;
    statuses.push({ id: "r2", label: "R2", detail: connected ? "Connected" : "Not connected", connected });
  }

  return statuses;
}
