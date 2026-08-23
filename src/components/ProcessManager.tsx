import { useState, useEffect } from "react";
import { Activity, RefreshCw, Search, XCircle } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { GlowButton } from "./GlowButton";
import { PanelHeader } from "./PanelHeader";
import { useAssistantApi } from "@/hooks/AssistantContext";
import { useStore } from "@/store/assistantStore";

export function ProcessManager() {
  const { processInput } = useAssistantApi();
  const [q, setQ] = useState("");
  const processes = useStore((s) => s.processes);

  useEffect(() => {
    processInput("list processes");
  }, [processInput]);

  const list = (processes || [])
    .filter((p) => (p.name || "").toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.ram || 0) - (a.ram || 0));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <PanelHeader icon={Activity} title="प्रोसेस मैनेजर" desc="चल रहे प्रोग्राम देखें और बंद करें" />
        <GlowButton onClick={() => processInput("list processes")}><RefreshCw size={15} /> रिफ्रेश</GlowButton>
      </div>

      <GlassCard className="flex items-center gap-2 p-3">
        <Search size={16} className="text-white/40" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="प्रोसेस खोजें..." className="flex-1 bg-transparent text-white outline-none placeholder-white/30" />
      </GlassCard>

      <GlassCard className="overflow-hidden">
        <div className="grid grid-cols-[60px_1fr_70px_70px_80px_50px] gap-2 border-b border-white/10 px-4 py-3 text-xs uppercase text-white/40">
          <span>PID</span><span>नाम</span><span>CPU</span><span>RAM</span><span>स्थिति</span><span></span>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {list.map((p) => (
            <div key={p.pid} className="grid grid-cols-[60px_1fr_70px_70px_80px_50px] items-center gap-2 border-b border-white/5 px-4 py-3 text-sm last:border-0 hover:bg-white/5">
              <span className="font-mono text-white/50">{p.pid}</span>
              <span className="truncate text-white">{p.name}</span>
              <span className="text-violet-300">{p.cpu}%</span>
              <span className="text-cyan-300">{p.ram}%</span>
              <span className="text-xs text-green-400">{p.status}</span>
              <button onClick={() => processInput(`kill process ${p.name}`)} className="text-red-400/60 hover:text-red-400" title="बंद करें"><XCircle size={17} /></button>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
