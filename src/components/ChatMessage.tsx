import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, Pencil, Volume2, RotateCcw, X, Send, CheckCircle2 } from "lucide-react";
import { cn } from "@/utils/cn";
import type { ChatMessage as ChatMessageType } from "@/types";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { formatTime } from "@/lib/utils";
import { useStore } from "@/store/assistantStore";
import { useAssistantApi } from "@/hooks/AssistantContext";

export function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(message.content);
  const [isSpeakingLocal, setIsSpeakingLocal] = useState(false);

  const addToast = useStore((s) => s.addToast);
  const updateMessageContent = useStore((s) => s.updateMessageContent);
  const { processInput } = useAssistantApi();

  if (isSystem) {
    return (
      <div className="my-2 text-center">
        <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/40">{message.content}</span>
      </div>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      addToast({ type: "success", message: isUser ? "प्रॉम्प्ट कॉपी हो गया ✓" : "उत्तर कॉपी हो गया ✓" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast({ type: "error", message: "कॉपी करने में विफल" });
    }
  };

  const handleSaveOnly = () => {
    if (!editDraft.trim()) return;
    updateMessageContent(message.id, editDraft.trim());
    setIsEditing(false);
    addToast({ type: "success", message: "प्रॉम्प्ट अपडेट किया गया ✓" });
  };

  const handleSaveAndSend = () => {
    if (!editDraft.trim()) return;
    const text = editDraft.trim();
    updateMessageContent(message.id, text);
    setIsEditing(false);
    processInput(text);
  };

  const handleSpeak = () => {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      if (isSpeakingLocal) {
        setIsSpeakingLocal(false);
        return;
      }
      const clean = message.content.replace(/[*_`#\>\[\]]/g, "").replace(/https?:\/\/\S+/g, "").trim();
      if (!clean) return;
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = "hi-IN";
      u.rate = 1;
      u.onend = () => setIsSpeakingLocal(false);
      u.onerror = () => setIsSpeakingLocal(false);
      setIsSpeakingLocal(true);
      window.speechSynthesis.speak(u);
    } catch {
      setIsSpeakingLocal(false);
    }
  };

  const handleRetry = () => {
    if (message.content) {
      processInput(message.content);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("group relative flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 text-sm shadow-md shadow-violet-500/20">
          ⚡
        </div>
      )}

      <div className={cn("flex max-w-[85%] flex-col", isUser ? "items-end" : "items-start")}>
        {/* Main Message Box / Inline Editor */}
        <div
          className={cn(
            "relative rounded-2xl px-4 py-2.5 transition-all duration-200",
            !isUser && "glass-card text-white/90 border border-white/10 shadow-sm",
            isEditing && "w-full min-w-[280px] md:min-w-[360px]"
          )}
          style={
            isUser && !isEditing
              ? {
                  background: "linear-gradient(135deg, var(--accent), rgba(var(--accent-rgb), 0.75))",
                  color: "white",
                  boxShadow: "0 4px 15px rgba(var(--accent-rgb), 0.25)",
                }
              : isEditing
              ? { background: "rgba(15, 23, 42, 0.95)", border: "1px solid rgba(var(--accent-rgb), 0.5)" }
              : undefined
          }
        >
          {isEditing ? (
            <div className="space-y-2 py-1">
              <textarea
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveAndSend();
                  }
                  if (e.key === "Escape") {
                    setIsEditing(false);
                    setEditDraft(message.content);
                  }
                }}
                rows={Math.min(6, Math.max(2, editDraft.split("\n").length))}
                autoFocus
                className="w-full resize-none rounded-lg bg-black/40 p-2 text-sm text-white placeholder-white/40 outline-none ring-1 ring-white/20 focus:ring-cyan-400"
              />
              <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditDraft(message.content);
                  }}
                  className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs text-white/70 hover:bg-white/20 hover:text-white"
                  title="रद्द करें (Esc)"
                >
                  <X size={12} />
                  <span>रद्द</span>
                </button>
                <button
                  onClick={handleSaveOnly}
                  className="flex items-center gap-1 rounded-md bg-white/15 px-2.5 py-1 text-xs text-white hover:bg-white/25"
                  title="सिर्फ सेव करें"
                >
                  <CheckCircle2 size={12} />
                  <span>सेव</span>
                </button>
                <button
                  onClick={handleSaveAndSend}
                  className="flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold text-white shadow-md transition active:scale-95"
                  style={{ background: "var(--accent)" }}
                  title="सेव करें और दोबारा रन करें (Enter)"
                >
                  <Send size={12} />
                  <span>सेव & भेजें</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <MarkdownRenderer content={message.content || "\u00a0"} />
              {message.isStreaming && (
                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-cyan-400 align-middle" />
              )}
            </>
          )}
        </div>

        {/* Hover / Tap Action Toolbar */}
        {!isEditing && (
          <div
            className={cn(
              "mt-1 flex items-center gap-2 px-1 text-[11px] text-white/40 opacity-80 transition-opacity group-hover:opacity-100",
              isUser ? "flex-row-reverse" : "flex-row"
            )}
          >
            <span>{formatTime(message.timestamp)}</span>

            {!isUser && message.provider && message.provider !== "pika" && (
              <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-white/60">
                {message.provider}
              </span>
            )}

            <div className="flex items-center gap-1">
              {/* Copy Button */}
              <button
                onClick={handleCopy}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-md transition hover:bg-white/15 hover:text-white",
                  copied ? "text-emerald-400" : "text-white/50"
                )}
                title={copied ? "कॉपी हो गया!" : "कॉपी करें"}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>

              {/* Edit Button for User Messages */}
              {isUser && (
                <button
                  onClick={() => {
                    setEditDraft(message.content);
                    setIsEditing(true);
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-white/50 transition hover:bg-white/15 hover:text-cyan-300"
                  title="एडिट करें"
                >
                  <Pencil size={12} />
                </button>
              )}

              {/* Speak Button for Assistant Messages */}
              {!isUser && (
                <button
                  onClick={handleSpeak}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-md transition hover:bg-white/15",
                    isSpeakingLocal ? "text-cyan-400 animate-pulse" : "text-white/50 hover:text-cyan-300"
                  )}
                  title={isSpeakingLocal ? "बोलना बंद करें" : "आवाज़ में सुनें"}
                >
                  <Volume2 size={12} />
                </button>
              )}

              {/* Retry / Regenerate Button for User Messages */}
              {isUser && (
                <button
                  onClick={handleRetry}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-white/50 transition hover:bg-white/15 hover:text-violet-300"
                  title="दोबारा चलाएं (Re-run)"
                >
                  <RotateCcw size={12} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
