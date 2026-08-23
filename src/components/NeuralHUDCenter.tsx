import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Zap, Send, Mic, MicOff } from "lucide-react";
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
      // Keep it a square that fits inside BOTH width & height. Lower floor of
      // 140px so ultra-short screens still show a complete (small) orb rather
      // than a clipped one; capped at 420px on large monitors.
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

  const send = () => {
    if (!input.trim()) return;
    processInput(input);
    setInput("");
  };

  const coreSize = Math.round(orbSize * 0.24);

  return (
    <div className="flex h-full flex-col gap-3 p-3 sm:p-4">
      {/* Status header */}
      <div className="text-center font-mono text-[10px] tracking-widest sm:text-[11px]" style={{ color: statusColor }}>
        <ScrambleText text={`NEURAL_NET: ${neuralStatus}`} trigger={neuralStatus} />
      </div>

      {/* Orb region — flex-1 so it eats all remaining vertical space */}
      <div ref={orbHolderRef} className="relative flex min-h-0 flex-1 items-center justify-center">
        <div className="relative" style={{ width: orbSize, height: orbSize }}>
          {/* 4 rotating rings */}
          {[
            { size: 100, dur: 24, color: "rgba(var(--accent-rgb),0.35)", dash: false },
            { size: 78, dur: 18, color: "rgba(6,182,212,0.3)", dash: true },
            { size: 58, dur: 14, color: "rgba(var(--secondary-accent-rgb),0.25)", dash: false },
            { size: 40, dur: 8, color: "rgba(255,255,255,0.15)", dash: true },
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
              }}
              animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
              transition={{ duration: r.dur, repeat: Infinity, ease: "linear" }}
            />
          ))}

          {/* SVG scanning sweep — cinematic radar arc */}
          <svg className="absolute inset-0" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="pika-sweep" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <motion.g
              animate={{ rotate: 360 }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: "50% 50%" }}
            >
              <path d="M 50 50 L 100 50 A 50 50 0 0 0 65 6 Z" fill="url(#pika-sweep)" />
            </motion.g>
          </svg>

          {/* 8 orbiting neural nodes on outer ring */}
          {Array.from({ length: OUTER_DOTS }).map((_, i) => {
            const angle = (360 / OUTER_DOTS) * i;
            const p = pt(50, angle);
            const nodeColor = i % 3 === 0 ? "var(--accent)" : i % 3 === 1 ? "#06b6d4" : "var(--secondary-accent)";
            return (
              <motion.span
                key={i}
                className="absolute h-2 w-2 rounded-full"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  background: nodeColor,
                  boxShadow: `0 0 8px ${nodeColor}`,
                  translate: "-50% -50%",
                }}
                animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.4, 1] }}
                transition={{ duration: 2 + (i % 3), repeat: Infinity, delay: i * 0.15 }}
              />
            );
          })}

          {/* Listening pulse rings — sized relative to the core */}
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
                animate={{ scale: 3, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.6 }}
              />
            ))}

          {/* Central core button */}
          <motion.button
            onClick={toggle}
            className="absolute flex items-center justify-center rounded-full"
            style={{
              left: "50%",
              top: "50%",
              width: coreSize,
              height: coreSize,
              translate: "-50% -50%",
              background: `radial-gradient(circle at 30% 30%, ${isListening ? "#ff8080" : "var(--accent)"}, ${isListening ? "#ef4444" : "var(--secondary-accent)"})`,
              boxShadow: `0 0 ${coreSize / 2}px rgba(var(--accent-rgb), 0.5)`,
            }}
            animate={{ scale: isListening || isSpeaking ? [1, 1.15, 1] : [1, 1.05, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            title="Ctrl+Space to toggle voice"
          >
            <span
              className="absolute inset-0 rounded-full opacity-60 blur-xl"
              style={{ background: isListening ? "#ef4444" : "var(--accent)" }}
            />
            <Zap size={Math.max(18, coreSize * 0.35)} className="relative text-white" fill="white" />
          </motion.button>
        </div>
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
