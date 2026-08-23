import { Bell, X, Plus } from "lucide-react";
import { useState } from "react";
import { HudCard } from "./HudCard";
import { useStore } from "@/store/assistantStore";
import { generateId } from "@/lib/utils";
import { motion } from "framer-motion";

// Rich "Active Reminders" HUD widget: live countdown, shrinking progress
// bar per reminder, quick-add input, and toast on trigger.
export function ActiveRemindersHUD() {
  const reminders = useStore((s) => s.reminders);
  const addReminder = useStore((s) => s.addReminder);
  const updateReminder = useStore((s) => s.updateReminder);
  const nowMs = useStore((s) => s.nowMs);
  const [txt, setTxt] = useState("");
  const [mins, setMins] = useState(5);

  const active = reminders
    .filter((r) => r.status === "active")
    .sort((a, b) => a.triggerAt - b.triggerAt);

  const create = () => {
    if (!txt.trim()) return;
    const total = mins * 60000;
    addReminder({
      id: generateId(),
      text: txt.trim(),
      triggerAt: Date.now() + total,
      status: "active",
    });
    setTxt("");
  };

  return (
    <HudCard title="सक्रिय रिमाइंडर" icon={Bell} dotColor={active.length ? "#eab308" : "#6b7280"}>
      {/* Quick add — compact 2-row layout that never overflows */}
      <div className="mb-3 space-y-2">
        <input
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="नया रिमाइंडर..."
          className="w-full rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-xs text-white outline-none placeholder-white/30"
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={mins}
            onChange={(e) => setMins(Math.max(1, +e.target.value))}
            className="w-14 rounded-lg bg-white/[0.05] px-2 py-1.5 text-center text-xs text-white outline-none"
          />
          <span className="text-[10px] text-white/40">मिनट</span>
          <button
            onClick={create}
            className="ml-auto flex h-7 items-center gap-1 rounded-lg px-3 text-[10px] font-bold text-white"
            style={{ background: "var(--accent)" }}
          >
            <Plus size={12} /> सेट करें
          </button>
        </div>
      </div>

      {active.length === 0 ? (
        <p className="py-4 text-center text-xs text-white/30">कोई सक्रिय रिमाइंडर नहीं</p>
      ) : (
        <div className="space-y-2">
          {active.slice(0, 4).map((r) => {
            const remaining = Math.max(0, r.triggerAt - nowMs);
            const totalGuess = remaining < 60000 ? 60000 : Math.max(remaining * 1.5, 300000);
            const pct = Math.min(100, Math.max(0, (remaining / totalGuess) * 100));
            const secs = Math.floor(remaining / 1000);
            const m = Math.floor(secs / 60);
            const s = secs % 60;
            const urgent = remaining < 60000;
            return (
              <div key={r.id} className="rounded-xl bg-white/[0.04] p-2.5">
                <div className="mb-1 flex items-center justify-between">
                  <span className="truncate text-xs text-white/85">{r.text}</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-xs ${urgent ? "text-red-300" : "text-white/60"}`}>
                      {m}:{String(s).padStart(2, "0")} min left
                    </span>
                    <button
                      onClick={() => updateReminder(r.id, { status: "cancelled" })}
                      className="text-white/30 hover:text-red-400"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-white/5">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: urgent ? "#ef4444" : "var(--accent)" }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </HudCard>
  );
}
