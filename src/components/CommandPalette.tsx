import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MessageSquare, Gamepad2, Wrench, Repeat, Bell, Activity, Calendar, Settings, StickyNote, Timer, Mic, Trash2, Sparkles } from "lucide-react";
import { useStore } from "@/store/assistantStore";
import { useAssistantApi } from "@/hooks/AssistantContext";

type Cmd = { id: string; label: string; desc: string; icon: any; action: () => void; keywords: string };

export function CommandPalette() {
  const open = useStore((s) => s.commandPaletteOpen);
  const setOpen = useStore((s) => s.setCommandPaletteOpen);
  const setTab = useStore((s) => s.setActiveTab);
  const { processInput } = useAssistantApi();
  const [q, setQ] = useState("");

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useStore.getState().commandPaletteOpen);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, setOpen]);

  useEffect(() => { if (open) setQ(""); }, [open]);

  const cmds: Cmd[] = useMemo(() => [
    { id:"chat", label:"चैट खोलो", desc:"AI से बात करो", icon: MessageSquare, action:()=>{ setTab("chat"); setOpen(false); }, keywords:"chat बात ai" },
    { id:"notes", label:"नोट्स", desc:"Quick memo hub", icon: StickyNote, action:()=>{ setTab("notes"); setOpen(false); }, keywords:"notes memo note yaad" },
    { id:"controls", label:"कंट्रोल", desc:"System / Apps / Media", icon: Gamepad2, action:()=>{ setTab("controls"); setOpen(false); }, keywords:"control system app" },
    { id:"tools", label:"टूल्स", desc:"Calculator, QR, Password, OCR", icon: Wrench, action:()=>{ setTab("tools"); setOpen(false); }, keywords:"tools calc qr" },
    { id:"macros", label:"मैक्रो", desc:"Automation chains", icon: Repeat, action:()=>{ setTab("macros"); setOpen(false); }, keywords:"macro auto" },
    { id:"reminders", label:"रिमाइंडर", desc:"Reminders", icon: Bell, action:()=>{ setTab("reminders"); setOpen(false); }, keywords:"reminder yaad" },
    { id:"processes", label:"प्रोसेस", desc:"Task manager", icon: Activity, action:()=>{ setTab("processes"); setOpen(false); }, keywords:"process task" },
    { id:"scheduler", label:"शेड्यूलर", desc:"Cron jobs", icon: Calendar, action:()=>{ setTab("scheduler"); setOpen(false); }, keywords:"schedule cron" },
    { id:"settings", label:"सेटिंग्स", desc:"Providers, voice, appearance", icon: Settings, action:()=>{ setTab("settings"); setOpen(false); }, keywords:"settings provider voice" },
    { id:"focus", label:"फोकस शुरू (Pomodoro 25m)", desc:"Futurist HUD timer", icon: Timer, action:()=>{ useStore.getState().setPomodoro({ status:"focus", mode:"focus", remainingSec: useStore.getState().pomodoro.focusMin*60 }); setOpen(false); useStore.getState().addToast({ type:"success", message:"फोकस शुरू! 🍅" }); }, keywords:"pomodoro focus timer" },
    { id:"clear", label:"चैट साफ़ करो", desc:"Clear messages", icon: Trash2, action:()=>{ useStore.getState().clearMessages(); setOpen(false); }, keywords:"clear chat saaf" },
    { id:"listen", label:"सुनो (voice toggle)", desc:"Ctrl+Space", icon: Mic, action:()=>{ setOpen(false); window.dispatchEvent(new KeyboardEvent("keydown",{ key:" ", code:"Space", ctrlKey:true })); }, keywords:"voice suno mic" },
    { id:"calc", label:"कैलकुलेटर खोलो", desc:"Tools → Calculator", icon: Wrench, action:()=>{ setTab("tools"); useStore.getState().setToolsSubTab("calculator"); setOpen(false); }, keywords:"calc calculator" },
    { id:"screenshot", label:"स्क्रीनशॉट लो", desc:"PC Bridge command", icon: Sparkles, action:()=>{ processInput("screenshot"); setOpen(false); }, keywords:"screenshot screen" },
    { id:"volume", label:"Volume 50%", desc:"Set volume", icon: Gamepad2, action:()=>{ processInput("volume 50"); setOpen(false); }, keywords:"volume aawaz" },
  ], [processInput, setOpen, setTab]);

  const filtered = useMemo(() => {
    if (!q.trim()) return cmds;
    const low = q.toLowerCase();
    return cmds.filter((c) => (c.label + c.desc + c.keywords).toLowerCase().includes(low));
  }, [q, cmds]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 backdrop-blur-sm pt-[18vh] p-4" onClick={()=>setOpen(false)}>
          <motion.div initial={{ y:12, scale:0.98, opacity:0 }} animate={{ y:0, scale:1, opacity:1 }} exit={{ y:8, scale:0.98, opacity:0 }} transition={{ type:"spring", stiffness:340, damping:28 }} onClick={(e)=>e.stopPropagation()} className="w-full max-w-[560px] rounded-2xl glass-strong border border-white/15 overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.6)]">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
              <Search size={18} className="text-white/40" />
              <input autoFocus value={q} onChange={(e)=>setQ(e.target.value)} placeholder="कमांड खोजो…  (जैसे: notes, screenshot, volume)" className="flex-1 bg-transparent text-white outline-none placeholder-white/30 text-sm" />
              <span className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[10px] text-white/60">ESC</span>
            </div>
            <div className="max-h-[42vh] overflow-y-auto py-2">
              {filtered.length===0 ? <div className="px-4 py-10 text-center text-sm text-white/40">कुछ नहीं मिला — दूसरा शब्द ट्राय करो</div> : filtered.map((c)=>(
                <button key={c.id} onClick={c.action} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/20"><c.icon size={16} /></span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-white">{c.label}</span>
                    <span className="block text-xs text-white/45">{c.desc}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-white/10 bg-white/[0.02] px-4 py-2 text-[11px] text-white/30">
              <span><b className="text-white/60">Ctrl+K</b> खोलो / बंद करो</span>
              <span><b className="text-white/60">↑↓</b> + Enter</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
