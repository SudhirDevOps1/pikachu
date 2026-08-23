import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAssistant } from "@/hooks/useAssistant";
import { AssistantContext, useAssistantApi } from "@/hooks/AssistantContext";
import { VoiceContext } from "@/hooks/VoiceContext";
import { useVoice } from "@/hooks/useVoice";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useStore } from "@/store/assistantStore";

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

  // Global Ctrl+Space push-to-talk shortcut, works from any tab.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === "Space") {
        e.preventDefault();
        voice.toggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [voice]);

  const scrollTabs = new Set(["macros", "reminders", "processes", "scheduler", "settings"]);
  const scrollable = scrollTabs.has(activeTab);

  return (
    <VoiceContext.Provider value={voice}>
      <div className="relative flex h-screen flex-col overflow-hidden bg-navy-900">
        <AuroraBackground />
        {particles && <ParticleBackground />}

        {/* Electron-only custom title bar (browser mein null return karta hai) */}
        <div className="relative z-30">
          <DesktopTitleBar />
        </div>

        <div className="relative flex min-h-0 flex-1">

        <AnimatePresence mode="wait">
          {uiMode === "futurist" ? (
            <motion.main
              key="futurist"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.4 }}
              className="relative z-10 flex flex-1 flex-col overflow-hidden"
            >
              <FuturisticDashboard />
            </motion.main>
          ) : (
            <motion.div
              key="standard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="relative z-10 flex flex-1"
            >
              <Sidebar />
              <main className="relative flex flex-1 flex-col overflow-hidden">
                <TopBar />
                <div className={scrollable ? "flex-1 overflow-y-auto py-4" : "flex-1 overflow-hidden"}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="h-full"
                    >
                      {activeTab === "chat" && <HUDView />}
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
          )}
        </AnimatePresence>

        </div>

        {pipMode && <PiPWindow />}
        <LivePiP />
        <ToastContainer />
        <ConfirmationDialog />
      </div>
    </VoiceContext.Provider>
  );
}
