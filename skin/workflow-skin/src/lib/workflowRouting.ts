import type { ProfileRecord, ShotRecord, Workflow } from "../api/types";
import { isMilkProfile, isReviewEnabled, type SkinSettings } from "../state/skinSettings";

export type PostShotPage = "review" | "steam" | null;
export type CompletedWorkflowActivity = "brew" | "steam";

function workflowSkinExtras(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const extras = value as Record<string, unknown>;
  const workflowSkin = extras.workflowSkin;
  if (!workflowSkin || typeof workflowSkin !== "object" || Array.isArray(workflowSkin)) return null;
  return workflowSkin as Record<string, unknown>;
}

export function selectedProfileIdFromWorkflow(workflow: Workflow | undefined, profiles: ProfileRecord[]): string | undefined {
  const selectedProfileId = workflowSkinExtras(workflow?.context?.extras)?.selectedProfileId;
  if (typeof selectedProfileId === "string") return selectedProfileId;

  const workflowTitle = workflow?.profile?.title?.trim();
  if (!workflowTitle) return undefined;
  return profiles.find((profile) => profile.profile.title?.trim() === workflowTitle)?.id;
}

export function postBrewPageForProfile(profileId: string | undefined, settings: SkinSettings): PostShotPage {
  if (isReviewEnabled(settings, profileId)) return "review";
  if (isMilkProfile(settings, profileId)) return "steam";
  return null;
}

export function postActivityPage(activity: CompletedWorkflowActivity, profileId: string | undefined, settings: SkinSettings): PostShotPage {
  if (activity === "steam") return "review";
  return postBrewPageForProfile(profileId, settings);
}

export function postShotPageForShot(shot: ShotRecord, settings: SkinSettings, profiles: ProfileRecord[]): PostShotPage {
  return postBrewPageForProfile(selectedProfileIdFromWorkflow(shot.workflow, profiles), settings);
}
