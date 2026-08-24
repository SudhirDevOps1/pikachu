import { useEffect, useRef, useState } from "react";
import { Terminal, Play, Trash2, Copy, Check } from "lucide-react";
import { useStore } from "@/store/assistantStore";
import { useAssistantApi } from "@/hooks/AssistantContext";
import { GlassCard } from "./GlassCard";
import { GlowButton } from "./GlowButton";
import { generateId, nowIso } from "@/lib/utils";

type Line = { id: string; cmd: string; out: string; err: string; code: number | null };

export function TerminalPanel() {
  const { sendRaw } = useAssistantApi();
  const isConnected = useStore((s) => s.isConnected);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<Line[]>([]);
  const [cwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history, busy]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      try {
        const msg = JSON.parse((e as any).data ?? "");
        if (msg?.type === "response" && msg?.data && typeof msg.data.stdout === "string") {
          const line: Line = { id: generateId(), cmd: "(bridge)", out: msg.data.stdout, err: msg.data.stderr || "", code: msg.data.returncode ?? null };
          setHistory((h) => [...h, line].slice(-100));
          setBusy(false);
        }
      } catch {}
    };
    // listen via websocket raw is handled in useAssistant; also poll toast? fallback: useAssistantApi doesn't expose raw onMessage, so also handle via store? Keep simple: we will not rely on async push, instead processInput returns via bridge event handled in useAssistant's onMessage which shows toast. We add direct listener on window for custom event.
    window.addEventListener("message", onMsg as any);
    return () => window.removeEventListener("message", onMsg as any);
  }, []);

  const run = () => {
    const cmd = input.trim();
    if (!cmd) return;
    if (!isConnected) {
      useStore.getState().addToast({ type: "info", message: "PC Bridge ज़रूरी है (डेमो में local echo)" });
      setHistory((h) => [...h, { id: generateId(), cmd, out: `(offline) echo: ${cmd}`, err: "", code: 0 }].slice(-100));
      setInput("");
      return;
    }
    setBusy(true);
    const line: Line = { id: generateId(), cmd, out: "…running", err: "", code: null };
    setHistory((h) => [...h, line].slice(-100));
    sendRaw({ type: "command", category: "terminal", action: "exec", params: { command: cmd, cwd }, id: generateId(), timestamp: nowIso() });
    setInput("");
    // fallback timeout to clear busy if no response
    setTimeout(() => setBusy(false), 4000);
  };

  const presets = ["dir", "ipconfig", "git status", "npm run build", "python --version"];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <GlassCard className="p-3 flex items-center gap-2">
        <Terminal size={16} style={{ color: "var(--accent)" }} />
        <span className="text-sm font-semibold text-white">टर्मिनल</span>
        <span className={`ml-2 h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-red-400"}`} />
        <span className="text-xs text-white/40">{isConnected ? "Bridge connected" : "Offline echo"}</span>
        <button onClick={() => { setHistory([]); }} className="ml-auto flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs text-white/60 hover:text-white"><Trash2 size={12} /> Clear</button>
      </GlassCard>

      <GlassCard className="p-0 overflow-hidden">
        <div className="flex gap-1 px-3 py-2 border-b border-white/10 overflow-x-auto no-scrollbar">
          {presets.map((p) => (
            <button key={p} onClick={() => setInput(p)} className="shrink-0 rounded-full bg-white/5 px-3 py-1 text-xs text-white/60 hover:bg-white/10 hover:text-white font-mono">{p}</button>
          ))}
        </div>
        <div className="h-[360px] overflow-y-auto bg-black/40 p-3 font-mono text-xs leading-relaxed">
          {history.length === 0 && <div className="text-white/30">कमांड लिखो और Enter दबाओ — PowerShell (Windows) / bash (Linux) चलेगा।</div>}
          {history.map((l) => (
            <div key={l.id} className="mb-3 border-b border-white/5 pb-2 last:border-0">
              <div className="text-cyan-300">$ {l.cmd}</div>
              {l.out && <pre className="whitespace-pre-wrap text-white/80 mt-1">{l.out.slice(0, 4000)}</pre>}
              {l.err && <pre className="whitespace-pre-wrap text-red-300 mt-1">{l.err.slice(0, 2000)}</pre>}
              {l.code !== null && <span className="text-white/30">exit {l.code}</span>}
            </div>
          ))}
          {busy && <div className="text-amber-300 animate-pulse">running…</div>}
          <div ref={endRef} />
        </div>
        <div className="flex items-center gap-2 p-3 border-t border-white/10 bg-white/[0.02]">
          <span className="text-cyan-400 font-mono text-sm">$</span>
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} placeholder="command…" className="flex-1 bg-transparent font-mono text-sm text-white outline-none placeholder-white/30" />
          <GlowButton variant="primary" onClick={run}><Play size={14} /> Run</GlowButton>
          <button onClick={() => { const all = history.map((h) => `$ ${h.cmd}\n${h.out}`).join("\n\n"); navigator.clipboard.writeText(all).catch(()=>{}); setCopied(true); setTimeout(()=>setCopied(false),1200); }} className="rounded-xl bg-white/5 p-2 text-white/60 hover:text-white">{copied ? <Check size={16} /> : <Copy size={16} />}</button>
        </div>
      </GlassCard>
      <p className="text-center text-[11px] text-white/30">⚠️ Terminal runs under your user — dangerous rm/format/shutdown commands are blocked. CWD is HOME by default.</p>
    </div>
  );
}
