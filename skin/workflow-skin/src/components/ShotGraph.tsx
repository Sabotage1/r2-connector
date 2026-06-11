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
      {points ? (
        <polyline points={points} fill="none" stroke="#77d1c2" strokeWidth="4" />
      ) : (
        <>
          <line x1="32" y1={height - 34} x2={width - 32} y2={height - 34} stroke="#2a343c" strokeWidth="2" strokeDasharray="10 10" />
          <text x={width / 2} y={height / 2} fill="#7f8b94" fontSize="18" fontWeight="800" textAnchor="middle">
            Waiting for live data
          </text>
        </>
      )}
    </svg>
  );
}
