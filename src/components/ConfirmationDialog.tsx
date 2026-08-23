import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useStore } from "@/store/assistantStore";
import { useAssistantApi } from "@/hooks/AssistantContext";
import { GlowButton } from "./GlowButton";

export function ConfirmationDialog() {
  const pending = useStore((s) => s.pendingConfirmation);
  const { resolveConfirmation } = useAssistantApi();

  return (
    <AnimatePresence>
      {pending && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => resolveConfirmation(false)}
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="glass-strong relative z-10 w-full max-w-md rounded-2xl p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/20">
                <AlertTriangle className="text-amber-400" size={22} />
              </div>
              <h3 className="text-lg font-semibold text-white">पुष्टि करें</h3>
            </div>
            <p className="mb-6 text-sm leading-relaxed text-white/70">{pending.message}</p>
            <div className="flex justify-end gap-3">
              <GlowButton variant="ghost" onClick={() => resolveConfirmation(false)}>
                रद्द करें
              </GlowButton>
              <GlowButton variant="danger" onClick={() => resolveConfirmation(true)}>
                हाँ, करें
              </GlowButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
