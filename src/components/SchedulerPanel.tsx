import { useState } from "react";
import { Calendar, Plus, X } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { GlowButton } from "./GlowButton";
import { PanelHeader } from "./PanelHeader";
import { useStore } from "@/store/assistantStore";
import { generateId } from "@/lib/utils";

interface Task {
  id: string;
  name: string;
  command: string;
  schedule: string;
  nextRun: string;
}

export function SchedulerPanel() {
  const [tasks, setTasks] = useState<Task[]>([
    { id: generateId(), name: "रोज़ स्क्रीनशॉट", command: "screenshot", schedule: "daily at 09:00", nextRun: "कल 09:00" },
    { id: generateId(), name: "मेमोरी सफाई", command: "cleanup temp", schedule: "every 6 hours", nextRun: "3 घंटे बाद" },
  ]);
  const [name, setName] = useState("");
  const [command, setCommand] = useState("screenshot");
  const [schedule, setSchedule] = useState("daily at 09:00");

  const commands = ["screenshot", "cleanup temp", "battery status", "open chrome", "lock computer", "volume 30%"];

  const add = () => {
    if (!name) return;
    setTasks((t) => [{ id: generateId(), name, command, schedule, nextRun: "गणना हो रही..." }, ...t]);
    setName("");
    useStore.getState().addToast({ type: "success", message: "टास्क शेड्यूल हुआ" });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PanelHeader icon={Calendar} title="शेड्यूलर" desc="Cron जैसे ऑटोमेटेड टास्क सेट करें" />

      <GlassCard className="space-y-3 p-5">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="टास्क का नाम..." className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-white outline-none placeholder-white/30" />
        <div className="grid gap-3 md:grid-cols-2">
          <select value={command} onChange={(e) => setCommand(e.target.value)} className="rounded-xl bg-white/10 px-4 py-2.5 text-white outline-none">
            {commands.map((c) => <option key={c} value={c} className="bg-navy-800">{c}</option>)}
          </select>
          <select value={schedule} onChange={(e) => setSchedule(e.target.value)} className="rounded-xl bg-white/10 px-4 py-2.5 text-white outline-none">
            {["every 30 minutes", "every hour", "every 6 hours", "daily at 09:00", "daily at 18:00"].map((c) => <option key={c} value={c} className="bg-navy-800">{c}</option>)}
          </select>
        </div>
        <GlowButton variant="primary" onClick={add}><Plus size={16} /> शेड्यूल करें</GlowButton>
      </GlassCard>

      <div className="space-y-2">
        {tasks.map((t) => (
          <GlassCard key={t.id} className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20"><Calendar size={18} className="text-cyan-300" /></div>
            <div className="flex-1">
              <div className="font-medium text-white">{t.name}</div>
              <div className="text-xs text-white/50"><code className="text-violet-300">{t.command}</code> · {t.schedule} · अगला: {t.nextRun}</div>
            </div>
            <button onClick={() => setTasks((arr) => arr.filter((x) => x.id !== t.id))} className="text-red-400/70 hover:text-red-400"><X size={18} /></button>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
