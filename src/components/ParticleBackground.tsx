import { useMemo, useEffect, useRef } from "react";
import { useStore } from "@/store/assistantStore";

// Production-grade particle system — respects Presets with real shapes (Starfield/Magnetic/Ripple etc.)
export function ParticleBackground() {
  const preset = useStore((s) => s.settings.appearance?.particlePreset as any) || (useStore((s) => s.settings.particles) ? "dots" : "none");
  const showScanline = useStore((s) => s.settings.appearance?.showScanline ?? true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // CSS fallback particles for non-canvas shapes (dots/stars/bubbles/lines)
  const cssParticles = useMemo(() => {
    if (preset === "none") return [] as any[];
    if (["heart","galaxy","dna","cube","torus","wave","spiral","star"].includes(preset)) return [] as any[]; // canvas will handle
    const isStars = preset === "stars";
    const isBubbles = preset === "bubbles";
    const isLines = preset === "lines";
    const count = isBubbles ? 28 : isStars ? 32 : isLines ? 22 : 40;
    const colors = isStars ? ["#ffffff", "#fde68a", "#7dd3fc"] : isBubbles ? ["#38bdf8","#a78bfa","#f472b6"] : ["#ffffff", "#7c3aed", "#06b6d4"];
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: isBubbles ? 5 + Math.random() * 7 : 2 + Math.random() * 3,
      duration: 8 + Math.random() * 14,
      delay: Math.random() * 12,
      opacity: isStars ? 0.35 + Math.random() * 0.45 : 0.12 + Math.random() * 0.3,
      drift: (Math.random() - 0.5) * 120,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
  }, [preset]);

  // Canvas for Pro shapes (heart/galaxy/dna/cube/torus/wave/spiral/star)
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const shapes = ["heart","galaxy","dna","cube","torus","wave","star","spiral"];
    if (!shapes.includes(preset)) {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      return;
    }
    let raf = 0;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);
    let t = 0;
    const draw = () => {
      t += 0.012;
      ctx.clearRect(0,0,window.innerWidth, window.innerHeight);
      ctx.save();
      // subtle vignette
      ctx.globalAlpha = 0.015;
      ctx.fillStyle = preset === "heart" ? "#ff2d55" : preset === "galaxy" ? "#8b5cf6" : "#06b6d4";
      ctx.fillRect(0,0,window.innerWidth, window.innerHeight);
      ctx.restore();
      const cx = window.innerWidth/2, cy = window.innerHeight/2;
      // draw shape hint with particles
      const count = 90;
      for (let i=0;i<count;i++) {
        const p = i / count;
        let x=0,y=0;
        if (preset === "heart") {
          const a = p * Math.PI * 2;
          const s = 10 + Math.sin(t*1.2 + p*6)*1.5;
          x = 16 * Math.pow(Math.sin(a),3);
          y = -(13*Math.cos(a) - 5*Math.cos(2*a) - 2*Math.cos(3*a) - Math.cos(4*a));
          x *= s; y *= s;
        } else if (preset === "galaxy" || preset === "spiral") {
          const a = p * Math.PI * 8 + t*0.7;
          const r = p * 140 + Math.sin(p*12 + t)*6;
          x = Math.cos(a)*r; y = Math.sin(a)*r;
        } else if (preset === "dna") {
          const a = p * Math.PI * 4 + t;
          x = Math.sin(a)*70 + (p%0.5>0.25? 18:-18);
          y = (p - 0.5)* 220;
        } else if (preset === "wave") {
          x = (p - 0.5)* 280;
          y = Math.sin(p*8 + t*1.8)* 26 + Math.cos(p*3)*8;
        } else if (preset === "star") {
          const a = p * Math.PI * 2;
          const r = (i%2===0? 90: 42) + Math.sin(t*1.5)*4;
          x = Math.cos(a)*r; y = Math.sin(a)*r;
        } else if (preset === "torus") {
          const a = p * Math.PI * 2;
          const r = 78 + Math.cos(a*6 + t)*4;
          x = Math.cos(a)*r; y = Math.sin(a)*r;
        } else if (preset === "cube") {
          const a = p * Math.PI * 2;
          const r = 68 + (i%4)*18;
          x = Math.cos(a + (i%4)*1.57)*r; y = Math.sin(a + (i%4)*1.57)*r;
        }
        const px = cx + x;
        const py = cy + y;
        const alpha = 0.18 + Math.sin(p*12 + t*2)*0.12;
        ctx.globalAlpha = Math.max(0.08, alpha);
        ctx.fillStyle = preset === "heart" ? "#ff4d6d" : preset === "star" ? "#fde68a" : preset === "galaxy" ? "#a78bfa" : "#38bdf8";
        ctx.beginPath();
        // star shape vs dot
        if (preset === "star") {
          ctx.moveTo(px, py-3); ctx.lineTo(px+1.5, py+1.5); ctx.lineTo(px-2.2, py-0.6); ctx.lineTo(px+2.2, py-0.6); ctx.lineTo(px-1.5, py+1.5); ctx.closePath(); ctx.fill();
        } else {
          ctx.arc(px, py, preset === "heart" ? 1.6 : 1.3, 0, Math.PI*2); ctx.fill();
        }
        // magnetic ripple
        if (preset === "galaxy" || preset === "spiral") {
          ctx.globalAlpha = 0.04;
          ctx.beginPath(); ctx.arc(cx, cy, p*150, 0, Math.PI*2); ctx.strokeStyle = "#8b5cf6"; ctx.lineWidth = 0.5; ctx.stroke();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [preset, showScanline]);

  const isCanvasShape = ["heart","galaxy","dna","cube","torus","wave","star","spiral"].includes(preset);
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Canvas Pro shapes */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ display: isCanvasShape ? "block" : "none" }} />
      {/* CSS fallback */}
      {!isCanvasShape && cssParticles.map((p) => (
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
      {/* Starfield overlay for stars preset */}
      {preset === "stars" && <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: `radial-gradient(white 1px, transparent 1px)`, backgroundSize: `22px 22px` }} />}
      {/* Magnetic field hint */}
      {(preset === "galaxy" || preset === "spiral") && <div className="absolute inset-0 opacity-[0.04]" style={{ background: `radial-gradient(circle at 50% 50%, transparent 30%, rgba(139,92,246,0.15) 70%)` }} />}
    </div>
  );
}
