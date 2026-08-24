import { useEffect } from "react";
import {
  MessageSquare,
  Gamepad2,
  Settings,
  Repeat,
  Bell,
  Activity,
  Calendar,
  Wrench,
  ChevronLeft,
  Zap,
  StickyNote,
} from "lucide-react";
import { motion } from "framer-motion";
import { useStore } from "@/store/assistantStore";
import { cn } from "@/utils/cn";
import type { TabName } from "@/types";
import { sounds } from "@/lib/soundEffects";

const NAV: { id: TabName; label: string; icon: typeof MessageSquare }[] = [
  { id: "chat", label: "चैट", icon: MessageSquare },
  { id: "notes", label: "नोट्स", icon: StickyNote },
  { id: "controls", label: "कंट्रोल", icon: Gamepad2 },
  { id: "tools", label: "टूल्स", icon: Wrench },
  { id: "macros", label: "मैक्रो", icon: Repeat },
  { id: "reminders", label: "रिमाइंडर", icon: Bell },
  { id: "processes", label: "प्रोसेस", icon: Activity },
  { id: "scheduler", label: "शेड्यूलर", icon: Calendar },
  { id: "settings", label: "सेटिंग्स", icon: Settings },
];

export function Sidebar() {
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const expanded = useStore((s) => s.sidebarExpanded);
  const toggleSidebar = useStore((s) => s.toggleSidebar);

  // Auto-collapse on narrow screens for mobile responsiveness
  useEffect(() => {
    const check = () => {
      const wide = window.innerWidth >= 900;
      const store = useStore.getState();
      if (!wide && store.sidebarExpanded) store.toggleSidebar();
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Hidden by default — single floating button outside will toggle
  if (!expanded) return null;

  return (
    <motion.aside
      initial={{ x: -232, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -232, opacity: 0 }}
      transition={{ type: "spring", stiffness: 280, damping: 28 }}
      className="glass-card z-20 flex w-[232px] shrink-0 flex-col border-y-0 border-l-0 py-4 backdrop-blur-xl relative overflow-hidden"
    >
      {/* subtle grid */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)`, backgroundSize: `20px 20px` }} />
      {/* Logo */}
      <div className="mb-6 flex items-center gap-3 px-5 relative">
        <motion.div
          animate={{ boxShadow: ["0 0 12px rgba(124,58,237,0.35)","0 0 22px rgba(6,182,212,0.45)","0 0 12px rgba(124,58,237,0.35)"] }}
          transition={{ duration: 2.4, repeat: Infinity }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 shadow-lg relative overflow-hidden"
        >
          <motion.span className="absolute inset-0" style={{ background: `linear-gradient(120deg, transparent, rgba(255,255,255,0.28), transparent)` }} animate={{ x: ["-100%","200%"] }} transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.4, ease: "linear" }} />
          <Zap className="text-white relative" size={20} fill="white" />
        </motion.div>
        <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="overflow-hidden">
          <div className="text-lg font-bold leading-none text-white tracking-wide">पिका</div>
          <div className="text-[10px] text-white/40 tracking-widest">AI असिस्टेंट • VOICE</div>
        </motion.div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV.map((item, idx) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04 }}
              whileHover={{ x: 2, scale: 1.015 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                sounds.click();
                setActiveTab(item.id);
              }}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all overflow-hidden",
                active ? "text-white" : "text-white/55 hover:bg-white/5 hover:text-white/90 hover:shadow-[0_0_12px_rgba(var(--accent-rgb),0.15)]"
              )}
            >
              {active && (
                <motion.div
                  layoutId="active-nav"
                  className="absolute inset-0 rounded-xl bg-[var(--accent)]/25 shadow-[0_0_18px_rgba(var(--accent-rgb),0.35)] border border-[var(--accent)]/20"
                />
              )}
              {!active && <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/[0.03] to-transparent opacity-0 hover:opacity-100 transition-opacity" />}
              <Icon size={20} className="relative z-10 shrink-0" />
              {expanded && <span className="relative z-10 font-medium">{item.label}</span>}
              {active && expanded && <motion.span layoutId="dot" className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_6px_var(--accent)] relative z-10" />}
            </motion.button>
          );
        })}
      </nav>

      {/* Collapse toggle — hide sidebar */}
      <button
        onClick={toggleSidebar}
        className="mx-3 mt-2 flex items-center justify-center gap-1.5 rounded-xl py-2 text-white/40 hover:bg-white/5 hover:text-white text-xs"
      >
        <ChevronLeft size={16} /> छुपाएँ
      </button>
    </motion.aside>
  );
}
