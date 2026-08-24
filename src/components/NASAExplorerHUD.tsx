import { useEffect, useState } from "react";
import { Image, ExternalLink, RefreshCw, Key } from "lucide-react";
import { HudCard } from "./HudCard";
import { useStore } from "@/store/assistantStore";

export function NASAExplorerHUD() {
  const nasaKey = useStore((s) => s.settings.nasaApiKey) || "DEMO_KEY";
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const fetchNASA = async () => {
    setLoading(true); setErr("");
    try {
      const r = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${nasaKey}`);
      const j = await r.json();
      if (j.code === 429 || j.msg?.includes("OVER_RATE_LIMIT")) { setErr("Demo key limit — Settings me apna NASA key dalo"); }
      else if (j.error) setErr(j.error.message || "NASA error");
      else setData(j);
    } catch { setErr("NASA connect fail — net check karo"); } finally { setLoading(false); }
  };

  useEffect(() => { fetchNASA(); }, [nasaKey]);

  return (
    <HudCard 
      title="Galaxy Core Feed" 
      icon={Image} 
      dotColor={nasaKey === "DEMO_KEY" ? "#eab308" : "#3b82f6"}
      right={<button onClick={fetchNASA} className="text-white/30 hover:text-white"><RefreshCw size={12} className={loading ? "animate-spin" : ""} /></button>}
    >
      {err ? (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-[11px] text-amber-200/80">
          <div className="flex items-start gap-1.5"><Key size={12} className="mt-0.5 shrink-0" />{err}</div>
          <div className="mt-1 text-[10px] text-white/40">Settings → Integrations → NASA API Key me apna key dalo (api.nasa.gov) — DEMO_KEY 30/hr limit.</div>
        </div>
      ) : data ? (
        <div className="space-y-2">
            <div className="group relative aspect-video overflow-hidden rounded-xl border border-white/10">
                <img src={data.url} alt="NASA" className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex items-end">
                    <span className="text-[10px] text-white/70 line-clamp-1">{data.title}</span>
                </div>
                {nasaKey === "DEMO_KEY" && <span className="absolute top-1.5 right-1.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-[8px] font-bold text-amber-300">DEMO</span>}
            </div>
            <a href={data.hdurl || data.url} target="_blank" className="flex items-center justify-between text-[9px] text-white/30 hover:text-cyan-400">
                <span>View Full Stream</span>
                <ExternalLink size={10} />
            </a>
        </div>
      ) : <div className="h-20 animate-pulse bg-white/5 rounded-xl" />}
    </HudCard>
  );
}
