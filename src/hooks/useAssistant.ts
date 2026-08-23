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
      u.onend = () => store.getState().setSpeaking(false);
      u.onerror = () => store.getState().setSpeaking(false);
      window.speechSynthesis.speak(u);
    } catch {
      store.getState().setSpeaking(false);
    }
  }, [store]);

  const triggerTTS = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      const now = Date.now();
      // Prevent repeating utterance within 6 seconds
      if (
        (lastSpokenRef.current.text === clean ||
          (clean.length > 20 && lastSpokenRef.current.text.startsWith(clean.slice(0, 30)))) &&
        now - lastSpokenRef.current.time < 6000
      ) {
        return;
      }
      lastSpokenRef.current = { text: clean, time: now };

      // Stop previous audio playback & browser speech synthesis immediately
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
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
  const processInput = useCallback((text: string) => {
    if (!text.trim()) return;
    store.getState().addMessage({ role: "user", content: text });
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
          if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: "load_data" }));
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
              store.getState().setSpeaking(false);
              currentAudioRef.current = null;
            };
            audio.play().catch((err) => {
              console.warn("Audio play rejected:", err);
              store.getState().setSpeaking(false);
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
      const curId = streamId.current || msg.id;
      if (!curId) return;
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
        const msgObj = store.getState().messages.find((m) => m.id === curId);
        const fullText = (msgObj?.content || "") + (msg.chunk || "");
        if (fullText.trim()) {
          // Clean markdown, limit to first 300 chars so TTS doesn't read entire long response
          const cleanText = fullText
            .replace(/[*#`_~>\[\]]/g, "")
            .replace(/https?:\/\/\S+/g, "")
            .replace(/\n+/g, " ")
            .trim()
            .slice(0, 300);
          if (cleanText) triggerTTS(cleanText);
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
      // Data came back from the bridge → populate the store (UI only, NO TTS here)
      // TTS is handled by: processInput→triggerTTS (commands) and llm_stream done→triggerTTS (LLM)
      const data = msg.data as any;
      if (data && Array.isArray(data.drives)) {
        store.getState().setDrives(data.drives);
      }
      if (data && Array.isArray(data.items) && msg.message === "प्रोसेस सूची") {
        store.getState().setProcesses(data.items);
      }
      if (msg.status === "error") {
        store.getState().addToast({ type: "error", message: msg.message });
      } else if (msg.message) {
        // Only show in UI — do NOT call triggerTTS (would double-speak with processInput's TTS)
        streamText(msg.message, "pika");
      }
    }
  }, [store, processInput, streamText]);

  const connect = useCallback(() => {
    const url = store.getState().settings.bridgeUrl;
    store.getState().setConnection("connecting");
    try {
      const socket = new WebSocket(url);
      ws.current = socket;
      const failTimer = window.setTimeout(() => {
        if (socket.readyState !== WebSocket.OPEN) {
          socket.close();
        }
      }, 4000);

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
        state.reminders !== prevState.reminders
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
              },
            })
          );
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
