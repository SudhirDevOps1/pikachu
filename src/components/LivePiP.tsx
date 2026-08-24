import { useRef, useState } from "react";
import { PictureInPicture2, X, ExternalLink, Activity } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store/assistantStore";
import { useRealPiP } from "@/hooks/useRealPiP";
import { PikaAvatar, type PikaMood } from "./PikaAvatar";

// Live activity monitor. Opens as a draggable in-page card, and can pop OUT of
// the browser into a real always-on-top Document Picture-in-Picture window
// (Chrome/Edge) so you can watch Pika work while using other apps.
export function LivePiP() {
  const activityLog = useStore((s) => s.activityLog);
  const isListening = useStore((s) => s.isListening);
  const isSpeaking = useStore((s) => s.isSpeaking);
  const isAiThinking = useStore((s) => s.isAiThinking);
  const isConnected = useStore((s) => s.isConnected);
  const nowMs = useStore((s) => s.nowMs);
  const contentRef = useRef<HTMLDivElement>(null);
  const { pipWindow, startPiP } = useRealPiP();
  const [open, setOpen] = useState(false);

  const mood: PikaMood = isListening ? "listening" : isSpeaking ? "speaking" : isAiThinking ? "thinking" : "neutral";
  const status = isListening ? "सुन रहा हूँ..." : isAiThinking ? "सोच रहा हूँ..." : isSpeaking ? "बोल रहा हूँ..." : isConnected ? "तैयार" : "डेमो मोड";

  const popOut = async () => {
    if ("documentPictureInPicture" in window) {
      await startPiP(contentRef.current);
    } else {
      useStore.getState().addToast({ type: "info", message: "Document PiP सिर्फ Chrome/Edge में — in-page मोड इस्तेमाल करें।" });
    }
  };

  return (
    <>
      {/* Floating launcher — DRAGGABLE like settings, never overlaps */}
      <motion.button
        drag
        dragMomentum={false}
        dragElastic={0.14}
        whileHover={{ scale: 1.08, rotate: 3 }}
        whileTap={{ scale: 0.96 }}
        whileDrag={{ scale: 1.12 }}
        onClick={() => setOpen((v) => !v)}
        onDoubleClick={popOut}
        title="Live PiP — drag karo, click kholo, double-click bahar (Chrome/Edge)"
        className="fixed bottom-2 right-2 z-50 flex h-11 w-11 cursor-grab items-center justify-center rounded-full text-white shadow-lg active:cursor-grabbing sm:h-12 sm:w-12 border border-white/10"
        style={{
          background: `linear-gradient(135deg, var(--accent), var(--secondary-accent))`,
          boxShadow: `0 0 20px rgba(var(--accent-rgb),0.5), 0 8px 24px rgba(0,0,0,0.35)`,
        }}
      >
        <PictureInPicture2 size={18} />
        {activityLog.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white animate-pulse">
            {Math.min(activityLog.length, 9)}
          </span>
        )}
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-1.5 py-0.5 text-[7px] font-bold tracking-widest text-white/70 opacity-0 group-hover:opacity-100">DRAG</span>
      </motion.button>

      <AnimatePresence>
        {open && !pipWindow && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            drag
            dragMomentum={false}
            className="glass-strong fixed bottom-36 right-4 z-40 flex h-[380px] w-[290px] flex-col rounded-2xl p-4 shadow-2xl"
            style={{ border: `1px solid rgba(var(--accent-rgb),0.3)` }}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-white/30"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> DRAGGABLE • POP-OUT</span>
              <span className="flex items-center gap-1.5">
                <button onClick={popOut} title="Browser se bahar — OS window (Chrome/Edge)" className="flex items-center gap-1 rounded-full bg-[var(--accent)] px-2.5 py-1 text-[10px] font-bold text-black hover:opacity-90">
                  <ExternalLink size={12} /> बाहर निकालो
                </button>
                <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white">
                  <X size={16} />
                </button>
              </span>
            </div>

            {/* This subtree gets physically moved into the Document PiP window */}
            <div ref={contentRef} className="flex flex-1 flex-col gap-3 overflow-hidden text-white">
              <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                <PikaAvatar mood={mood} size={44} />
                <div className="flex-1">
                  <div className="text-sm font-bold" style={{ color: "var(--accent)" }}>PIKA LIVE</div>
                  <div className="text-[10px] text-white/50">{status}</div>
                </div>
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: isConnected ? "#22c55e" : "#eab308", boxShadow: `0 0 8px ${isConnected ? "#22c55e" : "#eab308"}` }}
                />
              </div>

              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40">
                <Activity size={11} /> Live Activity
              </div>

              <div className="flex-1 space-y-1.5 overflow-y-auto">
                {activityLog.length === 0 ? (
                  <div className="flex h-full items-center justify-center px-4 text-center text-xs text-white/25">
                    कोई कमांड चलाएँ और यहाँ Pika का काम live देखें।
                  </div>
                ) : (
                  activityLog.map((a) => (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2 rounded-lg bg-white/[0.05] px-2.5 py-1.5"
                    >
                      <span className="text-sm">{a.icon}</span>
                      <span className="flex-1 truncate font-mono text-[11px] text-white/80">{a.text}</span>
                      <span className="text-[9px] text-white/30">{Math.max(0, Math.round((nowMs - a.at) / 1000))}s</span>
                    </motion.div>
                  ))
                )}
              </div>

              <div className="border-t border-white/10 pt-2 text-center font-mono text-[9px] text-white/30">
                ⚡ PIKA AI · {new Date(nowMs).toLocaleTimeString("hi-IN")}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recovery placeholder — content returns here when PiP window closes */}
      <div id="pika-pip-placeholder" style={{ display: "none" }} />
    </>
  );
}
