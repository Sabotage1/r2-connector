import type { SensorListItem } from "../api/types";
import type { SkinSettings } from "../state/skinSettings";

export function SettingsPage({
  settings,
  r2Sensor,
  onUpdateSettings
}: {
  settings: SkinSettings;
  r2Sensor: SensorListItem | null;
  onUpdateSettings: (settings: SkinSettings) => void;
}) {
  const r2Configured = Boolean(settings.r2SensorId);

  return (
    <div className="panel wide">
      <h2>Settings</h2>
      <div className="list-row">
        <strong>DiFluid R2 status</strong>
        <span>{r2Configured ? `Configured sensor: ${settings.r2SensorId}` : "R2 status is hidden until setup."}</span>
        <div className="profile-workflow-controls">
          <button
            type="button"
            className="primary-button"
            disabled={!r2Sensor}
            onClick={() => r2Sensor && onUpdateSettings({ ...settings, r2SensorId: r2Sensor.id })}
          >
            {r2Sensor ? "Use detected R2" : "No R2 detected"}
          </button>
          {r2Configured && (
            <button type="button" className="ghost-button" onClick={() => onUpdateSettings({ ...settings, r2SensorId: undefined })}>
              Hide R2 status
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
