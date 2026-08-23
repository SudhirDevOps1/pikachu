import { Zap, Cpu, MemoryStick, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useStore } from "@/store/assistantStore";
import { formatClock, formatHindiDate } from "@/lib/utils";
import { AccentPicker } from "./AccentPicker";
import { AnimatedCounter } from "./AnimatedCounter";
import { sounds } from "@/lib/soundEffects";

// Top banner used by the Futurist HUD dashboard. Logo, live clock+date,
// mini CPU/RAM chips, system online pill, and a mode toggle to switch
// back to the classic Standard mode.
export function FuturistHeader() {
  const [now, setNow] = useState(new Date());
  const status = useStore((s) => s.systemStatus);
  const isConnected = useStore((s) => s.isConnected);
  const setUiMode = useStore((s) => s.setUiMode);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
      <div className="flex items-center gap-3">
        <motion.div
          whileHover={{ rotate: 12, scale: 1.05 }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-lg"
          style={{
            background: `linear-gradient(135deg, var(--accent), #06b6d4)`,
            boxShadow: `0 0 24px rgba(var(--accent-rgb),0.4)`,
          }}
        >
          <Zap size={22} className="text-white" fill="white" />
        </motion.div>
        <div>
          <div className="text-lg font-bold leading-none text-white tracking-wide">PIKA AI</div>
          <div className="text-[10px] text-white/40">व्यक्तिगत AI असिस्टेंट</div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden sm:block">
          <div className="font-mono text-2xl font-light leading-none tracking-wider text-white">
            {formatClock(now)}
          </div>
          <div className="mt-1 text-[10px] text-white/45">{formatHindiDate(now)}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <AccentPicker />
        <MiniStatChip icon={Cpu} label="CPU" value={Math.round(status?.cpu ?? 0)} color="#06b6d4" />
        <MiniStatChip icon={MemoryStick} label="RAM" value={Math.round(status?.ram ?? 0)} color="var(--accent)" />
        <div className="glass-card hidden items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-semibold sm:flex">
          <span
            className="h-2 w-2 animate-pulse rounded-full"
            style={{
              background: isConnected ? "#22c55e" : "#eab308",
              boxShadow: `0 0 6px ${isConnected ? "#22c55e" : "#eab308"}`,
            }}
          />
          <span style={{ color: isConnected ? "#22c55e" : "#eab308" }}>SYSTEM ONLINE</span>
        </div>

        <button
          onClick={() => {
            sounds.click();
            setUiMode("standard");
          }}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition"
          style={{
            background: `linear-gradient(135deg, var(--accent), rgba(var(--accent-rgb),0.7))`,
            boxShadow: `0 0 16px rgba(var(--accent-rgb),0.4)`,
          }}
          title="स्टैंडर्ड मोड पर स्विच करें"
        >
          <Sparkles size={13} /> स्टैंडर्ड मोड
        </button>
      </div>
    </header>
  );
}

function MiniStatChip({ icon: Icon, label, value, color }: { icon: typeof Cpu; label: string; value: number; color: string }) {
  return (
    <div className="glass-card flex items-center gap-2 rounded-xl px-3 py-1.5">
      <Icon size={12} style={{ color }} />
      <div className="flex flex-col">
        <span className="text-[9px] uppercase tracking-wider text-white/40">{label}</span>
        <span className="font-mono text-xs font-bold text-white">
          <AnimatedCounter value={value} suffix="%" />
        </span>
      </div>
    </div>
  );
}
