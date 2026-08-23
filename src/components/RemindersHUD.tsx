import { BellRing } from "lucide-react";
import { HudCard } from "./HudCard";
import { useStore } from "@/store/assistantStore";

// Compact live-countdown widget for active reminders/timers, shown on the
// main HUD dashboard regardless of which tab is currently open.
export function RemindersHUD() {
  const reminders = useStore((s) => s.reminders);
  const nowMs = useStore((s) => s.nowMs);

  const active = reminders
    .filter((r) => r.status === "active")
    .sort((a, b) => a.triggerAt - b.triggerAt)
    .slice(0, 3);

  const countdown = (t: number) => {
    const s = Math.max(0, Math.floor((t - nowMs) / 1000));
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  };

  return (
    <HudCard title="Active Reminders" icon={BellRing} dotColor={active.length ? "#eab308" : "#6b7280"}>
      {active.length === 0 ? (
        <p className="py-2 text-center text-xs text-white/30">कोई सक्रिय रिमाइंडर नहीं</p>
      ) : (
        <div className="space-y-2">
          {active.map((r) => {
            const secsLeft = Math.max(0, Math.floor((r.triggerAt - nowMs) / 1000));
            const urgent = secsLeft < 60;
            return (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.04] px-3 py-2">
                <div className="flex items-center gap-2 truncate">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${urgent ? "animate-pulse bg-red-500" : "bg-amber-400"}`} />
                  <span className="truncate text-xs text-white/80">{r.text}</span>
                </div>
                <span className={`shrink-0 font-mono text-xs ${urgent ? "text-red-300" : "text-white/50"}`}>
                  {countdown(r.triggerAt)} min left
                </span>
              </div>
            );
          })}
        </div>
      )}
    </HudCard>
  );
}
