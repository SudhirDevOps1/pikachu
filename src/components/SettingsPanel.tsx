import { useState } from "react";
import { Settings, Eye, EyeOff, Check, X, Zap, Volume2, Palette, Plug, Info, Activity, RefreshCw, Gauge, Smartphone, Copy, Terminal, User, Database, BookOpen } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { GlowButton } from "./GlowButton";
import { PanelHeader } from "./PanelHeader";
import { Toggle } from "./Toggle";
import { AccentPicker } from "./AccentPicker";
import { useStore } from "@/store/assistantStore";
import { useAssistantApi } from "@/hooks/AssistantContext";
import { PROVIDERS } from "@/lib/constants";
import { sounds } from "@/lib/soundEffects";
import { testProvider } from "@/lib/apiHealth";
import { useLocalIP } from "@/hooks/useLocalIP";
import type { ApiHealthStatus } from "@/types";

const HEALTH_DOT: Record<ApiHealthStatus, string> = {
  unknown: "#6b7280",
  checking: "#eab308",
  ok: "#22c55e",
  error: "#ef4444",
};

function Section({ icon: Icon, title, children }: { icon: typeof Zap; title: string; children: React.ReactNode }) {
  return (
    <GlassCard className="p-5">
      <div className="mb-4 flex items-center gap-2 text-white/80">
        <Icon size={18} style={{ color: "var(--accent)" }} />
        <h3 className="font-semibold">{title}</h3>
      </div>
      {children}
    </GlassCard>
  );
}

export function SettingsPanel() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const apiHealth = useStore((s) => s.apiHealth);
  const commandsExecuted = useStore((s) => s.commandsExecuted);
  const { connect, sendRaw } = useAssistantApi();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const tokenUsage = useStore((s) => s.tokenUsage);

  const configuredCount = Object.values(settings.apiKeys).filter(Boolean).length;

  const runTest = async (provider: string) => {
    setTesting((t) => ({ ...t, [provider]: true }));
    sounds.click();
    await testProvider(provider);
    setTesting((t) => ({ ...t, [provider]: false }));
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PanelHeader icon={Settings} title="सेटिंग्स" desc="पिका को अपने हिसाब से कस्टमाइज़ करें" />

      {/* AI Provider */}
      <Section icon={Zap} title="AI प्रोवाइडर">
        <div className="mb-4 flex items-center gap-3">
          <select
            value={settings.aiProvider}
            onChange={(e) => updateSettings({ aiProvider: e.target.value })}
            className="flex-1 rounded-xl bg-white/10 px-4 py-2.5 text-white outline-none"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id} className="bg-navy-800">
                {p.name} — {p.desc}
              </option>
            ))}
            {settings.customProviders?.map((p) => (
              <option key={p.id} value={p.id} className="bg-navy-800">
                {p.name} — Custom
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
            <Gauge size={14} className="text-white/40" />
            <span className="text-xs text-white/50">मॉडल</span>
            <input
              value={settings.providerModels[settings.aiProvider] || ""}
              onChange={(e) =>
                updateSettings({
                  providerModels: { ...settings.providerModels, [settings.aiProvider]: e.target.value },
                })
              }
              className="w-40 bg-transparent text-xs text-white outline-none"
            />
          </div>
        </div>

        <div className="space-y-3">
          {PROVIDERS.map((p) => {
            const key = settings.apiKeys[p.id] ?? "";
            const has = Boolean(key);
            const health = apiHealth[p.id];
            const isTesting = testing[p.id];
            return (
              <div key={p.id} className="rounded-xl bg-white/[0.03] p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background: HEALTH_DOT[health?.status ?? "unknown"],
                      boxShadow: `0 0 6px ${HEALTH_DOT[health?.status ?? "unknown"]}`,
                    }}
                  />
                  <span className="text-sm font-medium text-white">{p.name}</span>
                  <span className="text-[10px] text-white/30">{p.model}</span>
                  <div className="ml-auto flex items-center gap-2">
                    {health?.latencyMs && <span className="text-[10px] text-white/40">{health.latencyMs}ms</span>}
                    <button
                      onClick={() => runTest(p.id)}
                      disabled={isTesting || !has}
                      className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-[10px] text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
                    >
                      <RefreshCw size={10} className={isTesting ? "animate-spin" : ""} />
                      {isTesting ? "चेकिंग..." : "टेस्ट"}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showKeys[p.id] ? "text" : "password"}
                      value={key}
                      onChange={(e) =>
                        updateSettings({ apiKeys: { ...settings.apiKeys, [p.id]: e.target.value } })
                      }
                      placeholder={`${p.keyEnv} · multiple: key1,key2,...`}
                      className="w-full rounded-lg bg-white/5 px-3 py-2 pr-9 text-sm text-white outline-none placeholder-white/25"
                    />
                    <button
                      onClick={() => setShowKeys((s) => ({ ...s, [p.id]: !s[p.id] }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                    >
                      {showKeys[p.id] ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      updateSettings({ aiProvider: p.id });
                    }}
                    className="flex items-center gap-1 rounded-lg bg-[var(--accent)]/20 px-3 py-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent)]/30"
                  >
                    Save & Use
                  </button>
                  {has ? (
                    <Check size={16} className="text-green-400" />
                  ) : (
                    <X size={16} className="text-white/20" />
                  )}
                </div>
                {health?.status === "error" && health.error && (
                  <p className="mt-1 text-[10px] text-red-300/70">{health.error}</p>
                )}
                <p className="mt-0.5 text-[10px] text-white/25">💡 Multiple keys: key1,key2,key3 (auto-rotation on failure)</p>
              </div>
            );
          })}
        </div>
        {configuredCount === 0 && (
          <p className="mt-3 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-200/80">
            💡 कोई API key सेट नहीं है। मुफ्त key के लिए console.groq.com या aistudio.google.com पर जाएँ। तब तक पिका डेमो मोड में चलेगा।
          </p>
        )}
      </Section>

      {/* Custom Providers */}
      <CustomProvidersSection />

      {/* AI Personality */}
      <Section icon={User} title="AI व्यक्तित्व (System Prompt)">
        <div className="space-y-2">
          <p className="text-xs text-white/50">
            पिका को बताएँ कि उसे कैसे व्यवहार करना है (जैसे: "तुम एक कोडिंग एक्सपर्ट हो")
          </p>
          <textarea
            value={settings.systemPrompt}
            onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
            placeholder="You are Pika, a helpful AI assistant..."
            className="w-full resize-y rounded-xl bg-white/5 p-3 text-sm text-white placeholder-white/30 outline-none focus:bg-white/10 min-h-[80px]"
          />
        </div>
      </Section>

      {/* Voice */}
      <Section icon={Volume2} title="आवाज़ सेटिंग्स">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/70">भाषा</span>
            <select
              value={settings.voiceSettings.language}
              onChange={(e) =>
                updateSettings({ voiceSettings: { ...settings.voiceSettings, language: e.target.value } })
              }
              className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white outline-none"
            >
              <option value="hi-IN" className="bg-navy-800">हिंदी (Swara)</option>
              <option value="en-US" className="bg-navy-800">English (Jenny)</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/70">STT इंजन (सुनने के लिए)</span>
            <select
              value={settings.sttEngine || "webspeech"}
              onChange={(e) =>
                updateSettings({ sttEngine: e.target.value as any })
              }
              className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white outline-none"
            >
              <option value="webspeech" className="bg-navy-800">Web Speech API (Default)</option>
              <option value="whisper" className="bg-navy-800">Whisper.cpp (Offline)</option>
              <option value="vosk" className="bg-navy-800">Vosk (Offline Live)</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/70">TTS इंजन (बोलने के लिए)</span>
            <select
              value={settings.ttsEngine || "edge"}
              onChange={(e) =>
                updateSettings({ ttsEngine: e.target.value as any })
              }
              className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white outline-none"
            >
              <option value="edge" className="bg-navy-800">Edge TTS (Microsoft Natural Neural - Best)</option>
              <option value="webspeech" className="bg-navy-800">Web Speech API (Browser Natural)</option>
              <option value="piper" className="bg-navy-800">Piper TTS (Offline HQ)</option>
              <option value="pyttsx3" className="bg-navy-800">Pyttsx3 (System SAPI5 Legacy)</option>
              <option value="none" className="bg-navy-800">Mute (No Voice)</option>
            </select>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-sm text-white/70">
              <span>गति</span>
              <span>{settings.voiceSettings.speed}x</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={settings.voiceSettings.speed}
              onChange={(e) =>
                updateSettings({ voiceSettings: { ...settings.voiceSettings, speed: +e.target.value } })
              }
              className="w-full"
              style={{ accentColor: "var(--accent)" }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/70">वेक वर्ड ("Hey Pika")</span>
            <Toggle
              on={settings.wakeWordEnabled}
              onClick={() => updateSettings({ wakeWordEnabled: !settings.wakeWordEnabled })}
            />
          </div>
          <GlowButton
            onClick={() => {
              const engine = settings.ttsEngine || "edge";
              if (engine === "edge") {
                sendRaw({
                  type: "tts_speak",
                  params: {
                    text: "नमस्ते! मैं पिका हूँ। आपकी आवाज़ एकदम नेचुरल है।",
                    voice: settings.voiceSettings.language === "en-US" ? "en-US-JennyNeural" : "hi-IN-SwaraNeural",
                    engine: "edge",
                  },
                } as any);
              } else {
                window.speechSynthesis.cancel();
                const u = new SpeechSynthesisUtterance("नमस्ते, मैं पिका हूँ");
                u.lang = settings.voiceSettings.language || "hi-IN";
                u.rate = settings.voiceSettings.speed || 1;
                window.speechSynthesis.speak(u);
              }
            }}
          >
            🔊 आवाज़ टेस्ट करें
          </GlowButton>
        </div>
      </Section>

      {/* Appearance */}
      <Section icon={Palette} title="दिखावट">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-white/70">थीम एक्सेंट कलर</span>
          <AccentPicker />
        </div>
        <div className="space-y-3">
          {[
            { k: "soundEffects" as const, label: "साउंड इफेक्ट" },
            { k: "particles" as const, label: "पार्टिकल बैकग्राउंड" },
            { k: "pipMode" as const, label: "Picture-in-Picture मोड" },
          ].map((o) => (
            <div key={o.k} className="flex items-center justify-between">
              <span className="text-sm text-white/70">{o.label}</span>
              <Toggle
                on={settings[o.k]}
                onClick={() => {
                  const val = !settings[o.k];
                  updateSettings({ [o.k]: val });
                  if (o.k === "soundEffects") sounds.enabled = val;
                }}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Connection */}
      <Section icon={Plug} title="कनेक्शन">
        <label className="mb-2 block text-xs text-white/50">ब्रिज URL</label>
        <div className="flex gap-2">
          <input
            value={settings.bridgeUrl}
            onChange={(e) => updateSettings({ bridgeUrl: e.target.value })}
            className="flex-1 rounded-xl bg-white/5 px-4 py-2.5 font-mono text-sm text-white outline-none"
          />
          <GlowButton onClick={connect}>कनेक्ट करें</GlowButton>
        </div>
      </Section>

      {/* Stats */}
      <Section icon={Activity} title="आँकड़े">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/5 p-4">
            <div className="text-2xl font-semibold" style={{ color: "var(--accent)" }}>
              {commandsExecuted}
            </div>
            <div className="text-xs text-white/50">कुल कमांड</div>
          </div>
          <div className="rounded-xl bg-white/5 p-4">
            <div className="text-2xl font-semibold text-cyan-300">{configuredCount}/7</div>
            <div className="text-xs text-white/50">प्रोवाइडर सेट</div>
          </div>
        </div>
      </Section>

      {/* Token Usage */}
      <Section icon={Database} title="टोकन उपयोग (Token Usage)">
        <div className="space-y-2">
          {Object.entries(tokenUsage).length === 0 ? (
            <p className="text-xs text-white/40">अभी कोई टोकन डेटा नहीं है।</p>
          ) : (
            Object.entries(tokenUsage).map(([provider, usage]) => (
              <div key={provider} className="flex items-center justify-between rounded-xl bg-white/5 p-3">
                <span className="text-sm font-medium capitalize text-white/80">{provider}</span>
                <div className="flex gap-4 text-xs text-white/50">
                  <div className="flex flex-col items-end">
                    <span className="text-white/30">Prompt</span>
                    <span>{usage.prompt.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-white/30">Completion</span>
                    <span>{usage.completion.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col items-end border-l border-white/10 pl-4 font-semibold text-[var(--accent)]">
                    <span className="text-white/30 font-normal">Total</span>
                    <span>{usage.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Section>

      {/* Data Management */}
      <Section icon={Database} title="डेटा मैनेजमेंट">
        <p className="mb-3 text-xs text-white/50">
          आपका डेटा (सेटिंग्स, टोकन, हिस्ट्री) अब ब्राउज़र के बजाय आपके सिस्टम में <code className="text-cyan-300 bg-white/10 px-1 rounded">pika_data.json</code> फ़ाइल में सेव होता है। आप यहाँ से इसे हमेशा के लिए डिलीट कर सकते हैं।
        </p>
        <button
          onClick={() => {
            if (confirm("क्या आप वाकई अपना सारा डेटा डिलीट करना चाहते हैं? यह वापस नहीं लाया जा सकेगा।")) {
              sendRaw({ type: "clear_data" } as any);
              sounds.success();
              window.location.reload();
            }
          }}
          className="flex items-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-400 transition hover:bg-red-500/30"
        >
          <X size={16} />
          <span>सारा डेटा डिलीट करें</span>
        </button>
      </Section>

      {/* Mobile Access */}
      <MobileAccessSection />

      {/* Obsidian Integration */}
      <ObsidianSection />

      {/* Setup troubleshooting */}
      <SetupSection />

      {/* About */}
      <Section icon={Info} title="जानकारी">
        <div className="space-y-1 text-sm text-white/60">
          <p className="font-semibold text-white">⚡ पिका AI असिस्टेंट v1.0.0</p>
          <p>पूरी तरह लोकल, पूरी तरह निजी।</p>
          <p className="text-xs text-white/40">MIT License · React + Vite + Python</p>
        </div>
      </Section>
    </div>
  );
}

function CustomProvidersSection() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const list = settings.customProviders;

  const add = () => {
    updateSettings({
      customProviders: [
        ...list,
        { id: crypto.randomUUID(), name: "My Provider", baseUrl: "https://api.example.com/v1/chat/completions", model: "model-name", apiKey: "" },
      ],
    });
  };
  const patch = (id: string, p: Partial<(typeof list)[0]>) =>
    updateSettings({ customProviders: list.map((c) => (c.id === id ? { ...c, ...p } : c)) });
  const remove = (id: string) =>
    updateSettings({ customProviders: list.filter((c) => c.id !== id) });

  return (
    <Section icon={Zap} title="कस्टम AI प्रोवाइडर">
      <p className="mb-3 text-xs text-white/50">
        कोई भी OpenAI-compatible endpoint जोड़ें — नाम, Base URL, मॉडल और API key सब customizable।
      </p>
      <div className="space-y-3">
        {list.map((c) => (
          <div key={c.id} className="space-y-2 rounded-xl bg-white/[0.03] p-3">
            <div className="flex items-center gap-2">
              <input
                value={c.name}
                onChange={(e) => patch(c.id, { name: e.target.value })}
                placeholder="Provider Name"
                className="flex-1 rounded-lg bg-white/5 px-3 py-1.5 text-sm font-semibold text-white outline-none"
              />
              <button onClick={() => remove(c.id)} className="text-red-400/70 hover:text-red-400"><X size={16} /></button>
            </div>
            <input
              value={c.baseUrl}
              onChange={(e) => patch(c.id, { baseUrl: e.target.value })}
              placeholder="Base URL (…/chat/completions)"
              className="w-full rounded-lg bg-white/5 px-3 py-1.5 font-mono text-xs text-white outline-none placeholder-white/25"
            />
            <div className="flex gap-2">
              <input
                value={c.model}
                onChange={(e) => patch(c.id, { model: e.target.value })}
                placeholder="model-name"
                className="flex-1 rounded-lg bg-white/5 px-3 py-1.5 font-mono text-xs text-white outline-none placeholder-white/25"
              />
              <input
                type="password"
                value={c.apiKey}
                onChange={(e) => patch(c.id, { apiKey: e.target.value })}
                placeholder="API Key"
                className="flex-1 rounded-lg bg-white/5 px-3 py-1.5 font-mono text-xs text-white outline-none placeholder-white/25"
              />
              <button
                onClick={() => updateSettings({ aiProvider: c.id })}
                className="rounded-lg bg-[var(--accent)]/20 px-3 py-1.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent)]/30"
              >
                Use
              </button>
            </div>
          </div>
        ))}
      </div>
      <GlowButton onClick={add} className="mt-3"><Zap size={14} /> नया प्रोवाइडर जोड़ें</GlowButton>
    </Section>
  );
}



function ObsidianSection() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const { sendRaw } = useAssistantApi();
  const isConnected = useStore((s) => s.isConnected);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const testObsidian = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const resp = await fetch(
        `${settings.obsidianUrl || "http://127.0.0.1:27123"}/`,
        {
          headers: { Authorization: `Bearer ${settings.obsidianApiKey || ""}` },
        }
      );
      if (resp.ok) {
        const data = await resp.json().catch(() => ({}));
        setTestResult({ ok: true, msg: `Connected! Vault: ${data.vaultName || "OK"}` });
      } else {
        setTestResult({ ok: false, msg: `Error ${resp.status}: ${resp.statusText}` });
      }
    } catch {
      setTestResult({ ok: false, msg: "Connect नहीं हो पाया। Obsidian खुला है और REST API plugin active है?" });
    }
    setTesting(false);
  };

  const quickAction = (action: string, params: Record<string, string> = {}) => {
    if (!isConnected) {
      return;
    }
    sendRaw({
      type: "command",
      category: "obsidian",
      action,
      params: {
        url: settings.obsidianUrl || "http://127.0.0.1:27123",
        api_key: settings.obsidianApiKey || "",
        ...params,
      },
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    } as any);
  };

  return (
    <Section icon={BookOpen} title="Obsidian Integration">
      <div className="space-y-4">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-white">Obsidian Enable करें</span>
            <p className="text-[11px] text-white/40">Local REST API plugin चाहिए (port 27123)</p>
          </div>
          <Toggle
            on={!!settings.obsidianEnabled}
            onClick={() => updateSettings({ obsidianEnabled: !settings.obsidianEnabled })}
          />
        </div>

        {settings.obsidianEnabled && (
          <>
            {/* Server URL */}
            <div>
              <label className="mb-1 block text-xs text-white/50">Server URL</label>
              <input
                value={settings.obsidianUrl || "http://127.0.0.1:27123"}
                onChange={(e) => updateSettings({ obsidianUrl: e.target.value })}
                placeholder="http://127.0.0.1:27123"
                className="w-full rounded-lg bg-white/5 px-3 py-2 font-mono text-sm text-white outline-none placeholder-white/25 focus:bg-white/10"
              />
            </div>

            {/* API Key */}
            <div>
              <label className="mb-1 block text-xs text-white/50">API Key (Bearer Token)</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showKey ? "text" : "password"}
                    value={settings.obsidianApiKey || ""}
                    onChange={(e) => updateSettings({ obsidianApiKey: e.target.value })}
                    placeholder="Bearer token from Local REST API plugin..."
                    className="w-full rounded-lg bg-white/5 px-3 py-2 pr-9 font-mono text-sm text-white outline-none placeholder-white/25 focus:bg-white/10"
                  />
                  <button
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <button
                  onClick={testObsidian}
                  disabled={testing}
                  className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-xs text-white/70 transition hover:bg-white/20 hover:text-white disabled:opacity-40"
                >
                  <RefreshCw size={12} className={testing ? "animate-spin" : ""} />
                  {testing ? "Testing..." : "Test"}
                </button>
              </div>
              {testResult && (
                <p className={`mt-1.5 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs ${testResult.ok ? "bg-green-500/10 text-green-300" : "bg-red-500/10 text-red-300"}`}>
                  {testResult.ok ? <Check size={12} /> : <X size={12} />}
                  {testResult.msg}
                </p>
              )}
            </div>

            {/* Quick Actions */}
            <div>
              <label className="mb-2 block text-xs text-white/50">Quick Actions (Bridge connected होने पर)</label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { label: "📅 Today's Daily Note", action: "daily_note", extraParams: {} },
                    { label: "📋 Active Note पढ़ें", action: "get_active", extraParams: {} },
                    { label: "🔍 Vault Search", action: "search", extraParams: { query: "pika" } },
                    { label: "📁 Files List", action: "list_files", extraParams: { path: "/" } },
                  ] as { label: string; action: string; extraParams: Record<string, string> }[]
                ).map((btn) => (
                  <button
                    key={btn.action}
                    onClick={() => quickAction(btn.action, btn.extraParams)}
                    disabled={!isConnected || !settings.obsidianApiKey}
                    className="rounded-lg bg-white/[0.05] px-3 py-2 text-left text-xs text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Info */}
            <div className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-200/80">
              <p className="font-semibold mb-1">📖 Setup:</p>
              <ol className="space-y-0.5 text-amber-200/60">
                <li>1. Obsidian → Settings → Community Plugins → "Local REST API with MCP" install करें</li>
                <li>2. Plugin enable करें, Non-encrypted (HTTP) server ON करें</li>
                <li>3. ऊपर दिखा API Key यहाँ paste करें</li>
                <li>4. Agent Mode ON करने पर Pika directly Obsidian vault में काम करेगी</li>
              </ol>
            </div>
          </>
        )}
      </div>
    </Section>
  );
}


function MobileAccessSection() {
  const ip = useLocalIP();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(`http://${ip}:3000`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Section icon={Smartphone} title="मोबाइल एक्सेस">
      <p className="mb-3 text-xs text-white/60">
        Same WiFi पर phone से access करने के लिए:
      </p>
      <div className="flex items-center gap-2 rounded-xl bg-white/[0.06] p-3">
        <code className="flex-1 font-mono text-sm text-cyan-300">http://{ip}:3000</code>
        <button
          onClick={copy}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
        >
          {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
        </button>
      </div>
    </Section>
  );
}

function SetupSection() {
  const [open, setOpen] = useState(false);
  return (
    <Section icon={Terminal} title="स्टेप-बाय-स्टेप सेटअप">
      <p className="mb-3 text-xs text-white/50">
        Bridge काम नहीं कर रहा? नीचे दिए steps follow करें:
      </p>
      <ol className="space-y-2 text-sm text-white/75">
        <li><b>1.</b> Python 3.10+ install करें — <a className="text-cyan-400 underline" href="https://python.org" target="_blank">python.org</a> → "Add to PATH" ज़रूर tick करें</li>
        <li><b>2.</b> Node.js 18+ install करें — <a className="text-cyan-400 underline" href="https://nodejs.org" target="_blank">nodejs.org</a></li>
        <li><b>3.</b> Project folder में <code className="rounded bg-white/10 px-1.5 py-0.5 text-cyan-300">start.bat</code> double-click करें (Windows) या <code className="rounded bg-white/10 px-1.5 py-0.5 text-cyan-300">python start.py</code> run करें</li>
        <li><b>4.</b> "ALL SYSTEMS GO!" message दिखे तो browser auto-open होगा</li>
        <li><b>5.</b> Mobile access के लिए same WiFi पर phone से ऊपर वाला URL खोलें</li>
      </ol>
      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-3 text-xs text-cyan-400 hover:underline"
      >
        {open ? "▼ छुपाएँ" : "▶ Manual commands दिखाएँ"}
      </button>
      {open && (
        <div className="mt-3 space-y-2 rounded-lg bg-black/40 p-3 font-mono text-[11px] text-cyan-200">
          <p># Terminal में (project folder के अंदर):</p>
          <p>python -m pip install -r requirements.txt</p>
          <p>npm install</p>
          <p>python pc_bridge.py   # एक terminal में</p>
          <p>npm run dev          # दूसरे terminal में</p>
          <p className="text-white/40"># Bridge test: python test_bridge.py</p>
        </div>
      )}
    </Section>
  );
}
