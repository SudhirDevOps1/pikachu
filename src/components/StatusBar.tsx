import { Wifi, WifiOff, BatteryCharging, Battery, Zap } from "lucide-react";
import { useStore } from "@/store/assistantStore";
import { PROVIDERS } from "@/lib/constants";
import { cn } from "@/utils/cn";

export function StatusBar() {
  const connected = useStore((s) => s.isConnected);
  const connStatus = useStore((s) => s.connectionStatus);
  const provider = useStore((s) => s.settings.aiProvider);
  const battery = useStore((s) => s.systemStatus?.battery);

  const providerName = PROVIDERS.find((p) => p.id === provider)?.name ?? provider;

  return (
    <div className="flex items-center gap-2">
      {/* Connection */}
      <div
        className={cn(
          "glass-card flex items-center gap-2 rounded-full px-3 py-1.5 text-xs",
          connected ? "text-green-300" : "text-white/50"
        )}
      >
        {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
        <span
          className={cn(
            "inline-block h-2 w-2 rounded-full",
            connected ? "bg-green-400" : connStatus === "connecting" ? "animate-pulse bg-amber-400" : "bg-red-400"
          )}
        />
        <span className="hidden sm:inline">
          {connected ? "कनेक्टेड" : "कनेक्ट हो रहा..."}
        </span>
      </div>

      {/* Provider */}
      <div className="glass-card flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-violet-300">
        <Zap size={12} fill="currentColor" />
        <span>{providerName}</span>
      </div>

      {/* Battery */}
      {battery && (
        <div className="glass-card hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-white/70 sm:flex">
          {battery.plugged ? <BatteryCharging size={14} className="text-green-400" /> : <Battery size={14} />}
          <span>{battery.percent}%</span>
        </div>
      )}
    </div>
  );
}
