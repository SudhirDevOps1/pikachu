import type { LucideIcon } from "lucide-react";

export function PanelHeader({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/30 to-cyan-500/30">
        <Icon size={22} className="text-violet-200" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="text-xs text-white/50">{desc}</p>
      </div>
    </div>
  );
}
