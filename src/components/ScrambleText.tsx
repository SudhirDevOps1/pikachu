import { useEffect, useRef, useState } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_:.<>[]";

// Cyberpunk-style text scramble animation — characters cycle through random
// glyphs before resolving to the target text. Perfect for HUD status readouts.
export function ScrambleText({
  text,
  className,
  trigger = text,
}: {
  text: string;
  className?: string;
  trigger?: string | number;
}) {
  const [display, setDisplay] = useState(text);
  const frameRef = useRef<number | null>(null);
  const queueRef = useRef<{ from: string; to: string; start: number; end: number }[]>([]);

  useEffect(() => {
    const from = display;
    const to = text;
    const maxLen = Math.max(from.length, to.length);
    queueRef.current = [];
    for (let i = 0; i < maxLen; i++) {
      const f = from[i] || "";
      const t = to[i] || "";
      const start = Math.floor(Math.random() * 20);
      const end = start + Math.floor(Math.random() * 20) + 10;
      queueRef.current.push({ from: f, to: t, start, end });
    }

    let frame = 0;
    const tick = () => {
      let output = "";
      let complete = 0;
      for (let i = 0; i < maxLen; i++) {
        const q = queueRef.current[i];
        if (frame >= q.end) {
          output += q.to;
          complete++;
        } else if (frame >= q.start) {
          if (q.to === " ") {
            output += " ";
          } else {
            output += CHARS[Math.floor(Math.random() * CHARS.length)];
          }
        } else {
          output += q.from;
        }
      }
      setDisplay(output);
      frame++;
      if (complete < maxLen) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, text]);

  return <span className={className}>{display}</span>;
}
