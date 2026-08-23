import { useStore } from "@/store/assistantStore";
import { Globe2 } from "lucide-react";
import { HudCard } from "./HudCard";

const ZONES = [
  { city: "दिल्ली", tz: "Asia/Kolkata", flag: "🇮🇳" },
  { city: "न्यूयॉर्क", tz: "America/New_York", flag: "🇺🇸" },
  { city: "लंदन", tz: "Europe/London", flag: "🇬🇧" },
  { city: "टोक्यो", tz: "Asia/Tokyo", flag: "🇯🇵" },
  { city: "दुबई", tz: "Asia/Dubai", flag: "🇦🇪" },
];

function timeIn(tz: string, now: number) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).format(new Date(now));
  } catch {
    return "--:--";
  }
}

function hourIn(tz: string, now: number): number {
  try {
    return +new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(new Date(now));
  } catch {
    return 12;
  }
}

// Multi-timezone world clock — updates every second via the store's central tick.
export function WorldClockHUD() {
  const now = useStore((s) => s.nowMs);
  return (
    <HudCard title="World Clock" icon={Globe2} dotColor="var(--accent)">
      <div className="space-y-1.5">
        {ZONES.map((z) => {
          const h = hourIn(z.tz, now);
          const isDay = h >= 6 && h < 18;
          return (
            <div key={z.tz} className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-1.5">
              <span className="text-base">{z.flag}</span>
              <span className="flex-1 text-xs text-white/70">{z.city}</span>
              <span className="text-xs">{isDay ? "☀️" : "🌙"}</span>
              <span className="font-mono text-sm font-semibold text-white">{timeIn(z.tz, now)}</span>
            </div>
          );
        })}
      </div>
    </HudCard>
  );
}
