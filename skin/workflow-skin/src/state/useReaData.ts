import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReaPrimeApi } from "../api/reaprime";
import type { Bean, BeanBatch, Grinder, ProfileRecord, SensorListItem, ShotRecord, Workflow } from "../api/types";
import { buildBag, type Bag } from "../lib/bags";
import { defaultSkinSettings, loadSkinSettings, saveSkinSettings, type SkinSettings } from "./skinSettings";

export function useReaData(api: ReaPrimeApi) {
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [workflow, setWorkflow] = useState<Workflow>({});
  const [beans, setBeans] = useState<Bean[]>([]);
  const [batches, setBatches] = useState<BeanBatch[]>([]);
  const [grinders, setGrinders] = useState<Grinder[]>([]);
  const [sensors, setSensors] = useState<SensorListItem[]>([]);
  const [shots, setShots] = useState<ShotRecord[]>([]);
  const [settings, setSettings] = useState<SkinSettings>(defaultSkinSettings);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [profileList, workflowData, beanList, grinderList, shotPage, savedSettings, sensorList] = await Promise.all([
        api.listProfiles(),
        api.getWorkflow(),
        api.listBeans(),
        api.listGrinders(),
        api.listShots({ limit: 100, order: "desc" }),
        loadSkinSettings(api),
        api.listSensors().catch(() => [] as SensorListItem[])
      ]);
      const batchLists = await Promise.all(beanList.map((bean) => api.listBatches(bean.id)));
      setProfiles(profileList);
      setWorkflow(workflowData);
      setBeans(beanList);
      setBatches(batchLists.flat());
      setGrinders(grinderList);
      setSensors(sensorList);
      setShots(Array.isArray(shotPage) ? shotPage : shotPage.items);
      setSettings(savedSettings);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [api]);

  useEffect(() => {
    void refresh();
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

  return { api, profiles, workflow, beans, batches, bags, grinders, sensors, shots, settings, error, refresh, persistSettings };
}
