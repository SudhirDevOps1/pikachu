import { useState, Fragment } from "react";
import { Copy, Check } from "lucide-react";

// Minimal but capable markdown renderer (no external deps).
// Supports: fenced code blocks, inline code, **bold**, *italic*,
// bullet lists, links, and line breaks.

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="my-2 overflow-hidden rounded-xl border border-white/10 bg-black/40">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className="font-mono text-xs text-white/40">{lang || "code"}</span>
        <button onClick={copy} className="flex items-center gap-1 text-xs text-white/50 hover:text-white">
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "कॉपी हुआ" : "कॉपी"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3">
        <code className="font-mono text-xs leading-relaxed text-cyan-100">{code}</code>
      </pre>
    </div>
  );
}

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // regex for inline code, bold, italic, links
  const regex = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(text))) {
    if (m.index > last) nodes.push(<Fragment key={key++}>{text.slice(last, m.index)}</Fragment>);
    const tok = m[0];
    if (tok.startsWith("`")) {
      nodes.push(
        <code key={key++} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.85em] text-cyan-200">
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok.startsWith("**")) {
      nodes.push(<strong key={key++} className="font-semibold text-white">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("*")) {
      nodes.push(<em key={key++}>{tok.slice(1, -1)}</em>);
    } else if (tok.startsWith("[")) {
      const lm = tok.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (lm) {
        const href = lm[2].trim();
        const safe = /^https?:\/\//i.test(href) || /^mailto:/i.test(href) || href.startsWith("/") || href.startsWith("#");
        if (safe) {
          nodes.push(
            <a key={key++} href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">
              {lm[1]}
            </a>
          );
        } else {
          // javascript:, data:, file: etc — render as plain text, not link
          nodes.push(<Fragment key={key++}>{lm[1]} <span className="text-white/30 text-xs">({href.slice(0,30)})</span></Fragment>);
        }
      }
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return nodes;
}

export function MarkdownRenderer({ content }: { content: string }) {
  const parts = content.split(/```/);
  return (
    <div className="text-sm leading-relaxed">
      {parts.map((part, idx) => {
        if (idx % 2 === 1) {
          // code block
          const nl = part.indexOf("\n");
          const lang = nl > -1 ? part.slice(0, nl).trim() : "";
          const code = nl > -1 ? part.slice(nl + 1) : part;
          return <CodeBlock key={idx} code={code.replace(/\n$/, "")} lang={lang} />;
        }
        // normal text — process lines
        const lines = part.split("\n");
        const out: React.ReactNode[] = [];
        let listItems: string[] = [];
        const flushList = (k: number) => {
          if (listItems.length) {
            out.push(
              <ul key={`ul-${k}`} className="my-1 ml-1 space-y-1">
                {listItems.map((li, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-violet-400">•</span>
                    <span>{renderInline(li)}</span>
                  </li>
                ))}
              </ul>
            );
            listItems = [];
          }
        };
        lines.forEach((line, i) => {
          const trimmed = line.trim();
          if (/^[-*]\s+/.test(trimmed)) {
            listItems.push(trimmed.replace(/^[-*]\s+/, ""));
          } else {
            flushList(i);
            if (trimmed) out.push(<p key={i} className="my-0.5">{renderInline(line)}</p>);
          }
        });
        flushList(9999);
        return <Fragment key={idx}>{out}</Fragment>;
      })}
    </div>
  );
}
