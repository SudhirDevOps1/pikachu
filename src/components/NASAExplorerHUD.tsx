import { useEffect, useState } from "react";
import { Image, ExternalLink, RefreshCw } from "lucide-react";
import { HudCard } from "./HudCard";

export function NASAExplorerHUD() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchNASA = async () => {
    setLoading(true);
    try {
      const r = await fetch(`https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY`);
      setData(await r.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchNASA(); }, []);

  return (
    <HudCard 
      title="Galaxy Core Feed" 
      icon={Image} 
      dotColor="#3b82f6"
      right={<button onClick={fetchNASA} className="text-white/30 hover:text-white"><RefreshCw size={12} className={loading ? "animate-spin" : ""} /></button>}
    >
      {data ? (
        <div className="space-y-2">
            <div className="group relative aspect-video overflow-hidden rounded-xl border border-white/10">
                <img src={data.url} alt="NASA" className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex items-end">
                    <span className="text-[10px] text-white/70 line-clamp-1">{data.title}</span>
                </div>
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
