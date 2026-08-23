import { useEffect } from "react";
import { useStore } from "@/store/assistantStore";
import { hexToRgb } from "@/lib/utils";

// Applies the user-selected accent color to CSS custom properties on the
// document root. Every accent-aware element (bg-[var(--accent)], glows,
// gradients, etc.) updates instantly — no reload, no rebuild.
export function useAccentColor() {
  const accent = useStore((s) => s.settings.accentColor);
  const secondary = useStore((s) => s.settings.secondaryAccentColor);

  useEffect(() => {
    const rgb = hexToRgb(accent) ?? "0, 240, 255";
    const rgbSecondary = hexToRgb(secondary) ?? "255, 0, 255";
    
    document.documentElement.style.setProperty("--accent", accent);
    document.documentElement.style.setProperty("--accent-rgb", rgb);
    document.documentElement.style.setProperty("--secondary-accent", secondary);
    document.documentElement.style.setProperty("--secondary-accent-rgb", rgbSecondary);
  }, [accent, secondary]);
}
