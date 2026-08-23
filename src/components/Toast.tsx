import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";
import { useStore } from "@/store/assistantStore";
import { useEffect } from "react";
import type { Toast as ToastType } from "@/types";

const config = {
  success: { icon: CheckCircle2, color: "#22c55e" },
  error: { icon: XCircle, color: "#ef4444" },
  info: { icon: Info, color: "#06b6d4" },
  warning: { icon: AlertTriangle, color: "#eab308" },
};

function ToastItem({ toast }: { toast: ToastType }) {
  const removeToast = useStore((s) => s.removeToast);
  const { icon: Icon, color } = config[toast.type];

  useEffect(() => {
    const t = setTimeout(() => removeToast(toast.id), toast.duration ?? 4000);
    return () => clearTimeout(t);
  }, [toast.id, toast.duration, removeToast]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.9 }}
      className="glass-strong flex items-center gap-3 rounded-xl px-4 py-3 shadow-xl"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <Icon size={18} style={{ color }} />
      <span className="max-w-[240px] text-sm text-white/90">{toast.message}</span>
      <button onClick={() => removeToast(toast.id)} className="ml-auto text-white/40 hover:text-white">
        <X size={14} />
      </button>
    </motion.div>
  );
}

export function ToastContainer() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
