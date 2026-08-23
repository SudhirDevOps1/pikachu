import { useEffect, useState } from "react";
import { Cpu } from "lucide-react";
import { HudCard } from "./HudCard";
import { Sparkline } from "./Sparkline";
import { CircularGauge } from "./CircularGauge";
import { ScrambleText } from "./ScrambleText";
import { useStore } from "@/store/assistantStore";
import { detectOS } from "@/lib/utils";

const OS_NAME = detectOS();
const HISTORY_LEN = 30;

export function CoreMetricsPanel() {
  const status = useStore((s) => s.systemStatus);
  const [cpuHist, setCpuHist] = useState<number[]>(() => new Array(HISTORY_LEN).fill(0));
  const [ramHist, setRamHist] = useState<number[]>(() => new Array(HISTORY_LEN).fill(0));
  const [temp, setTemp] = useState(45);
  const accent = "var(--accent)";

  useEffect(() => {
    if (!status) return;
    setCpuHist((h) => [...h.slice(-(HISTORY_LEN - 1)), status.cpu]);
    setRamHist((h) => [...h.slice(-(HISTORY_LEN - 1)), status.ram]);
    setTemp(Math.round(38 + status.cpu * 0.22 + Math.random() * 3));
  }, [status]);

  return (
    <HudCard title="Core Metrics" icon={Cpu} dotColor={accent}>
      <div className="mb-4 flex items-center justify-around">
        <CircularGauge value={status?.cpu ?? 0} color="#06b6d4" label="CPU Load" sublabel={`${temp}°C`} />
        <CircularGauge value={status?.ram ?? 0} color={accent} label="RAM Usage" />
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
            <span className="text-center text-[11px] font-semibold leading-tight text-white">{OS_NAME}</span>
          </div>
          <span className="text-[9px] uppercase tracking-wider text-white/40">OS</span>
        </div>
      </div>

      <div className="rounded-xl bg-black/20 p-2">
        <div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-wide text-white/30">
          <ScrambleText text="LIVE TIMELINE" className="font-mono" trigger={status?.cpu ?? 0} />
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />CPU</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />RAM</span>
          </span>
        </div>
        <div className="relative">
          <Sparkline data={ramHist} color={accent} height={44} />
          <div className="absolute inset-0">
            <Sparkline data={cpuHist} color="#06b6d4" height={44} />
          </div>
        </div>
      </div>
    </HudCard>
  );
}
