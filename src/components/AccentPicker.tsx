import { useState, useRef, useEffect } from "react";
import { Palette, Check, Shuffle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store/assistantStore";

const PRESETS = [
  { n: "Neon", a: "#00f0ff", s: "#ff00ff" },
  { n: "Emerald", a: "#22c55e", s: "#06b6d4" },
  { n: "Vulcan", a: "#f97316", s: "#ef4444" },
  { n: "Matrix", a: "#00ff00", s: "#003300" },
  { n: "Royal", a: "#7c3aed", s: "#ec4899" },
];

export function AccentPicker() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const click = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", click);
    return () => document.removeEventListener("mousedown", click);
  }, []);

  const randomize = () => {
    const h = () => "#" + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    updateSettings({ accentColor: h(), secondaryAccentColor: h() });
  };

  return (
    <div ref={ref} className="relative">
      <button 
        onClick={() => setOpen(!open)}
        className="glass-card flex items-center gap-2 rounded-full px-3 py-1.5 transition hover:scale-105"
        style={{ border: `1px solid var(--accent)` }}
      >
        <Palette size={14} style={{ color: "var(--accent)" }} />
        <span className="text-xs font-bold text-white/80">Theme</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="glass-strong absolute right-0 top-12 z-[100] w-64 rounded-2xl p-4 shadow-2xl"
          >
             <div className="mb-4 flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-white/40">HUD Core Accents</span>
                <button onClick={randomize} className="text-white/40 hover:text-cyan-400"><Shuffle size={12} /></button>
             </div>

             <div className="grid grid-cols-5 gap-2 mb-4">
                {PRESETS.map(p => (
                    <button 
                        key={p.n} 
                        onClick={() => updateSettings({ accentColor: p.a, secondaryAccentColor: p.s })}
                        className="h-10 rounded-lg border border-white/10"
                        style={{ background: `linear-gradient(135deg, ${p.a}, ${p.s})` }}
                    >
                        {settings.accentColor === p.a && <Check size={14} className="mx-auto text-white" />}
                    </button>
                ))}
             </div>

             <div className="space-y-3">
                <ColorInput label="Primary" val={settings.accentColor} set={(v) => updateSettings({ accentColor: v })} />
                <ColorInput label="Secondary" val={settings.secondaryAccentColor} set={(v) => updateSettings({ secondaryAccentColor: v })} />
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ColorInput({ label, val, set }: { label: string, val: string, set: (v: string) => void }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] text-white/50">{label}</span>
            <div className="flex flex-1 items-center gap-2 rounded-lg bg-white/5 p-1.5 border border-white/5">
                <input type="color" value={val} onChange={(e) => set(e.target.value)} className="h-5 w-5 cursor-pointer bg-transparent" />
                <input value={val} onChange={(e) => set(e.target.value)} className="flex-1 bg-transparent font-mono text-[10px] text-white outline-none" />
            </div>
        </div>
    )
}
