import { FuturistHeader } from "./FuturistHeader";
import { NetworkTelemetryPro } from "./NetworkTelemetryPro";
import { LiveMetricsChart } from "./LiveMetricsChart";
import { WebcamPanel } from "./WebcamPanel";
import { WeatherWidgetPro } from "./WeatherWidgetPro";
import { ActiveRemindersHUD } from "./ActiveRemindersHUD";
import { SystemHealthPanel } from "./SystemHealthPanel";
import { NeuralHUDCenter } from "./NeuralHUDCenter";
import { NetworkNodes } from "./NetworkNodes";
import { GlassCard } from "./GlassCard";
import { QuickActionsBar } from "./QuickActionsBar";
import { DriveExplorerHUD } from "./DriveExplorerHUD";
import { NASAExplorerHUD } from "./NASAExplorerHUD";
import { CryptoTickerHUD } from "./CryptoTickerHUD";
import { WorldClockHUD } from "./WorldClockHUD";
import { PomodoroHUD } from "./PomodoroHUD";
import { useStore } from "@/store/assistantStore";

function QuickNeuralPresets() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const a = (settings as any).appearance || {};
  const NEURAL = [
    { id: "cyber", name: "Cyber", accent: "#00f0ff", secondary: "#ff00ff" },
    { id: "matrix", name: "Matrix", accent: "#00ff41", secondary: "#003300" },
    { id: "royal", name: "Royal", accent: "#7c3aed", secondary: "#ec4899" },
    { id: "ocean", name: "Ocean", accent: "#06b6d4", secondary: "#0ea5e9" },
    { id: "sunset", name: "Sunset", accent: "#f97316", secondary: "#ef4444" },
    { id: "midnight", name: "Mid", accent: "#334155", secondary: "#0f172a" },
    { id: "fire", name: "Fire", accent: "#ef4444", secondary: "#f59e0b" },
    { id: "aurora", name: "Aurora", accent: "#10b981", secondary: "#8b5cf6" },
    { id: "gold", name: "Gold", accent: "#eab308", secondary: "#fde68a" },
    { id: "candy", name: "Candy", accent: "#ec4899", secondary: "#06b6d4" },
  ];
  return (
    <div className="relative border-t border-white/10 bg-black/20 backdrop-blur-md px-2 py-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-widest text-white/40">PRESETS • NEURAL</span>
        <span className="text-[9px] text-white/30">click to apply • bina settings khole</span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {NEURAL.map((p) => {
          const active = (a as any).neuralPreset === p.id;
          return (
            <button
              key={p.id}
              onClick={() => updateSettings({ accentColor: p.accent, secondaryAccentColor: p.secondary, appearance: { ...(a as any), neuralPreset: p.id } as any })}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${active ? "border-[var(--accent)] bg-[var(--accent)]/20 text-white shadow-[0_0_10px_rgba(var(--accent-rgb),0.35)]" : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"}`}
              title={`${p.name} — ${p.accent} / ${p.secondary}`}
            >
              <span className="h-3 w-3 rounded-full border border-white/20" style={{ background: `linear-gradient(135deg, ${p.accent}, ${p.secondary})` }} />
              {p.name}
              {active && <span className="ml-1 text-[9px] text-emerald-300">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Full "Futurist Mode" HUD — fully responsive:
//   • Mobile  (<1024px): single scrolling column, neural core on top
//   • Desktop (>=1024px): 3 fixed columns with independently scrolling sides.
// The center orb card fills the FULL height of its column so the orb never
// gets clipped, and Crypto + World Clock sit UNDERNEATH it as a compact row.
export function FuturisticDashboard() {
  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* Cinematic futurist backdrop — behind content, never blocks scroll */}
      <div className="pointer-events-none absolute inset-0 -z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#05070d] via-[#0a0f1e] to-[#0b0a14]" />
        <div className="absolute inset-0" style={{ backgroundImage: `linear-gradient(rgba(0,240,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,0,255,0.45) 1px, transparent 1px)`, backgroundSize: `32px 32px`, opacity: `var(--grid-opacity, 0.06)` }} />
        <div className="absolute inset-0 opacity-40" style={{ background: `radial-gradient(900px circle at 18% 12%, rgba(0,240,255,0.18), transparent 60%), radial-gradient(700px circle at 88% 78%, rgba(255,0,255,0.14), transparent 60%)` }} />
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 0%, transparent 78%, rgba(0,0,0,0.35) 100%)` }} />
      </div>
      <div className="relative z-10 shrink-0">
        <FuturistHeader />
      </div>

      <div className="relative z-10 grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto px-3 pb-4 sm:px-4 md:px-6 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)_minmax(260px,360px)] lg:overflow-hidden">
        {/* Left column — Telemetry & File Core */}
        <div className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto lg:pr-1 no-scrollbar">
          <PomodoroHUD />
          <NetworkTelemetryPro />
          <DriveExplorerHUD />
          <LiveMetricsChart />
          <WebcamPanel />
        </div>

        {/* Center — full-height Neural HUD core with crypto+clock strip below */}
        <div className="order-first flex min-h-[540px] flex-col gap-4 lg:order-none lg:h-full lg:min-h-0">
          {/* min-h guarantee: the orb card can NEVER be squashed below 420px */}
          <GlassCard className="relative flex min-h-[420px] flex-1 flex-col overflow-hidden border-[var(--accent)]/25">
            <NetworkNodes className="absolute inset-0 opacity-40" />
            <div className="relative flex min-h-0 flex-1 flex-col">
              <NeuralHUDCenter />
            </div>
            {/* QUICK PRESETS — directly on screenshot place, bina settings khole */}
            <QuickNeuralPresets />
          </GlassCard>

          {/* Intel strip — CSS media query shows it ONLY when viewport is tall
              enough (>=860px), so short screens give all space to the orb */}
          <div className="intel-strip shrink-0 gap-4">
            <CryptoTickerHUD />
            <WorldClockHUD />
          </div>
        </div>

        {/* Right column — Intel & Events */}
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pb-14 lg:overflow-y-auto lg:pr-1 lg:pb-2 no-scrollbar lg:max-h-full">
          <WeatherWidgetPro />
          <ActiveRemindersHUD />
          <NASAExplorerHUD />
          <SystemHealthPanel />
          {/* Crypto + Clock: shown here whenever the under-orb strip is hidden
              (mobile AND short desktop screens) */}
          <div className="grid gap-4 [@media(min-width:1024px)_and_(min-height:860px)]:hidden">
            <CryptoTickerHUD />
            <WorldClockHUD />
          </div>
        </div>
      </div>

      <QuickActionsBar />
    </div>
  );
}
