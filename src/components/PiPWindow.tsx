import { useRef } from "react";
import { Mic, Maximize2, Zap, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { useStore } from "@/store/assistantStore";
import { useVoiceApi } from "@/hooks/VoiceContext";
import { useRealPiP } from "@/hooks/useRealPiP";

export function PiPWindow() {
  const isListening = useStore((s) => s.isListening);
  const connected = useStore((s) => s.isConnected);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const updateSettings = useStore((s) => s.updateSettings);
  const { toggle } = useVoiceApi();
  const { pipWindow: livePip, startPiP } = useRealPiP();
  const pipContentRef = useRef<HTMLDivElement>(null);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      drag
      dragMomentum={false}
      dragElastic={0.1}
      whileDrag={{ scale: 1.02, rotate: 0.5 }}
      className="glass-strong fixed bottom-20 right-6 z-40 w-[300px] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.5)] border border-white/15 backdrop-blur-xl"
      style={{ boxShadow: `0 0 0 1px rgba(var(--accent-rgb),0.15), 0 12px 40px rgba(0,0,0,0.5)` }}
    >
      <div className="flex cursor-grab items-center justify-between border-b border-white/10 px-3 py-2 active:cursor-grabbing select-none">
        <span className="text-[10px] font-bold tracking-widest text-white/40">DRAG • OUTSIDE</span>
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-cyan-500">
            <Zap size={13} className="text-white" fill="white" />
          </div>
          <span className="text-sm font-semibold text-white">पिका</span>
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-400" : "bg-amber-400"}`} />
        </div>
        <span className="flex items-center gap-1.5">
          <button onClick={() => pipContentRef.current && startPiP(pipContentRef.current)} title="Browser se bahar — OS window" className="flex items-center gap-1 rounded-full bg-[var(--accent)] px-2 py-1 text-[10px] font-bold text-black"><ExternalLink size={11}/> बाहर</button>
          <button onClick={() => { updateSettings({ pipMode: false }); setActiveTab("chat"); }} className="text-white/40 hover:text-white">
            <Maximize2 size={15} />
          </button>
        </span>
      </div>
      <div ref={pipContentRef} className="flex items-center gap-3 p-4">
        <button
          onClick={toggle}
          className="flex h-12 w-12 items-center justify-center rounded-full transition active:scale-90"
          style={{ background: isListening ? "linear-gradient(135deg,#ef4444,#ec4899)" : "linear-gradient(135deg,#7c3aed,#06b6d4)" }}
        >
          <Mic size={20} className="text-white" />
        </button>
        <div className="text-sm text-white/70">{isListening ? "सुन रहा हूँ..." : "बात करने के लिए दबाएँ — बाहर भी"}</div>
      </div>
    </motion.div>
  );
}
