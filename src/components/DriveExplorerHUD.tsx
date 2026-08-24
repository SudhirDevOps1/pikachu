import { useEffect, useState } from "react";
import { HardDrive, RefreshCw, FolderOpen, FileEdit } from "lucide-react";
import { HudCard } from "./HudCard";
import { useStore } from "@/store/assistantStore";
import { useAssistantApi } from "@/hooks/AssistantContext";
import { motion } from "framer-motion";

// Live storage / drive explorer. Reads real drive data pushed by the Python
// bridge into the store (see useAssistant response handler). Falls back to a

export function DriveExplorerHUD() {
  const drives = useStore((s) => s.drives);
  const isConnected = useStore((s) => s.isConnected);
  const [loading, setLoading] = useState(false);
  const { sendRaw, processInput } = useAssistantApi();

  const refresh = () => {
    if (!isConnected) return;
    setLoading(true);
    sendRaw({
      type: "command",
      category: "disk",
      action: "list_drives",
      id: "drive-scan",
      params: {},
      timestamp: new Date().toISOString(),
    });
    window.setTimeout(() => setLoading(false), 1200);
  };

  useEffect(() => {
    if (!isConnected) return;
    refresh();
    const t = window.setInterval(refresh, 90000); // 90s silent poll — no chat spam
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  const displayDrives =
    isConnected && drives.length > 0
      ? drives
      : [
          { name: "C:\\", percent: 68, free: 120 * 2 ** 30, total: 512 * 2 ** 30 },
          { name: "D:\\", percent: 42, free: 580 * 2 ** 30, total: 1024 * 2 ** 30 },
        ];

  return (
    <HudCard
      title="Storage Explorer"
      icon={HardDrive}
      dotColor="var(--accent)"
      right={
        <button onClick={refresh} className="text-white/30 hover:text-white">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      }
    >
      <div className="space-y-3">
        {displayDrives.map((d, i) => (
          <div key={i} className="rounded-xl bg-white/[0.04] p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-bold text-white/90">{d.name} Drive</span>
              <span className="font-mono text-cyan-400">{d.percent}% Used</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, var(--accent), var(--secondary-accent))` }}
                initial={{ width: 0 }}
                animate={{ width: `${d.percent}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-white/40">
              <span>{Math.round(d.free / 2 ** 30)} GB Free</span>
              <span>Total {Math.round(d.total / 2 ** 30)} GB</span>
            </div>
          </div>
        ))}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            onClick={() => processInput("open file explorer")}
            className="flex items-center justify-center gap-2 rounded-lg bg-white/5 py-2 text-[10px] font-bold uppercase text-white/60 hover:bg-white/10"
          >
            <FolderOpen size={12} /> Open Explorer
          </button>
          <button
            onClick={() => processInput("list downloads")}
            className="flex items-center justify-center gap-2 rounded-lg bg-white/5 py-2 text-[10px] font-bold uppercase text-white/60 hover:bg-white/10"
          >
            <FileEdit size={12} /> Recent Files
          </button>
        </div>
      </div>
    </HudCard>
  );
}
