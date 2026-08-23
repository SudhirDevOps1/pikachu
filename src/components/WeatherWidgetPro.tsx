import { useState } from "react";
import { Cloud, Droplets, Wind, Eye, MapPin, RefreshCw } from "lucide-react";
import { HudCard } from "./HudCard";
import { useWeather } from "@/hooks/useWeather";
import { weatherInfo } from "@/lib/utils";
import { sounds } from "@/lib/soundEffects";

function fmtDay(d: string, i: number) {
  if (i === 0) return "आज";
  const date = new Date(d);
  return date.toLocaleDateString("hi-IN", { weekday: "short" });
}

// Full-featured weather widget used by the Futurist dashboard: current
// conditions grid + 5-day forecast + optional city override input.
export function WeatherWidgetPro() {
  const { data, loading, error, refresh } = useWeather();
  const [city, setCity] = useState("");
  const info = data ? weatherInfo(data.code) : null;

  const searchCity = async () => {
    if (!city.trim()) return;
    // Uses Open-Meteo geocoding (free, no key)
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=hi`
      );
      const j = await res.json();
      if (j.results?.[0]) {
        const { latitude, longitude } = j.results[0];
        // trigger weather refresh at this coord via a custom event; simplest: reload page? No — just refetch by reloading location.
        // Simplest path: use window fetch and update via manual DOM would be complex; instead, refresh() uses current coords.
        // Here we invoke a synthetic geolocation via storing in sessionStorage and letting the hook re-read.
        sessionStorage.setItem("pika_manual_coords", JSON.stringify({ latitude, longitude, name: j.results[0].name }));
        window.location.reload();
      }
    } catch {
      // ignore
    }
  };

  return (
    <HudCard
      title="मौसम अपडेट"
      icon={Cloud}
      dotColor="#06b6d4"
      right={
        <div className="flex items-center gap-1">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchCity()}
            placeholder={data?.place || "Delhi"}
            className="w-20 rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] text-white outline-none placeholder-white/30"
          />
          <button
            onClick={() => {
              sounds.click();
              refresh();
            }}
            className="text-white/30 hover:text-white"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      }
    >
      {loading && !data ? (
        <div className="py-6 text-center text-xs text-white/30">मौसम लोड हो रहा है...</div>
      ) : error && !data ? (
        <div className="py-6 text-center text-xs text-red-300/70">{error}</div>
      ) : data && info ? (
        <div>
          <div className="mb-3 flex items-center gap-4">
            <span className="text-5xl">{info.emoji}</span>
            <div className="flex-1">
              <div className="font-mono text-4xl font-bold text-white">{Math.round(data.tempC)}°C</div>
              <div className="flex items-center gap-1 text-xs text-white/50">
                <MapPin size={11} /> {data.place}
              </div>
              <div className="mt-0.5 text-[10px] text-white/30">
                अपडेट: {new Date(data.updatedAt).toLocaleTimeString("hi-IN")}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-white/40">महसूस</div>
              <div className="font-mono text-lg font-semibold text-white">{Math.round(data.feelsLike)}°</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <MiniInfo icon={Droplets} label="नमी" value={`${data.humidity}%`} color="#06b6d4" />
            <MiniInfo icon={Wind} label="हवा" value={`${Math.round(data.windKmh)} km/h`} color="var(--accent)" />
            <MiniInfo icon={Eye} label="दृश्य" value="10 km" color="#22c55e" />
          </div>

          {data.daily.length > 0 && (
            <div className="mt-3 border-t border-white/5 pt-2">
              <div className="mb-1.5 text-[9px] uppercase tracking-wider text-white/40">5-दिन का पूर्वानुमान</div>
              <div className="flex items-start justify-around">
                {[
                  { date: new Date().toISOString(), maxTemp: data.tempC, minTemp: data.tempC - 3, code: data.code },
                  ...data.daily,
                ]
                  .slice(0, 5)
                  .map((d, i) => {
                    const di = weatherInfo(d.code);
                    return (
                      <div key={i} className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] text-white/50">{fmtDay(d.date, i)}</span>
                        <span className="text-lg">{di.emoji}</span>
                        <span className="font-mono text-xs font-semibold text-white">{Math.round(d.maxTemp)}°</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </HudCard>
  );
}

function MiniInfo({ icon: Icon, label, value, color }: { icon: typeof Cloud; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] p-2">
      <div className="mb-1 flex items-center gap-1">
        <Icon size={12} style={{ color }} />
        <span className="text-lg font-bold text-white">{value}</span>
      </div>
      <div className="text-[10px] text-white/40">{label}</div>
    </div>
  );
}
