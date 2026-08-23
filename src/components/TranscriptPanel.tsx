import { useEffect, useRef, useState } from "react";
import { Send, MessageSquare, Sparkles } from "lucide-react";
import { useStore } from "@/store/assistantStore";
import { useAssistantApi } from "@/hooks/AssistantContext";
import { useVoiceApi } from "@/hooks/VoiceContext";
import { ChatMessage } from "./ChatMessage";
import { LoadingSpinner } from "./LoadingSpinner";
import { PikaAvatar, type PikaMood } from "./PikaAvatar";
import { VoiceButton } from "./VoiceButton";
import { VoiceWaveform } from "./VoiceWaveform";
import { Typewriter } from "./Typewriter";

const QUICK_ACTIONS = [
  { label: "Tell me a joke 🃏", cmd: "joke sunao" },
  { label: "Open YouTube 📺", cmd: "open youtube" },
  { label: "System info 🖥️", cmd: "cpu usage" },
  { label: "Hindi translation 🌐", cmd: "translate hello to hindi" },
  { label: "मौसम बताओ ⛅", cmd: "weather" },
  { label: "स्क्रीनशॉट लो 📸", cmd: "screenshot" },
];

// Right-column "Transcript Logs" panel — Pika's mood avatar, greeting,
// quick-action chips, the running conversation, and the message input.
export function TranscriptPanel() {
  const messages = useStore((s) => s.messages);
  const isAiThinking = useStore((s) => s.isAiThinking);
  const isListening = useStore((s) => s.isListening);
  const isSpeaking = useStore((s) => s.isSpeaking);
  const partial = useStore((s) => s.partialTranscript);
  const waveform = useStore((s) => s.voiceWaveformData);
  const agentModeEnabled = useStore((s) => s.settings.agentModeEnabled);
  const { processInput } = useAssistantApi();
  const { toggle } = useVoiceApi();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isAiThinking]);

  const mood: PikaMood = isListening ? "listening" : isSpeaking ? "speaking" : isAiThinking ? "thinking" : "happy";
  const moodLabel = {
    listening: "🎙️ LISTENING",
    speaking: "🔊 SPEAKING",
    thinking: "⚡ THINKING...",
    happy: "✨ READY",
    neutral: "✨ READY",
  }[mood];

  const send = () => {
    if (!input.trim()) return;
    processInput(input);
    setInput("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: "var(--accent)" }} />
        <MessageSquare size={13} className="text-white/40" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Transcript Logs</span>
        
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] uppercase text-white/50">Agent Mode</span>
          <button
            onClick={() => useStore.getState().updateSettings({ agentModeEnabled: !agentModeEnabled })}
            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
              agentModeEnabled ? "bg-accent" : "bg-white/20"
            }`}
            style={{ backgroundColor: agentModeEnabled ? "var(--accent)" : "" }}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                agentModeEnabled ? "translate-x-3.5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1 pb-2 pt-4">
        <PikaAvatar mood={mood} size={72} />
        <span className="mt-1 text-[10px] uppercase tracking-widest text-white/35">PIKA :: {moodLabel}</span>
        {messages.length <= 2 && (
          <p className="max-w-[200px] text-center text-[11px] leading-relaxed text-white/40">
            <Typewriter text="नमस्ते! मैं पिका हूँ। आपकी क्या मदद कर सकता हूँ?" speed={40} />
          </p>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-2">
        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} />
        ))}
        {isAiThinking && <LoadingSpinner />}

        {messages.length <= 1 && (
          <div className="grid grid-cols-2 gap-2 pt-2">
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa.label}
                onClick={() => processInput(qa.cmd)}
                className="flex items-center gap-1.5 rounded-xl bg-white/[0.05] px-3 py-2 text-left text-[11px] text-white/70 transition hover:bg-white/[0.1] hover:text-white"
              >
                <Sparkles size={11} style={{ color: "var(--accent)" }} className="shrink-0" />
                <span className="truncate">{qa.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {isListening && (
        <div className="mx-4 mb-2 rounded-xl bg-white/[0.05] px-3 py-2">
          <VoiceWaveform data={waveform} />
          <p className="mt-1 text-center text-[11px] text-white/50">{partial || "सुन रहा हूँ..."}</p>
        </div>
      )}

      <div className="border-t border-white/10 p-3">
        <div className="glass-card flex items-center gap-2 rounded-2xl p-2">
          <VoiceButton onToggle={toggle} />
          <input
            id="pika-transcript-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="टाइप करो या माइक दबाओ..."
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
