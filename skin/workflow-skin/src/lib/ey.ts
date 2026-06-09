export function cleanNumber(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateEy(input: { yieldGrams?: number | null; tdsPercent?: number | null; doseGrams?: number | null }): number | null {
  const dose = input.doseGrams;
  const yieldGrams = input.yieldGrams;
  const tds = input.tdsPercent;
  if (!dose || dose <= 0 || yieldGrams == null || tds == null) return null;
  return round2((yieldGrams * tds) / dose);
}
