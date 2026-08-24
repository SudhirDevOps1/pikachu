import { create } from "zustand";
import { generateId, nowIso } from "@/lib/utils";
import type {
  AppSettings,
  ChatMessage,
  ControlSubTab,
  PendingConfirmation,
  PomodoroState,
  ProcessInfo,
  QuickNote,
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
  nasaApiKey: "",
  ollamaUrl: "http://127.0.0.1:11434",
  appearance: {
    gridOpacity: 0.06,
    glassBlur: 30,
    fontScale: 1,
    animationSpeed: 1,
    showGrid: true,
    showScanline: true,
    hudBrightness: 1,
    orbScale: 1,
    particlePreset: "dots" as any,
    neuralPreset: "cyber" as any,
    nameStyle: "hinglish" as any,
  },
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
  scheduledJobs: any[];
  setScheduledJobs: (jobs: any[]) => void;

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

  // Notes & Pomodoro
  notes: QuickNote[];
  pomodoro: PomodoroState;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (v: boolean) => void;
  addNote: (n: Omit<QuickNote, "id" | "createdAt" | "updatedAt">) => string;
  updateNote: (id: string, patch: Partial<QuickNote>) => void;
  deleteNote: (id: string) => void;
  togglePinNote: (id: string) => void;
  setPomodoro: (patch: Partial<PomodoroState>) => void;
  tickPomodoro: () => void;

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

  activeTab: (() => { try { const v = localStorage.getItem("pika_activeTab") as any; return v && ["chat","notes","controls","tools","macros","reminders","processes","scheduler","settings"].includes(v) ? v : "chat"; } catch { return "chat"; } })() as any,
  controlSubTab: "system",
  toolsSubTab: "calculator",
  sidebarExpanded: (() => { try { return localStorage.getItem("pika_sidebarExpanded") === "true" ? true : false; } catch { return false; } })(),
  uiMode: (() => { try { const v = localStorage.getItem("pika_uiMode") as any; return v==="futurist"||v==="standard" ? v : "standard"; } catch { return "standard"; } })() as any,
  setUiMode: (m) => {
    try { localStorage.setItem("pika_uiMode", m); } catch {}
    set({ uiMode: m });
  },

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
  setActiveTab: (t) => { try { localStorage.setItem("pika_activeTab", t); } catch {} ; set({ activeTab: t }); },
  setControlSubTab: (t) => set({ controlSubTab: t }),
  setToolsSubTab: (t) => set({ toolsSubTab: t }),
  toggleSidebar: () => set((s) => { const v = !s.sidebarExpanded; try { localStorage.setItem("pika_sidebarExpanded", String(v)); } catch {} ; return { sidebarExpanded: v }; }),
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
  scheduledJobs: [],
  setScheduledJobs: (jobs) => set({ scheduledJobs: jobs }),
    
  activeSttEngine: "None",
  activeTtsEngine: "None",
  activeLlmEngine: "None",
  setEngines: (stt, tts, llm) => set({ activeSttEngine: stt, activeTtsEngine: tts, activeLlmEngine: llm }),

  notes: (() => { try { const v = localStorage.getItem("pika_notes"); return v ? JSON.parse(v) : []; } catch { return []; } })(),
  pomodoro: (() => { try { const v = localStorage.getItem("pika_pomodoro"); return v ? JSON.parse(v) : { status:"idle", mode:"focus", remainingSec:25*60, focusMin:25, breakMin:5, completedSessions:0 }; } catch { return { status:"idle", mode:"focus", remainingSec:25*60, focusMin:25, breakMin:5, completedSessions:0 }; } })(),
  commandPaletteOpen: false,
  setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),
  addNote: (n) => {
    const id = generateId();
    const now = nowIso();
    const note: QuickNote = { id, createdAt: now, updatedAt: now, pinned: false, ...n };
    set((s) => {
      const next = [note, ...s.notes];
      try { localStorage.setItem("pika_notes", JSON.stringify(next.slice(0,200))); } catch {}
      return { notes: next };
    });
    return id;
  },
  updateNote: (id, patch) => set((s) => {
    const next = s.notes.map((x) => x.id===id ? { ...x, ...patch, updatedAt: nowIso() } : x);
    try { localStorage.setItem("pika_notes", JSON.stringify(next)); } catch {}
    return { notes: next };
  }),
  deleteNote: (id) => set((s) => {
    const next = s.notes.filter((x)=>x.id!==id);
    try { localStorage.setItem("pika_notes", JSON.stringify(next)); } catch {}
    return { notes: next };
  }),
  togglePinNote: (id) => set((s) => {
    const next = s.notes.map((x)=> x.id===id ? { ...x, pinned: !x.pinned } : x).sort((a,b)=> Number(!!b.pinned)-Number(!!a.pinned));
    try { localStorage.setItem("pika_notes", JSON.stringify(next)); } catch {}
    return { notes: next };
  }),
  setPomodoro: (patch) => set((s) => {
    const next = { ...s.pomodoro, ...patch };
    try { localStorage.setItem("pika_pomodoro", JSON.stringify(next)); } catch {}
    return { pomodoro: next };
  }),
  tickPomodoro: () => set((s) => {
    const p = s.pomodoro;
    if (p.status!=="focus" && p.status!=="break") return s as any;
    if (p.remainingSec<=1) {
      const wasFocus = p.mode==="focus";
      const nextMode = wasFocus ? "break" : "focus";
      const nextSec = wasFocus ? p.breakMin*60 : p.focusMin*60;
      const completed = wasFocus ? p.completedSessions+1 : p.completedSessions;
      const next = { ...p, mode: nextMode, status: nextMode as any, remainingSec: nextSec, completedSessions: completed } as PomodoroState;
      try { localStorage.setItem("pika_pomodoro", JSON.stringify(next)); } catch {}
      // toast + notification
      try { const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAAA=="); audio.volume=0.6; audio.play().catch(()=>{});} catch {}
      return { pomodoro: next } as any;
    }
    const next = { ...p, remainingSec: p.remainingSec-1 };
    return { pomodoro: next } as any;
  }),
  
  loadAppData: (data) => set((s) => {
    // Restore UI mode without refresh — persist across reloads
    if ((data as any).uiMode && ["standard","futurist"].includes((data as any).uiMode)) {
      try { localStorage.setItem("pika_uiMode", (data as any).uiMode); } catch {}
    }
    if ((data as any).activeTab) {
      try { localStorage.setItem("pika_activeTab", (data as any).activeTab); } catch {}
    }
    if (typeof (data as any).sidebarExpanded === "boolean") {
      try { localStorage.setItem("pika_sidebarExpanded", String((data as any).sidebarExpanded)); } catch {}
    }
    // Validate: only allow known keys, block bridgeUrl hijack and message injection
    const allowedSettingsKeys = new Set(["theme","language","aiProvider","providerModels","apiKeys","systemPrompt","chatLanguageStyle","voiceSettings","bridgeUrl","wakeWordEnabled","soundEffects","pipMode","particles","accentColor","secondaryAccentColor","customProviders","agentModeEnabled","sttEngine","ttsEngine","obsidianEnabled","obsidianUrl","obsidianApiKey","nasaApiKey","ollamaUrl","customSubAgents","appearance"]);
    const safeSettings: any = {};
    if (data.settings && typeof data.settings === "object") {
      for (const k of Object.keys(data.settings)) {
        if (allowedSettingsKeys.has(k)) safeSettings[k] = (data.settings as any)[k];
      }
      // Strict validate bridgeUrl scheme
      if (safeSettings.bridgeUrl && !/^wss?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?\/?$/.test(safeSettings.bridgeUrl)) {
        delete safeSettings.bridgeUrl;
      }
    }
    // Sanitize messages — cap 200, strip javascript: links
    let safeMessages = s.messages;
    if (Array.isArray(data.messages)) {
      safeMessages = (data.messages as any[]).slice(-200).map((m:any)=>({
        id: String(m.id||""), role: (["user","assistant","system"].includes(m.role)?m.role:"assistant"), content: String(m.content||"").slice(0,8000), timestamp: m.timestamp, provider: m.provider
      }));
    }
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
      messages: safeMessages,
      tokenUsage: mergedTokens,
      settings: {
        ...s.settings,
        ...safeSettings,
        providerModels: {
          ...(s.settings.providerModels || {}),
          ...(safeSettings?.providerModels || {}),
        },
        customSubAgents: safeSettings?.customSubAgents || s.settings.customSubAgents || [],
        appearance: {
          ...(s.settings.appearance || (defaultSettings as any).appearance),
          ...(safeSettings?.appearance || {}),
        },
      }
    };
  }),
}));
