import { Sun, Moon, Zap, Wifi, WifiOff, Sparkles, Command } from "lucide-react";
import { motion } from "framer-motion";
import { useStore } from "@/store/assistantStore";
import { PROVIDERS } from "@/lib/constants";
import { AccentPicker } from "./AccentPicker";
import { ScrambleText } from "./ScrambleText";
import { cn } from "@/utils/cn";
import { sounds } from "@/lib/soundEffects";

export function TopBar() {
  const isConnected = useStore((s) => s.isConnected);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const isListening = useStore((s) => s.isListening);
  const isSpeaking = useStore((s) => s.isSpeaking);
  const isAiThinking = useStore((s) => s.isAiThinking);
  const provider = useStore((s) => s.settings.aiProvider);
  const theme = useStore((s) => s.settings.theme);
  const updateSettings = useStore((s) => s.updateSettings);
  const setUiMode = useStore((s) => s.setUiMode);

  const stt = useStore((s) => s.settings.sttEngine) || "webspeech";
  const tts = useStore((s) => s.settings.ttsEngine) || "edge";
  const llm = useStore((s) => s.settings.aiProvider) || "groq";

  const sttDisplay = stt === "webspeech" ? "WebSpeech" : stt === "vosk" ? "Vosk Live" : "Whisper";
  const ttsDisplay = tts === "edge" ? "Edge-TTS" : tts === "piper" ? "Piper Offline" : tts === "webspeech" ? "WebSpeech" : "Mute";
  const providerInfo = PROVIDERS.find((p) => p.id === provider);
  const llmDisplay = providerInfo?.name ?? llm.toUpperCase();

  let label = connectionStatus === "connecting" ? "CONNECTING" : "IDLE";
  let dot = "#22c55e";
  if (isAiThinking) { label = "THINKING"; dot = "#eab308"; }
  if (isSpeaking) { label = "SPEAKING"; dot = "#06b6d4"; }
  if (isListening) { label = "LISTENING"; dot = "#ef4444"; }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6 border-b border-white/[0.04] backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <motion.div animate={{ scale: isListening || isSpeaking || isAiThinking ? [1, 1.06, 1] : 1 }} transition={{ duration: 0.9, repeat: isListening || isSpeaking ? Infinity : 0 }} className="glass-card flex items-center gap-2 rounded-full px-3 py-1.5 text-xs border border-white/10">
          <span
            className={cn("h-2 w-2 rounded-full", (isListening || isAiThinking || isSpeaking) && "animate-pulse")}
            style={{ background: dot, boxShadow: `0 0 8px ${dot}` }}
          />
          <span className="font-mono text-white/70">
            <ScrambleText text={label} trigger={label} />
          </span>
        </motion.div>

        <div className="glass-card hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs sm:flex">
          <Zap size={12} style={{ color: "var(--accent)" }} fill="var(--accent)" />
          <span className="font-medium" style={{ color: "var(--accent)" }}>
            {providerInfo?.name ?? provider}
          </span>
          <span className="text-white/35">{providerInfo?.model}</span>
        </div>

        <div className="glass-card hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] uppercase tracking-wider sm:flex text-white/50">
          <span className="font-medium text-white/70">STT:</span> <span className="text-cyan-400 font-semibold">{sttDisplay}</span> <span className="mx-1 opacity-20">|</span>
          <span className="font-medium text-white/70">TTS:</span> <span className="text-purple-400 font-semibold">{ttsDisplay}</span> <span className="mx-1 opacity-20">|</span>
          <span className="font-medium text-white/70">LLM:</span> <span className="text-emerald-400 font-semibold">{llmDisplay}</span>
        </div>

        <div className="glass-card flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs text-white/50 md:hidden">
          {isConnected ? <Wifi size={12} className="text-green-400" /> : <WifiOff size={12} />}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={()=>useStore.getState().setCommandPaletteOpen(true)} title="Command Palette (Ctrl+K)" className="hidden sm:flex items-center gap-1.5 rounded-full glass-card px-3 py-1.5 text-xs text-white/60 hover:text-white border border-white/10">
          <Command size={13} /> Ctrl+K
        </button>
        <AccentPicker />
        <button
          onClick={() => {
            sounds.click();
            const next = theme === "dark" ? "light" : "dark";
            updateSettings({ theme: next });
            document.documentElement.classList.toggle("theme-light", next === "light");
          }}
          title="थीम टॉगल करें"
          className="glass-card flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition hover:text-white"
        >
          {theme === "dark" ? <Moon size={14} /> : <Sun size={14} />}
        </button>
        <button
          onClick={() => {
            sounds.click();
            setUiMode("futurist");
          }}
          title="फ्यूचरिस्टिक मोड"
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white transition hover:scale-105"
          style={{
            background: `linear-gradient(135deg, var(--accent), rgba(var(--accent-rgb),0.7))`,
            boxShadow: `0 0 14px rgba(var(--accent-rgb),0.4)`,
          }}
        >
          <Sparkles size={13} /> फ्यूचर मोड
        </button>
      </div>
    </div>
  );
}
