import { useEffect, useState } from "react";
import { Circle, Square, Save, Play, Trash2, Repeat } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { GlowButton } from "./GlowButton";
import { useStore } from "@/store/assistantStore";
import { generateId } from "@/lib/utils";
import { PanelHeader } from "./PanelHeader";

interface Macro {
  id: string;
  name: string;
  actions: number;
  date: string;
}

export function MacroEngine() {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [actions, setActions] = useState(0);
  const [name, setName] = useState("");
  const [macros, setMacros] = useState<Macro[]>([
    { id: generateId(), name: "Daily Startup", actions: 24, date: "आज" },
    { id: generateId(), name: "Open Workspace", actions: 12, date: "कल" },
  ]);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => {
      setElapsed((e) => e + 1);
      setActions((a) => a + Math.floor(Math.random() * 3));
    }, 1000);
    return () => clearInterval(t);
  }, [recording]);

  const stop = () => {
    setRecording(false);
    useStore.getState().addToast({ type: "success", message: `मैक्रो रिकॉर्ड हुआ (${actions} एक्शन)` });
  };
  const save = () => {
    if (!name) return;
    setMacros((m) => [{ id: generateId(), name, actions, date: "अभी" }, ...m]);
    setName(""); setElapsed(0); setActions(0);
    useStore.getState().addToast({ type: "success", message: "मैक्रो सेव हुआ" });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PanelHeader icon={Repeat} title="मैक्रो इंजन" desc="माउस और कीबोर्ड एक्शन रिकॉर्ड और रीप्ले करें" />

      <GlassCard className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {recording && <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />}
            <div>
              <div className="font-mono text-2xl text-white">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</div>
              <div className="text-xs text-white/50">{actions} एक्शन रिकॉर्ड हुए</div>
            </div>
          </div>
          {recording ? (
            <GlowButton variant="danger" onClick={stop}><Square size={16} /> रोकें</GlowButton>
          ) : (
            <GlowButton variant="primary" onClick={() => { setRecording(true); setElapsed(0); setActions(0); }}><Circle size={16} fill="currentColor" /> रिकॉर्ड करें</GlowButton>
          )}
        </div>
        {!recording && actions > 0 && (
          <div className="mt-4 flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="मैक्रो का नाम..." className="flex-1 rounded-xl bg-white/5 px-4 py-2.5 text-white outline-none placeholder-white/30" />
            <GlowButton onClick={save}><Save size={16} /> सेव</GlowButton>
          </div>
        )}
      </GlassCard>

      <div className="space-y-2">
        {macros.map((m) => (
          <GlassCard key={m.id} className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20"><Repeat size={18} className="text-violet-300" /></div>
            <div className="flex-1">
              <div className="font-medium text-white">{m.name}</div>
              <div className="text-xs text-white/50">{m.actions} एक्शन · {m.date}</div>
            </div>
            <GlowButton onClick={() => useStore.getState().addToast({ type: "info", message: `${m.name} चलाया जा रहा है (पुष्टि ज़रूरी)` })}><Play size={15} /></GlowButton>
            <button onClick={() => setMacros((arr) => arr.filter((x) => x.id !== m.id))} className="text-red-400/70 hover:text-red-400"><Trash2 size={16} /></button>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
