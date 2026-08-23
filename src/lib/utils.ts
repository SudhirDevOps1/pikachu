// ============================================================================
// Pika AI Assistant — Utility helpers
// ============================================================================

export function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

const HINDI_DAYS = ["रविवार", "सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार"];
const HINDI_MONTHS = [
  "जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून",
  "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर",
];

export function formatHindiDate(d: Date): string {
  return `${HINDI_DAYS[d.getDay()]}, ${d.getDate()} ${HINDI_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatClock(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function formatTime(t: string): string {
  try {
    const d = new Date(t);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch {
    return "";
  }
}

// Safe math evaluator — whitelist-only (no eval on raw input)
export function safeCalc(expr: string): { ok: boolean; value: number | null; error?: string } {
  const cleaned = expr
    .toLowerCase()
    .replace(/plus|और|जमा/g, "+")
    .replace(/minus|माइनस|घटा/g, "-")
    .replace(/into|times|गुना/g, "*")
    .replace(/divided by|भाग/g, "/")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/pi|π/g, String(Math.PI))
    .replace(/\be\b/g, String(Math.E));

  // Only allow safe characters + known function names
  const withFns = cleaned.replace(/\b(sqrt|sin|cos|tan|log|abs|round|floor|ceil|pow)\b/g, (m) => `Math.${m}`);
  const stripped = withFns.replace(/Math\.(sqrt|sin|cos|tan|log|abs|round|floor|ceil|pow)/g, "");
  if (/[^0-9+\-*/(). %]/.test(stripped)) {
    return { ok: false, value: null, error: "अमान्य एक्सप्रेशन" };
  }
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(`"use strict"; return (${withFns});`);
    const result = fn();
    if (typeof result !== "number" || !isFinite(result)) {
      return { ok: false, value: null, error: "गणना नहीं हो सकी" };
    }
    if (Math.abs(result) > 1e15) {
      return { ok: false, value: null, error: "संख्या बहुत बड़ी है" };
    }
    return { ok: true, value: result };
  } catch {
    return { ok: false, value: null, error: "गणना नहीं हो सकी" };
  }
}

export function generatePassword(
  length: number,
  opts: { upper: boolean; lower: boolean; digits: boolean; symbols: boolean }
): string {
  const U = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const L = "abcdefghijklmnopqrstuvwxyz";
  const D = "0123456789";
  const S = "!@#$%^&*()-_=+[]{};:,.<>?";
  let pool = "";
  const guaranteed: string[] = [];
  const rand = (s: string) => s[Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * s.length)];
  if (opts.upper) { pool += U; guaranteed.push(rand(U)); }
  if (opts.lower) { pool += L; guaranteed.push(rand(L)); }
  if (opts.digits) { pool += D; guaranteed.push(rand(D)); }
  if (opts.symbols) { pool += S; guaranteed.push(rand(S)); }
  if (!pool) pool = L;
  const out: string[] = [...guaranteed];
  while (out.length < length) out.push(rand(pool));
  // shuffle
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, length).join("");
}

export function passwordStrength(pw: string): { label: string; score: number; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 16) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const map = [
    { label: "बहुत कमज़ोर", color: "#ef4444" },
    { label: "कमज़ोर", color: "#f97316" },
    { label: "ठीक-ठाक", color: "#eab308" },
    { label: "मज़बूत", color: "#22c55e" },
    { label: "बहुत मज़बूत", color: "#06b6d4" },
    { label: "बहुत मज़बूत", color: "#06b6d4" },
  ];
  return { ...map[score], score };
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

// Convert a #rrggbb hex color into an "r,g,b" string usable inside CSS
// custom properties (e.g. rgba(var(--accent-rgb), 0.4)).
export function hexToRgb(hex: string): string | null {
  const clean = hex.replace("#", "");
  const parts = clean.match(/.{1,2}/g);
  if (!parts || parts.length < 3) return null;
  const [r, g, b] = parts.map((p) => parseInt(p, 16));
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  return `${r},${g},${b}`;
}

// Map WMO weather codes (used by Open-Meteo) to an emoji + Hindi label.
export function weatherInfo(code: number): { emoji: string; label: string } {
  const map: Record<string, { emoji: string; label: string }> = {
    "0": { emoji: "☀️", label: "साफ़ आसमान" },
    "1": { emoji: "🌤️", label: "मुख्यतः साफ़" },
    "2": { emoji: "⛅", label: "आंशिक बादल" },
    "3": { emoji: "☁️", label: "बादल छाए हुए" },
    "45": { emoji: "🌫️", label: "कोहरा" },
    "48": { emoji: "🌫️", label: "घना कोहरा" },
    "51": { emoji: "🌦️", label: "हल्की बूंदाबांदी" },
    "53": { emoji: "🌦️", label: "बूंदाबांदी" },
    "55": { emoji: "🌦️", label: "तेज़ बूंदाबांदी" },
    "61": { emoji: "🌧️", label: "हल्की बारिश" },
    "63": { emoji: "🌧️", label: "बारिश" },
    "65": { emoji: "🌧️", label: "तेज़ बारिश" },
    "71": { emoji: "🌨️", label: "हल्की बर्फ़बारी" },
    "73": { emoji: "🌨️", label: "बर्फ़बारी" },
    "75": { emoji: "❄️", label: "भारी बर्फ़बारी" },
    "80": { emoji: "🌦️", label: "बौछारें" },
    "81": { emoji: "🌧️", label: "तेज़ बौछारें" },
    "82": { emoji: "⛆", label: "बहुत तेज़ बौछारें" },
    "95": { emoji: "⛈️", label: "आंधी-तूफ़ान" },
    "96": { emoji: "⛈️", label: "ओलों के साथ तूफ़ान" },
    "99": { emoji: "⛈️", label: "भारी ओलावृष्टि" },
  };
  return map[String(code)] ?? { emoji: "🌡️", label: "अज्ञात" };
}

// Best-effort OS detection from the browser's user agent string.
export function detectOS(): string {
  const ua = navigator.userAgent;
  if (/Windows NT 10/.test(ua)) return "Windows 11";
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad/.test(ua)) return "iOS";
  return "Unknown";
}
