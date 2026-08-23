import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================================
// useWeather — real-time weather via the free, key-less Open-Meteo API.
// Uses the browser's geolocation when granted, falls back to Delhi.
// City name resolved via BigDataCloud's free reverse-geocoding endpoint.
// ============================================================================

export interface DailyForecast {
  date: string;
  maxTemp: number;
  minTemp: number;
  code: number;
}

export interface WeatherData {
  tempC: number;
  feelsLike: number;
  humidity: number;
  windKmh: number;
  code: number;
  place: string;
  updatedAt: number;
  daily: DailyForecast[];
}

const FALLBACK = { lat: 28.6139, lon: 77.209, name: "नई दिल्ली" };

export function useWeather() {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const coords = useRef<{ lat: number; lon: number }>({ lat: FALLBACK.lat, lon: FALLBACK.lon });

  const load = useCallback(async (lat: number, lon: number) => {
    setLoading(true);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("weather fetch failed");
      const j = await res.json();

      let place = FALLBACK.name;
      try {
        const geoRes = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=hi`
        );
        if (geoRes.ok) {
          const g = await geoRes.json();
          place = g.city || g.locality || g.principalSubdivision || place;
        }
      } catch {
        /* reverse geocoding is best-effort only */
      }

      const daily: DailyForecast[] = (j.daily?.time || []).slice(1, 4).map((t: string, i: number) => ({
        date: t,
        maxTemp: j.daily.temperature_2m_max[i + 1],
        minTemp: j.daily.temperature_2m_min[i + 1],
        code: j.daily.weather_code[i + 1],
      }));

      setData({
        tempC: j.current.temperature_2m,
        feelsLike: j.current.apparent_temperature,
        humidity: j.current.relative_humidity_2m,
        windKmh: j.current.wind_speed_10m,
        code: j.current.weather_code,
        place,
        updatedAt: Date.now(),
        daily,
      });
      setError(null);
    } catch {
      setError("मौसम लोड नहीं हो सका — कनेक्शन जांचें");
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    load(coords.current.lat, coords.current.lon);
  }, [load]);

  useEffect(() => {
    const useFallback = () => {
      coords.current = { lat: FALLBACK.lat, lon: FALLBACK.lon };
      load(FALLBACK.lat, FALLBACK.lon);
    };
    // Honour a user-picked city stored in sessionStorage (see WeatherWidgetPro)
    const manual = sessionStorage.getItem("pika_manual_coords");
    if (manual) {
      try {
        const { latitude, longitude } = JSON.parse(manual);
        coords.current = { lat: latitude, lon: longitude };
        load(latitude, longitude);
        return;
      } catch { /* ignore */ }
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          coords.current = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          load(pos.coords.latitude, pos.coords.longitude);
        },
        () => useFallback(),
        { timeout: 6000 }
      );
    } else {
      useFallback();
    }
    const t = window.setInterval(refresh, 5 * 60 * 1000); // refresh every 5 min
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, loading, error, refresh };
}
