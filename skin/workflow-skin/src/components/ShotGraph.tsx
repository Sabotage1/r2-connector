import type { ShotSnapshot } from "../api/types";
import { graphSeries } from "../lib/shotStats";

export function ShotGraph({ measurements }: { measurements: ShotSnapshot[] }) {
  const series = graphSeries(measurements);
  const width = 640;
  const height = 220;
  const points = series
    .map((sample, index) => {
      const x = series.length <= 1 ? 0 : (index / (series.length - 1)) * width;
      const y = height - Math.min(1, sample.pressure / 12) * height;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg className="shot-graph" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Shot pressure graph">
      <rect width={width} height={height} rx="8" fill="#10161b" />
      <polyline points={points} fill="none" stroke="#77d1c2" strokeWidth="4" />
    </svg>
  );
}
