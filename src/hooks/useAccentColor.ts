import { useEffect } from "react";
import { useStore } from "@/store/assistantStore";
import { hexToRgb } from "@/lib/utils";

// Applies the user-selected accent color to CSS custom properties on the
// document root. Every accent-aware element (bg-[var(--accent)], glows,
// gradients, etc.) updates instantly — no reload, no rebuild.
export function useAccentColor() {
  const accent = useStore((s) => s.settings.accentColor);
  const secondary = useStore((s) => s.settings.secondaryAccentColor);
  const appearance = useStore((s) => s.settings.appearance);

  useEffect(() => {
    const rgb = hexToRgb(accent) ?? "0, 240, 255";
    const rgbSecondary = hexToRgb(secondary) ?? "255, 0, 255";
    
    document.documentElement.style.setProperty("--accent", accent);
    document.documentElement.style.setProperty("--accent-rgb", rgb);
    document.documentElement.style.setProperty("--secondary-accent", secondary);
    document.documentElement.style.setProperty("--secondary-accent-rgb", rgbSecondary);
    if (appearance) {
      document.documentElement.style.setProperty("--grid-opacity", String(appearance.gridOpacity ?? 0.06));
      document.documentElement.style.setProperty("--glass-blur", `${appearance.glassBlur ?? 30}px`);
      document.documentElement.style.setProperty("--font-scale", String(appearance.fontScale ?? 1));
      document.documentElement.style.setProperty("--anim-speed", String(appearance.animationSpeed ?? 1));
      document.documentElement.style.setProperty("--hud-brightness", String(appearance.hudBrightness ?? 1));
      document.documentElement.style.setProperty("--orb-scale", String(appearance.orbScale ?? 1));
      document.documentElement.style.setProperty("--show-grid", appearance.showGrid ? "1" : "0");
      // fontScale and brightness via CSS vars only — no direct documentElement fontSize/filter to avoid layout break
    }
  }, [accent, secondary, appearance]);
}
