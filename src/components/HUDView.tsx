import { motion } from "framer-motion";
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
// / chat log on the right. Now cinematic for Standard mode too.
export function HUDView() {
  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 lg:grid lg:grid-cols-[300px_1fr_340px] lg:overflow-hidden md:px-6">
      {/* subtle grid backdrop for Standard — behind, no block */}
      <div className="pointer-events-none absolute inset-0 -z-0" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)`, backgroundSize: `28px 28px`, opacity: `var(--grid-opacity, 0.03)` }} />
      {/* Mobile Stack / Desktop Grid */}
      <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }} className="relative z-10 flex min-h-0 min-w-[280px] flex-col gap-4 lg:overflow-y-auto lg:max-h-full lg:pr-1 no-scrollbar">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}><TelemetryPanel /></motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}><CoreMetricsPanel /></motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}><SystemHealthPanel /></motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}><WebcamPanel /></motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}><RemindersHUD /></motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}><WeatherHUD /></motion.div>
      </motion.div>

      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.12 }} className="relative z-10">
        <GlassCard className="relative flex min-h-[420px] w-full shrink-0 flex-col overflow-hidden border-[var(--accent)]/15 shadow-[0_0_30px_rgba(var(--accent-rgb),0.08)] hover:shadow-[0_0_40px_rgba(var(--accent-rgb),0.13)] transition-shadow">
          <NetworkNodes className="absolute inset-0 opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/[0.04] via-transparent to-cyan-400/[0.03] pointer-events-none" />
          <PikaOrb />
        </GlassCard>
      </motion.div>

      <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.15 }} className="relative z-10 flex min-h-0 flex-col lg:max-h-full">
        <GlassCard className="flex min-h-[320px] w-full flex-1 flex-col overflow-hidden border-white/10 hover:border-white/15 transition-colors lg:overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <TranscriptPanel />
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
