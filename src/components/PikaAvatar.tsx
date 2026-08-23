import { motion } from "framer-motion";

export type PikaMood = "neutral" | "listening" | "thinking" | "speaking";

// Small animated gradient-face avatar whose expression reacts to the
// assistant's current mood (idle / listening / thinking / speaking).
export function PikaAvatar({ mood, size = 72 }: { mood: PikaMood; size?: number }) {
  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, var(--accent), #ec4899)`,
        boxShadow: `0 0 24px rgba(var(--accent-rgb),0.45)`,
      }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 40 40">
        {/* eyes */}
        {mood === "thinking" ? (
          <>
            <line x1={8} y1={16} x2={16} y2={16} stroke="white" strokeWidth={3} strokeLinecap="round" />
            <line x1={24} y1={16} x2={32} y2={16} stroke="white" strokeWidth={3} strokeLinecap="round" />
          </>
        ) : (
          <>
            <motion.circle
              cx={12}
              cy={16}
              r={3.2}
              fill="white"
              animate={mood === "listening" ? { r: [3.2, 4, 3.2] } : { scaleY: [1, 0.15, 1] }}
              transition={{ duration: mood === "listening" ? 0.8 : 3.2, repeat: Infinity, repeatDelay: mood === "listening" ? 0 : 1.6 }}
            />
            <motion.circle
              cx={28}
              cy={16}
              r={3.2}
              fill="white"
              animate={mood === "listening" ? { r: [3.2, 4, 3.2] } : { scaleY: [1, 0.15, 1] }}
              transition={{ duration: mood === "listening" ? 0.8 : 3.2, repeat: Infinity, repeatDelay: mood === "listening" ? 0 : 1.6 }}
            />
          </>
        )}
        {/* mouth */}
        {mood === "speaking" ? (
          <motion.ellipse
            cx={20}
            cy={27}
            rx={6}
            ry={4}
            fill="white"
            animate={{ ry: [2, 5, 2] }}
            transition={{ duration: 0.4, repeat: Infinity }}
          />
        ) : mood === "listening" ? (
          <ellipse cx={20} cy={27} rx={5} ry={5} fill="white" />
        ) : (
          <path d="M 10 25 Q 20 33 30 25" stroke="white" strokeWidth={3} fill="none" strokeLinecap="round" />
        )}
      </svg>
    </div>
  );
}
