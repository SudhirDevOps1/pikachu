import { useState, useCallback } from "react";
import { useStore } from "@/store/assistantStore";

export function useRealPiP() {
  const [pipWindow, setPipWindow] = useState<any>(null);
  const addToast = useStore((s) => s.addToast);

  const startPiP = useCallback(async (contentRef: HTMLElement | null) => {
    if (!contentRef) return;
    
    // Document Picture-in-Picture — Chrome/Edge 116+ : real OS window outside browser
    if ("documentPictureInPicture" in window) {
      try {
        const pip: any = await (window as any).documentPictureInPicture.requestWindow({
          width: 340,
          height: 500,
        });

        // Copy all styles + tailwind + CSS vars
        [...document.styleSheets].forEach((styleSheet) => {
          try {
            const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join("");
            const style = document.createElement("style");
            style.textContent = cssRules;
            pip.document.head.appendChild(style);
          } catch (e) {
            try {
              const link = document.createElement("link");
              link.rel = "stylesheet";
              link.href = (styleSheet as any).href;
              if (link.href) pip.document.head.appendChild(link);
            } catch {}
          }
        });
        // Copy <style> tags directly for vite single-file
        document.querySelectorAll("style").forEach((s) => {
          const c = document.createElement("style");
          c.textContent = s.textContent;
          pip.document.head.appendChild(c);
        });

        // Move the HUD content to PiP window — realistic OS window
        pip.document.body.appendChild(contentRef);
        pip.document.body.style.background = "#0a0b10";
        pip.document.body.style.margin = "0";
        pip.document.body.style.overflow = "hidden";
        pip.document.body.className = "pip-active";
        // Ensure accent vars follow
        const root = document.documentElement;
        pip.document.documentElement.style.setProperty("--accent", getComputedStyle(root).getPropertyValue("--accent"));
        pip.document.documentElement.style.setProperty("--accent-rgb", getComputedStyle(root).getPropertyValue("--accent-rgb"));
        pip.document.documentElement.style.setProperty("--secondary-accent", getComputedStyle(root).getPropertyValue("--secondary-accent"));

        pip.addEventListener("pagehide", () => {
          setPipWindow(null);
          document.getElementById("pika-pip-placeholder")?.appendChild(contentRef);
          addToast({ type: "info", message: "PiP band — wapas browser me." });
        });

        setPipWindow(pip);
        addToast({ type: "success", message: "✅ PiP bahar nikal gaya — ab browser ke bahar bhi dikhega!" });
        return;
      } catch (err: any) {
        // Fall through to fallback
        if (err?.name === "NotAllowedError") {
          addToast({ type: "error", message: "PiP ke liye click se kholo — auto-block hua." });
          return;
        }
      }
    }
    // Fallback: in-page draggable is already there, but also try window.open for Firefox
    try {
      const w = window.open("", "_blank", "width=340,height=500,menubar=no,toolbar=no,location=no,status=no");
      if (w) {
        w.document.write(`<html><head><title>Pika PiP</title></head><body style="margin:0;background:#0a0b10;color:white;font-family:system-ui"><div style="padding:16px;text-align:center">` + contentRef.innerHTML + `<p style="margin-top:12px;font-size:11px;opacity:0.5">Browser PiP support nahi — Chrome/Edge me kholo for outside window.</p></div></body></html>`);
        w.document.close();
        addToast({ type: "info", message: "Fallback window khola — Chrome/Edge me Document PiP best hai." });
        return;
      }
    } catch {}
    addToast({ type: "info", message: "Document PiP sirf Chrome/Edge 116+ me — in-page draggable use karo." });
  }, [addToast]);

  return { pipWindow, startPiP };
}
