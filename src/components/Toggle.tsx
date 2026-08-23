import { cn } from "@/utils/cn";

// Shared pill-style ON/OFF switch used across Settings + HUD panels.
export function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        on ? "bg-[var(--accent)]" : "bg-white/15"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
          on ? "left-[22px]" : "left-0.5"
        )}
      />
    </button>
  );
}
