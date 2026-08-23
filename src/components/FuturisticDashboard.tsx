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

// Full "Futurist Mode" HUD — fully responsive:
//   • Mobile  (<1024px): single scrolling column, neural core on top
//   • Desktop (>=1024px): 3 fixed columns with independently scrolling sides.
// The center orb card fills the FULL height of its column so the orb never
// gets clipped, and Crypto + World Clock sit UNDERNEATH it as a compact row.
export function FuturisticDashboard() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <FuturistHeader />

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto px-3 pb-4 sm:px-4 md:px-6 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)_minmax(260px,360px)] lg:overflow-hidden">
        {/* Left column — Telemetry & File Core */}
        <div className="flex flex-col gap-4 lg:overflow-y-auto lg:pr-1 no-scrollbar">
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
          </GlassCard>

          {/* Intel strip — CSS media query shows it ONLY when viewport is tall
              enough (>=860px), so short screens give all space to the orb */}
          <div className="intel-strip shrink-0 gap-4">
            <CryptoTickerHUD />
            <WorldClockHUD />
          </div>
        </div>

        {/* Right column — Intel & Events */}
        <div className="flex flex-col gap-4 pb-14 lg:overflow-y-auto lg:pr-1 lg:pb-2 no-scrollbar">
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
