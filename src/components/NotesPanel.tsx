import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { StickyNote, Plus, Trash2, Pin, Search, Copy, Check } from "lucide-react";
import { useStore } from "@/store/assistantStore";
import { GlassCard } from "./GlassCard";
import { GlowButton } from "./GlowButton";
import { MarkdownRenderer } from "./MarkdownRenderer";

const COLORS = ["#00f0ff","#7c3aed","#ec4899","#eab308","#22c55e","#06b6d4"];

export function NotesPanel() {
  const notes = useStore((s) => s.notes);
  const addNote = useStore((s) => s.addNote);
  const updateNote = useStore((s) => s.updateNote);
  const deleteNote = useStore((s) => s.deleteNote);
  const togglePin = useStore((s) => s.togglePinNote);
  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!q.trim()) return notes;
    const low = q.toLowerCase();
    return notes.filter((n) => (n.title+n.content).toLowerCase().includes(low));
  }, [notes, q]);

  const sel = selected ? notes.find((n)=>n.id===selected) || null : null;

  const create = () => {
    if (!title.trim() && !content.trim()) return;
    const id = addNote({ title: title.trim() || "बिना शीर्षक", content, color: COLORS[Math.floor(Math.random()*COLORS.length)] });
    setTitle(""); setContent(""); setSelected(id);
    useStore.getState().addToast({ type:"success", message:"नोट सेव हुआ ✍️" });
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-white">
          <StickyNote size={20} style={{ color:"var(--accent)" }} />
          <h2 className="text-lg font-semibold">नोट्स</h2>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">{notes.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 border border-white/10">
            <Search size={14} className="text-white/40" />
            <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="खोजो..." className="bg-transparent text-sm text-white outline-none placeholder-white/30 w-32 sm:w-48" />
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
        {/* Left: composer + list */}
        <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
          <GlassCard className="p-4 shrink-0">
            <input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="शीर्षक..." className="mb-2 w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder-white/30" />
            <textarea value={content} onChange={(e)=>setContent(e.target.value)} placeholder="नोट लिखो... markdown supported" rows={3} className="w-full resize-none rounded-xl bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder-white/30" />
            <div className="mt-3 flex justify-end">
              <GlowButton variant="primary" onClick={create}><Plus size={16} /> जोड़ो</GlowButton>
            </div>
          </GlassCard>

          <div className="min-h-0 flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar">
            {filtered.length===0 ? <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-white/40">कोई नोट नहीं — ऊपर से बनाओ</div> : filtered.map((n)=>(
              <motion.button key={n.id} layout onClick={()=>setSelected(n.id)} className={`w-full text-left rounded-xl border p-3 transition ${selected===n.id ? "bg-[var(--accent)]/15 border-[var(--accent)]/30" : "glass-card border-white/10 hover:border-white/20"}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-white text-sm line-clamp-1">{n.title}</span>
                  <span className="h-2 w-2 rounded-full shrink-0 mt-1" style={{ background: n.color || "var(--accent)" }} />
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-white/50 whitespace-pre-wrap">{n.content.slice(0,120) || "—"}</p>
                <div className="mt-2 flex items-center gap-1">
                  <button onClick={(e)=>{ e.stopPropagation(); togglePin(n.id); }} className={`rounded-lg px-2 py-1 text-xs ${n.pinned ? "bg-amber-400/20 text-amber-200" : "bg-white/5 text-white/40 hover:text-white"}`}><Pin size={12} /> {n.pinned?"Pinned":"Pin"}</button>
                  <button onClick={(e)=>{ e.stopPropagation(); navigator.clipboard.writeText(n.content).catch(()=>{}); setCopied(n.id); setTimeout(()=>setCopied(null),1200); }} className="rounded-lg bg-white/5 px-2 py-1 text-xs text-white/40 hover:text-white flex items-center gap-1">{copied===n.id ? <Check size={12} /> : <Copy size={12} />}{copied===n.id ? "कॉपी":"कॉपी"}</button>
                  <button onClick={(e)=>{ e.stopPropagation(); deleteNote(n.id); if(selected===n.id) setSelected(null); }} className="ml-auto rounded-lg bg-red-500/15 px-2 py-1 text-xs text-red-300 hover:bg-red-500/25"><Trash2 size={12} /></button>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Right: preview / edit */}
        <GlassCard className="flex min-h-[320px] flex-col overflow-hidden p-0 lg:min-h-0">
          {!sel ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-white/40">
              <div>
                <StickyNote size={32} className="mx-auto mb-2 opacity-40" />
                कोई नोट चुनो या नया बनाओ — Markdown preview यहाँ दिखेगा
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
                <input value={sel.title} onChange={(e)=>updateNote(sel.id, { title: e.target.value })} className="flex-1 bg-transparent text-white font-semibold outline-none" />
                <span className="text-xs text-white/30">{new Date(sel.updatedAt).toLocaleString("hi-IN")}</span>
              </div>
              <div className="grid flex-1 min-h-0 grid-cols-1 md:grid-cols-2">
                <textarea value={sel.content} onChange={(e)=>updateNote(sel.id, { content: e.target.value })} className="min-h-[200px] border-r border-white/10 bg-transparent p-4 text-sm text-white outline-none placeholder-white/30 resize-none" placeholder="markdown..." />
                <div className="overflow-y-auto p-4 text-sm bg-black/10">
                  <MarkdownRenderer content={sel.content || "_खाली नोट_"} />
                </div>
              </div>
            </>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
