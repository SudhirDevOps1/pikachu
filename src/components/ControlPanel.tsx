import { useState } from "react";
import {
  Lock, Moon, RotateCcw, Power, LogOut, Snowflake,
  Play, SkipForward, SkipBack, Volume2, VolumeX, Volume1,
  Camera, Video, Sun, Palette,
  FileText, FolderPlus, Trash2, FolderOpen,
  ClipboardCopy, Clipboard, Eraser,
  Cpu, MemoryStick, HardDrive, BatteryCharging, Globe, Clock,
  Wifi, Gauge, Search,
  Music2, Pause, Square,

} from "lucide-react";
import { motion } from "framer-motion";
import { useStore } from "@/store/assistantStore";
import { useAssistantApi } from "@/hooks/AssistantContext";
import { GlassCard } from "./GlassCard";
import { GlowButton } from "./GlowButton";
import { APP_LIST, WEBSITE_LIST } from "@/lib/constants";
import type { ControlSubTab } from "@/types";
import { cn } from "@/utils/cn";

const SUBTABS: { id: ControlSubTab; label: string }[] = [
  { id: "system", label: "सिस्टम" },
  { id: "apps", label: "ऐप्स" },
  { id: "media", label: "मीडिया" },
  { id: "files", label: "फाइल्स" },
  { id: "clipboard", label: "क्लिपबोर्ड" },
  { id: "info", label: "जानकारी" },
  { id: "web", label: "वेब" },
  { id: "screen", label: "स्क्रीन" },
  { id: "network", label: "नेटवर्क" },
  { id: "music", label: "म्यूज़िक" },
];

export function ControlPanel() {
  const sub = useStore((s) => s.controlSubTab);
  const setSub = useStore((s) => s.setControlSubTab);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3 md:px-8">
        {SUBTABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-sm transition-all",
              sub === t.id ? "bg-[var(--accent)] text-white shadow-lg shadow-[0_0_16px_rgba(var(--accent-rgb),0.4)]" : "glass-card text-white/60 hover:text-white"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <motion.div
        key={sub}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 overflow-y-auto px-4 py-4 md:px-8"
      >
        {sub === "system" && <SystemControls />}
        {sub === "apps" && <AppLauncher />}
        {sub === "media" && <MediaControls />}
        {sub === "files" && <FileManager />}
        {sub === "clipboard" && <ClipboardManager />}
        {sub === "info" && <SystemInfo />}
        {sub === "web" && <WebLauncher />}
        {sub === "screen" && <ScreenTools />}
        {sub === "network" && <NetworkTools />}
        {sub === "music" && <MusicPlayer />}
      </motion.div>
    </div>
  );
}

function Grid({ children, cols = "md:grid-cols-3" }: { children: React.ReactNode; cols?: string }) {
  return <div className={cn("grid grid-cols-2 gap-3", cols)}>{children}</div>;
}

// ---------- System ----------
function SystemControls() {
  const { processInput } = useAssistantApi();
  const items = [
    { label: "लॉक", icon: Lock, cmd: "lock computer" },
    { label: "स्लीप", icon: Moon, cmd: "sleep" },
    { label: "रीस्टार्ट", icon: RotateCcw, cmd: "restart" },
    { label: "शटडाउन", icon: Power, cmd: "shutdown", danger: true },
    { label: "लॉग ऑफ", icon: LogOut, cmd: "logoff" },
    { label: "हाइबरनेट", icon: Snowflake, cmd: "hibernate" },
  ];
  return (
    <Grid>
      {items.map((it) => (
        <GlowButton key={it.label} variant={it.danger ? "danger" : "default"} onClick={() => processInput(it.cmd)} className="h-24 flex-col gap-2">
          <it.icon size={26} />
          {it.label}
        </GlowButton>
      ))}
    </Grid>
  );
}

// ---------- Apps ----------
function AppLauncher() {
  const { processInput } = useAssistantApi();
  return (
    <Grid cols="md:grid-cols-4">
      {APP_LIST.map((app) => (
        <GlowButton key={app.key} onClick={() => processInput(`open ${app.name}`)} className="h-24 flex-col gap-2">
          <span className="text-3xl">{app.icon}</span>
          <span className="text-xs">{app.name}</span>
        </GlowButton>
      ))}
    </Grid>
  );
}

// ---------- Media ----------
function MediaControls() {
  const { processInput } = useAssistantApi();
  const [vol, setVol] = useState(50);
  return (
    <div className="mx-auto max-w-md space-y-6">
      <GlassCard className="p-8">
        <div className="flex items-center justify-center gap-6">
          <GlowButton variant="ghost" onClick={() => processInput("previous song")} className="h-14 w-14 rounded-full">
            <SkipBack size={22} />
          </GlowButton>
          <button
            onClick={() => processInput("play music")}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-white shadow-[0_0_30px_rgba(124,58,237,0.5)] transition active:scale-90"
          >
            <Play size={30} fill="white" />
          </button>
          <GlowButton variant="ghost" onClick={() => processInput("next song")} className="h-14 w-14 rounded-full">
            <SkipForward size={22} />
          </GlowButton>
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <div className="mb-3 flex items-center justify-between text-sm text-white/70">
          <div className="flex items-center gap-2"><Volume1 size={18} /> आवाज़</div>
          <span>{vol}%</span>
        </div>
        <input
          type="range" min={0} max={100} value={vol}
          onChange={(e) => setVol(+e.target.value)}
          onMouseUp={() => processInput(`volume ${vol}`)}
          className="w-full accent-violet-500"
        />
        <div className="mt-4 flex gap-3">
          <GlowButton onClick={() => processInput("volume up")} className="flex-1"><Volume2 size={16} /> बढ़ाओ</GlowButton>
          <GlowButton onClick={() => processInput("volume down")} className="flex-1"><Volume1 size={16} /> कम</GlowButton>
          <GlowButton onClick={() => processInput("mute")} className="flex-1"><VolumeX size={16} /> म्यूट</GlowButton>
        </div>
      </GlassCard>
    </div>
  );
}

// ---------- Files ----------
function FileManager() {
  const { processInput } = useAssistantApi();
  const [name, setName] = useState("");
  return (
    <div className="space-y-4">
      <GlassCard className="p-4">
        <label className="mb-2 block text-xs text-white/50">फाइल / फोल्डर का नाम</label>
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="जैसे: notes.txt या Projects"
          className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-white outline-none placeholder-white/30"
        />
      </GlassCard>
      <Grid cols="md:grid-cols-4">
        <GlowButton onClick={() => name && processInput(`create file ${name}`)} className="h-20 flex-col gap-2"><FileText size={22} /> फाइल बनाओ</GlowButton>
        <GlowButton onClick={() => name && processInput(`create folder ${name}`)} className="h-20 flex-col gap-2"><FolderPlus size={22} /> फोल्डर बनाओ</GlowButton>
        <GlowButton variant="danger" onClick={() => name && processInput(`delete file ${name}`)} className="h-20 flex-col gap-2"><Trash2 size={22} /> डिलीट</GlowButton>
        <GlowButton onClick={() => processInput("open file explorer")} className="h-20 flex-col gap-2"><FolderOpen size={22} /> एक्सप्लोरर</GlowButton>
      </Grid>
    </div>
  );
}

// ---------- Clipboard ----------
function ClipboardManager() {
  const { processInput } = useAssistantApi();
  const history = useStore((s) => s.clipboardHistory);
  const addClipboard = useStore((s) => s.addClipboard);
  const [text, setText] = useState("");
  return (
    <div className="space-y-4">
      <GlassCard className="p-4">
        <div className="flex gap-2">
          <input
            value={text} onChange={(e) => setText(e.target.value)}
            placeholder="टेक्स्ट सेव करें..."
            className="flex-1 rounded-xl bg-white/5 px-4 py-2.5 text-white outline-none placeholder-white/30"
          />
          <GlowButton onClick={() => { if (text) { addClipboard(text); setText(""); processInput("save clipboard"); } }}><ClipboardCopy size={16} /> सेव</GlowButton>
          <GlowButton variant="danger" onClick={() => processInput("clear clipboard")}><Eraser size={16} /></GlowButton>
        </div>
      </GlassCard>
      <GlassCard className="max-h-80 overflow-y-auto p-2">
        {history.length === 0 ? (
          <p className="p-6 text-center text-sm text-white/40">कोई क्लिपबोर्ड हिस्ट्री नहीं</p>
        ) : (
          history.map((h) => (
            <button
              key={h.id}
              onClick={() => navigator.clipboard.writeText(h.content).catch(() => {})}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/5"
            >
              <Clipboard size={15} className="shrink-0 text-white/40" />
              <span className="flex-1 truncate text-sm text-white/80">{h.content}</span>
            </button>
          ))
        )}
      </GlassCard>
    </div>
  );
}

// ---------- Info ----------
function SystemInfo() {
  const { processInput } = useAssistantApi();
  const status = useStore((s) => s.systemStatus);
  const cards = [
    { label: "CPU उपयोग", icon: Cpu, value: `${Math.round(status?.cpu ?? 0)}%`, color: "#7c3aed", cmd: "cpu usage" },
    { label: "RAM उपयोग", icon: MemoryStick, value: `${Math.round(status?.ram ?? 0)}%`, color: "#06b6d4", cmd: "ram usage" },
    { label: "डिस्क", icon: HardDrive, value: "66%", color: "#ec4899", cmd: "disk space" },
    { label: "बैटरी", icon: BatteryCharging, value: `${status?.battery?.percent ?? 78}%`, color: "#22c55e", cmd: "battery dikhao" },
    { label: "IP एड्रेस", icon: Globe, value: "192.168.1.42", color: "#eab308", cmd: "ip address" },
    { label: "समय", icon: Clock, value: new Date().toLocaleTimeString("hi-IN", { hour: "2-digit", minute: "2-digit" }), color: "#38bdf8", cmd: "time" },
  ];
  return (
    <Grid>
      {cards.map((c) => (
        <button key={c.label} onClick={() => processInput(c.cmd)} className="text-left">
          <GlassCard className="p-5 hover:border-white/20">
            <div className="mb-3 flex items-center justify-between">
              <c.icon size={22} style={{ color: c.color }} />
            </div>
            <div className="text-2xl font-semibold text-white">{c.value}</div>
            <div className="mt-1 text-xs text-white/50">{c.label}</div>
          </GlassCard>
        </button>
      ))}
    </Grid>
  );
}

// ---------- Web ----------
function WebLauncher() {
  const { processInput } = useAssistantApi();
  const [q, setQ] = useState("");
  return (
    <div className="space-y-4">
      <GlassCard className="flex items-center gap-2 p-3">
        <Search size={18} className="text-white/40" />
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && q && (processInput(`search ${q}`), setQ(""))}
          placeholder="वेब पर सर्च करें..."
          className="flex-1 bg-transparent text-white outline-none placeholder-white/30"
        />
        <GlowButton onClick={() => q && (processInput(`search ${q}`), setQ(""))}>सर्च</GlowButton>
      </GlassCard>
      <Grid cols="md:grid-cols-4">
        {WEBSITE_LIST.map((w) => (
          <GlowButton key={w.name} onClick={() => processInput(`open ${w.name}`)} className="h-24 flex-col gap-2">
            <span className="text-3xl">{w.icon}</span>
            <span className="text-xs">{w.name}</span>
          </GlowButton>
        ))}
      </Grid>
    </div>
  );
}

// ---------- Screen ----------
function ScreenTools() {
  const { processInput } = useAssistantApi();
  const [bright, setBright] = useState(70);
  return (
    <div className="space-y-4">
      <Grid>
        <GlowButton onClick={() => processInput("screenshot")} className="h-24 flex-col gap-2"><Camera size={26} /> स्क्रीनशॉट</GlowButton>
        <GlowButton onClick={() => processInput("start recording")} className="h-24 flex-col gap-2"><Video size={26} /> रिकॉर्ड शुरू</GlowButton>
        <GlowButton variant="danger" onClick={() => processInput("stop recording")} className="h-24 flex-col gap-2"><Square size={26} /> रिकॉर्ड बंद</GlowButton>
      </Grid>
      <GlassCard className="p-5">
        <div className="mb-3 flex items-center justify-between text-sm text-white/70">
          <div className="flex items-center gap-2"><Sun size={18} /> ब्राइटनेस</div>
          <span>{bright}%</span>
        </div>
        <input type="range" min={0} max={100} value={bright} onChange={(e) => setBright(+e.target.value)} onMouseUp={() => processInput(`brightness ${bright}`)} className="w-full accent-violet-500" />
        <div className="mt-4 flex gap-3">
          <GlowButton onClick={() => processInput("color picker")} className="flex-1"><Palette size={16} /> कलर पिकर</GlowButton>
        </div>
      </GlassCard>
    </div>
  );
}

// ---------- Network ----------
function NetworkTools() {
  const { processInput } = useAssistantApi();
  return (
    <Grid>
      <GlowButton onClick={() => processInput("ip address")} className="h-24 flex-col gap-2"><Globe size={26} /> IP जानकारी</GlowButton>
      <GlowButton onClick={() => processInput("speed test")} className="h-24 flex-col gap-2"><Gauge size={26} /> स्पीड टेस्ट</GlowButton>
      <GlowButton onClick={() => processInput("list wifi")} className="h-24 flex-col gap-2"><Wifi size={26} /> WiFi नेटवर्क</GlowButton>
    </Grid>
  );
}

// ---------- Music ----------
function MusicPlayer() {
  const { processInput } = useAssistantApi();
  return (
    <div className="space-y-4">
      <GlassCard className="p-5">
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-pink-500">
            <Music2 className="text-white" size={26} />
          </div>
          <div>
            <div className="text-sm text-white/50">मीडिया कंट्रोल</div>
            <div className="font-medium text-white">PC Music</div>
          </div>
        </div>
        <div className="flex gap-2">
          <GlowButton onClick={() => processInput("play music")} className="flex-1"><Play size={16} /> प्ले</GlowButton>
          <GlowButton onClick={() => processInput("pause music")} className="flex-1"><Pause size={16} /> पॉज़</GlowButton>
        </div>
      </GlassCard>
    </div>
  );
}
