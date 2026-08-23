import { Mic, MicOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/store/assistantStore";

export function VoiceButton({ onToggle }: { onToggle: () => void }) {
  const isListening = useStore((s) => s.isListening);

  return (
    <button
      onClick={onToggle}
      className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90"
      style={{
        background: isListening
          ? "linear-gradient(135deg, #ef4444, #ec4899)"
          : "linear-gradient(135deg, var(--accent), #06b6d4)",
        boxShadow: isListening
          ? "0 0 30px rgba(239,68,68,0.6)"
          : "0 0 20px rgba(var(--accent-rgb),0.4)",
      }}
      title={isListening ? "रुकें" : "बोलें (Ctrl+Space)"}
    >
      <AnimatePresence>
        {isListening &&
          [0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute inset-0 rounded-full border-2 border-red-400"
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 2.2, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.4 }}
            />
          ))}
      </AnimatePresence>
      {isListening ? <MicOff className="text-white" size={22} /> : <Mic className="text-white" size={22} />}
    </button>
  );
}
