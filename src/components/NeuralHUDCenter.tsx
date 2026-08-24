import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Zap, Send, Mic, MicOff, Radio } from "lucide-react";
import { useStore } from "@/store/assistantStore";
import { useVoiceApi } from "@/hooks/VoiceContext";
import { useAssistantApi } from "@/hooks/AssistantContext";
import { ScrambleText } from "./ScrambleText";
import { VoiceWaveform } from "./VoiceWaveform";

// The centerpiece "Neural Core" of the Futurist dashboard.
// Fully responsive: the orb sizes itself to the available container space,
// with 4 rotating rings, 8 orbiting neural nodes, a pulsing core, live status
// readouts, and an integrated voice/text input.
const OUTER_DOTS = 8;

function pt(rad: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: 50 + rad * Math.cos(a), y: 50 + rad * Math.sin(a) };
}

export function NeuralHUDCenter() {
  const isListening = useStore((s) => s.isListening);
  const isSpeaking = useStore((s) => s.isSpeaking);
  const isAiThinking = useStore((s) => s.isAiThinking);
  const isConnected = useStore((s) => s.isConnected);
  const waveform = useStore((s) => s.voiceWaveformData);
  const partial = useStore((s) => s.partialTranscript);
  const { toggle } = useVoiceApi();
  const { processInput } = useAssistantApi();

  const [reaction, setReaction] = useState(0.025);
  const [input, setInput] = useState("");
  const [orbSize, setOrbSize] = useState(300);
  const orbHolderRef = useRef<HTMLDivElement>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  // parallax springs
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-1, 1], [6, -6]), { stiffness: 50, damping: 15 });
  const ry = useSpring(useTransform(mx, [-1, 1], [-8, 8]), { stiffness: 50, damping: 15 });

  useEffect(() => {
    const t = setInterval(() => setReaction(+(0.01 + Math.random() * 0.05).toFixed(3)), 2500);
    return () => clearInterval(t);
  }, []);

  // ResizeObserver → orb always fits the available square area of its holder.
  useEffect(() => {
    const el = orbHolderRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const size = Math.min(rect.width, rect.height);
      setOrbSize(Math.max(140, Math.min(420, size - 8)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const neuralStatus = isListening ? "LISTENING" : isAiThinking ? "PROCESSING" : isSpeaking ? "SPEAKING" : isConnected ? "READY" : "STANDBY";
  const statusColor = isListening ? "#ef4444" : isAiThinking ? "#eab308" : isSpeaking ? "#06b6d4" : "#22c55e";
  const voiceEnergy = waveform.reduce((a,b)=>a+b,0)/Math.max(1,waveform.length);

  const send = () => {
    if (!input.trim()) return;
    processInput(input);
    setInput("");
  };

  const coreSize = Math.round(orbSize * 0.24);

  return (
    <div className="flex h-full flex-col gap-3 p-3 sm:p-4">
      {/* Status header with live dot */}
      <div className="flex items-center justify-center gap-2 font-mono text-[10px] tracking-widest sm:text-[11px]" style={{ color: statusColor }}>
        <motion.span className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
        <ScrambleText text={`NEURAL_NET: ${neuralStatus}`} trigger={neuralStatus} />
        <Radio size={12} className="opacity-60" />
      </div>

      {/* Orb region — flex-1 so it eats all remaining vertical space */}
      <div
        ref={orbHolderRef}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl"
        onMouseMove={(e) => {
          const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
          const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
          mx.set(nx); my.set(ny); setMouse({ x: nx, y: ny });
        }}
        onMouseLeave={() => { mx.set(0); my.set(0); }}
      >
        {/* Cinematic grid + vignette + scanline */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)`, backgroundSize: `24px 24px` }} />
          <div className="absolute inset-0" style={{ background: `radial-gradient(600px circle at 50% 50%, transparent 40%, rgba(0,0,0,0.55) 100%)` }} />
          <motion.div className="absolute inset-0 opacity-30" style={{ background: `repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(255,255,255,0.06) 3px, transparent 4px)` }} animate={{ y: [0, 8] }} transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }} />
        </div>

        <motion.div className="relative" style={{ width: orbSize, height: orbSize, rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" as any }}>
          {/* Chromatic glow layers */}
          <div className="absolute inset-[-12%] rounded-full blur-2xl opacity-40" style={{ background: `radial-gradient(circle, rgba(var(--accent-rgb),0.55), transparent 70%)` }} />
          <div className="absolute inset-[-8%] rounded-full blur-xl opacity-30" style={{ background: `radial-gradient(circle, rgba(6,182,212,0.4), transparent 65%)` }} />

          {/* 4 rotating rings + voice-reactive scale */}
          {[
            { size: 100, dur: 24, color: "rgba(var(--accent-rgb),0.45)", dash: false },
            { size: 82, dur: 16, color: "rgba(6,182,212,0.38)", dash: true },
            { size: 62, dur: 11, color: "rgba(var(--secondary-accent-rgb),0.32)", dash: false },
            { size: 44, dur: 7, color: "rgba(255,255,255,0.18)", dash: true },
          ].map((r, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full border"
              style={{
                left: `${(100 - r.size) / 2}%`,
                top: `${(100 - r.size) / 2}%`,
                width: `${r.size}%`,
                height: `${r.size}%`,
                borderColor: r.color,
                borderStyle: r.dash ? "dashed" : "solid",
                boxShadow: i===0 ? `0 0 12px rgba(var(--accent-rgb),0.35)` : undefined,
              }}
              animate={{ rotate: i % 2 === 0 ? 360 : -360, scale: isListening ? 1 + voiceEnergy * 0.18 : isSpeaking ? 1 + voiceEnergy*0.12 : 1 }}
              transition={{ rotate: { duration: r.dur, repeat: Infinity, ease: "linear" }, scale: { duration: 0.25 } }}
            />
          ))}

          {/* Connecting orbit lines */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-20">
            {Array.from({ length: OUTER_DOTS }).map((_, i) => {
              const a1 = (360 / OUTER_DOTS) * i;
              const a2 = (360 / OUTER_DOTS) * ((i+1)%OUTER_DOTS);
              const p1 = pt(48, a1), p2 = pt(48, a2);
              return <line key={i} x1={`${p1.x}%`} y1={`${p1.y}%`} x2={`${p2.x}%`} y2={`${p2.y}%`} stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" strokeDasharray="2 3" />;
            })}
          </svg>

          {/* 8 orbiting neural nodes + trailing */}
          {Array.from({ length: OUTER_DOTS }).map((_, i) => {
            const angle = (360 / OUTER_DOTS) * i;
            const p = pt(50, angle);
            const nodeColor = i % 3 === 0 ? "var(--accent)" : i % 3 === 1 ? "#06b6d4" : "var(--secondary-accent)";
            return (
              <motion.span
                key={i}
                className="absolute h-2.5 w-2.5 rounded-full"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  background: nodeColor,
                  boxShadow: `0 0 10px ${nodeColor}, 0 0 18px ${nodeColor}`,
                  translate: "-50% -50%",
                }}
                animate={{ opacity: [0.4, 1, 0.4], scale: isListening ? [1, 1.6, 1] : [1, 1.35, 1] }}
                transition={{ duration: 1.6 + (i % 3)*0.4, repeat: Infinity, delay: i * 0.12 }}
              />
            );
          })}

          {/* Voice energy halo */}
          <motion.div className="absolute rounded-full border border-cyan-300/30" style={{ left: "50%", top: "50%", width: coreSize*1.8, height: coreSize*1.8, translate: "-50% -50%" }} animate={{ scale: [1, 1.15, 1], opacity: [0.18, 0.32, 0.18] }} transition={{ duration: 1.1, repeat: Infinity }} />

          {/* Listening pulse rings */}
          {isListening &&
            [0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="absolute rounded-full border-2 border-red-400"
                style={{
                  left: "50%",
                  top: "50%",
                  width: coreSize,
                  height: coreSize,
                  translate: "-50% -50%",
                }}
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: 3.2, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.6 }}
              />
            ))}

          {/* Central core liquid morph */}
          <motion.button
            onClick={toggle}
            className="absolute flex items-center justify-center rounded-full backdrop-blur-md"
            style={{
              left: "50%",
              top: "50%",
              width: coreSize,
              height: coreSize,
              translate: "-50% -50%",
              background: `radial-gradient(circle at 30% 28%, ${isListening ? "#ff9a9a" : "white"} 0%, ${isListening ? "#ef4444" : "var(--accent)"} 28%, ${isListening ? "#991b1b" : "var(--secondary-accent)"} 72%)`,
              boxShadow: `0 0 ${coreSize*0.7}px rgba(var(--accent-rgb), 0.65), inset 0 0 ${coreSize*0.25}px rgba(255,255,255,0.55)`,
            }}
            animate={{ scale: isListening || isSpeaking ? [1, 1.16, 1] : [1, 1.06, 1], rotate: isAiThinking ? 180 : 0 }}
            transition={{ scale: { duration: 1.25, repeat: Infinity }, rotate: { duration: 2.5, repeat: Infinity, ease: "linear" } }}
            title="Ctrl+Space to toggle voice"
          >
            <motion.span
              className="absolute inset-0 rounded-full"
              style={{ background: `conic-gradient(from 0deg, transparent, rgba(255,255,255,0.35), transparent 70%)` }}
              animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
            <span
              className="absolute inset-0 rounded-full opacity-60 blur-xl"
              style={{ background: isListening ? "#ef4444" : "var(--accent)" }}
            />
            <Zap size={Math.max(18, coreSize * 0.38)} className="relative text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.45)]" fill="white" />
          </motion.button>

          {/* Floating particles */}
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.span key={`p-${i}`} className="absolute h-1 w-1 rounded-full bg-white/70" style={{ left: `${18+i*12}%`, top: `${22 + (i%3)*18}%` }} animate={{ y: [0, -10, 0], opacity: [0.2, 0.8, 0.2] }} transition={{ duration: 2.2 + i*0.3, repeat: Infinity, delay: i*0.2 }} />
          ))}
        </motion.div>
      </div>

      {/* Bottom widgets — always visible */}
      <div className="w-full space-y-2">
        {isListening && (
          <div className="rounded-xl bg-white/[0.04] px-3 py-2">
            <VoiceWaveform data={waveform} />
            <p className="mt-1 text-center text-[11px] text-white/50">{partial || "सुन रहा हूँ..."}</p>
          </div>
        )}

        <div className="text-center font-mono text-[10px] text-white/40">
          UI_REACTION: {reaction}s · LIVE_STREAM: {isAiThinking ? "COMPILING" : "IDLE"}
        </div>

        <div className="glass-card flex items-center gap-2 rounded-2xl p-2">
          <button
            onClick={toggle}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition active:scale-90"
            style={{ background: isListening ? "#ef4444" : "var(--accent)" }}
          >
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <input
            id="pika-transcript-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="टाइप करें या माइक दबाएँ..."
            className="flex-1 bg-transparent text-sm text-white placeholder-white/35 outline-none"
          />
          <button
            onClick={send}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white transition active:scale-90"
            style={{ background: "var(--accent)" }}
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
