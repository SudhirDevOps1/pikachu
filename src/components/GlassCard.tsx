import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export function GlassCard({
  children,
  className,
  strong = false,
}: {
  children: ReactNode;
  className?: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        strong ? "glass-strong" : "glass-card",
        "rounded-2xl shadow-lg transition-all duration-300",
        className
      )}
    >
      {children}
    </div>
  );
}
