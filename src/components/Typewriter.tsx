import { useEffect, useState } from "react";

// Smooth typewriter effect that reveals text character-by-character with
// a blinking cursor. Perfect for sci-fi greetings and status messages.
export function Typewriter({
  text,
  speed = 35,
  className,
  onDone,
}: {
  text: string;
  speed?: number;
  className?: string;
  onDone?: () => void;
}) {
  const [display, setDisplay] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplay("");
    setDone(false);
    let i = 0;
    const t = setInterval(() => {
      i++;
      setDisplay(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(t);
        setDone(true);
        onDone?.();
      }
    }, speed);
    return () => clearInterval(t);
  }, [text, speed, onDone]);

  return (
    <span className={className}>
      {display}
      {!done && <span className="inline-block h-4 w-0.5 animate-pulse bg-current align-middle" />}
    </span>
  );
}
