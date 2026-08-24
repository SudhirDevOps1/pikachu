import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/store/assistantStore";

export type PikaMood = "neutral" | "listening" | "thinking" | "speaking" | "happy";

export function PikaAvatar({ mood, size = 72 }: { mood: PikaMood; size?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const [isHoverNear, setIsHoverNear] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);
  const [clickBop, setClickBop] = useState(0);
  const [isWinking, setIsWinking] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const waveform = useStore((s) => s.voiceWaveformData);
  const voiceEnergy = waveform.reduce((a: number, b: number) => a + b, 0) / Math.max(1, waveform.length);

  // Eye tracking — cursor jidhar, aankhen udhar
  useEffect(() => {
    let raf = 0;
    let lastX = 0, lastY = 0;
    const onMove = (e: MouseEvent) => { lastX = e.clientX; lastY = e.clientY; if (!raf) raf = requestAnimationFrame(tick); };
    const tick = () => {
      raf = 0;
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = lastX - cx;
      const dy = lastY - cy;
      const dist = Math.hypot(dx, dy);
      const maxDist = Math.max(220, Math.hypot(window.innerWidth, window.innerHeight) * 0.28);
      const strength = mood === "thinking" ? 0.45 : mood === "listening" ? 1.35 : 1.28;
      const nx = Math.max(-1, Math.min(1, (dx / maxDist) * 3.2 * strength));
      const ny = Math.max(-1, Math.min(1, (dy / maxDist) * 2.9 * strength));
      setEyeOffset({ x: nx, y: ny });
      setIsHoverNear(dist < 180);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("touchmove", (e) => { if (e.touches[0]) { lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; if (!raf) raf = requestAnimationFrame(tick); } }, { passive: true } as any);
    return () => { window.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, [mood]);

  // Auto blink + click bop
  useEffect(() => {
    const iv = setInterval(() => { setIsBlinking(true); setTimeout(() => setIsBlinking(false), 140); }, 3200 + Math.random() * 2200);
    return () => clearInterval(iv);
  }, []);
  // Dynamic glow and gradient based on active state
  const bgGlow = {
    listening: "linear-gradient(135deg, #06b6d4, #3b82f6)",
    thinking: "linear-gradient(135deg, #f59e0b, #ec4899)",
    speaking: "linear-gradient(135deg, #10b981, #06b6d4)",
    happy: "linear-gradient(135deg, #ec4899, #8b5cf6)",
    neutral: "linear-gradient(135deg, var(--accent), #ec4899)",
  }[mood] || "linear-gradient(135deg, var(--accent), #ec4899)";

  const shadowGlow = {
    listening: "0 0 35px rgba(6,182,212,0.6)",
    thinking: "0 0 35px rgba(245,158,11,0.6)",
    speaking: "0 0 35px rgba(16,185,129,0.6)",
    happy: "0 0 35px rgba(236,72,153,0.6)",
    neutral: "0 0 25px rgba(var(--accent-rgb),0.5)",
  }[mood] || "0 0 25px rgba(var(--accent-rgb),0.5)";

  // Pupil max offset — made 45% more sensitive for Standard mode visibility
  const px = eyeOffset.x * 1.95;
  const py = eyeOffset.y * 1.55;
  const headTilt = eyeOffset.x * 9;
  const headPitch = eyeOffset.y * -6;
  const isLooking = Math.abs(eyeOffset.x) > 0.06 || Math.abs(eyeOffset.y) > 0.06;

  return (
    <div ref={wrapRef} className="relative flex shrink-0 items-center justify-center">
      {/* Outer audio / neural pulse rings when listening or speaking */}
      <AnimatePresence>
        {(mood === "listening" || mood === "speaking") && (
          <>
            <motion.span
              className="absolute rounded-full border border-cyan-400/50"
              style={{ width: size * 1.4, height: size * 1.4 }}
              initial={{ scale: 0.8, opacity: 0.8 }}
              animate={{ scale: 1.3, opacity: 0 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.span
              className="absolute rounded-full border border-purple-400/40"
              style={{ width: size * 1.6, height: size * 1.6 }}
              initial={{ scale: 0.8, opacity: 0.8 }}
              animate={{ scale: 1.4, opacity: 0 }}
              transition={{ duration: 1.4, repeat: Infinity, delay: 0.5, ease: "easeOut" }}
            />
          </>
        )}
      </AnimatePresence>
      {/* Cursor proximity glow */}
      <motion.span className="absolute rounded-full bg-[var(--accent)]/15 blur-xl pointer-events-none" style={{ width: size*1.8, height: size*1.8 }} animate={{ opacity: isHoverNear ? 0.9 : 0, scale: isHoverNear ? 1 : 0.7 }} transition={{ duration: 0.35 }} />

      {/* Main Avatar Bubble — head follows cursor with pitch */}
      <motion.div
        className="relative flex items-center justify-center rounded-full cursor-pointer select-none"
        style={{
          width: size,
          height: size,
          background: bgGlow,
          boxShadow: isHoverNear ? "0 0 42px rgba(var(--accent-rgb),0.85)" : shadowGlow,
          rotateY: headTilt,
          rotateX: headPitch,
        }}
        animate={
          mood === "speaking"
            ? { scale: [1, 1.06, 1], y: [0, -3, 0] }
            : mood === "listening"
            ? { scale: [1, 1.04, 1] }
            : mood === "thinking"
            ? { rotate: [0, 4, -4, 0] }
            : isLooking ? { y: [0, -1, 0] } : { y: [0, -2, 0] }
        }
        transition={{
          duration: mood === "speaking" ? 0.35 : mood === "thinking" ? 1.5 : 2.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => { setClickBop(v=>v+1); setIsBlinking(true); setTimeout(()=>setIsBlinking(false),180); setShowTip(true); setTimeout(()=>setShowTip(false),1200); }}
        onDoubleClick={() => { setIsWinking(true); setClickBop(v=>v+1); setTimeout(()=>setIsWinking(false),650); }}
        onContextMenu={(e) => { e.preventDefault(); setIsWinking(true); setTimeout(()=>setIsWinking(false),500); }}
        title="Cursor jidhar, Pika udhar dekhega — click/wink/double-click!"
      >
        <svg width={size * 0.65} height={size * 0.65} viewBox="0 0 40 40" style={{ overflow: "visible" }}>
          {/* Cute Blushing Cheeks — blush follows look */}
          <motion.circle cx={7} cy={22} r={2.5} fill="#ff6b81" animate={{ opacity: isHoverNear ? 0.85 : 0.6, scale: isHoverNear ? 1.15 : 1 }} transition={{ duration: 0.4 }} />
          <motion.circle cx={33} cy={22} r={2.5} fill="#ff6b81" animate={{ opacity: isHoverNear ? 0.85 : 0.6, scale: isHoverNear ? 1.15 : 1 }} transition={{ duration: 0.4 }} />
          {/* Eyebrows follow cursor */}
          <motion.g animate={{ x: px * 0.35, y: py * 0.25 }} transition={{ type: "spring", stiffness: 180, damping: 18 }}>
            <path d="M 8 10 Q 12 8.5 16 10" stroke="white" strokeOpacity={0.9} strokeWidth={1.4} fill="none" strokeLinecap="round" />
            <path d="M 24 10 Q 28 8.5 32 10" stroke="white" strokeOpacity={0.9} strokeWidth={1.4} fill="none" strokeLinecap="round" />
          </motion.g>

          {/* Eyes with Dynamic Expressions — now cursor-tracking */}
          {mood === "thinking" ? (
            <>
              <motion.g
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                style={{ originX: "12px", originY: "15px" }}
              >
                <circle cx={12} cy={15} r={3.5} stroke="white" strokeWidth={1.8} fill="none" strokeDasharray="5 3" />
              </motion.g>
              <motion.g
                animate={{ rotate: -360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                style={{ originX: "28px", originY: "15px" }}
              >
                <circle cx={28} cy={15} r={3.5} stroke="white" strokeWidth={1.8} fill="none" strokeDasharray="5 3" />
              </motion.g>
            </>
          ) : mood === "listening" ? (
            <>
              <motion.circle
                cx={12}
                cy={15}
                r={3.8}
                fill="white"
                animate={{ r: [3.5, 4.2, 3.5] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
              <motion.circle cx={13.2 + px} cy={13.8 + py} r={1.25} fill="#06b6d4" animate={{ scale: isLooking ? 1.15 : 1 }} transition={{ duration: 0.2 }} />
              <motion.circle
                cx={28}
                cy={15}
                r={3.8}
                fill="white"
                animate={{ r: [3.5, 4.2, 3.5] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
              <motion.circle cx={29.2 + px} cy={13.8 + py} r={1.25} fill="#06b6d4" animate={{ scale: isLooking ? 1.15 : 1 }} transition={{ duration: 0.2 }} />
            </>
          ) : (
            <>
              {/* Happy / Neutral — pupils track cursor + blink */}
              <motion.g
                animate={{ scaleY: isBlinking ? 0.08 : 1 }}
                transition={{ duration: 0.13 }}
                style={{ originX: "20px", originY: "15px" }}
              >
                <circle cx={12} cy={15} r={3.4} fill="white" />
                <motion.circle cx={13.2 + px} cy={14 + py} r={1.05} fill="#1e1b4b" animate={{ scale: clickBop ? 1.3 : 1 }} transition={{ duration: 0.22 }} />
                <circle cx={12.6} cy={13.2} r={0.6} fill="white" opacity={0.85} />
                <circle cx={28} cy={15} r={3.4} fill="white" />
                <motion.circle cx={29.2 + px} cy={14 + py} r={1.05} fill="#1e1b4b" animate={{ scale: clickBop ? 1.3 : 1 }} transition={{ duration: 0.22 }} />
                <circle cx={28.6} cy={13.2} r={0.6} fill="white" opacity={0.85} />
              </motion.g>
            </>
          )}

          {/* Mouth with Voice-reactive Shapes */}
          {mood === "speaking" ? (
            <motion.ellipse
              cx={20}
              cy={26}
              rx={6}
              ry={4.5}
              fill="white"
              animate={{ ry: [2, 6, 2.5, 5, 2] }}
              transition={{ duration: 0.45, repeat: Infinity, ease: "easeInOut" }}
            />
          ) : mood === "listening" ? (
            <motion.ellipse
              cx={20}
              cy={26}
              rx={4}
              ry={4}
              fill="white"
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 0.9, repeat: Infinity }}
            />
          ) : mood === "thinking" ? (
            <motion.path
              d="M 14 26 Q 20 22 26 26"
              stroke="white"
              strokeWidth={2.8}
              fill="none"
              strokeLinecap="round"
            />
          ) : (
            <motion.path
              d="M 12 24 Q 20 31 28 24"
              stroke="white"
              strokeWidth={2.8}
              fill="none"
              strokeLinecap="round"
            />
          )}
        </svg>
      </motion.div>
    </div>
  );
}
