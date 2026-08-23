import { useMemo } from "react";

// Lightweight pure-CSS floating particle field
export function ParticleBackground() {
  const particles = useMemo(() => {
    const colors = ["#ffffff", "#7c3aed", "#06b6d4"];
    return Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 2 + Math.random() * 3,
      duration: 8 + Math.random() * 14,
      delay: Math.random() * 12,
      opacity: 0.1 + Math.random() * 0.35,
      drift: (Math.random() - 0.5) * 120,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute rounded-full"
          style={
            {
              left: `${p.left}%`,
              bottom: "-10px",
              width: `${p.size}px`,
              height: `${p.size}px`,
              background: p.color,
              "--p-opacity": p.opacity,
              "--p-drift": `${p.drift}px`,
              animation: `particle-rise ${p.duration}s linear ${p.delay}s infinite`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
