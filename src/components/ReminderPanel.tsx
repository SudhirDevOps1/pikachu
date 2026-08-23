import { useState } from "react";
import { Bell, Plus, X, Clock, Check } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { GlowButton } from "./GlowButton";
import { PanelHeader } from "./PanelHeader";
import { useStore } from "@/store/assistantStore";
import { generateId } from "@/lib/utils";

export function ReminderPanel() {
  const reminders = useStore((s) => s.reminders);
  const addReminder = useStore((s) => s.addReminder);
  const updateReminder = useStore((s) => s.updateReminder);
  // The 1-second clock and reminder-trigger check now run centrally in
  // useAssistant.ts, so every screen (not just this panel) stays live.
  const nowMs = useStore((s) => s.nowMs);
  const [text, setText] = useState("");
  const [minutes, setMinutes] = useState(5);

  const create = (mins: number, txt: string) => {
    addReminder({ id: generateId(), text: txt || `${mins} मिनट का टाइमर`, triggerAt: Date.now() + mins * 60000, status: "active" });
    useStore.getState().addToast({ type: "success", message: "रिमाइंडर सेट हुआ" });
  };

  const presets = [1, 5, 10, 15, 30, 60];
  const active = reminders.filter((r) => r.status === "active");
  const past = reminders.filter((r) => r.status !== "active");

  const countdown = (t: number) => {
    const s = Math.max(0, Math.floor((t - nowMs) / 1000));
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PanelHeader icon={Bell} title="रिमाइंडर और टाइमर" desc="आवाज़ या क्लिक से रिमाइंडर सेट करें" />

      <GlassCard className="space-y-3 p-5">
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="मुझे याद दिलाओ..." className="flex-1 rounded-xl bg-white/5 px-4 py-2.5 text-white outline-none placeholder-white/30" />
          <input type="number" value={minutes} onChange={(e) => setMinutes(+e.target.value)} className="w-20 rounded-xl bg-white/5 px-3 py-2.5 text-center text-white outline-none" />
          <span className="flex items-center text-sm text-white/50">मिनट</span>
          <GlowButton variant="primary" onClick={() => { create(minutes, text); setText(""); }}><Plus size={16} /> सेट</GlowButton>
        </div>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button key={p} onClick={() => create(p, "")} className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10">{p >= 60 ? "1 घंटा" : `${p} मिनट`}</button>
          ))}
        </div>
      </GlassCard>

      <div className="space-y-2">
        <div className="px-1 text-xs uppercase text-white/40">सक्रिय</div>
        {active.length === 0 && <p className="p-4 text-center text-sm text-white/40">कोई सक्रिय रिमाइंडर नहीं</p>}
        {active.map((r) => (
          <GlassCard key={r.id} className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20"><Clock size={18} className="text-amber-300" /></div>
            <div className="flex-1"><div className="text-white">{r.text}</div></div>
            <span className="font-mono text-cyan-300">{countdown(r.triggerAt)}</span>
            <button onClick={() => updateReminder(r.id, { status: "cancelled" })} className="text-red-400/70 hover:text-red-400"><X size={18} /></button>
          </GlassCard>
        ))}
        {past.length > 0 && <div className="px-1 pt-2 text-xs uppercase text-white/40">पूर्ण</div>}
        {past.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-xl px-4 py-3 text-white/40">
            <Check size={16} className="text-green-500/60" />
            <span className="flex-1 line-through">{r.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
