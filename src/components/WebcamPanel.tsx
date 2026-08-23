import { useEffect, useRef, useState } from "react";
import { Camera, Fingerprint } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { HudCard } from "./HudCard";
import { Toggle } from "./Toggle";
import { useStore } from "@/store/assistantStore";

type ScanPhase = "idle" | "verifying" | "verified" | "denied";

// Webcam feed with a sci-fi "security gate" facial-scan HUD overlay:
// animated laser scan-line + a two-stage verification state machine.
export function WebcamPanel() {
  const [on, setOn] = useState(false);
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const addToast = useStore((s) => s.addToast);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setPhase("idle");
  };

  const start = async () => {
    setPhase("verifying");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      window.setTimeout(() => setPhase("verified"), 2200);
    } catch {
      setPhase("denied");
      addToast({ type: "error", message: "कैमरा एक्सेस नहीं मिला" });
      setOn(false);
    }
  };

  useEffect(() => {
    if (on) start();
    else stop();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  return (
    <HudCard
      title="Webcam Feed"
      icon={Camera}
      dotColor={on ? "#ef4444" : "#6b7280"}
      right={
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase text-white/40">{on ? "ON" : "OFF"}</span>
          <Toggle on={on} onClick={() => setOn((v) => !v)} />
        </div>
      }
    >
      <div className="relative aspect-video overflow-hidden rounded-xl bg-black/40">
        {on ? (
          <>
            <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
            {/* scanning grid overlay */}
            <div
              className="pointer-events-none absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(var(--accent-rgb),0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--accent-rgb),0.5) 1px, transparent 1px)",
                backgroundSize: "16px 16px",
              }}
            />
            {/* corner brackets */}
            {["top-1 left-1", "top-1 right-1", "bottom-1 left-1", "bottom-1 right-1"].map((pos) => (
              <span
                key={pos}
                className={`pointer-events-none absolute h-4 w-4 ${pos} border-[var(--accent)]`}
                style={{
                  borderTopWidth: pos.includes("top") ? 2 : 0,
                  borderBottomWidth: pos.includes("bottom") ? 2 : 0,
                  borderLeftWidth: pos.includes("left") ? 2 : 0,
                  borderRightWidth: pos.includes("right") ? 2 : 0,
                }}
              />
            ))}
            {/* laser scan line */}
            {phase === "verifying" && (
              <motion.div
                className="pointer-events-none absolute left-0 right-0 h-0.5"
                style={{ background: "linear-gradient(90deg, transparent, var(--accent), transparent)" }}
                animate={{ top: ["2%", "98%", "2%"] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
              />
            )}
            {/* status overlay */}
            <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-1 font-mono text-[10px]">
              <Fingerprint size={11} className={phase === "verified" ? "text-green-400" : "text-amber-400"} />
              <AnimatePresence mode="wait">
                {phase === "verifying" && (
                  <motion.span key="v" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-amber-300">
                    FACIAL_ID: VERIFYING...
                  </motion.span>
                )}
                {phase === "verified" && (
                  <motion.span key="ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-green-400">
                    USER_IDENTITY: VERIFIED ✓
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-white/30">
            <Camera size={26} />
            <div className="text-center">
              <div className="text-xs font-medium text-white/40">CAMERA FEED OFFLINE</div>
              <div className="text-[10px] text-white/25">Click 'ON' to toggle stream</div>
            </div>
          </div>
        )}
      </div>
    </HudCard>
  );
}
