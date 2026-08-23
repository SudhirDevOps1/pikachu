import { TelemetryPanel } from "./TelemetryPanel";
import { CoreMetricsPanel } from "./CoreMetricsPanel";
import { SystemHealthPanel } from "./SystemHealthPanel";
import { WebcamPanel } from "./WebcamPanel";
import { RemindersHUD } from "./RemindersHUD";
import { WeatherHUD } from "./WeatherHUD";
import { PikaOrb } from "./PikaOrb";
import { TranscriptPanel } from "./TranscriptPanel";
import { NetworkNodes } from "./NetworkNodes";
import { GlassCard } from "./GlassCard";

// Main sci-fi HUD dashboard — three columns: live telemetry widgets on the
// left, the animated Pika neural-core orb in the center, and the transcript
// / chat log on the right.
export function HUDView() {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 lg:grid lg:grid-cols-[300px_1fr_340px] lg:overflow-hidden md:px-6">
      {/* Mobile Stack / Desktop Grid */}
      <div className="flex min-w-[280px] flex-col gap-4 lg:overflow-y-auto lg:pr-1 no-scrollbar">
        <TelemetryPanel />
        <CoreMetricsPanel />
        <SystemHealthPanel />
        <WebcamPanel />
        <RemindersHUD />
        <WeatherHUD />
      </div>

      <GlassCard className="relative flex min-h-[420px] w-full shrink-0 flex-col overflow-hidden">
        <NetworkNodes className="absolute inset-0 opacity-40" />
        <PikaOrb />
      </GlassCard>

      <GlassCard className="flex min-h-[320px] w-full flex-col overflow-hidden">
        <TranscriptPanel />
      </GlassCard>
    </div>
  );
}
