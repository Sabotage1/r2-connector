import type { ProfileRecord, ShotRecord } from "../api/types";
import type { Bag } from "./bags";

export interface Recommendation {
  profile: ProfileRecord;
  score: number;
  reasons: string[];
}

export function recommendProfiles(input: {
  profiles: ProfileRecord[];
  shots: ShotRecord[];
  selectedBag?: Bag;
  bags: Bag[];
  preferredEy: [number, number];
}): Recommendation[] {
  const titleToProfile = new Map(input.profiles.map((profile) => [profile.profile.title, profile]));
  const bagById = new Map(input.bags.map((bag) => [bag.id, bag]));
  const scores = new Map<string, Recommendation>();

  for (const profile of input.profiles) {
    scores.set(profile.id, { profile, score: 0, reasons: [] });
  }

  for (const shot of input.shots) {
    const profile = titleToProfile.get(shot.workflow.profile?.title);
    if (!profile) continue;
    const rec = scores.get(profile.id);
    if (!rec) continue;
    const shotBagId = shot.workflow.context?.beanBatchId;
    const shotBag = shotBagId ? bagById.get(shotBagId) : undefined;
    const sameBag = input.selectedBag?.id && shotBagId === input.selectedBag.id;
    const sameProcess = input.selectedBag?.process && shotBag?.process === input.selectedBag.process;
    const sameCountry = input.selectedBag?.country && shotBag?.country === input.selectedBag.country;
    const ey = shot.annotations?.drinkEy;
    const enjoyment = shot.annotations?.enjoyment;

    if (sameBag) rec.score += 50;
    if (sameProcess) rec.score += 12;
    if (sameCountry) rec.score += 6;
    if (typeof enjoyment === "number") rec.score += enjoyment * 3;
    if (typeof ey === "number" && ey >= input.preferredEy[0] && ey <= input.preferredEy[1]) rec.score += 15;
  }

  for (const rec of scores.values()) {
    const matchingShots = input.shots.filter((shot) => shot.workflow.profile?.title === rec.profile.profile.title);
    const sameBagShots = matchingShots.filter((shot) => shot.workflow.context?.beanBatchId === input.selectedBag?.id);
    const enjoymentValues = matchingShots.map((shot) => shot.annotations?.enjoyment).filter((value): value is number => typeof value === "number");
    if (sameBagShots.length) rec.reasons.push(`${sameBagShots.length} previous shot${sameBagShots.length === 1 ? "" : "s"} on this bag`);
    if (enjoymentValues.length) {
      const avg = enjoymentValues.reduce((sum, value) => sum + value, 0) / enjoymentValues.length;
      rec.reasons.push(`average enjoyment ${avg.toFixed(1)}`);
    }
    if (rec.reasons.length === 0) rec.reasons.push("available profile with no matching history");
  }

  return [...scores.values()].sort((a, b) => b.score - a.score || a.profile.profile.title!.localeCompare(b.profile.profile.title!));
}
