import { useState } from "react";
import {
  Calculator as CalcIcon, Languages, KeyRound, QrCode, ScanText,
  FileText, ImageIcon, Type, Copy, Check, RefreshCw, ArrowRightLeft, Plus, Trash2,
  FolderCog, Save, PenLine, Terminal,
} from "lucide-react";
import { motion } from "framer-motion";
import { useStore } from "@/store/assistantStore";
import { useAssistantApi } from "@/hooks/AssistantContext";
import { GlassCard } from "./GlassCard";
import { GlowButton } from "./GlowButton";
import { TerminalPanel } from "./TerminalPanel";
import { safeCalc, generatePassword, passwordStrength, generateId, nowIso } from "@/lib/utils";
import type { ToolsSubTab } from "@/types";
import { cn } from "@/utils/cn";

const SUBTABS: { id: ToolsSubTab; label: string; icon: typeof CalcIcon }[] = [
  { id: "files", label: "फाइल मैनेजर", icon: FolderCog },
  { id: "terminal", label: "टर्मिनल", icon: Terminal },
  { id: "calculator", label: "कैलकुलेटर", icon: CalcIcon },
  { id: "translator", label: "अनुवाद", icon: Languages },
  { id: "password", label: "पासवर्ड", icon: KeyRound },
  { id: "qrcode", label: "QR कोड", icon: QrCode },
  { id: "ocr", label: "OCR", icon: ScanText },
  { id: "pdf", label: "PDF", icon: FileText },
  { id: "image", label: "इमेज", icon: ImageIcon },
  { id: "text_expand", label: "स्निपेट", icon: Type },
];

export function ToolsPanel() {
  const sub = useStore((s) => s.toolsSubTab);
  const setSub = useStore((s) => s.setToolsSubTab);
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3 md:px-8">
        {SUBTABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition-all",
              sub === t.id ? "bg-[var(--accent)] text-white shadow-lg shadow-[0_0_16px_rgba(var(--accent-rgb),0.4)]" : "glass-card text-white/60 hover:text-white"
            )}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>
      <motion.div key={sub} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex-1 overflow-y-auto px-4 py-4 md:px-8">
        {sub === "files" && <FileManagerPro />}
        {sub === "terminal" && <TerminalPanel />}
        {sub === "calculator" && <CalculatorTool />}
        {sub === "translator" && <TranslatorTool />}
        {sub === "password" && <PasswordTool />}
        {sub === "qrcode" && <QrTool />}
        {sub === "ocr" && <OcrTool />}
        {sub === "pdf" && <PdfTool />}
        {sub === "image" && <ImageTool />}
        {sub === "text_expand" && <SnippetTool />}
      </motion.div>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [c, setC] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).catch(() => {}); setC(true); setTimeout(() => setC(false), 1500); }}
      className="flex items-center gap-1 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
    >
      {c ? <Check size={13} /> : <Copy size={13} />} {c ? "कॉपी हुआ" : "कॉपी"}
    </button>
  );
}

// ---------- Calculator ----------
function CalculatorTool() {
  const [expr, setExpr] = useState("");
  const [history, setHistory] = useState<{ e: string; r: string }[]>([]);
  const btns = ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "(", ")", "sqrt(", "pi", "+", "="];
  const calc = () => {
    const r = safeCalc(expr);
    if (r.ok) {
      setHistory((h) => [{ e: expr, r: String(r.value) }, ...h].slice(0, 8));
      setExpr(String(r.value));
    } else {
      useStore.getState().addToast({ type: "error", message: r.error ?? "गणना नहीं हो सकी" });
    }
  };
  return (
    <div className="mx-auto max-w-md space-y-4">
      <GlassCard className="p-4">
        <input value={expr} onChange={(e) => setExpr(e.target.value)} onKeyDown={(e) => e.key === "Enter" && calc()} placeholder="0" className="w-full bg-transparent text-right font-mono text-3xl text-white outline-none" />
      </GlassCard>
      <div className="grid grid-cols-4 gap-2">
        <button onClick={() => setExpr("")} className="col-span-2 rounded-xl bg-red-500/20 py-3 font-medium text-red-200 hover:bg-red-500/30">C</button>
        {btns.map((b) => (
          <button
            key={b}
            onClick={() => (b === "=" ? calc() : setExpr((e) => e + b))}
            className={cn("rounded-xl py-3 font-mono text-lg transition active:scale-95", b === "=" ? "bg-[var(--accent)] text-white" : "glass-card text-white/85 hover:bg-white/10")}
          >
            {b === "sqrt(" ? "√" : b === "pi" ? "π" : b}
          </button>
        ))}
      </div>
      {history.length > 0 && (
        <GlassCard className="p-3">
          {history.map((h, i) => (
            <div key={i} className="flex justify-between border-b border-white/5 py-1.5 font-mono text-sm text-white/60 last:border-0">
              <span>{h.e}</span><span className="text-cyan-300">= {h.r}</span>
            </div>
          ))}
        </GlassCard>
      )}
    </div>
  );
}

// ---------- Translator ----------
function TranslatorTool() {
  const { processInput } = useAssistantApi();
  const [src, setSrc] = useState("");
  const [out, setOut] = useState("");
  const [lang, setLang] = useState("hindi");
  const langs = ["hindi", "english", "french", "german", "spanish", "japanese", "chinese", "arabic"];
  const translate = () => {
    processInput(`Translate this to ${lang}: ${src}`);
    setOut("AI द्वारा अनुवाद चैट विंडो में देखें...");
  };
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <GlassCard className="p-4">
          <textarea value={src} onChange={(e) => setSrc(e.target.value)} placeholder="टेक्स्ट यहाँ लिखें..." rows={6} className="w-full resize-none bg-transparent text-white outline-none placeholder-white/30" />
        </GlassCard>
        <GlassCard className="flex flex-col p-4">
          <div className="flex-1 whitespace-pre-wrap text-white/90">{out || <span className="text-white/30">अनुवाद यहाँ दिखेगा...</span>}</div>
          {out && <div className="mt-2"><CopyBtn text={out} /></div>}
        </GlassCard>
      </div>
      <div className="flex items-center gap-3">
        <ArrowRightLeft size={16} className="text-white/40" />
        <select value={lang} onChange={(e) => setLang(e.target.value)} className="rounded-xl bg-white/10 px-4 py-2 text-white outline-none">
          {langs.map((l) => <option key={l} value={l} className="bg-navy-800">{l}</option>)}
        </select>
        <GlowButton variant="primary" onClick={translate}><Languages size={16} /> अनुवाद करें</GlowButton>
      </div>
    </div>
  );
}

// ---------- Password ----------
function PasswordTool() {
  const [len, setLen] = useState(16);
  const [opts, setOpts] = useState({ upper: true, lower: true, digits: true, symbols: true });
  const [pw, setPw] = useState("");
  const gen = () => setPw(generatePassword(len, opts));
  const strength = pw ? passwordStrength(pw) : null;
  return (
    <div className="mx-auto max-w-md space-y-4">
      <GlassCard className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <input readOnly value={pw} placeholder="पासवर्ड जनरेट करें" className="flex-1 rounded-xl bg-white/5 px-4 py-3 font-mono text-white outline-none placeholder-white/30" />
          <button onClick={gen} className="rounded-xl bg-[var(--accent)] p-3 text-white"><RefreshCw size={18} /></button>
        </div>
        {strength && (
          <div className="mb-3">
            <div className="mb-1 flex justify-between text-xs"><span className="text-white/50">मज़बूती</span><span style={{ color: strength.color }}>{strength.label}</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full transition-all" style={{ width: `${(strength.score / 5) * 100}%`, background: strength.color }} />
            </div>
          </div>
        )}
        {pw && <CopyBtn text={pw} />}
      </GlassCard>
      <GlassCard className="space-y-4 p-5">
        <div>
          <div className="mb-2 flex justify-between text-sm text-white/70"><span>लंबाई</span><span>{len}</span></div>
          <input type="range" min={8} max={64} value={len} onChange={(e) => setLen(+e.target.value)} className="w-full accent-violet-500" />
        </div>
        {(["upper", "lower", "digits", "symbols"] as const).map((k) => (
          <label key={k} className="flex cursor-pointer items-center justify-between text-sm text-white/80">
            <span>{k === "upper" ? "बड़े अक्षर (A-Z)" : k === "lower" ? "छोटे अक्षर (a-z)" : k === "digits" ? "अंक (0-9)" : "चिह्न (!@#$)"}</span>
            <input type="checkbox" checked={opts[k]} onChange={(e) => setOpts((o) => ({ ...o, [k]: e.target.checked }))} className="h-4 w-4 accent-violet-500" />
          </label>
        ))}
      </GlassCard>
    </div>
  );
}

// ---------- QR ----------
function QrTool() {
  const [data, setData] = useState("");
  const [url, setUrl] = useState("");
  const gen = () => {
    if (!data.trim()) return;
    setUrl(`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(data)}`);
  };
  return (
    <div className="mx-auto max-w-md space-y-4">
      <GlassCard className="flex gap-2 p-3">
        <input value={data} onChange={(e) => setData(e.target.value)} onKeyDown={(e) => e.key === "Enter" && gen()} placeholder="टेक्स्ट या URL डालें..." className="flex-1 bg-transparent px-2 text-white outline-none placeholder-white/30" />
        <GlowButton variant="primary" onClick={gen}><QrCode size={16} /> बनाओ</GlowButton>
      </GlassCard>
      {url && (
        <GlassCard className="flex flex-col items-center gap-4 p-6">
          <img src={url} alt="QR" className="rounded-xl bg-white p-2" width={240} height={240} />
          <a href={url} download="qrcode.png" target="_blank" rel="noreferrer">
            <GlowButton>डाउनलोड</GlowButton>
          </a>
        </GlassCard>
      )}
    </div>
  );
}

// ---------- OCR ----------
function OcrTool() {
  const [text, setText] = useState("");
  return (
    <div className="mx-auto max-w-md space-y-4">
      <GlowButton variant="primary" onClick={() => setText("यह डेमो टेक्स्ट है जो स्क्रीन से पढ़ा गया।\nबैकएंड कनेक्ट होने पर Tesseract OCR से असली टेक्स्ट मिलेगा।")} className="w-full py-4"><ScanText size={20} /> स्क्रीन से टेक्स्ट पढ़ें</GlowButton>
      <GlassCard className="p-4">
        <textarea readOnly value={text} placeholder="पढ़ा गया टेक्स्ट यहाँ दिखेगा..." rows={8} className="w-full resize-none bg-transparent text-white/90 outline-none placeholder-white/30" />
        {text && <div className="mt-2"><CopyBtn text={text} /></div>}
      </GlassCard>
    </div>
  );
}

// ---------- PDF ----------
function PdfTool() {
  return (
    <div className="mx-auto max-w-md space-y-3">
      {[
        { t: "PDF मर्ज करें", d: "दो या ज़्यादा PDF जोड़ें" },
        { t: "PDF स्प्लिट करें", d: "पेज अलग करें" },
        { t: "टेक्स्ट निकालें", d: "PDF से टेक्स्ट एक्सट्रैक्ट करें" },
      ].map((o) => (
        <GlassCard key={o.t} className="flex items-center justify-between p-4">
          <div>
            <div className="font-medium text-white">{o.t}</div>
            <div className="text-xs text-white/50">{o.d}</div>
          </div>
          <GlowButton onClick={() => useStore.getState().addToast({ type: "info", message: "बैकएंड ब्रिज ज़रूरी है" })}>चुनें</GlowButton>
        </GlassCard>
      ))}
    </div>
  );
}

// ---------- Image ----------
function ImageTool() {
  return (
    <div className="mx-auto max-w-md space-y-3">
      {[
        { t: "रीसाइज़", d: "चौड़ाई × ऊँचाई बदलें" },
        { t: "कन्वर्ट", d: "फॉर्मेट बदलें (PNG/JPG/WebP)" },
        { t: "कंप्रेस", d: "फाइल साइज़ कम करें" },
      ].map((o) => (
        <GlassCard key={o.t} className="flex items-center justify-between p-4">
          <div>
            <div className="font-medium text-white">{o.t}</div>
            <div className="text-xs text-white/50">{o.d}</div>
          </div>
          <GlowButton onClick={() => useStore.getState().addToast({ type: "info", message: "बैकएंड ब्रिज ज़रूरी है" })}>चुनें</GlowButton>
        </GlassCard>
      ))}
    </div>
  );
}

// ---------- Snippets ----------
function SnippetTool() {
  const [snippets, setSnippets] = useState<{ id: string; trigger: string; content: string }[]>([
    { id: generateId(), trigger: "addr", content: "123, MG Road, नई दिल्ली, 110001" },
    { id: generateId(), trigger: "sig", content: "धन्यवाद,\nपिका" },
  ]);
  const [trigger, setTrigger] = useState("");
  const [content, setContent] = useState("");
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <GlassCard className="space-y-3 p-4">
        <input value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder="ट्रिगर (जैसे: addr)" className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-white outline-none placeholder-white/30" />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="विस्तृत टेक्स्ट..." rows={3} className="w-full resize-none rounded-xl bg-white/5 px-4 py-2.5 text-white outline-none placeholder-white/30" />
        <GlowButton variant="primary" onClick={() => { if (trigger && content) { setSnippets((s) => [...s, { id: generateId(), trigger, content }]); setTrigger(""); setContent(""); } }}><Plus size={16} /> जोड़ें</GlowButton>
      </GlassCard>
      <div className="space-y-2">
        {snippets.map((s) => (
          <GlassCard key={s.id} className="flex items-center gap-3 p-4">
            <code className="rounded-lg bg-violet-500/20 px-2 py-1 text-sm text-violet-200">{s.trigger}</code>
            <span className="flex-1 truncate text-sm text-white/70">{s.content}</span>
            <CopyBtn text={s.content} />
            <button onClick={() => setSnippets((arr) => arr.filter((x) => x.id !== s.id))} className="text-red-400/70 hover:text-red-400"><Trash2 size={16} /></button>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

// ---------- File Manager Pro (create / edit / rename / delete on real PC) ----------
function FileManagerPro() {
  const { sendRaw, processInput } = useAssistantApi();
  const isConnected = useStore((s) => s.isConnected);
  const [path, setPath] = useState("Desktop/pika-note.txt");
  const [content, setContent] = useState("");
  const [newName, setNewName] = useState("");

  const send = (category: string, action: string, params: Record<string, unknown>) => {
    if (!isConnected) {
      useStore.getState().addToast({ type: "info", message: "यह लाइव क्रिया के लिए PC ब्रिज ज़रूरी है (डेमो मोड)।" });
      return;
    }
    sendRaw({ type: "command", category, action, params, id: generateId(), timestamp: nowIso() });
    useStore.getState().addToast({ type: "success", message: `${action} → ${String(params.path ?? "")}` });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <GlassCard className="p-4">
        <div className="mb-2 flex items-center gap-2 text-white/70">
          <FolderCog size={16} style={{ color: "var(--accent)" }} />
          <span className="text-sm font-semibold">फाइल पथ</span>
        </div>
        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="जैसे: Desktop/notes.txt या Documents/report.md"
          className="w-full rounded-xl bg-white/5 px-4 py-2.5 font-mono text-sm text-white outline-none placeholder-white/30"
        />
        <p className="mt-1 text-[10px] text-white/30">
          रिलेटिव पथ आपके होम फोल्डर से resolve होते हैं। Desktop, Documents, Downloads आदि सपोर्टेड।
        </p>
      </GlassCard>

      <GlassCard className="p-4">
        <div className="mb-2 flex items-center gap-2 text-white/70">
          <PenLine size={16} style={{ color: "var(--accent)" }} />
          <span className="text-sm font-semibold">कंटेंट (create / edit)</span>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          placeholder="यहाँ फाइल का टेक्स्ट लिखें..."
          className="w-full resize-none rounded-xl bg-white/5 px-4 py-2.5 font-mono text-sm text-white outline-none placeholder-white/30"
        />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <GlowButton variant="primary" onClick={() => send("files", "create_file", { path, content })}>
            <Plus size={15} /> बनाओ
          </GlowButton>
          <GlowButton onClick={() => send("files", "write", { path, content })}>
            <Save size={15} /> सेव
          </GlowButton>
          <GlowButton onClick={() => send("files", "read", { path })}>
            <FileText size={15} /> पढ़ो
          </GlowButton>
          <GlowButton variant="danger" onClick={() => processInput(`delete file ${path}`)}>
            <Trash2 size={15} /> डिलीट
          </GlowButton>
        </div>
      </GlassCard>

      <GlassCard className="p-4">
        <div className="mb-2 text-sm font-semibold text-white/70">रीनेम</div>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="नया नाम / नया पथ"
            className="flex-1 rounded-xl bg-white/5 px-4 py-2.5 font-mono text-sm text-white outline-none placeholder-white/30"
          />
          <GlowButton onClick={() => newName && send("files", "rename", { path, new_path: newName })}>
            <RefreshCw size={15} /> रीनेम
          </GlowButton>
        </div>
      </GlassCard>

      <GlassCard className="p-4">
        <div className="mb-2 text-sm font-semibold text-white/70">फोल्डर क्रियाएँ</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <GlowButton onClick={() => send("files", "create_folder", { path })}><Plus size={15} /> फोल्डर बनाओ</GlowButton>
          <GlowButton onClick={() => send("files", "list", { path })}><FolderCog size={15} /> लिस्ट</GlowButton>
          <GlowButton onClick={() => processInput("open file explorer")}><FileText size={15} /> एक्सप्लोरर</GlowButton>
        </div>
        {/* Preview hint — bridge read returns toast + ws event; this box shows current editor content as preview */}
        {(path.endsWith(".png")||path.endsWith(".jpg")||path.endsWith(".jpeg")||path.endsWith(".webp")) ? (
          <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-center text-xs text-white/40">🖼️ इमेज प्रीव्यू — Bridge से read के बाद यहाँ thumbnail आएगा (स्क्रीनशॉट API से) • अभी editor content दिख रहा</div>
        ) : content ? (
          <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="mb-1 text-xs text-white/40">प्रीव्यू</div>
            <pre className="whitespace-pre-wrap text-xs text-white/70 max-h-40 overflow-auto">{content.slice(0,2000)}</pre>
          </div>
        ) : null}
        <p className="mt-3 rounded-lg bg-white/[0.03] p-2 text-[11px] text-white/40">
          💡 वॉइस/चैट से भी: "desktop par file banao test.txt", "notes.txt ko final.txt rename karo",
          "downloads mein kya hai", "delete file old.log" • टर्मिनल से <code className="bg-white/10 px-1 rounded">dir Desktop</code> भी try करो
        </p>
      </GlassCard>
    </div>
  );
}
