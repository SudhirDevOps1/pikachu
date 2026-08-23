import { useEffect, useState } from "react";
import { Minus, Square, X, PictureInPicture2, RefreshCw, Zap, Copy } from "lucide-react";
import { motion } from "framer-motion";
import { desktop, isDesktopApp, type AppInfo } from "@/lib/desktop";
import { useStore } from "@/store/assistantStore";
import { useVoiceApi } from "@/hooks/VoiceContext";

/**
 * Custom frameless title bar — sirf tab render hoti hai jab app Electron
 * desktop mode mein chal raha ho. Browser mein yeh component `null` return
 * kar deta hai, isliye web build bilkul waisa hi dikhta hai jaisa pehle tha.
 *
 * `-webkit-app-region: drag` wali CSS window ko draggable banati hai,
 * aur buttons par `no-drag` lagana padta hai warna click hi nahi hoga.
 */
export function DesktopTitleBar() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [bridgeRunning, setBridgeRunning] = useState(false);
  const [isMini, setIsMini] = useState(false);
  const addToast = useStore((s) => s.addToast);
  const { toggle } = useVoiceApi();

  useEffect(() => {
    if (!isDesktopApp()) return;
    desktop.appInfo().then(setInfo).catch(() => {});
    desktop.bridgeStatus().then((s) => setBridgeRunning(s.running)).catch(() => {});

    const offStatus = desktop.onBridgeStatus((d) => {
      setBridgeRunning(d.running);
      if (!d.running) addToast({ type: "warning", message: "PC Bridge रुक गया — restart करें" });
    });
    const offHotkey = desktop.onVoiceHotkey(() => toggle());
    const offMini = desktop.onMiniMode(setIsMini);

    return () => { offStatus(); offHotkey(); offMini(); };
  }, [addToast, toggle]);

  if (!isDesktopApp()) return null;

  return (
    <div
      className="flex h-9 shrink-0 select-none items-center justify-between border-b border-white/5 bg-black/30 px-3"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Left: logo + version */}
      <div className="flex items-center gap-2">
        <div
          className="flex h-5 w-5 items-center justify-center rounded"
          style={{ background: "linear-gradient(135deg, var(--accent), var(--secondary-accent))" }}
        >
          <Zap size={11} className="text-white" fill="white" />
        </div>
        <span className="text-[11px] font-bold tracking-wide text-white/80">PIKA AI</span>
        {info && <span className="font-mono text-[9px] text-white/25">v{info.version}</span>}
      </div>

      {/* Center: bridge status pill */}
      <div className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <div className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1">
          <motion.span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: bridgeRunning ? "#22c55e" : "#ef4444" }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          />
          <span className="text-[9px] font-semibold uppercase tracking-wider text-white/50">
            {bridgeRunning ? "BRIDGE LIVE" : "BRIDGE OFF"}
          </span>
          <button
            onClick={async () => {
              await desktop.restartBridge();
              addToast({ type: "info", message: "PC Bridge restart हो रहा है..." });
            }}
            title="Restart Python bridge"
            className="ml-1 text-white/30 hover:text-white"
          >
            <RefreshCw size={10} />
          </button>
        </div>
      </div>

      {/* Right: window controls */}
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <button
          onClick={() => desktop.toggleMiniMode()}
          title={isMini ? "सामान्य साइज़" : "Mini mode (always on top)"}
          className="flex h-6 w-7 items-center justify-center rounded text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <PictureInPicture2 size={13} />
        </button>
        <button
          onClick={() => navigator.clipboard.writeText("http://localhost:3000")}
          title="Copy local URL"
          className="flex h-6 w-7 items-center justify-center rounded text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <Copy size={12} />
        </button>
        <div className="mx-1 h-4 w-px bg-white/10" />
        <button onClick={() => desktop.minimize()} className="flex h-6 w-8 items-center justify-center rounded text-white/50 transition hover:bg-white/10 hover:text-white">
          <Minus size={13} />
        </button>
        <button onClick={() => desktop.maximize()} className="flex h-6 w-8 items-center justify-center rounded text-white/50 transition hover:bg-white/10 hover:text-white">
          <Square size={11} />
        </button>
        <button onClick={() => desktop.close()} className="flex h-6 w-8 items-center justify-center rounded text-white/50 transition hover:bg-red-500 hover:text-white">
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
