import type { Bean, BeanBatch, ShotRecord } from "../api/types";

export interface Bag {
  id: string;
  beanId: string;
  roaster?: string;
  bean?: string;
  country?: string;
  region?: string;
  process?: string;
  roastDate?: string;
  roastLevel?: string;
  notes?: string;
}

export interface BagFilters {
  roaster?: string;
  bean?: string;
  country?: string;
  region?: string;
  process?: string;
  roastLevel?: string;
}

export function buildBag(bean: Bean, batch: BeanBatch): Bag {
  return {
    id: batch.id,
    beanId: bean.id,
    roaster: bean.roaster,
    bean: bean.name,
    country: bean.country,
    region: bean.region,
    process: bean.processing,
    roastDate: batch.roastDate,
    roastLevel: batch.roastLevel,
    notes: batch.notes ?? bean.notes
  };
}

export function isValidBag(bag: Bag): boolean {
  return Boolean(bag.roaster?.trim() && bag.bean?.trim() && bag.roastDate?.trim() && bag.process?.trim());
}

function matches(value: string | undefined, filter: string | undefined): boolean {
  if (!filter) return true;
  return (value ?? "").toLowerCase().includes(filter.toLowerCase());
}

export function filterBags(bags: Bag[], filters: BagFilters): Bag[] {
  return bags.filter((bag) =>
    matches(bag.roaster, filters.roaster) &&
    matches(bag.bean, filters.bean) &&
    matches(bag.country, filters.country) &&
    matches(bag.region, filters.region) &&
    matches(bag.process, filters.process) &&
    matches(bag.roastLevel, filters.roastLevel)
  );
}

export function filterShotsByBagFields(shots: ShotRecord[], bags: Bag[], filters: BagFilters): ShotRecord[] {
  const matchingBatchIds = new Set(filterBags(bags, filters).map((bag) => bag.id));
  return shots.filter((shot) => {
    const batchId = shot.workflow.context?.beanBatchId;
    return batchId ? matchingBatchIds.has(batchId) : false;
  });
}
