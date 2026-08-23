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
} from "lucide-react";
import { motion } from "framer-motion";
import { useStore } from "@/store/assistantStore";
import { cn } from "@/utils/cn";
import type { TabName } from "@/types";
import { sounds } from "@/lib/soundEffects";

const NAV: { id: TabName; label: string; icon: typeof MessageSquare }[] = [
  { id: "chat", label: "चैट", icon: MessageSquare },
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

  return (
    <motion.aside
      animate={{ width: expanded ? 232 : 68 }}
      className="glass-card z-20 flex shrink-0 flex-col border-y-0 border-l-0 py-4"
    >
      {/* Logo */}
      <div className="mb-6 flex items-center gap-3 px-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 shadow-lg shadow-violet-500/30">
          <Zap className="text-white" size={20} fill="white" />
        </div>
        {expanded && (
          <div className="overflow-hidden">
            <div className="text-lg font-bold leading-none text-white">पिका</div>
            <div className="text-[10px] text-white/40">AI असिस्टेंट</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                sounds.click();
                setActiveTab(item.id);
              }}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                active ? "text-white" : "text-white/55 hover:bg-white/5 hover:text-white/90 hover:shadow-[0_0_12px_rgba(var(--accent-rgb),0.15)]"
              )}
            >
              {active && (
                <motion.div
                  layoutId="active-nav"
                  className="absolute inset-0 rounded-xl bg-[var(--accent)]/25 shadow-[0_0_18px_rgba(var(--accent-rgb),0.35)]"
                />
              )}
              <Icon size={20} className="relative z-10 shrink-0" />
              {expanded && <span className="relative z-10 font-medium">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="mx-3 mt-2 flex items-center justify-center rounded-xl py-2 text-white/40 hover:bg-white/5 hover:text-white"
      >
        <ChevronLeft className={cn("transition-transform", !expanded && "rotate-180")} size={18} />
      </button>
    </motion.aside>
  );
}
