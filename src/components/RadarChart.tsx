import { useMemo } from "react";

// Minimal SVG radar / spider chart for system-health visualization.
// No external chart library — pure SVG math.
export function RadarChart({
  values,
  labels,
  size = 140,
  color = "var(--accent)",
}: {
  values: number[];
  labels: string[];
  size?: number;
  color?: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.38;
  const n = values.length;

  const points = useMemo(() => {
    return values.map((v, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const r = (Math.min(100, Math.max(0, v)) / 100) * radius;
      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    });
  }, [values, n, cx, cy, radius]);

  const poly = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const gridRings = [0.25, 0.5, 0.75, 1];

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {/* grid rings */}
        {gridRings.map((f) => (
          <polygon
            key={f}
            points={Array.from({ length: n })
              .map((_, i) => {
                const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
                const r = radius * f;
                return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
              })
              .join(" ")}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={0.5}
          />
        ))}
        {/* axis lines */}
        {Array.from({ length: n }).map((_, i) => {
          const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={cx + radius * Math.cos(angle)}
              y2={cy + radius * Math.sin(angle)}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={0.5}
            />
          );
        })}
        {/* data area */}
        <polygon points={poly} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
        {/* data points */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} />
        ))}
      </svg>
      {/* labels around the edge */}
      {labels.map((label, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        const r = radius + 14;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        return (
          <span
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2 text-[8px] uppercase tracking-wider text-white/30"
            style={{ left: x, top: y }}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}
