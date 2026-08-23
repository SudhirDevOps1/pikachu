import { useEffect, useState } from "react";
import { Wifi, ArrowDownToLine, ArrowUpFromLine, Radio, Signal, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { HudCard } from "./HudCard";
import { AnimatedCounter } from "./AnimatedCounter";
import { useStore } from "@/store/assistantStore";

// Enhanced network telemetry HUD: latency, download/upload speeds, packet
// rate, and a live scrolling bar-graph of network traffic.
export function NetworkTelemetryPro() {
  const isConnected = useStore((s) => s.isConnected);
  const [latency, setLatency] = useState(14);
  const [down, setDown] = useState(65);
  const [up, setUp] = useState(28);
  const [rate, setRate] = useState(1018);
  const [bars, setBars] = useState<number[]>(() => new Array(22).fill(0).map(() => 0.3 + Math.random() * 0.7));

  useEffect(() => {
    const t = setInterval(() => {
      const base = isConnected ? 14 : 32;
      setLatency(Math.max(4, Math.round(base + (Math.random() - 0.5) * 10)));
      setDown(Math.max(1, Math.round(65 + (Math.random() - 0.5) * 30)));
      setUp(Math.max(1, Math.round(28 + (Math.random() - 0.5) * 16)));
      setRate(Math.max(50, Math.round(1000 + (Math.random() - 0.5) * 400)));
      setBars((b) => [...b.slice(1), 0.3 + Math.random() * 0.7]);
    }, 1500);
    return () => clearInterval(t);
  }, [isConnected]);

  return (
    <HudCard
      title="नेटवर्क टेलीमेट्री"
      icon={Wifi}
      dotColor={isConnected ? "#22c55e" : "#eab308"}
      right={
        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase" style={{ color: isConnected ? "#22c55e" : "#eab308" }}>
          <Signal size={10} /> {isConnected ? "ONLINE" : "OFFLINE"}
        </span>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        <StatBox icon={Radio} label="AVG LATENCY" value={latency} suffix="ms" tint="#06b6d4" />
        <StatBox icon={ArrowDownToLine} label="DOWNLOAD" value={down} suffix=" MB/s" tint="var(--accent)" />
        <StatBox icon={ArrowUpFromLine} label="UPLOAD" value={up} suffix=" MB/s" tint="#06b6d4" />
        <StatBox icon={Activity} label="PACKET RATE" value={rate} suffix="" hint="packets/sec" tint="var(--accent)" />
      </div>

      <div className="mt-3 rounded-xl bg-white/[0.03] p-2">
        <div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-wider text-white/40">
          <span>LIVE TRAFFIC</span>
          <span className="flex items-center gap-1 text-green-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" /> ACTIVE
          </span>
        </div>
        <div className="flex h-10 items-end gap-1">
          {bars.map((v, i) => (
            <motion.div
              key={i}
              className="flex-1 rounded-t"
              style={{ background: `linear-gradient(180deg, var(--accent), rgba(var(--accent-rgb),0.35))` }}
              animate={{ height: `${v * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          ))}
        </div>
      </div>
    </HudCard>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
  suffix,
  hint,
  tint,
}: {
  icon: typeof Wifi;
  label: string;
  value: number;
  suffix: string;
  hint?: string;
  tint: string;
}) {
  return (
    <div className="rounded-xl bg-white/[0.04] px-3 py-2">
      <div className="mb-1 flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-white/40">
        <Icon size={10} /> {label}
      </div>
      <div className="font-mono text-lg font-bold" style={{ color: tint }}>
        <AnimatedCounter value={value} suffix={suffix} />
      </div>
      {hint && <div className="text-[9px] text-white/30">{hint}</div>}
      <div className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="h-full rounded-full"
          style={{ background: tint }}
          animate={{ width: `${Math.min(100, value)}%` }}
          transition={{ duration: 0.6 }}
        />
      </div>
    </div>
  );
}
