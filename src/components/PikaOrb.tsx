import { useEffect, useRef, useState } from "react";
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
  const orbRef = useRef<HTMLDivElement>(null);
  const [orbOffset, setOrbOffset] = useState({ x: 0, y: 0 });
  const [isOrbHover, setIsOrbHover] = useState(false);

  const [reaction, setReaction] = useState(0.02);

  // Cursor tracking for Standard orb — highlight + tilt follows mouse
  useEffect(() => {
    let raf = 0;
    let lx = 0, ly = 0;
    const onMove = (e: MouseEvent) => { lx = e.clientX; ly = e.clientY; if (!raf) raf = requestAnimationFrame(tick); };
    const tick = () => {
      raf = 0;
      const el = orbRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = lx - cx;
      const dy = ly - cy;
      const dist = Math.hypot(dx, dy);
      const maxD = Math.max(260, Math.hypot(window.innerWidth, window.innerHeight) * 0.3);
      const nx = Math.max(-1, Math.min(1, (dx / maxD) * 2.8));
      const ny = Math.max(-1, Math.min(1, (dy / maxD) * 2.6));
      setOrbOffset({ x: nx, y: ny });
      setIsOrbHover(dist < 200);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => { window.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, []);

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

      <div ref={orbRef} className="relative flex h-64 w-64 items-center justify-center" style={{ perspective: 600 } as any}>
        {/* cursor-reactive tilt container */}
        <motion.div className="absolute inset-0" style={{ rotateY: orbOffset.x * 9, rotateX: orbOffset.y * -7 }} transition={{ type: "spring", stiffness: 60, damping: 18 }}>
        {/* outer solid rotating ring */}
        <motion.div
          className="absolute inset-0 rounded-full border"
          style={{ borderColor: isOrbHover ? "rgba(var(--accent-rgb),0.42)" : "rgba(var(--accent-rgb),0.25)", boxShadow: isOrbHover ? "0 0 16px rgba(var(--accent-rgb),0.28)" : undefined }}
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
        </motion.div>

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

        {/* center core — highlight follows cursor */}
        <motion.button
          onClick={toggle}
          className="relative flex h-20 w-20 items-center justify-center rounded-full overflow-hidden"
          style={{
            background: isListening ? "#ef4444" : "var(--accent)",
            rotateY: orbOffset.x * 6,
            rotateX: orbOffset.y * -5,
          }}
          animate={{ scale: isListening || isSpeaking ? [1, 1.12, 1] : [1, 1.04, 1] }}
          transition={{ duration: 1.3, repeat: Infinity }}
          title="Cursor jidhar, orb udhar — Standard mode me bhi tracking"
        >
          {/* cursor-following highlight */}
          <motion.span
            className="absolute h-10 w-10 rounded-full bg-white/35 blur-md pointer-events-none"
            style={{ left: `calc(50% + ${orbOffset.x * 14}px)`, top: `calc(50% + ${orbOffset.y * 14}px)`, translate: "-50% -50%" }}
            animate={{ opacity: isOrbHover ? 0.95 : 0.55, scale: isOrbHover ? 1.25 : 1 }}
            transition={{ duration: 0.25 }}
          />
          <span
            className="absolute inset-0 rounded-full opacity-60 blur-xl"
            style={{ background: isListening ? "#ef4444" : "var(--accent)" }}
          />
          {/* tracking pupil dot */}
          <motion.span className="absolute h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] pointer-events-none" style={{ left: `calc(50% + ${orbOffset.x * 10}px)`, top: `calc(50% + ${orbOffset.y * 10}px)`, translate: "-50% -50%" }} animate={{ scale: isListening ? 1.4 : isOrbHover ? 1.2 : 1 }} />
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
