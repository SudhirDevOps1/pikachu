import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { GlassCard } from "./GlassCard";

// Shared sci-fi HUD panel wrapper: small uppercase header with a pulsing
// status dot + icon, and an optional right-aligned control (e.g. a Toggle).
export function HudCard({
  title,
  icon: Icon,
  dotColor = "#22c55e",
  children,
  right,
  className,
}: {
  title: string;
  icon: LucideIcon;
  dotColor?: string;
  children: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <GlassCard className={`p-4 ${className ?? ""}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full"
            style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}` }}
          />
          <Icon size={13} className="shrink-0 text-white/40" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
            {title}
          </span>
        </div>
        {right}
      </div>
      {children}
    </GlassCard>
  );
}
