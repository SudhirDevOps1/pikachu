import { useState, useCallback } from "react";
import { useStore } from "@/store/assistantStore";

export function useRealPiP() {
  const [pipWindow, setPipWindow] = useState<any>(null);
  const addToast = useStore((s) => s.addToast);

  const startPiP = useCallback(async (contentRef: HTMLElement | null) => {
    if (!contentRef) return;
    
    // Check if the Document Picture-in-Picture API is available
    if ("documentPictureInPicture" in window) {
      try {
        const pip: any = await (window as any).documentPictureInPicture.requestWindow({
          width: 320,
          height: 480,
        });

        // Copy styles to the new window
        [...document.styleSheets].forEach((styleSheet) => {
          try {
            const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join("");
            const style = document.createElement("style");
            style.textContent = cssRules;
            pip.document.head.appendChild(style);
          } catch (e) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = (styleSheet as any).href;
            pip.document.head.appendChild(link);
          }
        });

        // Move the HUD content to PiP window
        pip.document.body.appendChild(contentRef);
        pip.document.body.style.background = "#0a0b10";
        pip.document.body.className = "pip-active";

        pip.addEventListener("pagehide", () => {
          setPipWindow(null);
          // Return content to main page (DOM recovery)
          document.getElementById("pika-pip-placeholder")?.appendChild(contentRef);
        });

        setPipWindow(pip);
      } catch (err) {
        addToast({ type: "error", message: "PiP failed: browser restricted." });
      }
    } else {
        addToast({ type: "info", message: "Document PiP only supported in Chrome/Edge." });
    }
  }, [addToast]);

  return { pipWindow, startPiP };
}
