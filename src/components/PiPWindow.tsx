import { useRef, useState } from "react";
import { Mic, Maximize2, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { useStore } from "@/store/assistantStore";
import { useVoiceApi } from "@/hooks/VoiceContext";

export function PiPWindow() {
  const isListening = useStore((s) => s.isListening);
  const connected = useStore((s) => s.isConnected);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const updateSettings = useStore((s) => s.updateSettings);
  const { toggle } = useVoiceApi();
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef({ active: false, sx: 0, sy: 0, ox: 0, oy: 0 });

  const onDown = (e: React.MouseEvent) => {
    drag.current = { active: true, sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
    const move = (ev: MouseEvent) => {
      if (!drag.current.active) return;
      setPos({ x: drag.current.ox + ev.clientX - drag.current.sx, y: drag.current.oy + ev.clientY - drag.current.sy });
    };
    const up = () => {
      drag.current.active = false;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-strong fixed bottom-6 right-6 z-40 w-[280px] rounded-2xl shadow-2xl"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
    >
      <div onMouseDown={onDown} className="flex cursor-grab items-center justify-between border-b border-white/10 px-3 py-2 active:cursor-grabbing">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-cyan-500">
            <Zap size={13} className="text-white" fill="white" />
          </div>
          <span className="text-sm font-semibold text-white">पिका</span>
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-400" : "bg-amber-400"}`} />
        </div>
        <button onClick={() => { updateSettings({ pipMode: false }); setActiveTab("chat"); }} className="text-white/40 hover:text-white">
          <Maximize2 size={15} />
        </button>
      </div>
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={toggle}
          className="flex h-12 w-12 items-center justify-center rounded-full transition active:scale-90"
          style={{ background: isListening ? "linear-gradient(135deg,#ef4444,#ec4899)" : "linear-gradient(135deg,#7c3aed,#06b6d4)" }}
        >
          <Mic size={20} className="text-white" />
        </button>
        <div className="text-sm text-white/70">{isListening ? "सुन रहा हूँ..." : "बात करने के लिए दबाएँ"}</div>
      </div>
    </motion.div>
  );
}
