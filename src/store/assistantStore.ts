import { create } from "zustand";
import { generateId, nowIso } from "@/lib/utils";
import type {
  AppSettings,
  ChatMessage,
  ControlSubTab,
  PendingConfirmation,
  ProcessInfo,
  Reminder,
  SystemStatus,
  TabName,
  Toast,
  TokenUsage,
  ToolsSubTab,
} from "@/types";

const defaultSettings: AppSettings = {
  theme: "dark",
  language: "hi",
  aiProvider: "groq",
  providerModels: {
    groq: "llama-3.3-70b-versatile",
    gemini: "gemini-2.0-flash",
    mistral: "mistral-small-latest",
    cerebras: "llama-3.3-70b",
    openrouter: "meta-llama/llama-3.3-70b-instruct:free",
    zai: "glm-4-flash",
    deepseek: "deepseek-chat",
  },
  apiKeys: {},
  systemPrompt: "You are Pika, a friendly personal AI assistant on the user's PC. Default language Hindi (Devanagari). Match the user's language. Keep replies short.",
  chatLanguageStyle: "auto",
  voiceSettings: { language: "hi-IN", speed: 1, pitch: 0 },
  bridgeUrl: "ws://localhost:8765",
  wakeWordEnabled: false,
  soundEffects: true,
  pipMode: false,
  particles: true,
  accentColor: "#00f0ff",
  secondaryAccentColor: "#ff00ff",
  customProviders: [],
  agentModeEnabled: false,
  sttEngine: "webspeech",
  ttsEngine: "edge",
  obsidianEnabled: false,
  obsidianUrl: "http://127.0.0.1:27123",
  obsidianApiKey: "",
};

interface AssistantState {
  // Connection
  isConnected: boolean;
  connectionStatus: "disconnected" | "connecting" | "connected" | "error";
  processes: ProcessInfo[];

  // Chat
  messages: ChatMessage[];
  isAiThinking: boolean;

  // Voice
  isListening: boolean;
  isSpeaking: boolean;
  partialTranscript: string;
  voiceWaveformData: number[];

  // System
  systemStatus: SystemStatus | null;

  // UI
  activeTab: TabName;
  controlSubTab: ControlSubTab;
  toolsSubTab: ToolsSubTab;
  sidebarExpanded: boolean;
  uiMode: import("@/types").UiMode;
  setUiMode: (m: import("@/types").UiMode) => void;

  // Data
  reminders: Reminder[];
  clipboardHistory: { id: string; content: string; at: string }[];
  commandsExecuted: number;
  nowMs: number;
  drives: { name: string; percent: number; free: number; total: number }[];
  setDrives: (d: { name: string; percent: number; free: number; total: number }[]) => void;
  activityLog: { id: string; text: string; at: number; icon: string }[];
  logActivity: (text: string, icon?: string) => void;

  // Settings
  settings: AppSettings;

  // API Health & Tokens
  apiHealth: Record<string, import("@/types").ProviderHealth>;
  setApiHealth: (provider: string, health: import("@/types").ProviderHealth) => void;
  tokenUsage: Record<string, TokenUsage>;
  addTokenUsage: (provider: string, usage: TokenUsage) => void;
  resetTokenUsage: () => void;

  // Active Engines
  activeSttEngine: string;
  activeTtsEngine: string;
  activeLlmEngine: string;
  setEngines: (stt: string, tts: string, llm: string) => void;

  // Data Loading
  loadAppData: (data: Partial<AssistantState>) => void;

  // Toasts & confirmation
  toasts: Toast[];
  pendingConfirmation: PendingConfirmation | null;

  // Actions
  setConnection: (status: AssistantState["connectionStatus"]) => void;
  setProcesses: (procs: ProcessInfo[]) => void;
  addMessage: (msg: Omit<ChatMessage, "id" | "timestamp"> & { id?: string }) => string;
  updateMessageContent: (id: string, content: string) => void;
  deleteMessage: (id: string) => void;
  appendToMessage: (id: string, chunk: string) => void;
  finalizeMessage: (id: string) => void;
  clearMessages: () => void;
  setAiThinking: (v: boolean) => void;
  setListening: (v: boolean) => void;
  setSpeaking: (v: boolean) => void;
  setPartial: (t: string) => void;
  setWaveform: (d: number[]) => void;
  setSystemStatus: (s: SystemStatus) => void;
  setActiveTab: (t: TabName) => void;
  setControlSubTab: (t: ControlSubTab) => void;
  setToolsSubTab: (t: ToolsSubTab) => void;
  toggleSidebar: () => void;
  updateSettings: (p: Partial<AppSettings>) => void;
  addToast: (t: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
  setPendingConfirmation: (c: PendingConfirmation | null) => void;
  addReminder: (r: Reminder) => void;
  updateReminder: (id: string, patch: Partial<Reminder>) => void;
  addClipboard: (content: string) => void;
  incCommands: () => void;
  tick: () => void;
}

export const useStore = create<AssistantState>()((set) => ({
      isConnected: false,
      connectionStatus: "disconnected",
  processes: [],

  messages: [
    {
      id: generateId(),
      role: "assistant",
      content:
        "नमस्ते! ⚡ मैं **पिका** हूँ — आपका निजी AI असिस्टेंट।\n\nमुझसे हिंदी, English या Hinglish में बात करें। जैसे: `open chrome`, `volume 50%`, `battery dikhao`, या कुछ भी पूछें!",
      timestamp: nowIso(),
      provider: "pika",
    },
  ],
  isAiThinking: false,

  isListening: false,
  isSpeaking: false,
  partialTranscript: "",
  voiceWaveformData: new Array(20).fill(0.1),

  systemStatus: null,

  activeTab: "chat",
  controlSubTab: "system",
  toolsSubTab: "calculator",
  sidebarExpanded: true,
  uiMode: "standard",
  setUiMode: (m) => set({ uiMode: m }),

  reminders: [],
  clipboardHistory: [],
  commandsExecuted: 0,
  nowMs: Date.now(),

  settings: defaultSettings,
  toasts: [],
  pendingConfirmation: null,

  setConnection: (status) =>
    set({ connectionStatus: status, isConnected: status === "connected" }),
  setProcesses: (procs) => set({ processes: procs }),

  addMessage: (msg) => {
    const id = msg.id ?? generateId();
    set((s) => ({
      messages: [...s.messages, { ...msg, id, timestamp: nowIso() }],
    }));
    return id;
  },
  updateMessageContent: (id, content) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, content } : m)),
    })),
  deleteMessage: (id) =>
    set((s) => ({
      messages: s.messages.filter((m) => m.id !== id),
    })),
  appendToMessage: (id, chunk) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + chunk, isStreaming: true } : m
      ),
    })),
  finalizeMessage: (id) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, isStreaming: false } : m)),
    })),
  clearMessages: () => set({ messages: [] }),
  setAiThinking: (v) => set({ isAiThinking: v }),
  setListening: (v) => set({ isListening: v }),
  setSpeaking: (v) => set({ isSpeaking: v }),
  setPartial: (t) => set({ partialTranscript: t }),
  setWaveform: (d) => set({ voiceWaveformData: d }),
  setSystemStatus: (s) => set({ systemStatus: s }),
  setActiveTab: (t) => set({ activeTab: t }),
  setControlSubTab: (t) => set({ controlSubTab: t }),
  setToolsSubTab: (t) => set({ toolsSubTab: t }),
  toggleSidebar: () => set((s) => ({ sidebarExpanded: !s.sidebarExpanded })),
  updateSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
  addToast: (t) =>
    set((s) => ({ toasts: [...s.toasts.slice(-4), { ...t, id: generateId() }] })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  setPendingConfirmation: (c) => set({ pendingConfirmation: c }),
  addReminder: (r) => set((s) => ({ reminders: [...s.reminders, r] })),
  updateReminder: (id, patch) =>
    set((s) => ({
      reminders: s.reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })),
  addClipboard: (content) =>
    set((s) => ({
      clipboardHistory: [
        { id: generateId(), content, at: nowIso() },
        ...s.clipboardHistory,
      ].slice(0, 50),
    })),
  incCommands: () => set((s) => ({ commandsExecuted: s.commandsExecuted + 1 })),
  tick: () => set({ nowMs: Date.now() }),
  apiHealth: {},
  setApiHealth: (provider, health) =>
    set((s) => ({ apiHealth: { ...s.apiHealth, [provider]: health } })),

  tokenUsage: (() => {
    try {
      const saved = localStorage.getItem("pika_token_usage");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  })(),
  addTokenUsage: (provider, usage) =>
    set((s) => {
      const prev = s.tokenUsage[provider] || { prompt: 0, completion: 0, total: 0 };
      const updated = {
        ...s.tokenUsage,
        [provider]: {
          prompt: prev.prompt + usage.prompt,
          completion: prev.completion + usage.completion,
          total: prev.total + usage.total,
        },
      };
      try {
        localStorage.setItem("pika_token_usage", JSON.stringify(updated));
      } catch {}
      return { tokenUsage: updated };
    }),
  resetTokenUsage: () =>
    set(() => {
      try {
        localStorage.removeItem("pika_token_usage");
      } catch {}
      return { tokenUsage: {} };
    }),

  drives: [],
  setDrives: (d) => set({ drives: d }),
  activityLog: [],
  logActivity: (text, icon = "⚡") =>
    set((s) => ({
      activityLog: [{ id: generateId(), text, at: Date.now(), icon }, ...s.activityLog].slice(0, 30),
    })),
    
  activeSttEngine: "None",
  activeTtsEngine: "None",
  activeLlmEngine: "None",
  setEngines: (stt, tts, llm) => set({ activeSttEngine: stt, activeTtsEngine: tts, activeLlmEngine: llm }),
  
  loadAppData: (data) => set((s) => {
    const mergedTokens = {
      ...s.tokenUsage,
      ...(data.tokenUsage || {}),
    };
    try {
      localStorage.setItem("pika_token_usage", JSON.stringify(mergedTokens));
    } catch {}
    return {
      ...s,
      ...data,
      tokenUsage: mergedTokens,
      settings: {
        ...s.settings,
        ...(data.settings || {}),
        providerModels: {
          ...(s.settings.providerModels || {}),
          ...(data.settings?.providerModels || {}),
        },
        customSubAgents: data.settings?.customSubAgents || s.settings.customSubAgents || [],
      }
    };
  }),
}));
