import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { HudCard } from "./HudCard";
import { AnimatedCounter } from "./AnimatedCounter";
import { useStore } from "@/store/assistantStore";
import { cn } from "@/utils/cn";

type Metric = "CPU" | "RAM" | "TEMP";

interface Point {
  t: number;
  v: number;
}

// Live real-time metrics chart with CPU / RAM / Temperature tabs — updates
// every 2 seconds using data from the store's systemStatus feed.
export function LiveMetricsChart() {
  const status = useStore((s) => s.systemStatus);
  const [metric, setMetric] = useState<Metric>("CPU");
  const [history, setHistory] = useState<Record<Metric, Point[]>>({
    CPU: [],
    RAM: [],
    TEMP: [],
  });

  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setHistory((h) => {
        const cpu = status?.cpu ?? 30;
        const ram = status?.ram ?? 60;
        const temp = Math.round(38 + cpu * 0.22 + Math.random() * 3);
        return {
          CPU: [...h.CPU.slice(-19), { t: now, v: cpu }],
          RAM: [...h.RAM.slice(-19), { t: now, v: ram }],
          TEMP: [...h.TEMP.slice(-19), { t: now, v: temp }],
        };
      });
    }, 2000);
    return () => clearInterval(t);
  }, [status]);

  const data = history[metric];
  const currentValue = data[data.length - 1]?.v ?? 0;
  const unit = metric === "TEMP" ? "°C" : "%";
  const color = metric === "CPU" ? "#06b6d4" : metric === "RAM" ? "var(--accent)" : "#f97316";
  const label = metric === "CPU" ? "CPU USAGE" : metric === "RAM" ? "RAM USAGE" : "TEMPERATURE";

  return (
    <HudCard
      title="रियल-टाइम मेट्रिक्स"
      icon={Activity}
      dotColor={color}
      right={
        <div className="flex gap-1">
          {(["CPU", "RAM", "TEMP"] as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase transition",
                metric === m ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-1">
          <div className="font-mono text-3xl font-bold text-white">
            <AnimatedCounter value={Math.round(currentValue)} suffix={unit} />
          </div>
          <div className="mt-0.5 text-[9px] uppercase tracking-wider text-white/40">{label}</div>
        </div>
        <div className="col-span-2 h-14">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis domain={metric === "TEMP" ? [30, 90] : [0, 100]} hide />
              <Tooltip
                contentStyle={{
                  background: "rgba(10,14,26,0.9)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  fontSize: 11,
                }}
                labelFormatter={() => ""}
                formatter={(v) => [`${Math.round(Number(v))}${unit}`, metric] as [string, string]}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke={color}
                strokeWidth={2}
                fill={`url(#grad-${metric})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </HudCard>
  );
}
