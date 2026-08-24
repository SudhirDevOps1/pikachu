import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAssistant } from "@/hooks/useAssistant";
import { AssistantContext, useAssistantApi } from "@/hooks/AssistantContext";
import { VoiceContext } from "@/hooks/VoiceContext";
import { useVoice } from "@/hooks/useVoice";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useStore } from "@/store/assistantStore";
import { Settings } from "lucide-react";

import { AuroraBackground } from "@/components/AuroraBackground";
import { ParticleBackground } from "@/components/ParticleBackground";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { HUDView } from "@/components/HUDView";
import { ControlPanel } from "@/components/ControlPanel";
import { ToolsPanel } from "@/components/ToolsPanel";
import { MacroEngine } from "@/components/MacroEngine";
import { ReminderPanel } from "@/components/ReminderPanel";
import { ProcessManager } from "@/components/ProcessManager";
import { SchedulerPanel } from "@/components/SchedulerPanel";
import { SettingsPanel } from "@/components/SettingsPanel";
import { PiPWindow } from "@/components/PiPWindow";
import { ToastContainer } from "@/components/Toast";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { FuturisticDashboard } from "@/components/FuturisticDashboard";
import { LivePiP } from "@/components/LivePiP";
import { DesktopTitleBar } from "@/components/DesktopTitleBar";
import { NotesPanel } from "@/components/NotesPanel";
import { CommandPalette } from "@/components/CommandPalette";
import { ShortcutsHelp } from "@/components/ShortcutsHelp";
import OnboardingWizard from "@/components/OnboardingWizard";

export default function App() {
  const api = useAssistant();
  return (
    <AssistantContext.Provider value={api}>
      <AppShell />
    </AssistantContext.Provider>
  );
}

// Wrapped separately so it can consume AssistantContext (for the shared
// voice controller) right after the provider above is mounted.
function AppShell() {
  useAccentColor();
  const { processInput, sendRaw } = useAssistantApi();
  const voice = useVoice(processInput, sendRaw);
  const activeTab = useStore((s) => s.activeTab);
  const uiMode = useStore((s) => s.uiMode);
  const particles = useStore((s) => s.settings.particles);
  const pipMode = useStore((s) => s.settings.pipMode);
  const onboarded = useStore((s) => s.onboarded);
  const setOnboarded = useStore((s) => s.setOnboarded);

  // Global Ctrl+Space push-to-talk + F fullscreen + Esc exit
  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === "Space") {
        e.preventDefault();
        voice.toggle();
      }
      // F for fullscreen — realistic web, bina kuch hataye
      if ((e.key === "f" || e.key === "F") && !e.ctrlKey && !e.metaKey && (e.target as HTMLElement)?.tagName !== "INPUT" && (e.target as HTMLElement)?.tagName !== "TEXTAREA") {
        e.preventDefault();
        const el = document.documentElement;
        if (!document.fullscreenElement) el.requestFullscreen?.().catch(()=>{});
        else document.exitFullscreen?.().catch(()=>{});
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [voice]);

  const scrollTabs = new Set(["macros", "reminders", "processes", "scheduler", "settings", "notes"]);
  const scrollable = scrollTabs.has(activeTab);

  return (
    <VoiceContext.Provider value={voice}>
      <div className="relative flex h-screen flex-col overflow-hidden bg-navy-900">
        <AuroraBackground />
        {particles && <ParticleBackground />}

        {/* First-run onboarding wizard */}
        {!onboarded && <OnboardingWizard onComplete={() => setOnboarded(true)} />}

        {/* Electron-only custom title bar (browser mein null return karta hai) */}
        <div className="relative z-30">
          <DesktopTitleBar />
        </div>

        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {/* Both modes stay mounted — crossfade only, no unmount → no lag, no refresh, GPU accelerated */}
          <motion.div
            aria-hidden={uiMode !== "futurist"}
            initial={false}
            animate={{ opacity: uiMode === "futurist" ? 1 : 0, pointerEvents: uiMode === "futurist" ? "auto" : "none" } as any}
            transition={{ duration: 0.22, ease: "easeOut" as any }}
            className="absolute inset-0 flex flex-col overflow-hidden"
            style={{ willChange: "opacity", transform: "translateZ(0)" } as any}
          >
            <FuturisticDashboard />
          </motion.div>
          <motion.div
            aria-hidden={uiMode !== "standard"}
            initial={false}
            animate={{ opacity: uiMode === "standard" ? 1 : 0, pointerEvents: uiMode === "standard" ? "auto" : "none" } as any}
            transition={{ duration: 0.22, ease: "easeOut" as any }}
            className="absolute inset-0 flex"
            style={{ willChange: "opacity", transform: "translateZ(0)" } as any}
          >
              <Sidebar />
              {/* Floating single Setting button when sidebar hidden — draggable like PiP, never overlaps */}
              {!useStore((s)=>s.sidebarExpanded) && (
                <motion.button
                  drag
                  dragMomentum={false}
                  dragElastic={0.12}
                  dragTransition={{ bounceStiffness: 260, bounceDamping: 22 } as any}
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.08, rotate: 3 }}
                  whileTap={{ scale: 0.96 }}
                  whileDrag={{ scale: 1.12, zIndex: 50 } as any}
                  onClick={() => useStore.getState().toggleSidebar()}
                  onDoubleClick={() => {
                    const el = document.documentElement;
                    if (!document.fullscreenElement) el.requestFullscreen?.().catch(()=>{});
                    else document.exitFullscreen?.().catch(()=>{});
                  }}
                  className="fixed left-4 bottom-6 z-30 flex h-11 w-11 cursor-grab items-center justify-center rounded-2xl glass-strong border border-white/15 text-white shadow-[0_8px_28px_rgba(0,0,0,0.45)] active:cursor-grabbing hover:shadow-[0_0_22px_rgba(var(--accent-rgb),0.45)] backdrop-blur-xl"
                  style={{ boxShadow: `0 0 0 1px rgba(var(--accent-rgb),0.18), 0 8px 28px rgba(0,0,0,0.45)` }}
                  title="Settings — drag anywhere, click to show all, double-click fullscreen, F also"
                >
                  <Settings size={18} style={{ color: "var(--accent)" }} />
                  <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                </motion.button>
              )}
              <main className="relative flex flex-1 flex-col overflow-hidden">
                <div className="relative flex items-center">
                  <TopBar />
                </div>
                <div className={scrollable ? "flex-1 overflow-y-auto py-4" : "flex-1 overflow-hidden"}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18, ease: "easeOut" as any }}
                      className="h-full will-change-transform"
                      style={{ transform: "translateZ(0)" } as any}
                    >
                      {activeTab === "chat" && <HUDView />}
                      {activeTab === "notes" && <NotesPanel />}
                      {activeTab === "controls" && <ControlPanel />}
                      {activeTab === "tools" && <ToolsPanel />}
                      {activeTab === "macros" && <MacroEngine />}
                      {activeTab === "reminders" && <ReminderPanel />}
                      {activeTab === "processes" && <ProcessManager />}
                      {activeTab === "scheduler" && <SchedulerPanel />}
                      {activeTab === "settings" && <SettingsPanel />}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </main>
          </motion.div>
        </div>

        {pipMode && <PiPWindow />}
        <LivePiP />
        <CommandPalette />
        <ShortcutsHelp />
        <ToastContainer />
        <ConfirmationDialog />
      </div>
    </VoiceContext.Provider>
  );
}
