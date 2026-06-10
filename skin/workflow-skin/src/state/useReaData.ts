import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReaPrimeApi } from "../api/reaprime";
import type { Bean, BeanBatch, Grinder, MachineState, ProfileRecord, SensorListItem, ShotRecord, Workflow } from "../api/types";
import { buildBag, type Bag } from "../lib/bags";
import { defaultSkinSettings, loadSkinSettings, saveSkinSettings, type SkinSettings } from "./skinSettings";

export function useReaData(api: ReaPrimeApi) {
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [workflow, setWorkflow] = useState<Workflow>({});
  const [beans, setBeans] = useState<Bean[]>([]);
  const [batches, setBatches] = useState<BeanBatch[]>([]);
  const [grinders, setGrinders] = useState<Grinder[]>([]);
  const [sensors, setSensors] = useState<SensorListItem[]>([]);
  const [machineState, setMachineState] = useState<MachineState | null>(null);
  const [shots, setShots] = useState<ShotRecord[]>([]);
  const [settings, setSettings] = useState<SkinSettings>(defaultSkinSettings);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [profileList, workflowData, beanList, grinderList, shotPage, savedSettings, sensorList, state] = await Promise.all([
        api.listProfiles(),
        api.getWorkflow(),
        api.listBeans(),
        api.listGrinders(),
        api.listShots({ limit: 100, order: "desc" }),
        loadSkinSettings(api),
        api.listSensors().catch(() => [] as SensorListItem[]),
        api.getMachineState().catch(() => null as MachineState | null)
      ]);
      const batchLists = await Promise.all(beanList.map((bean) => api.listBatches(bean.id)));
      setProfiles(profileList);
      setWorkflow(workflowData);
      setBeans(beanList);
      setBatches(batchLists.flat());
      setGrinders(grinderList);
      setSensors(sensorList);
      setMachineState(state);
      setShots(Array.isArray(shotPage) ? shotPage : shotPage.items);
      setSettings(savedSettings);
      setError(null);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setMachineState(null);
      setLoaded(true);
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refresh();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const bags = useMemo<Bag[]>(() => {
    const beanById = new Map(beans.map((bean) => [bean.id, bean]));
    return batches.flatMap((batch) => {
      const bean = beanById.get(batch.beanId);
      return bean ? [buildBag(bean, batch)] : [];
    });
  }, [beans, batches]);

  const persistSettings = useCallback(
    async (next: SkinSettings) => {
      await saveSkinSettings(api, next);
      setSettings(next);
    },
    [api]
  );

  return { api, profiles, workflow, beans, batches, bags, grinders, sensors, machineState, shots, settings, error, loaded, refresh, persistSettings };
}
