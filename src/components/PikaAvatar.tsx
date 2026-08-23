import { motion, AnimatePresence } from "framer-motion";

export type PikaMood = "neutral" | "listening" | "thinking" | "speaking" | "happy";

export function PikaAvatar({ mood, size = 72 }: { mood: PikaMood; size?: number }) {
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

  return (
    <div className="relative flex shrink-0 items-center justify-center">
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

      {/* Main Avatar Bubble */}
      <motion.div
        className="relative flex items-center justify-center rounded-full cursor-pointer select-none"
        style={{
          width: size,
          height: size,
          background: bgGlow,
          boxShadow: shadowGlow,
        }}
        animate={
          mood === "speaking"
            ? { scale: [1, 1.06, 1], y: [0, -3, 0] }
            : mood === "listening"
            ? { scale: [1, 1.04, 1] }
            : mood === "thinking"
            ? { rotate: [0, 4, -4, 0] }
            : { y: [0, -2, 0] }
        }
        transition={{
          duration: mood === "speaking" ? 0.35 : mood === "thinking" ? 1.5 : 2.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <svg width={size * 0.65} height={size * 0.65} viewBox="0 0 40 40">
          {/* Cute Blushing Cheeks */}
          <circle cx={7} cy={22} r={2.5} fill="#ff6b81" opacity={0.6} />
          <circle cx={33} cy={22} r={2.5} fill="#ff6b81" opacity={0.6} />

          {/* Eyes with Dynamic Expressions */}
          {mood === "thinking" ? (
            <>
              {/* Spinning/Thinking cyber eyes */}
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
              {/* Alert wide glowing eyes */}
              <motion.circle
                cx={12}
                cy={15}
                r={3.8}
                fill="white"
                animate={{ r: [3.5, 4.2, 3.5] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
              <circle cx={13.2} cy={13.8} r={1.2} fill="#06b6d4" />
              <motion.circle
                cx={28}
                cy={15}
                r={3.8}
                fill="white"
                animate={{ r: [3.5, 4.2, 3.5] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
              <circle cx={29.2} cy={13.8} r={1.2} fill="#06b6d4" />
            </>
          ) : (
            <>
              {/* Happy / Neutral blinking eyes with pupil shine */}
              <motion.g
                animate={{ scaleY: [1, 1, 0.1, 1] }}
                transition={{ duration: 3.5, repeat: Infinity, times: [0, 0.85, 0.9, 1] }}
                style={{ originX: "20px", originY: "15px" }}
              >
                <circle cx={12} cy={15} r={3.4} fill="white" />
                <circle cx={13.2} cy={14} r={1} fill="#1e1b4b" />
                <circle cx={28} cy={15} r={3.4} fill="white" />
                <circle cx={29.2} cy={14} r={1} fill="#1e1b4b" />
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
