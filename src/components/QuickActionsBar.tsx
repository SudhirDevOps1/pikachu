import { motion } from "framer-motion";
import { Globe, Camera, Play, Music, Search, Terminal, Calculator, Languages } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAssistantApi } from "@/hooks/AssistantContext";
import { sounds } from "@/lib/soundEffects";

// Horizontal quick-actions launcher shown at the bottom of the Futurist
// dashboard — one-tap access to the most common commands.
interface QuickAction {
  icon: LucideIcon;
  label: string;
  cmd: string;
  color: string;
}

const ACTIONS: QuickAction[] = [
  { icon: Globe, label: "Chrome", cmd: "open chrome", color: "#06b6d4" },
  { icon: Play, label: "YouTube", cmd: "open youtube", color: "#ef4444" },
  { icon: Camera, label: "स्क्रीनशॉट", cmd: "screenshot", color: "var(--accent)" },
  { icon: Music, label: "म्यूज़िक", cmd: "play music", color: "#ec4899" },
  { icon: Terminal, label: "टर्मिनल", cmd: "open terminal", color: "#22c55e" },
  { icon: Calculator, label: "कैलक", cmd: "calculate 2+2", color: "#f59e0b" },
  { icon: Languages, label: "अनुवाद", cmd: "translate hello to hindi", color: "#8b5cf6" },
  { icon: Search, label: "सर्च", cmd: "search AI news", color: "#38bdf8" },
];

export function QuickActionsBar() {
  const { processInput } = useAssistantApi();
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2 md:px-6">
      {ACTIONS.map((a, i) => (
        <motion.button
          key={a.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          whileHover={{ y: -3, scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            sounds.click();
            processInput(a.cmd);
          }}
          className="glass-card flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white/85 transition hover:text-white"
          style={{ boxShadow: `0 0 0 0 ${a.color}` }}
        >
          <a.icon size={15} style={{ color: a.color }} />
          <span>{a.label}</span>
        </motion.button>
      ))}
    </div>
  );
}
