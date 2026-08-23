import type { ReactNode } from "react";
import { cn } from "@/utils/cn";
import { sounds } from "@/lib/soundEffects";

export function GlowButton({
  children,
  onClick,
  className,
  variant = "default",
  disabled,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: "default" | "danger" | "primary" | "ghost";
  disabled?: boolean;
  title?: string;
}) {
  const variants = {
    default:
      "bg-white/[0.06] border-white/10 hover:bg-white/[0.12] hover:border-[var(--accent)]/50 hover:shadow-[0_0_20px_rgba(var(--accent-rgb),0.3)]",
    primary:
      "bg-[var(--accent)]/80 border-[var(--accent)]/40 hover:bg-[var(--accent)] hover:shadow-[0_0_24px_rgba(var(--accent-rgb),0.5)]",
    danger:
      "bg-red-500/15 border-red-500/30 hover:bg-red-500/30 hover:border-red-400/60 hover:shadow-[0_0_20px_rgba(239,68,68,0.35)] text-red-200",
    ghost: "bg-transparent border-transparent hover:bg-white/[0.06]",
  };
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        sounds.click();
        onClick?.();
      }}
      className={cn(
        "flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5",
        "text-sm font-medium text-white/85 hover:text-white",
        "transition-all duration-200 active:scale-95",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
}
