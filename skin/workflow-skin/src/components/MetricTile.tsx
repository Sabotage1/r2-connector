export function MetricTile({
  label,
  value,
  unit
}: {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
}) {
  return (
    <div className="metric-tile">
      <span>{label}</span>
      <strong>
        {value ?? "—"}
        {unit ? ` ${unit}` : ""}
      </strong>
    </div>
  );
}
