import { useEffect, useState } from "react";
import { Cpu, MemoryStick } from "lucide-react";
import { useStore } from "@/store/assistantStore";
import { formatClock, formatHindiDate } from "@/lib/utils";

export function Dashboard() {
  const [now, setNow] = useState(new Date());
  const status = useStore((s) => s.systemStatus);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex items-center gap-5">
      <div>
        <div className="font-mono text-2xl font-light leading-none tracking-wider text-white">
          {formatClock(now)}
        </div>
        <div className="mt-1 text-xs text-white/45">{formatHindiDate(now)}</div>
      </div>

      <div className="hidden items-center gap-3 md:flex">
        <MiniStat icon={<Cpu size={13} />} label="CPU" value={status?.cpu ?? 0} color="#7c3aed" />
        <MiniStat icon={<MemoryStick size={13} />} label="RAM" value={status?.ram ?? 0} color="#06b6d4" />
      </div>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color }}>{icon}</span>
      <div className="w-16">
        <div className="flex justify-between text-[10px] text-white/50">
          <span>{label}</span>
          <span>{Math.round(value)}%</span>
        </div>
        <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, background: color }} />
        </div>
      </div>
    </div>
  );
}
