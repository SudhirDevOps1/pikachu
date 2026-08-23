import { motion } from "framer-motion";
import { ScrambleText } from "./ScrambleText";

// Sci-fi "AI thinking" animation with a rotating ring, pulsing core,
// and a scramble-text status label.
export function LoadingSpinner() {
  return (
    <div className="flex items-center gap-3 px-2 py-1">
      <div className="relative flex h-8 w-8 items-center justify-center">
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-transparent"
          style={{ borderTopColor: "var(--accent)" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="h-3 w-3 rounded-full"
          style={{ background: "var(--accent)" }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      </div>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--accent)" }}
            animate={{ y: [0, -5, 0], opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12 }}
          />
        ))}
      </div>
      <span className="text-sm text-white/50">
        <ScrambleText text="सोच रहा हूँ..." trigger={Date.now()} />
      </span>
    </div>
  );
}
