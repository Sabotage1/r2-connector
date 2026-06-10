export type JsonMap = Record<string, unknown>;

export interface Profile {
  title?: string;
  author?: string;
  notes?: string;
  beverage_type?: string;
  target_weight?: number | null;
  steps?: Array<JsonMap>;
}

export interface ProfileRecord {
  id: string;
  profile: Profile;
  metadata?: JsonMap;
  visibility?: "visible" | "hidden";
}

export interface WorkflowContext {
  targetDoseWeight?: number;
  targetYield?: number;
  grinderId?: string;
  grinderModel?: string;
  grinderSetting?: string;
  beanBatchId?: string;
  coffeeName?: string;
  coffeeRoaster?: string;
  finalBeverageType?: string;
  baristaName?: string;
  drinkerName?: string;
  extras?: JsonMap;
}

export interface Workflow {
  id?: string;
  name?: string;
  description?: string;
  profile?: Profile;
  context?: WorkflowContext;
}

export interface Bean {
  id: string;
  roaster: string;
  name: string;
  country?: string;
  region?: string;
  processing?: string;
  notes?: string;
  archived?: boolean;
  extras?: JsonMap;
}

export interface BeanBatch {
  id: string;
  beanId: string;
  roastDate?: string;
  roastLevel?: string;
  openDate?: string;
  weight?: number;
  weightRemaining?: number;
  notes?: string;
  archived?: boolean;
  extras?: JsonMap;
}

export interface Grinder {
  id: string;
  manufacturer?: string;
  model: string;
  settingType?: "numeric" | "preset";
  notes?: string;
}

export interface ShotAnnotations {
  actualDoseWeight?: number;
  actualYield?: number;
  drinkTds?: number;
  drinkEy?: number;
  enjoyment?: number;
  espressoNotes?: string;
  extras?: JsonMap;
}

export interface ShotSnapshot {
  machine?: {
    timestamp?: string;
    pressure?: number;
    targetPressure?: number;
    flow?: number;
    targetFlow?: number;
    mixTemperature?: number;
    groupTemperature?: number;
    targetMixTemperature?: number;
    state?: { state?: string; substate?: string };
  };
  scale?: {
    weight?: number;
    weightFlow?: number;
  };
}

export interface ShotRecord {
  id: string;
  timestamp: string;
  workflow: Workflow;
  measurements?: ShotSnapshot[];
  annotations?: ShotAnnotations;
  shotNotes?: string;
  metadata?: JsonMap;
}

export interface ShotPage {
  items: ShotRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface SensorListItem {
  id: string;
  info: {
    name: string;
    vendor: string;
    data: Array<{ key: string; type: string; unit?: string }>;
    commands?: Array<{ id: string; name?: string; description?: string }>;
  };
}

export interface MachineState {
  connected?: boolean;
  ip?: string;
  ipAddress?: string;
  machineIp?: string;
  wifi?: {
    connected?: boolean;
    ip?: string;
    ipAddress?: string;
    ssid?: string;
  };
  network?: {
    connected?: boolean;
    ip?: string;
    ipAddress?: string;
  };
  scale?: {
    connected?: boolean;
    name?: string;
  };
}
