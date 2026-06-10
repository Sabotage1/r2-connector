import { Pencil } from "lucide-react";
import type { ProfileRecord } from "../api/types";
import type { PresetSlot } from "../state/skinSettings";

function profileTitle(profile: ProfileRecord | undefined): string {
  return profile?.profile.title?.trim() || "Choose profile";
}

export function ProfilePresetGrid({
  slots,
  profiles,
  onApply,
  onEditSlot
}: {
  slots: PresetSlot[];
  profiles: ProfileRecord[];
  onApply: (profile: ProfileRecord) => void;
  onEditSlot: (index: number) => void;
}) {
  return (
    <div className="preset-grid">
      {slots.map((slot, index) => {
        const profile = profiles.find((item) => item.id === slot.profileId);
        return (
          <div className="preset-button" key={`${slot.label}-${index}`}>
            <button
              type="button"
              aria-label={`${slot.label} ${profileTitle(profile)}`}
              disabled={!profile}
              onClick={() => profile && onApply(profile)}
            >
              <span>{slot.label}</span>
              <strong>{profileTitle(profile)}</strong>
            </button>
            <button type="button" className="icon-button" aria-label={`Edit ${slot.label}`} onClick={() => onEditSlot(index)}>
              <Pencil size={18} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
