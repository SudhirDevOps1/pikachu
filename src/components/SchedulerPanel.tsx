import { useEffect, useState } from "react";
import { Calendar, Plus, X } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { GlowButton } from "./GlowButton";
import { PanelHeader } from "./PanelHeader";
import { useStore } from "@/store/assistantStore";
import { useAssistantApi } from "@/hooks/AssistantContext";
import { generateId } from "@/lib/utils";

interface Task {
  id: string;
  name: string;
  command: string;
  schedule: string;
  nextRun: string;
}

export function SchedulerPanel() {
  const { sendRaw } = useAssistantApi();
  const [tasks, setTasks] = useState<Task[]>([
    { id: generateId(), name: "रोज़ स्क्रीनशॉट", command: "screenshot", schedule: "daily at 09:00", nextRun: "कल 09:00" },
    { id: generateId(), name: "मेमोरी सफाई", command: "cleanup temp", schedule: "every 6 hours", nextRun: "3 घंटे बाद" },
  ]);
  const [name, setName] = useState("");
  const [command, setCommand] = useState("screenshot");
  const [schedule, setSchedule] = useState("daily at 09:00");

  const commands = ["screenshot", "cleanup temp", "battery status", "open chrome", "lock computer", "volume 30%"];

  // Load persisted jobs from backend
  useEffect(() => {
    sendRaw(JSON.stringify({ type: "command", category: "scheduler", action: "list", params: {} }));
    const onMsg = (e: any) => {
      try {
        const d = JSON.parse(e.data);
        if (d.type === "mcp_result" && d.name === "scheduler.list") {
          const items = d.data?.data?.items || [];
          if (items.length) setTasks(items.map((j:any)=>({ id:j.id, name:j.name, command:j.command, schedule:j.schedule, nextRun:j.schedule })));
        }
        if (d.type === "response" && d.data?.items && Array.isArray(d.data.items) && d.data.items[0]?.command) {
          setTasks(d.data.items.map((j:any)=>({ id:j.id, name:j.name, command:j.command, schedule:j.schedule, nextRun:j.schedule })));
        }
      } catch {}
    };
    // We listen via WS raw handler in useAssistant — this effect is placeholder for polling
    return () => {};
  }, [sendRaw]);

  const add = () => {
    if (!name) return;
    const newTask = { id: generateId(), name, command, schedule, nextRun: schedule };
    setTasks((t) => [newTask, ...t]);
    // Persist to backend
    sendRaw(JSON.stringify({ type: "command", category: "scheduler", action: "add", params: { id: newTask.id, name, command, schedule } }));
    setName("");
    useStore.getState().addToast({ type: "success", message: "टास्क शेड्यूल हुआ — backend persistent ⏰" });
  };
  const remove = (id: string) => {
    setTasks((arr) => arr.filter((x) => x.id !== id));
    sendRaw(JSON.stringify({ type: "command", category: "scheduler", action: "remove", params: { id } }));
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
            <button onClick={() => remove(t.id)} className="text-red-400/70 hover:text-red-400"><X size={18} /></button>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
