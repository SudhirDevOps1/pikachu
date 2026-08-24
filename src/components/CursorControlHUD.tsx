import { useState } from "react";
import { MousePointer2, Mouse, Move, Copy, Crosshair, ScanSearch, Hand, Monitor, Video, Square } from "lucide-react";
import { useStore } from "@/store/assistantStore";
import { useAssistantApi } from "@/hooks/AssistantContext";
import { GlassCard } from "./GlassCard";
import { GlowButton } from "./GlowButton";
import { generateId, nowIso } from "@/lib/utils";

export function CursorControlHUD() {
  const { sendRaw } = useAssistantApi();
  const isConnected = useStore((s) => s.isConnected);
  const [x, setX] = useState(960);
  const [y, setY] = useState(540);
  const [x2, setX2] = useState(1200);
  const [y2, setY2] = useState(600);
  const [mon, setMon] = useState(0);
  const [recOn, setRecOn] = useState(false);
  const [log, setLog] = useState<string>("");

  const send = (action: string, params: Record<string, unknown>, category="uia") => {
    if (!isConnected) {
      useStore.getState().addToast({ type: "info", message: "Bridge offline — demo only" });
      setLog(`(offline) ${category}/${action} ${JSON.stringify(params)}`);
      return;
    }
    sendRaw({ type: "command", category, action, params, id: generateId(), timestamp: nowIso() });
    setLog(`${category}/${action} → ${JSON.stringify(params)}`);
    useStore.getState().addToast({ type: "success", message: `${action} भेजा 🖱️` });
  };
  const sendScreen = (action: string, params: Record<string, unknown>={}) => send(action, params, "screen");

  const onPick = () => send("get_position", {});
  const onImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const b64 = String(r.result || "");
      send("find_image", { image_b64: b64, click: true, threshold: 0.8 });
    };
    r.readAsDataURL(f);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <GlassCard className="p-3 flex flex-wrap items-center gap-2">
        <MousePointer2 size={16} style={{ color: "var(--accent)" }} />
        <span className="text-sm font-semibold text-white">Cursor Control</span>
        <span className={`ml-2 h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-red-400"}`} />
        <span className="text-xs text-white/40">{isConnected ? "Bridge" : "Offline"} • Bézier • DPI • Multi-mon</span>
        <div className="ml-auto flex items-center gap-1">
          <span className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs text-white/60"><Monitor size={12} /> Mon <select value={mon} onChange={(e)=>setMon(+e.target.value)} className="bg-transparent text-white outline-none"><option value={0} className="bg-black">0 primary</option><option value={1} className="bg-black">1</option><option value={2} className="bg-black">2</option></select></span>
          <button onClick={onPick} className="rounded-lg bg-white/5 px-2 py-1 text-xs text-white/60 hover:text-white flex items-center gap-1"><Crosshair size={12} /> Pos</button>
          <button onClick={()=>send("get_monitors",{})} className="rounded-lg bg-white/5 px-2 py-1 text-xs text-white/60 hover:text-white">Scan</button>
        </div>
      </GlassCard>

      <div className="grid gap-4 md:grid-cols-2">
        <GlassCard className="p-4 space-y-3">
          <div className="text-xs font-semibold text-white/70 flex items-center gap-2"><Move size={14} /> Move / Click</div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-white/50">X <input type="number" value={x} onChange={(e)=>setX(+e.target.value)} className="mt-1 w-full rounded-lg bg-white/5 px-2 py-1.5 text-white outline-none" /></label>
            <label className="text-xs text-white/50">Y <input type="number" value={y} onChange={(e)=>setY(+e.target.value)} className="mt-1 w-full rounded-lg bg-white/5 px-2 py-1.5 text-white outline-none" /></label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <GlowButton onClick={()=>send("move",{x,y,monitor:mon})}><Move size={12} /> Move</GlowButton>
            <GlowButton variant="primary" onClick={()=>send("click",{x,y,monitor:mon})}><Mouse size={12} /> Click</GlowButton>
            <GlowButton onClick={()=>send("right_click",{x,y,monitor:mon})}><Hand size={12} /> Right</GlowButton>
            <GlowButton onClick={()=>send("double_click",{x,y,monitor:mon})}><Copy size={12} /> Double</GlowButton>
            <GlowButton onClick={()=>send("drag",{x,y,x2,y2,monitor:mon})}><MousePointer2 size={12} /> Drag</GlowButton>
            <GlowButton onClick={()=>send("scroll",{direction:"down",amount:3})}><Move size={12} /> Scroll</GlowButton>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-white/50">X2 <input type="number" value={x2} onChange={(e)=>setX2(+e.target.value)} className="mt-1 w-full rounded-lg bg-white/5 px-2 py-1.5 text-white outline-none" /></label>
            <label className="text-xs text-white/50">Y2 <input type="number" value={y2} onChange={(e)=>setY2(+e.target.value)} className="mt-1 w-full rounded-lg bg-white/5 px-2 py-1.5 text-white outline-none" /></label>
          </div>
        </GlassCard>

        <GlassCard className="p-4 space-y-3">
          <div className="text-xs font-semibold text-white/70 flex items-center gap-2"><ScanSearch size={14} /> Vision → Click</div>
          <p className="text-xs text-white/40">Image upload karo (button screenshot) → OpenCV `find_image` → auto click. Bina template ke OCR se bhi: screenshot lo → `find_image` threshold 0.8.</p>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/5 py-3 text-xs text-white/60 hover:bg-white/10">
            <ScanSearch size={14} /> Template PNG chunao (click auto)
            <input type="file" accept="image/*" onChange={onImagePick} className="hidden" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <GlowButton onClick={()=>send("find_image",{image_b64:"", threshold:0.8})}><ScanSearch size={12} /> Find (no img = error demo)</GlowButton>
            <GlowButton onClick={()=>send("type",{text:"Hello पिका — ghost type via clipboard"})}><Copy size={12} /> Type text</GlowButton>
          </div>
          <p className="text-[11px] text-white/25">Voice: “play button pe click karo” → OCR `find_text`, “is button pe click karo” → `find_image` template. “right/double click”, “drag 100,100 se 500,500”.</p>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
            <GlowButton variant={recOn?"danger":"default"} onClick={()=>{ if(!recOn){ sendScreen("start_recording",{monitor:mon,fps:15}); setRecOn(true);} else { sendScreen("stop_recording",{}); setRecOn(false);} }}>{recOn?<Square size={12} />:<Video size={12} />}{recOn?" Stop Rec":" Start Rec"}</GlowButton>
            <GlowButton onClick={()=>sendScreen("recording_status",{})}><Video size={12} /> Status</GlowButton>
          </div>
          <p className="text-[11px] text-white/25">Rec → <code className="bg-white/10 px-1 rounded">~/Videos/Pika_Recordings/rec_*.mp4</code> 15fps mp4v.</p>
        </GlassCard>
      </div>

      {log && <GlassCard className="p-3 font-mono text-xs text-white/60 whitespace-pre-wrap">{log}</GlassCard>}
    </div>
  );
}
