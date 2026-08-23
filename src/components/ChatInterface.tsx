import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store/assistantStore";
import { useAssistantApi } from "@/hooks/AssistantContext";
import { useVoiceApi } from "@/hooks/VoiceContext";
import { ChatMessage } from "./ChatMessage";
import { LoadingSpinner } from "./LoadingSpinner";
import { VoiceButton } from "./VoiceButton";
import { VoiceWaveform } from "./VoiceWaveform";
import { SUGGESTIONS } from "@/lib/constants";

export function ChatInterface() {
  const messages = useStore((s) => s.messages);
  const isAiThinking = useStore((s) => s.isAiThinking);
  const isListening = useStore((s) => s.isListening);
  const partial = useStore((s) => s.partialTranscript);
  const waveform = useStore((s) => s.voiceWaveformData);
  const { processInput } = useAssistantApi();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { toggle } = useVoiceApi();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isAiThinking]);

  // Ctrl+Space toggles voice
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === "Space") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle]);

  const send = () => {
    if (!input.trim()) return;
    processInput(input);
    setInput("");
  };

  const suggestions = input
    ? SUGGESTIONS.filter((s) => s.toLowerCase().includes(input.toLowerCase())).slice(0, 5)
    : [];

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-6 md:px-8">
        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} />
        ))}
        {isAiThinking && <LoadingSpinner />}
      </div>

      {isListening && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card mx-4 mb-2 rounded-xl px-4 py-3 md:mx-8"
        >
          <VoiceWaveform data={waveform} />
          <p className="mt-1 text-center text-sm text-white/60">{partial || "सुन रहा हूँ..."}</p>
        </motion.div>
      )}

      <div className="px-4 pb-4 md:px-8">
        <AnimatePresence>
          {suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="glass-card mb-2 flex flex-wrap gap-2 rounded-xl p-2"
            >
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setInput("");
                    processInput(s);
                  }}
                  className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <Sparkles size={11} className="text-violet-400" />
                  {s}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="glass-strong flex items-center gap-3 rounded-2xl p-3">
          <VoiceButton onToggle={toggle} />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="टाइप करो या माइक दबाओ..."
            className="flex-1 bg-transparent text-white placeholder-white/40 outline-none"
          />
          <button
            onClick={send}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white transition hover:bg-violet-500 active:scale-90"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
