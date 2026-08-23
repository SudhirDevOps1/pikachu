// Full-screen animated aurora gradient + cyber grid overlay behind everything.
// Blobs use the live theme accent colors so the whole vibe recolors instantly.
export function AuroraBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, #0a0e1a 0%, #120a28 25%, #0a1628 50%, #0d1f2d 75%, #0a0e1a 100%)",
          backgroundSize: "400% 400%",
          animation: "aurora 18s ease-in-out infinite",
        }}
      />
      {/* moving accent blobs */}
      <div
        className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full opacity-30 blur-[120px] transition-colors duration-700"
        style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)", animation: "float 12s ease-in-out infinite" }}
      />
      <div
        className="absolute -right-40 top-1/3 h-[500px] w-[500px] rounded-full opacity-25 blur-[120px] transition-colors duration-700"
        style={{ background: "radial-gradient(circle, var(--secondary-accent) 0%, transparent 70%)", animation: "float 15s ease-in-out infinite reverse" }}
      />
      <div
        className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full opacity-20 blur-[120px]"
        style={{ background: "radial-gradient(circle, #06b6d4 0%, transparent 70%)", animation: "float 18s ease-in-out infinite" }}
      />
      {/* subtle cyber grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(var(--accent-rgb),0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--accent-rgb),0.6) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 85%)",
        }}
      />
      {/* scanline sweep */}
      <div className="cyber-scanline absolute inset-x-0 h-24" />
    </div>
  );
}
