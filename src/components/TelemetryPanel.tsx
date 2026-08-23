import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { HudCard } from "./HudCard";
import { ScrambleText } from "./ScrambleText";
import { useStore } from "@/store/assistantStore";

export function TelemetryPanel() {
  const isConnected = useStore((s) => s.isConnected);
  const [latency, setLatency] = useState(10);
  const [rate, setRate] = useState(42);
  const [pktLoss, setPktLoss] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      const base = isConnected ? 10 : 28;
      setLatency(Math.max(4, Math.round(base + (Math.random() - 0.5) * 12)));
      setRate(Math.max(2, Math.round(42 + (Math.random() - 0.5) * 40)));
      setPktLoss(isConnected ? 0 : Math.floor(Math.random() * 3));
    }, 1800);
    return () => clearInterval(t);
  }, [isConnected]);

  return (
    <HudCard title="Network Telemetry" icon={Radio} dotColor={isConnected ? "#22c55e" : "#eab308"}>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-white/[0.04] p-3 text-center">
          <div className="font-mono text-lg font-semibold text-white">
            <ScrambleText text={`${latency}ms`} trigger={latency} />
          </div>
          <div className="mt-1 text-[9px] uppercase tracking-wide text-white/35">Latency</div>
        </div>
        <div className="rounded-xl bg-white/[0.04] p-3 text-center">
          <div className="font-mono text-lg font-semibold text-white">
            <ScrambleText text={`${rate}KB/s`} trigger={rate} />
          </div>
          <div className="mt-1 text-[9px] uppercase tracking-wide text-white/35">Packet Rate</div>
        </div>
        <div className="rounded-xl bg-white/[0.04] p-3 text-center">
          <div className="font-mono text-lg font-semibold text-white">
            <ScrambleText text={`${pktLoss}%`} trigger={pktLoss} />
          </div>
          <div className="mt-1 text-[9px] uppercase tracking-wide text-white/35">Loss</div>
        </div>
      </div>
    </HudCard>
  );
}
