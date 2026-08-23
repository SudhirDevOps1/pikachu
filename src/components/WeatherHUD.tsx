import { CloudSun, RefreshCw, Droplets, Wind, MapPin, Calendar } from "lucide-react";
import { HudCard } from "./HudCard";
import { useWeather } from "@/hooks/useWeather";
import { weatherInfo } from "@/lib/utils";
import { sounds } from "@/lib/soundEffects";

function fmtDate(d: string) {
  const date = new Date(d);
  return date.toLocaleDateString("hi-IN", { weekday: "short" });
}

export function WeatherHUD() {
  const { data, loading, error, refresh } = useWeather();
  const info = data ? weatherInfo(data.code) : null;

  return (
    <HudCard
      title="Live Weather"
      icon={CloudSun}
      dotColor="#06b6d4"
      right={
        <button
          onClick={() => {
            sounds.click();
            refresh();
          }}
          className="text-white/30 hover:text-white"
          title="रीफ्रेश करें"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      }
    >
      {loading && !data ? (
        <div className="py-4 text-center text-xs text-white/30">मौसम लोड हो रहा है...</div>
      ) : error && !data ? (
        <div className="py-4 text-center text-xs text-red-300/70">{error}</div>
      ) : data && info ? (
        <div>
          <div className="mb-2 flex items-center gap-1 text-[10px] text-white/40">
            <MapPin size={10} /> {data.place}
            <span className="ml-auto flex items-center gap-1 text-cyan-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" /> LIVE
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-4xl leading-none">{info.emoji}</span>
            <div>
              <div className="font-mono text-2xl font-semibold text-white">{Math.round(data.tempC)}°C</div>
              <div className="text-[11px] text-white/45">{info.label}</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-white/[0.04] px-2 py-1.5">
              <div className="text-xs font-medium text-white">{Math.round(data.feelsLike)}°</div>
              <div className="text-[9px] text-white/35">महसूस</div>
            </div>
            <div className="rounded-lg bg-white/[0.04] px-2 py-1.5">
              <div className="flex items-center justify-center gap-1 text-xs font-medium text-white">
                <Droplets size={10} className="text-cyan-300" /> {data.humidity}%
              </div>
              <div className="text-[9px] text-white/35">नमी</div>
            </div>
            <div className="rounded-lg bg-white/[0.04] px-2 py-1.5">
              <div className="flex items-center justify-center gap-1 text-xs font-medium text-white">
                <Wind size={10} className="text-white/50" /> {Math.round(data.windKmh)}
              </div>
              <div className="text-[9px] text-white/35">km/h</div>
            </div>
          </div>

          {/* Mini forecast */}
          {data.daily.length > 0 && (
            <div className="mt-3 border-t border-white/5 pt-2">
              <div className="mb-1.5 flex items-center gap-1 text-[9px] uppercase tracking-wider text-white/30">
                <Calendar size={9} /> 3-Day Forecast
              </div>
              <div className="flex justify-around">
                {data.daily.map((d, i) => {
                  const di = weatherInfo(d.code);
                  return (
                    <div key={i} className="flex flex-col items-center gap-0.5">
                      <span className="text-[9px] text-white/40">{fmtDate(d.date)}</span>
                      <span className="text-sm">{di.emoji}</span>
                      <span className="font-mono text-[10px] text-white/70">
                        {Math.round(d.maxTemp)}° <span className="text-white/30">{Math.round(d.minTemp)}°</span>
                      </span>
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
