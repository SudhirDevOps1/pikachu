import { motion } from "framer-motion";
import { AnimatedCounter } from "./AnimatedCounter";

export function CircularGauge({
  value,
  size = 80,
  stroke = 6,
  color,
  label,
  sublabel,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color: string;
  label: string;
  sublabel?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value));
  const dash = `${(pct / 100) * c} ${c}`;
  const glow = `drop-shadow(0 0 6px ${color})`;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size, filter: glow }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={dash}
            initial={{ strokeDasharray: `0 ${c}` }}
            animate={{ strokeDasharray: dash }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-sm font-bold text-white">
            <AnimatedCounter value={Math.round(pct)} suffix="%" />
          </span>
        </div>
      </div>
      <span className="text-[9px] uppercase tracking-wider text-white/40">{label}</span>
      {sublabel && <span className="text-[9px] text-white/25">{sublabel}</span>}
    </div>
  );
}
