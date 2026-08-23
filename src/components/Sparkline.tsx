// Minimal rolling line-chart (like Task Manager's CPU timeline graph).
// Pure SVG — no canvas/chart library needed.
export function Sparkline({
  data,
  color,
  height = 36,
  max = 100,
}: {
  data: number[];
  color: string;
  height?: number;
  max?: number;
}) {
  const w = 100;
  const points = data
    .map((v, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * w;
      const y = height - (Math.min(Math.max(v, 0), max) / max) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const areaPoints = `0,${height} ${points} ${w},${height}`;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      {/* faint grid lines for that task-manager feel */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={0} x2={w} y1={height * f} y2={height * f} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
      ))}
      <polygon points={areaPoints} fill={color} fillOpacity={0.12} />
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
