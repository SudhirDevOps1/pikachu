import { Shield } from "lucide-react";
import { HudCard } from "./HudCard";
import { RadarChart } from "./RadarChart";
import { ScrambleText } from "./ScrambleText";
import { useStore } from "@/store/assistantStore";

// System health radar — visualizes CPU, RAM, Disk, Battery, Network and
// Security scores on a hexagonal radar chart.
export function SystemHealthPanel() {
  const status = useStore((s) => s.systemStatus);
  const isConnected = useStore((s) => s.isConnected);

  const cpu = status?.cpu ?? 0;
  const ram = status?.ram ?? 0;
  const disk = 66; // simulated
  const battery = status?.battery ? (status.battery.plugged ? 100 : status.battery.percent) : 78;
  const network = isConnected ? 95 : 30;
  const security = 88;

  const values = [cpu, ram, disk, battery, network, security];
  const labels = ["CPU", "RAM", "Disk", "Batt", "Net", "Sec"];

  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const healthLabel = avg > 80 ? "EXCELLENT" : avg > 60 ? "GOOD" : avg > 40 ? "FAIR" : "POOR";

  return (
    <HudCard title="System Health" icon={Shield} dotColor={avg > 60 ? "#22c55e" : "#eab308"}>
      <div className="flex items-center justify-around">
        <RadarChart values={values} labels={labels} size={130} />
        <div className="flex flex-col items-center gap-1">
          <div className="font-mono text-3xl font-bold text-white">{avg}%</div>
          <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--accent)" }}>
            <ScrambleText text={healthLabel} trigger={avg} />
          </div>
          <div className="mt-2 space-y-1">
            {[
              { l: "CPU", v: cpu, c: "#06b6d4" },
              { l: "RAM", v: ram, c: "var(--accent)" },
              { l: "NET", v: network, c: "#22c55e" },
            ].map((item) => (
              <div key={item.l} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: item.c }} />
                <span className="w-6 text-[9px] text-white/40">{item.l}</span>
                <div className="h-1 w-16 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${item.v}%`, background: item.c }}
                  />
                </div>
                <span className="w-6 text-right font-mono text-[9px] text-white/50">{Math.round(item.v)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </HudCard>
  );
}
