import { motion } from "framer-motion";
import { cn } from "@/utils/cn";
import type { ChatMessage as ChatMessageType } from "@/types";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { formatTime } from "@/lib/utils";

export function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="my-2 text-center">
        <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/40">{message.content}</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 text-sm">
          ⚡
        </div>
      )}
      <div className={cn("flex max-w-[78%] flex-col", isUser ? "items-end" : "items-start")}>
        <div
          className={cn("rounded-2xl px-4 py-2.5", !isUser && "glass-card text-white/90")}
          style={isUser ? { background: "linear-gradient(135deg, var(--accent), rgba(var(--accent-rgb),0.75))", color: "white" } : undefined}
        >
          <MarkdownRenderer content={message.content || "\u00a0"} />
          {message.isStreaming && (
            <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-cyan-400 align-middle" />
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 px-1 text-[10px] text-white/30">
          <span>{formatTime(message.timestamp)}</span>
          {!isUser && message.provider && message.provider !== "pika" && (
            <span className="rounded bg-white/5 px-1.5 py-0.5 uppercase">{message.provider}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
