import { useEffect } from "react";
import { Timer, Play, Pause, RotateCcw, Coffee } from "lucide-react";
import { useStore } from "@/store/assistantStore";
import { GlassCard } from "./GlassCard";
import { GlowButton } from "./GlowButton";

function fmt(s:number){ const m=Math.floor(s/60).toString().padStart(2,"0"); const ss=(s%60).toString().padStart(2,"0"); return `${m}:${ss}`; }

export function PomodoroHUD({ compact=false }: { compact?: boolean }) {
  const p = useStore((s)=>s.pomodoro);
  const setPomodoro = useStore((s)=>s.setPomodoro);
  const tick = useStore((s)=>s.tickPomodoro);

  useEffect(()=>{
    if(p.status==="focus"||p.status==="break"){
      const id=setInterval(()=>tick(),1000);
      return ()=>clearInterval(id);
    }
  },[p.status, tick]);

  const total = (p.mode==="focus"? p.focusMin: p.breakMin)*60;
  const pct = 1 - p.remainingSec/total;

  const startFocus = ()=> setPomodoro({ status:"focus", mode:"focus", remainingSec: p.focusMin*60 });
  const startBreak = ()=> setPomodoro({ status:"break", mode:"break", remainingSec: p.breakMin*60 });
  const togglePause = ()=>{
    if(p.status==="focus"||p.status==="break") setPomodoro({ status:"paused" });
    else if(p.status==="paused") setPomodoro({ status: p.mode as any });
  };
  const reset = ()=> setPomodoro({ status:"idle", mode:"focus", remainingSec: p.focusMin*60 });

  if(compact){
    return (
      <div className="flex items-center gap-2 rounded-xl bg-black/25 border border-white/10 px-3 py-2">
        <Timer size={14} style={{ color:"var(--accent)" }} />
        <span className="font-mono text-xs text-white">{fmt(p.remainingSec)}</span>
        <span className="text-[10px] text-white/40">{p.mode==="focus"?"FOCUS":"BREAK"} • {p.completedSessions}✓</span>
        <button onClick={togglePause} className="ml-1 rounded-lg bg-white/10 p-1 text-white/70 hover:text-white">{p.status==="paused" ? <Play size={12} /> : <Pause size={12} />}</button>
      </div>
    );
  }

  return (
    <GlassCard className="p-4 overflow-hidden relative">
      <div className="absolute inset-0 opacity-20" style={{ background:`conic-gradient(from 0deg, var(--accent) ${pct*360}deg, transparent ${pct*360}deg)` }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-white"><Timer size={16} style={{ color:"var(--accent)" }} /> Pomodoro</span>
          <span className="text-xs text-white/50">{p.mode==="focus"?"🍅 फोकस":"☕ ब्रेक"} • {p.completedSessions} सेशन</span>
        </div>
        <div className="text-center">
          <div className="font-mono text-4xl font-bold tracking-widest" style={{ color: p.mode==="focus" ? "var(--accent)" : "#22c55e" }}>{fmt(p.remainingSec)}</div>
          <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width:`${pct*100}%`, background: p.mode==="focus" ? "var(--accent)" : "#22c55e" }} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          <GlowButton variant="primary" onClick={startFocus}><Play size={14} /> फोकस</GlowButton>
          <GlowButton onClick={startBreak}><Coffee size={14} /> ब्रेक</GlowButton>
          <GlowButton onClick={togglePause}>{p.status==="paused" ? <Play size={14} /> : <Pause size={14} />}{p.status==="paused"?"Resume":"Pause"}</GlowButton>
          <GlowButton onClick={reset}><RotateCcw size={14} /> Reset</GlowButton>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-white/40">
          <label>Focus <input type="number" min={5} max={60} value={p.focusMin} onChange={(e)=>setPomodoro({ focusMin: Math.max(5, Math.min(60, +e.target.value)), remainingSec: p.status==="idle" ? Math.max(5, Math.min(60, +e.target.value))*60 : p.remainingSec })} className="ml-1 w-12 rounded bg-white/10 px-1 py-0.5 text-white outline-none" />m</label>
          <label>Break <input type="number" min={1} max={30} value={p.breakMin} onChange={(e)=>setPomodoro({ breakMin: Math.max(1, Math.min(30, +e.target.value)) })} className="ml-1 w-10 rounded bg-white/10 px-1 py-0.5 text-white outline-none" />m</label>
        </div>
      </div>
    </GlassCard>
  );
}
