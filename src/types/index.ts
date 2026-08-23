// ============================================================================
// Pika AI Assistant — Shared TypeScript interfaces for all WebSocket messages
// ============================================================================

export interface CustomProvider {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface WSMessage {
  type: "command" | "query" | "agent_action" | "config" | "voice_start" | "voice_stop" | "tts_speak" | "cancel" | "ping" | "save_data" | "load_data" | "clear_data";
  category?: string;
  action?: string;
  params?: Record<string, unknown>;
  data?: unknown;
  id: string;
  timestamp: string;
}

export interface WSResponse {
  type: "response";
  status: "success" | "error" | "confirmation_required";
  data?: unknown;
  message: string;
  confirmation_id?: string | null;
  id: string;
  timestamp: string;
}

export interface WSEvent {
  type: "event";
  event: string;
  data: unknown;
  timestamp: string;
}

export interface WSLLMStream {
  type: "llm_stream";
  chunk: string;
  provider: string;
  id: string;
  done: boolean;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  timestamp: string;
}

export type WSIncoming = WSResponse | WSEvent | WSLLMStream;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  provider?: string;
  isStreaming?: boolean;
}

export interface SystemStatus {
  cpu: number;
  ram: number;
  battery: { percent: number; plugged: boolean } | null;
}

export interface Toast {
  id: string;
  type: "success" | "error" | "info" | "warning";
  message: string;
  duration?: number;
}

export interface PendingConfirmation {
  id: string;
  message: string;
  originalCommand: WSMessage;
}

export interface Reminder {
  id: string;
  text: string;
  triggerAt: number;
  status: "active" | "triggered" | "cancelled";
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  ram: number;
  status: string;
}

export interface AppSettings {
  theme: "dark" | "light";
  language: "hi" | "en";
  aiProvider: string;
  providerModels: Record<string, string>;
  apiKeys: Record<string, string>;
  systemPrompt: string;
  voiceSettings: {
    language: string;
    speed: number;
    pitch: number;
  };
  sttEngine?: "webspeech" | "whisper" | "vosk";
  ttsEngine?: "edge" | "webspeech" | "piper" | "pyttsx3" | "none";
  bridgeUrl: string;
  wakeWordEnabled: boolean;
  soundEffects: boolean;
  pipMode: boolean;
  particles: boolean;
  accentColor: string;
  secondaryAccentColor: string;
  customProviders: CustomProvider[];
  customSubAgents?: CustomSubAgent[];
  agentModeEnabled: boolean;
  obsidianEnabled: boolean;
  obsidianUrl: string;
  obsidianApiKey: string;
}

export interface CustomSubAgent {
  id: string;
  name: string;
  role: string;
  desc: string;
  provider: string;
  model: string;
  systemPrompt?: string;
  tools: string[];
  enabled: boolean;
}

export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

export type ApiHealthStatus = "unknown" | "checking" | "ok" | "error";

export interface ProviderHealth {
  status: ApiHealthStatus;
  latencyMs?: number;
  error?: string;
  checkedAt?: string;
  models?: string[];
}

// User-defined custom AI provider (fully OpenAI-compatible endpoint)
export interface CustomProvider {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export type UiMode = "standard" | "futurist";

export type TabName =
  | "chat"
  | "controls"
  | "settings"
  | "macros"
  | "reminders"
  | "processes"
  | "scheduler"
  | "tools";

export type ControlSubTab =
  | "system"
  | "apps"
  | "media"
  | "files"
  | "clipboard"
  | "info"
  | "web"
  | "screen"
  | "network"
  | "music"
  | "disk";

export type ToolsSubTab =
  | "files"
  | "ocr"
  | "pdf"
  | "image"
  | "qrcode"
  | "calculator"
  | "translator"
  | "password"
  | "text_expand";
