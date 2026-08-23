import { useEffect, useState } from "react";
import { Phone, PhoneOff, MessageCircle, Volume2, VolumeX } from "lucide-react";
import { motion } from "framer-motion";
import { useStore } from "@/store/assistantStore";
import { useVoiceApi } from "@/hooks/VoiceContext";
import { sounds } from "@/lib/soundEffects";
import { ScrambleText } from "./ScrambleText";

const ORBIT_DOTS = [
  { angle: 20, ring: "outer", color: "#06b6d4" },
  { angle: 160, ring: "outer", color: "var(--accent)" },
  { angle: 270, ring: "inner", color: "#ec4899" },
];

function pointOnCircle(radius: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: 50 + radius * Math.cos(rad), y: 50 + radius * Math.sin(rad) };
}

export function PikaOrb() {
  const isConnected = useStore((s) => s.isConnected);
  const isListening = useStore((s) => s.isListening);
  const isAiThinking = useStore((s) => s.isAiThinking);
  const isSpeaking = useStore((s) => s.isSpeaking);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const { toggle } = useVoiceApi();

  const [reaction, setReaction] = useState(0.02);

  useEffect(() => {
    const t = setInterval(() => setReaction(+(0.01 + Math.random() * 0.05).toFixed(3)), 2500);
    return () => clearInterval(t);
  }, []);

  const streamState = isAiThinking ? "COMPILING" : isSpeaking ? "STREAMING" : "IDLE";
  const neuralStatus = isConnected ? "READY" : "STANDBY";

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 p-6">
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 font-mono text-[11px]">
        <span className="flex items-center gap-1.5" style={{ color: isConnected ? "#22c55e" : "#eab308" }}>
          <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
          <ScrambleText text={`NEURAL_NET: ${neuralStatus}`} trigger={neuralStatus} />
        </span>
        <span className="text-white/40">
          <ScrambleText text={`DELEGATION_CORE: LOADED`} trigger={0} />
        </span>
      </div>

      <div className="relative flex h-64 w-64 items-center justify-center">
        {/* outer solid rotating ring */}
        <motion.div
          className="absolute inset-0 rounded-full border"
          style={{ borderColor: "rgba(var(--accent-rgb),0.25)" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
        />
        {/* dashed ring rotating opposite way */}
        <motion.div
          className="absolute inset-8 rounded-full border border-dashed border-cyan-400/25"
          animate={{ rotate: -360 }}
          transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
        />
        <div className="absolute inset-16 rounded-full border border-white/10" />

        {/* orbiting decorative dots */}
        {ORBIT_DOTS.map((d, i) => {
          const p = pointOnCircle(d.ring === "outer" ? 50 : 34, d.angle);
          return (
            <motion.span
              key={i}
              className="absolute h-2 w-2 rounded-full"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                background: d.color,
                boxShadow: `0 0 8px ${d.color}`,
              }}
              animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.3, 1] }}
              transition={{ duration: 2 + i, repeat: Infinity }}
            />
          );
        })}

        {/* pulse rings when listening */}
        {isListening &&
          [0, 1].map((i) => (
            <motion.span
              key={i}
              className="absolute h-20 w-20 rounded-full border-2 border-red-400"
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.5 }}
            />
          ))}

        {/* center core */}
        <motion.button
          onClick={toggle}
          className="relative flex h-20 w-20 items-center justify-center rounded-full"
          style={{ background: isListening ? "#ef4444" : "var(--accent)" }}
          animate={{ scale: isListening || isSpeaking ? [1, 1.12, 1] : [1, 1.04, 1] }}
          transition={{ duration: 1.3, repeat: Infinity }}
          title="बोलने के लिए दबाएँ"
        >
          <span
            className="absolute inset-0 rounded-full opacity-60 blur-xl"
            style={{ background: isListening ? "#ef4444" : "var(--accent)" }}
          />
        </motion.button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 font-mono text-[10px] text-white/40">
        <ScrambleText text={`UI_REACTION: ${reaction}s`} trigger={reaction} />
        <ScrambleText text={`LIVE_STREAM: ${streamState}`} trigger={streamState} />
      </div>

      <div className="flex items-center gap-4">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            sounds.click();
            updateSettings({ soundEffects: !settings.soundEffects });
            speechSynthesis.cancel();
          }}
          title="साउंड म्यूट/अनम्यूट"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/[0.12]"
        >
          {settings.soundEffects ? <Volume2 size={17} /> : <VolumeX size={17} />}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={toggle}
          className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition"
          style={{
            background: isListening ? "#ef4444" : "#22c55e",
            boxShadow: isListening
              ? "0 0 20px rgba(239,68,68,0.5)"
              : "0 0 20px rgba(34,197,94,0.4)",
          }}
        >
          {isListening ? <PhoneOff size={22} /> : <Phone size={22} />}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => document.getElementById("pika-transcript-input")?.focus()}
          title="चैट पर जाएँ"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/[0.12]"
        >
          <MessageCircle size={17} />
        </motion.button>
      </div>
    </div>
  );
}
