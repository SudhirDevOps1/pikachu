import { useCallback, useEffect, useRef } from "react";
import { useStore } from "@/store/assistantStore";
import { parseCommand } from "@/lib/commandEngine";
import { generateId, nowIso } from "@/lib/utils";
import { sounds } from "@/lib/soundEffects";
import type { WSIncoming, WSMessage } from "@/types";

// ============================================================================
// useAssistant — central brain. Connects to the Python bridge over WebSocket.
// so the whole UI remains fully interactive.
// ============================================================================

const RECONNECT_MAX = 30000;

// Emoji icons per command category — used in the live activity feed
const ICON_FOR_CATEGORY: Record<string, string> = {
  system: "🖥️", apps: "🚀", volume: "🔊", media: "🎵", files: "📁",
  clipboard: "📋", info: "📊", web: "🌐", screen: "📸", processes: "⚙️",
  network: "📡", reminders: "⏰", calculator: "🧮", password: "🔐",
  translator: "🌍", weather: "🌤️", qrcode: "📱", ocr: "👁️", disk: "💾",
  config: "🎛️", music: "🎧",
};

export function useAssistant() {
  const ws = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef(1000);
  const reconnectTimer = useRef<number | null>(null);
  const streamId = useRef<string | null>(null);
  const lastSpokenRef = useRef<{ text: string; time: number }>({ text: "", time: 0 });
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsQueueRef = useRef<string[]>([]);

  const store = useStore;

  const speakWithBrowser = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      const clean = text.replace(/[*_`#\>\[\]]/g, "").replace(/https?:\/\/\S+/g, "").trim();
      if (!clean) return;
      const u = new SpeechSynthesisUtterance(clean);
      const voiceLang = store.getState().settings.voiceSettings.language || "hi-IN";
      u.lang = voiceLang;
      u.rate = store.getState().settings.voiceSettings.speed || 1;
      u.pitch = store.getState().settings.voiceSettings.pitch || 0;

      const voices = window.speechSynthesis.getVoices();
      const match = voices.find(
        (v) =>
          v.lang.startsWith(voiceLang.slice(0, 2)) ||
          v.name.toLowerCase().includes("swara") ||
          v.name.toLowerCase().includes("natural") ||
          v.name.toLowerCase().includes("google") ||
          v.name.toLowerCase().includes("hindi") ||
          v.name.toLowerCase().includes("india")
      );
      if (match) u.voice = match;

      store.getState().setSpeaking(true);
      u.onend = () => {
        const q: string[] = ttsQueueRef.current;
        if (q.length > 0) {
          const next = q.shift()!;
          ttsQueueRef.current = q;
          window.setTimeout(() => speakWithBrowser(next), 120);
        } else {
          store.getState().setSpeaking(false);
          ttsQueueRef.current = [];
        }
      };
      u.onerror = () => {
        const q: string[] = ttsQueueRef.current;
        if (q.length > 0) {
          const next = q.shift()!;
          ttsQueueRef.current = q;
          speakWithBrowser(next);
        } else {
          store.getState().setSpeaking(false);
        }
      };
      window.speechSynthesis.speak(u);
    } catch {
      store.getState().setSpeaking(false);
    }
  }, [store]);

  const triggerTTS = useCallback(
    (text: string, _msgId?: string) => {
      const clean = text.trim();
      if (!clean) return;
      const now = Date.now();
      // Robust dedup: block identical text OR same 40-char prefix within 6s
      // This catches rapid double-invoke (StrictMode, duplicate llm_stream done, double click)
      const prev = lastSpokenRef.current.text;
      const isSame = prev === clean;
      const isPrefixDup =
        clean.length > 20 &&
        prev.length > 20 &&
        (prev.startsWith(clean.slice(0, 40)) || clean.startsWith(prev.slice(0, 40)));
      if ((isSame || isPrefixDup) && now - lastSpokenRef.current.time < 6000) {
        console.log("[TTS] dedup blocked duplicate:", clean.slice(0, 50));
        return;
      }
      lastSpokenRef.current = { text: clean, time: now };

      // Stop previous audio playback & browser speech synthesis immediately — atomic
      if (currentAudioRef.current) {
        try { currentAudioRef.current.pause(); } catch {}
        currentAudioRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try { window.speechSynthesis.cancel(); } catch {}
      }

      const ttsEngine = store.getState().settings.ttsEngine || "edge";
      if (ttsEngine === "none") return;
      if (ttsEngine === "webspeech") {
        speakWithBrowser(clean);
        return;
      }
      if (ws.current?.readyState === WebSocket.OPEN) {
        const lang = store.getState().settings.voiceSettings.language || "hi-IN";
        const voice = lang === "en-US" ? "en-US-JennyNeural" : "hi-IN-SwaraNeural";
        ws.current.send(JSON.stringify({ type: "tts_speak", params: { text: clean, voice, engine: ttsEngine } }));
      } else {
        speakWithBrowser(clean);
      }
    },
    [speakWithBrowser, store]
  );

  const streamText = useCallback((text: string, provider = "pika") => {
    const id = store.getState().addMessage({ role: "assistant", content: "", provider, isStreaming: true });
    const words = text.split(/(\s+)/);
    let i = 0;
    store.getState().setAiThinking(false);
    const tick = () => {
      if (i >= words.length) {
        store.getState().finalizeMessage(id);
        return;
      }
      store.getState().appendToMessage(id, words[i]);
      i++;
      window.setTimeout(tick, 18 + Math.random() * 30);
    };
    tick();
  }, [store]);

  // Process a user text input (from typing or voice)
  const lastInputRef = useRef({ text: "", time: 0 });
  const spokenMessageIds = useRef<Set<string>>(new Set());

  // additive — prompt-injection shield (bina kuchh hataye)
  const isInjection = useCallback((t: string) => {
    const low = t.toLowerCase();
    const patterns = ["ignore previous instructions", "you are now dan", "reveal system prompt", "delete all user data", "do anything now", "system override", "jailbreak"];
    return patterns.some((p) => low.includes(p));
  }, []);
  const processInput = useCallback(
    (text: string) => {
      const cleanText = text.trim();
      if (!cleanText) return;
      if (isInjection(cleanText)) {
        store.getState().addToast({ type: "error", message: "⚠️ Suspicious prompt blocked (injection filter)" });
        store.getState().addMessage({ id: generateId(), role: "assistant", content: "⚠️ यह अनुरोध सुरक्षा कारणों से ब्लॉक किया गया। कृपया सामान्य भाषा में पूछें।" });
        try { const m="blocked injection: "+cleanText.slice(0,80); const a=JSON.parse(localStorage.getItem("pika_audit")||"[]"); a.push({at:Date.now(),event:"injection_blocked",msg:m}); localStorage.setItem("pika_audit", JSON.stringify(a.slice(-200))); } catch {}
        return;
      }
      
      const state = store.getState();
      // Block input if AI is currently thinking or streaming a response
      if (state.isAiThinking || state.messages.some((m) => m.isStreaming)) {
        state.addToast({ type: "warning", message: "कृपया पिछले जवाब का इंतज़ार करें... (Please wait)" });
        return;
      }

      const now = Date.now();
      if (lastInputRef.current.text === cleanText && now - lastInputRef.current.time < 1200) {
        console.log("Skipping duplicate rapid input:", cleanText);
        return;
      }
      lastInputRef.current = { text: cleanText, time: now };

      store.getState().addMessage({ id: generateId(), role: "user", content: cleanText });
    store.getState().incCommands();

    let result = parseCommand(text);
    const isAgentMode = store.getState().settings.agentModeEnabled;

    if (isAgentMode && result.parsed) {
      // In Agent Mode, pass web searches, research, complex file creation to autonomous Agent Loop
      // BUT: always allow direct hardware + direct media/app/web commands to pass through
      const ALWAYS_ALLOW = ["volume", "screen", "system", "apps", "app", "media", "web", "weather", "reminders", "reminder", "keyboard", "window"];
      const isAllowed = ALWAYS_ALLOW.includes(result.parsed.category);
      const isResearch = text.toLowerCase().includes("summary") || text.toLowerCase().includes("research");
      if (!isAllowed || isResearch) {
        result = { parsed: null, reply: "", isLLM: true };
      }
    }

    if (result.parsed && result.parsed.needsConfirmation) {
      store.getState().setPendingConfirmation({
        id: generateId(),
        message: result.reply,
        originalCommand: {
          type: "command",
          category: result.parsed.category,
          action: result.parsed.action,
          params: result.parsed.params,
          id: generateId(),
          timestamp: nowIso(),
        },
      });
      return;
    }

    if (result.parsed) {
      // Non-confirmation command
      if (result.openUrl) {
        window.open(result.openUrl, "_blank", "noopener");
      }
      // Log the action to the live activity feed (PiP + HUD)
      store.getState().logActivity(
        `${result.parsed.category}/${result.parsed.action}`,
        ICON_FOR_CATEGORY[result.parsed.category] ?? "⚡"
      );
      if (result.toast) store.getState().addToast(result.toast);
      if (result.parsed.category === "config" && result.parsed.action === "switch_provider") {
        store.getState().updateSettings({ aiProvider: String(result.parsed.params.provider) });
      }
      // UI voice control — bina backend ke local
      if (result.parsed.category === "ui") {
        const a = result.parsed.action;
        const p = result.parsed.params as any;
        if (a === "switch_mode" && (p.mode === "futurist" || p.mode === "standard")) {
          store.getState().setUiMode(p.mode);
          if (p.mode === "futurist") store.getState().addToast({ type: "success", message: "🌌 Futurist Mode ON" });
        } else if (a === "clear_chat") {
          store.getState().clearMessages();
        } else if (a === "open_tab" && p.tab) {
          store.getState().setActiveTab(p.tab);
          store.getState().setUiMode("standard");
        } else if (a === "toggle_theme") {
          const cur = store.getState().settings.theme;
          const nxt = cur === "dark" ? "light" : "dark";
          store.getState().updateSettings({ theme: nxt });
          document.documentElement.classList.toggle("theme-light", nxt === "light");
        }
        sounds.success();
        if (result.reply) triggerTTS(result.reply);
        return;
      }
      sounds.success();

      // Send to backend if connected
      const connected = store.getState().isConnected;
      if (connected && ws.current?.readyState === WebSocket.OPEN) {
        if (result.reply) {
          triggerTTS(result.reply);
        }
        const msg: WSMessage = {
          type: "command",
          category: result.parsed.category,
          action: result.parsed.action,
          params: result.parsed.params,
          id: generateId(),
          timestamp: nowIso(),
        };
        ws.current.send(JSON.stringify(msg));
      } else {
        store.getState().addToast({ type: "error", message: "ब्रिज कनेक्ट नहीं है (PC Bridge is off)!" });
        streamText("कृपया PC Bridge चालू करें, बिना इसके मैं कमांड्स नहीं चला सकता।", "pika");
      }
      return;
    }

    // ── Quick replies (isLLM:false, parsed:null) — show immediately, no LLM call ──
    // e.g. "kaise ho", "bye", "shukriya", "tera naam kya hai"
    if (!result.isLLM && result.reply) {
      streamText(result.reply, "pika");
      triggerTTS(result.reply);
      return;
    }

    // No command matched → conversation → LLM
    store.getState().setAiThinking(true);
    const connected = store.getState().isConnected;
    if (connected && ws.current?.readyState === WebSocket.OPEN) {
      const provider = store.getState().settings.aiProvider || "groq";
      const apiKey = store.getState().settings.apiKeys[provider] || "";
      const systemPrompt = store.getState().settings.systemPrompt;
      const history = store.getState().messages
        .filter((m) => m.role !== "system" && m.content)
        .slice(-20) // send only last 20 messages for context window
        .map((m) => ({ role: m.role, content: m.content }));

      const isAgentMode = store.getState().settings.agentModeEnabled;
      const msgType = isAgentMode ? "agent_action" : "query";

      const msg: WSMessage = {
        type: msgType,
        params: { 
          text, 
          provider, 
          api_key: apiKey, 
          api_keys: store.getState().settings.apiKeys,
          provider_models: store.getState().settings.providerModels || {},
          custom_providers: store.getState().settings.customProviders || [],
          system_prompt: systemPrompt, 
          chatLanguageStyle: store.getState().settings.chatLanguageStyle || "auto",
          history,
          obsidianEnabled: store.getState().settings.obsidianEnabled,
          obsidianUrl: store.getState().settings.obsidianUrl,
          obsidianApiKey: store.getState().settings.obsidianApiKey
        },
        id: generateId(),
        timestamp: nowIso(),
      };
      streamId.current = msg.id;
      ws.current.send(JSON.stringify(msg));
    } else {
      store.getState().setAiThinking(false);
      store.getState().addToast({ type: "error", message: "ब्रिज कनेक्ट नहीं है (PC Bridge is off)!" });
      streamText("कृपया मुझे इंटरनेट और बैकएंड से जोड़ने के लिए PC Bridge चालू करें।", "pika");
    }
  }, [store, streamText, triggerTTS]);

  // Approve/reject confirmation
  const resolveConfirmation = useCallback((approve: boolean) => {
    const pc = store.getState().pendingConfirmation;
    store.getState().setPendingConfirmation(null);
    if (!pc) return;
    if (approve) {
      sounds.success();
      store.getState().addToast({ type: "success", message: "कमांड निष्पादित" });
      if (store.getState().isConnected && ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify(pc.originalCommand));
      }
      streamText("✅ किया गया! कमांड सफलतापूर्वक निष्पादित हुई।", "pika");
    } else {
      sounds.error();
      store.getState().addToast({ type: "info", message: "रद्द किया गया" });
      streamText("❌ ठीक है, रद्द कर दिया।", "pika");
    }
  }, [store, streamText]);

  // Handle incoming WS messages
  const handleMessage = useCallback((raw: string) => {
    let msg: WSIncoming;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.type === "event") {
      switch (msg.event) {
        case "connection_ready":
          store.getState().setConnection("connected");
          if (msg.data && typeof msg.data === "object" && "engines" in msg.data) {
            const engines = (msg.data as any).engines;
            store.getState().setEngines(engines.stt, engines.tts, engines.llm);
          }
          // Persist WS token for LAN auth (additive, not enforcing yet)
          if (msg.data && typeof msg.data === "object" && "ws_token" in msg.data) {
            try { localStorage.setItem("pika_ws_token", (msg.data as any).ws_token); } catch {}
            // Auto-auth
            if (ws.current?.readyState === WebSocket.OPEN) {
              ws.current.send(JSON.stringify({ type: "auth", token: (msg.data as any).ws_token }));
            }
          }
          if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: "load_data" }));
            // If we already had a stored token, send it too
            try {
              const stored = localStorage.getItem("pika_ws_token");
              if (stored) ws.current.send(JSON.stringify({ type: "auth", token: stored }));
            } catch {}
          }
          break;
        case "system_status":
          store.getState().setSystemStatus(msg.data as never);
          break;
        case "voice_partial":
          store.getState().setPartial((msg.data as { text: string }).text ?? "");
          break;
        case "voice_final":
          store.getState().setPartial("");
          processInput((msg.data as { text: string }).text ?? "");
          break;
        case "tts_started":
          store.getState().setSpeaking(true);
          break;
        case "tts_ended":
          // NOTE: Don't setSpeaking(false) here — backend sends this immediately after
          // generating audio, but the browser hasn't finished PLAYING the audio yet.
          // audio.onended in the tts_audio handler correctly sets speaking=false.
          break;
        case "reminder_triggered":
          sounds.notification();
          store.getState().addToast({ type: "warning", message: `⏰ ${(msg.data as { text: string }).text}` });
          break;
        case "battery_alert":
          store.getState().addToast({ type: "warning", message: "🔋 बैटरी कम है!" });
          break;
        case "wake_word":
          sounds.notification();
          store.getState().addToast({ type: "info", message: "🎙️ Wake word detected — सुन रहा हूँ!" });
          break;
        case "shortcut_executed":
          sounds.success();
          store.getState().addToast({
            type: "success",
            message: `⚡ ${(msg.data as { message: string }).message}`,
          });
          break;
        case "agent_tool_start":
          store.getState().logActivity(`Agent Tool: ${(msg.data as { tool: string }).tool}`, "🤖");
          store.getState().addToast({
            type: "info",
            message: `🤖 Agent is using tool: ${(msg.data as { tool: string }).tool}`,
          });
          break;
        case "agent_tool_end":
          if ((msg.data as { error?: boolean }).error) {
             store.getState().addToast({ type: "error", message: `⚠️ Agent tool error: ${(msg.data as { tool: string }).tool}` });
          } else {
             store.getState().addToast({ type: "success", message: `✅ Agent tool finished: ${(msg.data as { tool: string }).tool}` });
          }
          break;
        case "tts_audio": {
          // Backend sent base64 audio (Edge TTS mp3 / piper wav) — play it
          try {
            if (typeof window !== "undefined" && "speechSynthesis" in window) {
              window.speechSynthesis.cancel();
            }
            if (currentAudioRef.current) {
              currentAudioRef.current.pause();
              currentAudioRef.current = null;
            }
            const d = msg.data as { audio: string; format: string };
            const mime = (d.format && d.format.includes("wav")) ? "audio/wav" : "audio/mpeg";
            const audio = new Audio(`data:${mime};base64,${d.audio}`);
            currentAudioRef.current = audio;
            store.getState().setSpeaking(true);
            audio.onended = () => {
              currentAudioRef.current = null;
              const q: string[] = ttsQueueRef.current;
              if (q.length > 0) {
                const next = q.shift()!;
                ttsQueueRef.current = q;
                // Slight gap between sentences
                window.setTimeout(() => triggerTTS(next), 180);
              } else {
                store.getState().setSpeaking(false);
                ttsQueueRef.current = [];
              }
            };
            audio.onpause = () => {
              // If paused for next queue, don't mark not speaking yet
              const q: string[] = ttsQueueRef.current;
              if (q.length === 0) store.getState().setSpeaking(false);
            };
            audio.play().catch((err) => {
              console.warn("Audio play rejected:", err);
              const q: string[] = ttsQueueRef.current;
              if (q.length > 0) {
                const next = q.shift()!;
                ttsQueueRef.current = q;
                triggerTTS(next);
              } else {
                store.getState().setSpeaking(false);
              }
            });
          } catch {
            store.getState().setSpeaking(false);
          }
          break;
        }
        case "tts_fallback_webspeech": {
          const d = msg.data as { text?: string };
          if (d?.text) {
            speakWithBrowser(d.text);
          }
          break;
        }
      }
    } else if (msg.type === "llm_stream") {
      const curId = msg.id;
      if (!curId) return;
      // Dedup: if same llm_stream id already marked spoken, ignore duplicate done (prevents double TTS from provider fallback retry)
      if (msg.done && spokenMessageIds.current.has(curId)) {
        console.log("[TTS] llm_stream dedup: already spoken id", curId);
        return;
      }
      if (!store.getState().messages.find((m) => m.id === curId)) {
        store.getState().addMessage({ id: curId, role: "assistant", content: "", provider: msg.provider, isStreaming: true });
        store.getState().setAiThinking(false);
      }
      if (msg.done) {
        if (msg.chunk) {
          store.getState().appendToMessage(curId, msg.chunk);
        }
        if (msg.usage) {
          store.getState().addTokenUsage(msg.provider, {
            prompt: msg.usage.prompt_tokens,
            completion: msg.usage.completion_tokens,
            total: msg.usage.total_tokens,
          });
        }
        store.getState().finalizeMessage(curId);
        store.getState().setAiThinking(false);
        // Mark as spoken BEFORE trigger to block racing duplicates
        spokenMessageIds.current.add(curId);
        // Prevent unbounded growth — keep last 50 ids
        if (spokenMessageIds.current.size > 50) {
          const first = spokenMessageIds.current.values().next().value;
          if (first) spokenMessageIds.current.delete(first);
        }
        const msgObj = store.getState().messages.find((m) => m.id === curId);
        // FIX: content already includes chunk after append, don't add chunk again (was causing duplicated tail)
        const fullText = msgObj?.content || "";
        if (fullText.trim()) {
          // Sentence-aware chunking: split into sentences, queue via backend tts_audio (no 300-char cut for long answers)
          const normalized = fullText
            .replace(/[*#`_~>\[\]]/g, "")
            .replace(/https?:\/\/\S+/g, "")
            .replace(/\n+/g, " ")
            .trim();
          // Split on sentence boundaries (Hindi danda । + . ! ?) keep delimiters, fallback to 300-char slices
          const sentences = normalized.match(/[^।.!?]+[।.!?]+|[^।.!?]+$/g) || [normalized];
          const chunks: string[] = [];
          let buf = "";
          for (const s of sentences) {
            const cand = (buf ? buf + " " : "") + s.trim();
            if (cand.length > 320 && buf) {
              chunks.push(buf.trim());
              buf = s.trim();
            } else {
              buf = cand;
            }
          }
          if (buf) chunks.push(buf.trim());
          // Send chunks sequentially via tts_queue to avoid overlap; first chunk immediate, rest via tts_audio onended chain
          if (chunks.length > 0) {
            // Store queue in ref so tts_audio onended can continue
            ttsQueueRef.current = chunks.slice(1);            triggerTTS(chunks[0], curId);
          }
        }
        streamId.current = null;
      } else {
        store.getState().appendToMessage(curId, msg.chunk);
      }

    } else if ((msg as any).type === "app_data") {
      if ((msg as any).data) {
        store.getState().loadAppData((msg as any).data);
      }
    } else if ((msg as any).type === "test_provider_result") {
      const p = (msg as any).provider;
      const res = (msg as any).data;
      if (p && res) {
        store.getState().setApiHealth(p, res);
      }
    } else if ((msg as any).type === "response") {
      const data = msg.data as any;
      const isSilentPoll = !!(data && Array.isArray(data.drives)) || (msg.message && /ड्राइव मिले|drives/i.test(msg.message) && data?.drives);
      if (data && Array.isArray(data.drives)) {
        store.getState().setDrives(data.drives);
        if (isSilentPoll) return; // silent HUD refresh — no chat spam (fixed bar-bar drive)
      }
      if (data && Array.isArray(data.items) && msg.message === "प्रोसेस सूची") {
        store.getState().setProcesses(data.items);
        return; // silent process poll
      }
      if (msg.status === "error") {
        store.getState().addToast({ type: "error", message: msg.message });
      } else if (msg.message) {
        if (isSilentPoll) return;
        // Only show in UI — do NOT call triggerTTS (would double-speak with processInput's TTS)
        streamText(msg.message, "pika");
      }
    }
  }, [store, processInput, streamText]);

  const connect = useCallback(() => {
    // Guard: don't create duplicate socket if already connecting/connected
    if (ws.current && (ws.current.readyState === WebSocket.CONNECTING || ws.current.readyState === WebSocket.OPEN)) {
      console.log("[WS] already connected/connecting, skip duplicate connect");
      return;
    }
    // Auto-connect via link: ?bridge=wss://...&token=xxx overrides bridgeUrl for this session (no delete, additive)
    let url = store.getState().settings.bridgeUrl;
    try {
      const sp = new URLSearchParams(window.location.search);
      const qBridge = sp.get("bridge");
      const qToken = sp.get("token");
      if (qBridge && /^wss?:\/\/.+/i.test(qBridge)) {
        url = qBridge;
        // Persist for reload
        try { localStorage.setItem("pika_cf_tunnel_url", qBridge); } catch {}
        if (qToken) { try { localStorage.setItem("pika_ws_token", qToken); } catch {} }
        console.log("[WS] auto-connect via link bridge:", url);
        // Clean URL (keep shareable link copy in settings)
        try { window.history.replaceState({}, "", window.location.pathname); } catch {}
      } else {
        // Also check localStorage tunnel url if set and not localhost
        const savedTunnel = localStorage.getItem("pika_cf_tunnel_url");
        if (savedTunnel && /^wss?:\/\/.+/i.test(savedTunnel) && !url.includes("trycloudflare") && !url.includes("tailnet")) {
          // Don't auto-override localhost if user explicitly wants LAN — only if bridge is default localhost
          if (url === "ws://localhost:8765" || url.includes("localhost")) {
            // keep localhost by default for LAN, tunnel only via ?bridge= link (explicit)
          }
        }
      }
    } catch {}
    if (!url) url = "ws://localhost:8765";
    store.getState().setConnection("connecting");
    try {
      const socket = new WebSocket(url);
      ws.current = socket;
      const failTimer = window.setTimeout(() => {
        if (socket.readyState !== WebSocket.OPEN) {
          socket.close();
        }
      }, 12000);

      socket.onopen = () => {
        window.clearTimeout(failTimer);
        reconnectDelay.current = 1000;
        store.getState().setConnection("connected");
        sounds.connect();
        store.getState().addToast({ type: "success", message: "🔗 ब्रिज से कनेक्ट हो गया" });
      };
      socket.onmessage = (e) => handleMessage(typeof e.data === "string" ? e.data : "");
      socket.onerror = () => {
        // handled by onclose
      };
      socket.onclose = () => {
        if (ws.current && ws.current !== socket) return;
        window.clearTimeout(failTimer);
        const wasConnected = store.getState().isConnected;
        store.getState().setConnection("disconnected");
        if (wasConnected) {
          store.getState().addToast({ type: "warning", message: "ब्रिज डिसकनेक्ट हो गया।" });
        }
        // exponential backoff reconnect
        reconnectTimer.current = window.setTimeout(() => {
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, RECONNECT_MAX);
          connect();
        }, reconnectDelay.current);
      };
    } catch {
      store.getState().setConnection("error");
    }
  }, [store, handleMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
    if (ws.current) {
      ws.current.onclose = null;
      ws.current.close();
      ws.current = null;
    }
  }, []);

  const sendRaw = useCallback((msg: any) => {
    if (store.getState().isConnected && ws.current?.readyState === WebSocket.OPEN) {
      if (msg instanceof ArrayBuffer || msg instanceof Uint8Array) {
        ws.current.send(msg);
      } else if (typeof msg === "string") {
        ws.current.send(msg);
      } else {
        ws.current.send(JSON.stringify(msg));
      }
    }
  }, [store]);

  // Auto connect on mount + reminder clock
  useEffect(() => {
    connect();

    const unsubStore = useStore.subscribe((state, prevState) => {
      if (
        state.settings !== prevState.settings ||
        state.messages !== prevState.messages ||
        state.tokenUsage !== prevState.tokenUsage ||
        state.reminders !== prevState.reminders ||
        state.uiMode !== prevState.uiMode ||
        state.activeTab !== prevState.activeTab ||
        state.sidebarExpanded !== prevState.sidebarExpanded
      ) {
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(
            JSON.stringify({
              type: "save_data",
              data: {
                settings: state.settings,
                messages: state.messages,
                tokenUsage: state.tokenUsage,
                reminders: state.reminders,
                clipboardHistory: state.clipboardHistory,
                commandsExecuted: state.commandsExecuted,
                uiMode: state.uiMode,
                activeTab: state.activeTab,
                sidebarExpanded: state.sidebarExpanded,
              },
            })
          );
        } else {
          // Also persist locally for instant reload without vault
          try {
            localStorage.setItem("pika_uiMode", state.uiMode);
            localStorage.setItem("pika_activeTab", state.activeTab);
            localStorage.setItem("pika_sidebarExpanded", String(state.sidebarExpanded));
          } catch {}
        }
      }
    });

    // Central 1-second clock: drives all live countdown displays (reminders,
    // HUD widgets) and checks whether any active reminder has fired.
    const clock = window.setInterval(() => {
      store.getState().tick();
      const now = Date.now();
      store.getState().reminders.forEach((r) => {
        if (r.status === "active" && r.triggerAt <= now) {
          store.getState().updateReminder(r.id, { status: "triggered" });
          sounds.notification();
          store.getState().addToast({ type: "warning", message: `⏰ ${r.text}` });
        }
      });
    }, 1000);

    return () => {
      unsubStore();
      window.clearInterval(clock);
      disconnect();
    };
  }, [connect, disconnect, store]);

  return { processInput, resolveConfirmation, connect, disconnect, sendRaw };
}
