import type { ShotRecord } from "../api/types";
import type { CommunityShotEvidence } from "./types";

export function sanitizeShotEvidence(shot: ShotRecord): CommunityShotEvidence {
  return {
    id: shot.id,
    timestamp: shot.timestamp,
    profileTitle: shot.workflow.profile?.title,
    doseWeight: shot.annotations?.actualDoseWeight,
    drinkWeight: shot.annotations?.actualYield,
    tds: shot.annotations?.drinkTds,
    ey: shot.annotations?.drinkEy,
    enjoyment: shot.annotations?.enjoyment,
    notes: shot.annotations?.espressoNotes ?? shot.shotNotes,
    grindSetting: shot.workflow.context?.grinderSetting,
    grinderId: shot.workflow.context?.grinderId,
    grinderModel: shot.workflow.context?.grinderModel,
    measurements: shot.measurements
  };
}
