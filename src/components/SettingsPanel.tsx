import { useState } from "react";
import { Settings, Eye, EyeOff, Check, X, Zap, Volume2, Palette, Plug, Info, Activity, RefreshCw, Gauge, Smartphone, Copy, Terminal, User, Database, BookOpen, Bot, Plus, Trash2, PieChart, Layers, Cpu } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { GlowButton } from "./GlowButton";
import { PanelHeader } from "./PanelHeader";
import { Toggle } from "./Toggle";
import { AccentPicker } from "./AccentPicker";
import { useStore } from "@/store/assistantStore";
import { useAssistantApi } from "@/hooks/AssistantContext";
import { PROVIDERS } from "@/lib/constants";
import { sounds } from "@/lib/soundEffects";
import { testProvider, testCustomProvider } from "@/lib/apiHealth";
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
    
    sendRaw({
      type: "test_provider_backend",
      params: {
        provider,
        apiKey: settings.apiKeys[provider] || "",
      },
      id: crypto.randomUUID(),
    } as any);

    await testProvider(provider);
    setTesting((t) => ({ ...t, [provider]: false }));
  };

  // ——— New: Tabbed navigation for scattered settings ———
  const [activeCat, setActiveCat] = useState("general");
  const [q, setQ] = useState("");
  const CATS = [
    { id: "general", label: "General", icon: Zap, desc: "AI Provider & Language" },
    { id: "voice", label: "Voice", icon: Volume2, desc: "STT/TTS & Wake" },
    { id: "appearance", label: "Appearance", icon: Palette, desc: "Theme • Grid • Glass" },
    { id: "presets", label: "Presets", icon: Layers, desc: "Neural • Particle • Font" },
    { id: "connections", label: "Connections", icon: Plug, desc: "Bridge • Mobile • Cloudflare" },
    { id: "intelligence", label: "Intelligence", icon: Bot, desc: "Agents & Tokens" },
    { id: "data", label: "Data", icon: Database, desc: "Stats • About" },
  ] as const;
  const matches = (text: string) => !q || text.toLowerCase().includes(q.toLowerCase());

  return (
    <div className="mx-auto max-w-5xl">
      <PanelHeader icon={Settings} title="सेटिंग्स" desc="पिका को अपने हिसाब से कस्टमाइज़ करें — बिखरा हुआ expand अब tabbed" />

      {/* Search + tab bar */}
      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-md">
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search settings — theme, voice, bridge, token..." className="w-full rounded-xl bg-white/5 px-4 py-2.5 pl-9 text-sm text-white placeholder-white/30 outline-none border border-white/5 focus:border-[var(--accent)]/30" />
          <Settings size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
          {CATS.map(c=> {
            const Icon=c.icon; const active=activeCat===c.id;
            return <button key={c.id} onClick={()=>{setActiveCat(c.id); sounds.click();}} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition ${active?"bg-[var(--accent)] text-black shadow-[0_0_14px_rgba(var(--accent-rgb),0.4)]":"bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"}`}><Icon size={13}/>{c.label}</button>
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row">
        {/* Left nav — desktop */}
        <nav className="hidden lg:flex lg:w-[210px] shrink-0 flex-col gap-1.5 sticky top-4 self-start">
          {CATS.map(c=> {
            const Icon=c.icon; const active=activeCat===c.id;
            return <button key={c.id} onClick={()=>setActiveCat(c.id)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${active?"bg-white/[0.07] text-white border border-white/10 shadow-sm":"text-white/55 hover:bg-white/[0.04] hover:text-white"}`}>
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${active?"bg-[var(--accent)] text-black":"bg-white/5"}`}><Icon size={14}/></span>
              <span className="flex-1"><span className="block text-xs font-semibold leading-none">{c.label}</span><span className="block text-[10px] leading-none opacity-50">{c.desc}</span></span>
              {active && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_6px_var(--accent)]" />}
            </button>
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-4">
          {(activeCat==="general" || q) && matches("AI Provider provider model groq gemini language persona") && <>

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
                    className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      settings.aiProvider === p.id
                        ? "bg-[var(--accent)] text-black font-semibold shadow-lg shadow-[var(--accent)]/30"
                        : "bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
                    }`}
                  >
                    {settings.aiProvider === p.id ? "Active ✓" : "Use"}
                  </button>
                  {has ? (
                    <Check size={16} className="text-green-400" />
                  ) : (
                    <X size={16} className="text-white/20" />
                  )}
                </div>

                {/* Dynamic Live Model Selector & Custom Model Input */}
                <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-lg bg-black/20 p-2 border border-white/5">
                  <span className="text-[11px] text-white/50">Model:</span>
                  {health?.models && health.models.length > 0 ? (
                    <select
                      value={settings.providerModels?.[p.id] || p.model}
                      onChange={(e) => {
                        const m = e.target.value;
                        updateSettings({
                          providerModels: { ...(settings.providerModels || {}), [p.id]: m },
                        });
                      }}
                      className="flex-1 rounded bg-white/10 px-2 py-1 text-xs font-mono text-cyan-300 outline-none hover:bg-white/15"
                    >
                      {health.models.map((m) => (
                        <option key={m} value={m} className="bg-slate-900 text-white">
                          {m}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={settings.providerModels?.[p.id] || ""}
                      onChange={(e) => {
                        updateSettings({
                          providerModels: { ...(settings.providerModels || {}), [p.id]: e.target.value },
                        });
                      }}
                      placeholder={`Default: ${p.model}`}
                      className="flex-1 rounded bg-white/5 px-2 py-1 font-mono text-xs text-cyan-300 outline-none placeholder-white/30"
                    />
                  )}
                  {health?.models && health.models.length > 0 ? (
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-mono text-emerald-300">
                      ⚡ {health.models.length} live models
                    </span>
                  ) : (
                    <button
                      onClick={() => runTest(p.id)}
                      disabled={isTesting || !has}
                      className="text-[10px] text-cyan-400/80 hover:text-cyan-300 underline disabled:opacity-30"
                    >
                      {isTesting ? "Fetching..." : "Fetch live models"}
                    </button>
                  )}
                </div>

                {health?.status === "error" && health.error && (
                  <p className="mt-1 text-[10px] text-red-300/70">{health.error}</p>
                )}
                <p className="mt-1 text-[10px] text-white/25">💡 Multiple keys: key1,key2,key3 (auto-rotation on failure)</p>
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

      {/* AI Personality & Language */}
      <Section icon={User} title="AI व्यक्तित्व और भाषा शैली (Language & Persona)">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-sm font-medium text-white">बातचीत की भाषा शैली (Response Language)</span>
              <p className="text-[11px] text-white/40">पिका किस भाषा में आपसे बात करेगा</p>
            </div>
            <select
              value={settings.chatLanguageStyle || "auto"}
              onChange={(e) => updateSettings({ chatLanguageStyle: e.target.value as any })}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-cyan-300 font-medium outline-none"
            >
              <option value="auto" className="bg-navy-800 text-white">🔄 ऑटो-डिटेक्ट (जैसा आप बोलेंगे वैसा जवाब)</option>
              <option value="hinglish" className="bg-navy-800 text-white">🔤 Hinglish (रोमन हिंदी + इंग्लिश मिक्स)</option>
              <option value="hindi" className="bg-navy-800 text-white">🇮🇳 हिंदी (शुद्ध देवनागरी हिंदी)</option>
              <option value="english" className="bg-navy-800 text-white">🇬🇧 English (Pure English)</option>
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-xs text-white/50">कस्टम निर्देश (System Prompt)</span>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => updateSettings({ systemPrompt: "You are Pika, a smart, witty and helpful friend. Talk in friendly Hinglish." })}
                  className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-white/60 hover:bg-white/10 hover:text-white"
                >
                  हिंग्लिश
                </button>
                <button
                  type="button"
                  onClick={() => updateSettings({ systemPrompt: "आप पिका हैं, एक अत्यंत बुद्धिमान और विनम्र निजी AI सहायक। हमेशा शुद्ध हिंदी में उत्तर दें।" })}
                  className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-white/60 hover:bg-white/10 hover:text-white"
                >
                  हिंदी
                </button>
                <button
                  type="button"
                  onClick={() => updateSettings({ systemPrompt: "You are Pika, an advanced autonomous desktop AI engineer. Always reply in clear, professional English." })}
                  className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-white/60 hover:bg-white/10 hover:text-white"
                >
                  English
                </button>
              </div>
            </div>
            <textarea
              value={settings.systemPrompt}
              onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
              placeholder="You are Pika, a helpful AI assistant..."
              className="w-full resize-y rounded-xl bg-white/5 p-3 text-sm text-white placeholder-white/30 outline-none focus:bg-white/10 min-h-[80px]"
            />
          </div>
        </div>
      </Section>
      </>}

      {(activeCat==="voice" || q) && matches("voice stt tts whisper vosk edge piper wake word") && <>
      {/* Voice */}
      {/* Voice Settings */}
      <Section icon={Volume2} title="आवाज़ और वॉइस सेटिंग्स">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/70">वॉइस कैरेक्टर (आवाज़)</span>
            <select
              value={settings.voiceSettings.voice || "hi-IN-SwaraNeural"}
              onChange={(e) =>
                updateSettings({
                  voiceSettings: {
                    ...settings.voiceSettings,
                    voice: e.target.value,
                    language: e.target.value.startsWith("en") ? "en-US" : "hi-IN",
                  },
                })
              }
              className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white outline-none"
            >
              <option value="hi-IN-SwaraNeural" className="bg-navy-800">🇮🇳 हिंदी (स्वरा - फ़ीमेल / अल्ट्रा नेचुरल)</option>
              <option value="hi-IN-MadhurNeural" className="bg-navy-800">🇮🇳 हिंदी (मधुर - मेल / अल्ट्रा नेचुरल)</option>
              <option value="en-IN-NeerjaNeural" className="bg-navy-800">🇮🇳 भारतीय English (नीरजा)</option>
              <option value="en-US-JennyNeural" className="bg-navy-800">🇺🇸 English (Jenny - Female)</option>
              <option value="en-US-GuyNeural" className="bg-navy-800">🇺🇸 English (Guy - Male)</option>
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
              <option value="edge" className="bg-navy-800">Edge TTS (Microsoft Natural Neural - Online)</option>
              <option value="piper" className="bg-navy-800">Piper TTS (100% Offline HQ Neural)</option>
              <option value="webspeech" className="bg-navy-800">Web Speech API (Browser Native)</option>
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
              if (engine === "edge" || engine === "piper") {
                sendRaw({
                  type: "tts_speak",
                  params: {
                    text: engine === "piper" ? "नमस्ते! मैं पिका हूँ। यह पाइपर ऑफ़लाइन वॉइस है।" : "नमस्ते! मैं पिका हूँ। यह माइक्रोसॉफ्ट एज नेचुरल वॉइस है।",
                    voice: settings.voiceSettings.voice || (settings.voiceSettings.language === "en-US" ? "en-US-JennyNeural" : "hi-IN-SwaraNeural"),
                    engine: engine,
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
      </>}

      {(activeCat==="appearance" || q) && matches("appearance theme accent grid glass blur font animation brightness orb") && <>
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

      {/* Advanced Appearance — Standard + Futurist */}
      <AppearanceAdvancedSection />
      </>}
      {(activeCat==="presets" || activeCat==="appearance" || q) && matches("presets neural particle font name cyber matrix royal ocean sunset midnight fire aurora gold candy dots stars lines bubbles heart galaxy dna cube torus wave spiral inter playfair bebas dancing orbitron pacifico righteous lobster cinzel monoton hindi hinglish english mono") && <>
      <PresetsSection />
      </>}

      {(activeCat==="connections" || q) && matches("connection bridge mobile cloudflare obsidian wifi tunnel") && <>
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
      </>}

      {(activeCat==="data" || q) && matches("stats data analytics") && <>
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
      </>}

      {(activeCat==="intelligence" || q) && matches("token usage cost analytics") && <>
      {/* Token Usage & Analytics */}
      <Section icon={Database} title="टोकन उपयोग और एनालिटिक्स (Token Usage & Cost)">
        {(() => {
          const grandPrompt = Object.values(tokenUsage).reduce((a, b) => a + (b.prompt || 0), 0);
          const grandCompletion = Object.values(tokenUsage).reduce((a, b) => a + (b.completion || 0), 0);
          const grandTotal = grandPrompt + grandCompletion;
          const resetTokens = useStore.getState().resetTokenUsage;

          return (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-white/[0.04] p-3 text-center border border-white/5">
                  <div className="text-lg font-bold text-cyan-300">{grandPrompt.toLocaleString()}</div>
                  <div className="text-[10px] text-white/40">Prompt Tokens</div>
                </div>
                <div className="rounded-xl bg-white/[0.04] p-3 text-center border border-white/5">
                  <div className="text-lg font-bold text-purple-300">{grandCompletion.toLocaleString()}</div>
                  <div className="text-[10px] text-white/40">Completion Tokens</div>
                </div>
                <div className="rounded-xl bg-white/[0.04] p-3 text-center border border-white/5">
                  <div className="text-lg font-bold text-[var(--accent)]">{grandTotal.toLocaleString()}</div>
                  <div className="text-[10px] text-white/40">कुल टोकन (Total)</div>
                </div>
              </div>

              {/* Provider Breakdown */}
              <div className="space-y-2">
                {Object.entries(tokenUsage).length === 0 ? (
                  <p className="text-xs text-white/40">अभी कोई टोकन डेटा नहीं है — चैट शुरू करने पर यहाँ लाइव डेटा दिखेगा।</p>
                ) : (
                  Object.entries(tokenUsage).map(([provider, usage]) => {
                    const pct = grandTotal > 0 ? Math.round((usage.total / grandTotal) * 100) : 0;
                    return (
                      <div key={provider} className="rounded-xl bg-white/5 p-3 space-y-1.5 border border-white/5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold capitalize text-white">{provider}</span>
                          <span className="font-mono text-cyan-300">{usage.total.toLocaleString()} tokens ({pct}%)</span>
                        </div>
                        {/* Progress Bar */}
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 transition-all duration-500"
                            style={{ width: `${Math.max(4, pct)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-white/40">
                          <span>Prompt: {usage.prompt.toLocaleString()}</span>
                          <span>Completion: {usage.completion.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {grandTotal > 0 && (
                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => {
                      if (confirm("क्या आप टोकन हिस्ट्री रीसेट करना चाहते हैं?")) {
                        resetTokens();
                        sounds.success();
                      }
                    }}
                    className="flex items-center gap-1 text-[11px] text-red-400/80 hover:text-red-400 transition"
                  >
                    <Trash2 size={12} />
                    <span>टोकन काउंटर रीसेट करें</span>
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </Section>
      </>}

      {(activeCat==="data" || q) && matches("data management delete pika_data") && <>
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
      </>}

      {(activeCat==="intelligence" || q) && matches("sub agent swarm intelligence") && <>
      {/* Sub-Agent Swarm Section */}
      <SubAgentsSection />
      </>}

      {(activeCat==="general" || q) && matches("custom provider ai") && <>
      {/* Custom AI Providers */}
      <CustomProvidersSection />
      </>}

      {(activeCat==="connections" || q) && matches("mobile access phone wifi") && <>
      {/* Mobile Access */}
      <MobileAccessSection />
      </>}

      {(activeCat==="connections" || q) && matches("cloudflare pages tunnel") && <>
      {/* Cloudflare Pages + Local Backend Analysis */}
      <CloudflareDeploymentSection />
      </>}

      {(activeCat==="connections" || q) && matches("obsidian vault notes") && <>
      {/* Obsidian Integration */}
      <ObsidianSection />
      </>}

      {(activeCat==="connections" || q) && matches("setup troubleshooting bridge") && <>
      {/* Setup troubleshooting */}
      <SetupSection />
      </>}

      {(activeCat==="data" || q) && matches("about info pika") && <>
      {/* About */}
      <Section icon={Info} title="जानकारी">
        <div className="space-y-1 text-sm text-white/60">
          <p className="font-semibold text-white">⚡ पिका AI असिस्टेंट v1.2.0</p>
          <p>पूरी तरह लोकल, मल्टी-एजेंट, विज़न और ऑब्सीडियन पावर्ड।</p>
          <p className="text-xs text-white/40">MIT License · React + Vite + Python</p>
        </div>
      </Section>
      </>}
        </div>
      </div>
    </div>
  );
}

function AppearanceAdvancedSection() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const a = settings.appearance || { gridOpacity: 0.06, glassBlur: 30, fontScale: 1, animationSpeed: 1, showGrid: true, showScanline: true, hudBrightness: 1, orbScale: 1 };
  const upd = (p: Partial<typeof a>) => updateSettings({ appearance: { ...a, ...p } as any });
  const reset = () => updateSettings({ appearance: { gridOpacity: 0.06, glassBlur: 30, fontScale: 1, animationSpeed: 1, showGrid: true, showScanline: true, hudBrightness: 1, orbScale: 1 } as any });

  return (
    <Section icon={Palette} title="🎨 Advanced Appearance — Standard + Futurist (bina kuch hataye)">
      <p className="mb-3 text-xs text-white/50">Standard aur Futurist dono ke liye — grid, glass, font, animation, brightness sab control. Theme dropdown hide fix portal se ho gaya hai (z-9999).</p>
      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/70">Grid दिखाएँ</span>
          <Toggle on={!!a.showGrid} onClick={() => upd({ showGrid: !a.showGrid })} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/70">Scanline</span>
          <Toggle on={!!a.showScanline} onClick={() => upd({ showScanline: !a.showScanline })} />
        </div>
        {[
          { k: "gridOpacity", label: "Grid Opacity", min: 0, max: 0.2, step: 0.01, val: a.gridOpacity },
          { k: "glassBlur", label: "Glass Blur (px)", min: 10, max: 60, step: 2, val: a.glassBlur },
          { k: "fontScale", label: "Font Scale", min: 0.85, max: 1.25, step: 0.05, val: a.fontScale },
          { k: "animationSpeed", label: "Animation Speed", min: 0.5, max: 2, step: 0.1, val: a.animationSpeed },
          { k: "hudBrightness", label: "HUD Brightness", min: 0.8, max: 1.3, step: 0.05, val: a.hudBrightness },
          { k: "orbScale", label: "Orb Scale (Futurist)", min: 0.8, max: 1.3, step: 0.05, val: a.orbScale },
        ].map((f) => (
          <div key={f.k} className="space-y-1">
            <div className="flex justify-between text-xs text-white/60"><span>{f.label}</span><span className="font-mono text-cyan-300">{f.val}</span></div>
            <input type="range" min={f.min} max={f.max} step={f.step} value={f.val} onChange={(e) => upd({ [f.k]: parseFloat(e.target.value) } as any)} className="w-full" style={{ accentColor: "var(--accent)" }} />
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <GlowButton onClick={reset}>↺ Reset Default</GlowButton>
          <span className="text-[11px] text-white/30 self-center">Changes live — dono modes pe turant</span>
        </div>
      </div>
    </Section>
  );
}

function PresetsSection() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const a = settings.appearance || { gridOpacity: 0.06, glassBlur: 30, fontScale: 1, animationSpeed: 1, showGrid: true, showScanline: true, hudBrightness: 1, orbScale: 1, particlePreset: "dots" as any, neuralPreset: "cyber" as any, nameStyle: "hinglish" as any };
  // Analysis of Particle-System-Pro: 9 shapes + 10 fonts + 8 themes + 40k particles — mapped to presets
  const NEURAL = [
    { id: "cyber", name: "Cyber Neon", desc: "Cyan/Magenta", accent: "#00f0ff", secondary: "#ff00ff", gridOpacity: 0.06, anim: 1, orb: 1 },
    { id: "matrix", name: "Matrix", desc: "Green mono", accent: "#00ff41", secondary: "#003300", gridOpacity: 0.09, anim: 0.8, orb: 1.1 },
    { id: "royal", name: "Royal", desc: "Purple/Pink", accent: "#7c3aed", secondary: "#ec4899", gridOpacity: 0.05, anim: 1, orb: 1 },
    { id: "ocean", name: "Ocean", desc: "Blue/Cyan", accent: "#06b6d4", secondary: "#0ea5e9", gridOpacity: 0.07, anim: 1.1, orb: 0.95 },
    { id: "sunset", name: "Sunset", desc: "Orange/Red", accent: "#f97316", secondary: "#ef4444", gridOpacity: 0.06, anim: 1.2, orb: 1.05 },
    { id: "midnight", name: "Midnight", desc: "Dark minimal", accent: "#334155", secondary: "#0f172a", gridOpacity: 0.03, anim: 0.7, orb: 0.9 },
    { id: "fire", name: "Fire", desc: "Red/Gold — Pro Theme", accent: "#ef4444", secondary: "#f59e0b", gridOpacity: 0.08, anim: 1.3, orb: 1.12 },
    { id: "aurora", name: "Aurora", desc: "Teal/Violet", accent: "#10b981", secondary: "#8b5cf6", gridOpacity: 0.07, anim: 1, orb: 1 },
    { id: "gold", name: "Gold", desc: "Amber/Yellow", accent: "#eab308", secondary: "#fde68a", gridOpacity: 0.05, anim: 0.9, orb: 0.98 },
    { id: "candy", name: "Candy", desc: "Pink/Cyan — Pro", accent: "#ec4899", secondary: "#06b6d4", gridOpacity: 0.08, anim: 1.15, orb: 1.08 },
  ];
  // Particle-System-Pro shapes + base particles — 12 presets
  const PARTICLES = [
    { id: "dots", label: "Dots", desc: "Classic 40", icon: "• • •", shape: "dots" },
    { id: "stars", label: "Stars", desc: "Twinkle", icon: "✦ ✧", shape: "star" },
    { id: "lines", label: "Lines", desc: "Network", icon: "╱╲", shape: "wave" },
    { id: "bubbles", label: "Bubbles", desc: "Floating", icon: "○ ◌", shape: "sphere" },
    { id: "heart", label: "Heart", desc: "Pro Heart", icon: "♥", shape: "heart" },
    { id: "galaxy", label: "Galaxy", desc: "Spiral", icon: "🌀", shape: "galaxy" },
    { id: "dna", label: "DNA", desc: "Helix", icon: "🧬", shape: "dna" },
    { id: "cube", label: "Cube", desc: "3D Cube", icon: "⬢", shape: "cube" },
    { id: "torus", label: "Torus", desc: "Donut", icon: "◎", shape: "torus" },
    { id: "wave", label: "Wave", desc: "Ripple", icon: "〰️", shape: "wave" },
    { id: "spiral", label: "Spiral", desc: "Pro Spiral", icon: "🌀", shape: "spiral" },
    { id: "none", label: "None", desc: "Off", icon: "—", shape: "none" },
  ];
  const FONTS = [
    { id: "inter", label: "Inter", css: "Inter, sans-serif" },
    { id: "playfair", label: "Playfair", css: "'Playfair Display', serif" },
    { id: "bebas", label: "Bebas", css: "'Bebas Neue', sans-serif" },
    { id: "dancing", label: "Dancing", css: "'Dancing Script', cursive" },
    { id: "orbitron", label: "Orbitron", css: "Orbitron, monospace" },
    { id: "pacifico", label: "Pacifico", css: "Pacifico, cursive" },
    { id: "righteous", label: "Righteous", css: "Righteous, sans-serif" },
    { id: "lobster", label: "Lobster", css: "Lobster, cursive" },
    { id: "cinzel", label: "Cinzel", css: "Cinzel, serif" },
    { id: "monoton", label: "Monoton", css: "Monoton, cursive" },
  ];
  const NAMES = [
    { id: "hindi", label: "Hindi", desc: "शुद्ध हिंदी", lang: "hindi" },
    { id: "hinglish", label: "Hinglish", desc: "Roman mix", lang: "hinglish" },
    { id: "english", label: "English", desc: "Pure English", lang: "english" },
    { id: "mono", label: "Mono", desc: "Code", lang: "auto" },
  ];
  const applyNeural = (p: typeof NEURAL[0]) => {
    updateSettings({ accentColor: p.accent, secondaryAccentColor: p.secondary, appearance: { ...a, gridOpacity: p.gridOpacity, animationSpeed: p.anim, orbScale: p.orb, neuralPreset: p.id as any } as any });
  };
  const applyParticle = (p: typeof PARTICLES[0]) => {
    const on = p.id !== "none";
    updateSettings({ particles: on, appearance: { ...a, particlePreset: p.id as any } as any });
    // Also set CSS var for ParticleBackground shape hint
    try { document.documentElement.style.setProperty("--particle-shape", p.shape); } catch {}
  };
  const applyFont = (f: typeof FONTS[0]) => {
    updateSettings({ appearance: { ...a, nameStyle: f.id as any } as any });
    try { document.documentElement.style.setProperty("--pika-font", f.css); } catch {}
  };
  const applyName = (n: typeof NAMES[0]) => {
    updateSettings({ chatLanguageStyle: n.lang as any, appearance: { ...a, nameStyle: n.id as any } as any });
  };
  const exportPreset = () => {
    const data = { accent: settings.accentColor, secondary: settings.secondaryAccentColor, appearance: a, chatLanguageStyle: settings.chatLanguageStyle, ts: new Date().toISOString(), source: "Particle-System-Pro-inspired" };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const ael = document.createElement("a"); ael.href = url; ael.download = `pika-preset-${Date.now()}.json`; ael.click(); URL.revokeObjectURL(url);
  };
  const importPreset = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => { try { const d = JSON.parse(String(r.result)); if (d.accent) updateSettings({ accentColor: d.accent }); if (d.secondary) updateSettings({ secondaryAccentColor: d.secondary }); if (d.appearance) updateSettings({ appearance: { ...a, ...d.appearance } as any }); if (d.chatLanguageStyle) updateSettings({ chatLanguageStyle: d.chatLanguageStyle }); } catch {} }; r.readAsText(f);
  };
  return (
    <Section icon={Layers} title="🎨 Presets — Neural • Particle • Font • Name (choose & apply)">
      <p className="mb-3 text-xs text-white/50">Particle-System-Pro analysis: 9 shapes (Heart/Sphere/Torus/Galaxy/DNA/Cube/Wave/Star/Spiral) + 10 fonts + 8 themes + 40k particles + audio/magnetic/ripple — yahan presets me map kiya. Bina kuch hataye.</p>
      <div className="space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-white/70">Neural HUD — 10 Themes (Pro)</span><span className="text-[10px] text-white/30">40k vibe</span></div>
          <div className="grid grid-cols-5 gap-2">
            {NEURAL.map(p => {
              const active = (a as any).neuralPreset === p.id;
              return <button key={p.id} onClick={() => applyNeural(p)} className={`rounded-xl p-2 text-left border transition ${active ? "border-[var(--accent)] bg-[var(--accent)]/15" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                <div className="h-7 w-full rounded-lg mb-1.5 border border-white/5" style={{ background: `linear-gradient(135deg, ${p.accent}, ${p.secondary})` }} />
                <div className="text-xs font-bold text-white leading-none">{p.name}</div>
                <div className="text-[10px] text-white/40">{p.desc}</div>
                {active && <span className="mt-1 inline-block rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] text-emerald-300">✓ Active</span>}
              </button>
            })}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-white/70">Particles — 12 Shapes (Pro morph)</span><span className="text-[10px] text-white/30">Three.js vibe</span></div>
          <div className="grid grid-cols-6 gap-1.5">
            {PARTICLES.map(p => {
              const active = ((a as any).particlePreset || (settings.particles ? "dots" : "none")) === p.id;
              return <button key={p.id} onClick={() => applyParticle(p)} className={`rounded-xl p-2 text-center border transition ${active ? "border-cyan-400 bg-cyan-400/15 text-cyan-300" : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]"}`}>
                <div className="text-sm">{p.icon}</div>
                <div className="text-[11px] font-semibold leading-none">{p.label}</div>
                <div className="text-[9px] opacity-60">{p.desc}</div>
              </button>
            })}
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold text-white/70">Fonts — 10 Switchable (Pro text morph)</div>
          <div className="grid grid-cols-5 gap-1.5">
            {FONTS.map(f => {
              const active = (a as any).nameStyle === f.id;
              return <button key={f.id} onClick={() => applyFont(f)} style={{ fontFamily: f.css }} className={`rounded-xl p-2 text-center border transition ${active ? "border-purple-400 bg-purple-500/15 text-purple-200" : "border-white/10 bg-white/[0.03] text-white/60"}`}>
                <div className="text-xs font-bold truncate">Aa</div>
                <div className="text-[10px] truncate">{f.label}</div>
              </button>
            })}
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold text-white/70">Name / Language</div>
          <div className="grid grid-cols-4 gap-1.5">
            {NAMES.map(n => {
              const active = ((a as any).nameStyle || settings.chatLanguageStyle) === n.id || ((a as any).nameStyle === undefined && settings.chatLanguageStyle === n.lang);
              return <button key={n.id} onClick={() => applyName(n)} className={`rounded-xl p-2 text-center border transition ${active ? "border-purple-400 bg-purple-500/15 text-purple-200" : "border-white/10 bg-white/[0.03] text-white/60"}`}>
                <div className="text-xs font-bold">{n.label}</div>
                <div className="text-[10px] opacity-60">{n.desc}</div>
              </button>
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
          <button onClick={exportPreset} className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white">⬇️ Export Preset JSON</button>
          <label className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white cursor-pointer">⬆️ Import JSON<input type="file" accept=".json" className="hidden" onChange={importPreset} /></label>
          <button onClick={() => { const ids = NEURAL.map(n=>n.id); const pick = NEURAL[Math.floor(Math.random()*NEURAL.length)]; applyNeural(pick); const p = PARTICLES[Math.floor(Math.random()*PARTICLES.length)]; applyParticle(p); }} className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-black">🎲 Randomize Pro</button>
          <span className="text-[11px] text-white/30 self-center">Bina kuch hataye — export/import + randomize</span>
        </div>
      </div>
    </Section>
  );
}

function SubAgentsSection() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const [isAdding, setIsAdding] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: "",
    role: "",
    desc: "",
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    systemPrompt: "",
    tools: ["web_search", "file_edit"],
  });

  const baseSubAgents = [
    {
      id: "researcher",
      name: "🔍 Researcher Agent",
      role: "Live Web & DuckDuckGo Search",
      model: "DuckDuckGo + Mistral / Groq",
      desc: "इंटरनेट पर लाइव रिसर्च करके जानकारी और एरर सॉल्यूशन्स फ़िल्टर करता है।",
      tools: ["duckduckgo_search", "web_fetch", "summarize"],
    },
    {
      id: "coder",
      name: "💻 Coder & Script Agent",
      role: "Code Generation & Debugging",
      model: "Cerebras / DeepSeek V3",
      desc: "सटीक Python/JavaScript कोड लिखना, स्क्रिप्ट्स बनाना और फाइलें एडिट करना।",
      tools: ["write_file", "edit_file", "shell_exec"],
    },
    {
      id: "vision",
      name: "👁️ Vision & Screen Agent",
      role: "Multimodal Screen Perception",
      model: "Gemini 1.5 Flash / Groq Vision",
      desc: "सक्रिय स्क्रीन और तस्वीरों को देखकर एरर कोड, चार्ट और यूआई को समझाना।",
      tools: ["screen_capture", "vision_analyze", "ocr_read"],
    },
    {
      id: "obsidian",
      name: "📓 Obsidian Memory Agent",
      role: "Second Brain & PKM Sync",
      model: "Local REST API + AI",
      desc: "Obsidian Vault में नोट्स, डेली नोट्स और लॉन्ग-टर्म मेमोरी को सिंक रखना।",
      tools: ["obsidian_read", "obsidian_write", "obsidian_search"],
    },
    {
      id: "devops",
      name: "⚡ DevOps & Terminal Agent",
      role: "Windows & Hardware Automation",
      model: "Local OS PowerShell Bridge",
      desc: "सिस्टम प्रोसेसेस, वॉल्यूम, ब्राइटनेस, नेटवर्क और बैकग्राउंड टास्क्स को कंट्रोल करना।",
      tools: ["run_command", "kill_process", "system_health"],
    },
  ];

  const customAgents = settings.customSubAgents || [];

  const handleCreateAgent = () => {
    if (!newAgent.name.trim() || !newAgent.role.trim()) {
      alert("कृपया सब-एजेंट का नाम और रोल भरें।");
      return;
    }
    const created = {
      id: `custom_${Date.now()}`,
      name: newAgent.name.trim(),
      role: newAgent.role.trim(),
      desc: newAgent.desc.trim() || `${newAgent.name} - ${newAgent.role}`,
      provider: newAgent.provider,
      model: newAgent.model || "default",
      systemPrompt: newAgent.systemPrompt,
      tools: newAgent.tools,
      enabled: true,
    };
    updateSettings({
      customSubAgents: [...customAgents, created],
    });
    setNewAgent({
      name: "",
      role: "",
      desc: "",
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      systemPrompt: "",
      tools: ["web_search", "file_edit"],
    });
    setIsAdding(false);
    sounds.success();
  };

  const removeCustomAgent = (id: string) => {
    updateSettings({
      customSubAgents: customAgents.filter((a) => a.id !== id),
    });
  };

  const toggleCustomAgent = (id: string) => {
    updateSettings({
      customSubAgents: customAgents.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
    });
  };

  const toggleTool = (tool: string) => {
    setNewAgent((prev) => ({
      ...prev,
      tools: prev.tools.includes(tool) ? prev.tools.filter((t) => t !== tool) : [...prev.tools, tool],
    }));
  };

  const AVAILABLE_TOOLS = [
    { id: "web_search", label: "🔍 Web Search (DuckDuckGo)" },
    { id: "file_edit", label: "💻 File & Code Generator" },
    { id: "screen_vision", label: "👁️ Vision Perception" },
    { id: "obsidian_sync", label: "📓 Obsidian Vault Sync" },
    { id: "shell_exec", label: "⚡ Terminal Automation" },
  ];

  return (
    <Section icon={Bot} title="🤖 सब-एजेंट टीम (Sub-Agent Swarm Manager)">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-white/50">
          विशेषीकृत सब-एजेंट्स टास्क के अनुसार काम करते हैं। आप कस्टम सब-एजेंट्स भी बना सकते हैं:
        </p>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-1 rounded-lg bg-[var(--accent)]/20 px-2.5 py-1 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/30 transition shrink-0 ml-2"
        >
          <Plus size={14} />
          {isAdding ? "रद्द करें" : "नया एजेंट जोड़ें"}
        </button>
      </div>

      {/* Add Custom Sub-Agent Form */}
      {isAdding && (
        <div className="mb-4 rounded-xl bg-white/[0.06] p-4 border border-[var(--accent)]/30 space-y-3">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Plus size={14} className="text-[var(--accent)]" />
            कस्टम सब-एजेंट बनाएं (Create Sub-Agent)
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={newAgent.name}
              onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
              placeholder="एजेंट का नाम (e.g. 📊 Data Analyst)"
              className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white outline-none placeholder-white/30"
            />
            <input
              value={newAgent.role}
              onChange={(e) => setNewAgent({ ...newAgent, role: e.target.value })}
              placeholder="रोल (e.g. Python Scraper & Analytics)"
              className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white outline-none placeholder-white/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={newAgent.provider}
              onChange={(e) => setNewAgent({ ...newAgent, provider: e.target.value })}
              className="rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-xs text-cyan-300 outline-none"
            >
              {PROVIDERS.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.name} ({pr.id})
                </option>
              ))}
            </select>
            <input
              value={newAgent.model}
              onChange={(e) => setNewAgent({ ...newAgent, model: e.target.value })}
              placeholder="Model (e.g. llama-3.3-70b-versatile)"
              className="rounded-lg bg-white/5 px-3 py-2 text-xs font-mono text-cyan-300 outline-none placeholder-white/30"
            />
          </div>
          <textarea
            value={newAgent.systemPrompt}
            onChange={(e) => setNewAgent({ ...newAgent, systemPrompt: e.target.value })}
            placeholder="सिस्टम प्रॉम्प्ट / निर्देश (e.g. You are a specialized data scraper agent...)"
            rows={2}
            className="w-full rounded-lg bg-white/5 px-3 py-2 text-xs text-white outline-none placeholder-white/30"
          />
          <div>
            <span className="block text-[11px] text-white/50 mb-1.5">उपलब्ध टूल्स चुनें (Assign Tools):</span>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_TOOLS.map((t) => {
                const active = newAgent.tools.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTool(t.id)}
                    className={`rounded-lg px-2 py-1 text-[11px] font-mono transition ${
                      active
                        ? "bg-purple-500/30 text-purple-200 border border-purple-400/50"
                        : "bg-white/5 text-white/40 hover:bg-white/10"
                    }`}
                  >
                    {active ? "✓ " : "+ "}
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setIsAdding(false)}
              className="rounded-lg px-3 py-1.5 text-xs text-white/50 hover:text-white"
            >
              रद्द करें
            </button>
            <GlowButton onClick={handleCreateAgent}>सेव और एक्टिव करें</GlowButton>
          </div>
        </div>
      )}

      {/* Sub-Agents List */}
      <div className="space-y-2.5">
        {/* User-defined custom sub-agents */}
        {customAgents.map((ag) => (
          <div
            key={ag.id}
            className="rounded-xl bg-purple-500/[0.07] p-3 border border-purple-500/20 transition hover:bg-purple-500/[0.1]"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-purple-200">{ag.name}</span>
              <div className="flex items-center gap-2">
                <Toggle on={ag.enabled} onClick={() => toggleCustomAgent(ag.id)} />
                <button
                  onClick={() => removeCustomAgent(ag.id)}
                  className="text-red-400/70 hover:text-red-400 transition ml-1"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-white/70">{ag.role}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-white/40">Provider:</span>
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-cyan-300 font-mono capitalize">{ag.provider} ({ag.model})</span>
              <span className="ml-auto flex flex-wrap gap-1">
                {ag.tools.map((t) => (
                  <span key={t} className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] text-purple-300 font-mono">
                    {t}
                  </span>
                ))}
              </span>
            </div>
          </div>
        ))}

        {/* Base sub-agents */}
        {baseSubAgents.map((ag) => (
          <div key={ag.id} className="rounded-xl bg-white/[0.04] p-3 border border-white/5 transition hover:bg-white/[0.07]">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">{ag.name}</span>
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                ACTIVE ✓
              </span>
            </div>
            <p className="mt-1 text-xs text-white/60">{ag.desc}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-white/40">Model:</span>
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-cyan-300 font-mono">{ag.model}</span>
              <span className="ml-auto flex flex-wrap gap-1">
                {ag.tools.map((t) => (
                  <span key={t} className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[10px] text-purple-300 font-mono">
                    {t}
                  </span>
                ))}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function CustomProvidersSection() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const apiHealthStore = useStore((s) => s.apiHealth);
  const { sendRaw } = useAssistantApi();
  const list = settings.customProviders;

  const [testingMap, setTestingMap] = useState<Record<string, boolean>>({});
  const [healthMap, setHealthMap] = useState<Record<string, { status: "ok" | "error"; latencyMs?: number; error?: string; models?: string[] }>>({});
  const [showKeyMap, setShowKeyMap] = useState<Record<string, boolean>>({});

  const add = () => {
    updateSettings({
      customProviders: [
        ...list,
        { id: crypto.randomUUID(), name: "OmniRoute Local", baseUrl: "http://localhost:20128/v1", model: "gemini-2.5-flash", apiKey: "" },
      ],
    });
  };

  const patch = (id: string, p: Partial<(typeof list)[0]>) =>
    updateSettings({ customProviders: list.map((c) => (c.id === id ? { ...c, ...p } : c)) });

  const remove = (id: string) =>
    updateSettings({ customProviders: list.filter((c) => c.id !== id) });

  const handleTest = async (c: (typeof list)[0]) => {
    setTestingMap((s) => ({ ...s, [c.id]: true }));
    sounds.click();
    try {
      // 1. Send WebSocket backend proxy test (Zero-CORS, checks local port 20128 & fetches live models)
      sendRaw({
        type: "test_provider_backend",
        params: {
          provider: c.name,
          baseUrl: c.baseUrl,
          apiKey: c.apiKey,
        },
        id: crypto.randomUUID(),
      } as any);

      // 2. Client test for external HTTPS URLs
      if (!c.baseUrl.includes("localhost") && !c.baseUrl.includes("127.0.0.1")) {
        const res = await testCustomProvider(c.baseUrl, c.apiKey);
        setHealthMap((s) => ({ ...s, [c.id]: res }));
        if (res.status === "ok") {
          sounds.success();
          if (res.models && res.models.length > 0 && (!c.model || c.model === "model-name")) {
            patch(c.id, { model: res.models[0] });
          }
        }
      }
    } catch {
      // WebSocket backend will deliver the live models
    } finally {
      setTimeout(() => setTestingMap((s) => ({ ...s, [c.id]: false })), 800);
    }
  };

  return (
    <Section icon={Zap} title="कस्टम AI प्रोवाइडर">
      <p className="mb-3 text-xs text-white/50">
        कोई भी OpenAI-compatible endpoint जोड़ें (OmniRoute, LM Studio, vLLM, Ollama, Together, आदि) — नाम, Base URL, लाइव मॉडल फेच और API key सब सपोर्टेड!
      </p>
      <div className="space-y-3">
        {list.map((c) => {
          const health = apiHealthStore[c.name] || apiHealthStore[c.id] || healthMap[c.id];
          const isTesting = testingMap[c.id];
          const isActive = settings.aiProvider === c.id;

          return (
            <div key={c.id} className="space-y-2.5 rounded-xl bg-white/[0.03] p-3 border border-white/5">
              {/* Header row: Name + Latency + Actions */}
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background: health?.status === "ok" ? "#22c55e" : health?.status === "error" ? "#ef4444" : "#6b7280",
                    boxShadow: `0 0 6px ${health?.status === "ok" ? "#22c55e" : health?.status === "error" ? "#ef4444" : "#6b7280"}`,
                  }}
                />
                <input
                  value={c.name}
                  onChange={(e) => patch(c.id, { name: e.target.value })}
                  placeholder="Provider Name (e.g. OmniRoute)"
                  className="flex-1 rounded-lg bg-white/5 px-3 py-1.5 text-sm font-semibold text-white outline-none placeholder-white/30"
                />
                {health?.latencyMs && (
                  <span className="text-[10px] text-white/40">{health.latencyMs}ms</span>
                )}
                <button
                  onClick={() => handleTest(c)}
                  disabled={isTesting}
                  className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10 hover:text-white transition disabled:opacity-40"
                >
                  <RefreshCw size={11} className={isTesting ? "animate-spin" : ""} />
                  <span>{isTesting ? "चेकिंग..." : "टेस्ट"}</span>
                </button>
                <button
                  onClick={() => remove(c.id)}
                  className="text-red-400/70 hover:text-red-400 transition ml-1"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {/* Base URL */}
              <input
                value={c.baseUrl}
                onChange={(e) => patch(c.id, { baseUrl: e.target.value })}
                placeholder="Base URL (e.g. http://localhost:20128/v1 or https://api.openai.com/v1)"
                className="w-full rounded-lg bg-white/5 px-3 py-1.5 font-mono text-xs text-white outline-none placeholder-white/25"
              />

              {/* Model selection & API Key */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Model dropdown if models available, else manual input */}
                {health?.models && health.models.length > 0 ? (
                  <div className="flex-1 flex items-center gap-1.5">
                    <select
                      value={c.model}
                      onChange={(e) => patch(c.id, { model: e.target.value })}
                      className="flex-1 rounded-lg bg-white/10 px-2.5 py-1.5 font-mono text-xs text-cyan-300 outline-none hover:bg-white/15 cursor-pointer"
                    >
                      {health.models.map((m) => (
                        <option key={m} value={m} className="bg-slate-900 text-white">
                          {m}
                        </option>
                      ))}
                    </select>
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-mono text-emerald-300 shrink-0">
                      ⚡ {health.models.length} models
                    </span>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center gap-1.5">
                    <input
                      value={c.model}
                      onChange={(e) => patch(c.id, { model: e.target.value })}
                      placeholder="Model Name (e.g. gemini-2.5-flash)"
                      className="flex-1 rounded-lg bg-white/5 px-3 py-1.5 font-mono text-xs text-cyan-300 outline-none placeholder-white/25"
                    />
                    <button
                      onClick={() => handleTest(c)}
                      disabled={isTesting}
                      className="text-[10px] text-cyan-400/80 hover:text-cyan-300 underline whitespace-nowrap"
                    >
                      Fetch live models
                    </button>
                  </div>
                )}

                {/* API Key */}
                <div className="relative flex-1 min-w-[140px]">
                  <input
                    type={showKeyMap[c.id] ? "text" : "password"}
                    value={c.apiKey}
                    onChange={(e) => patch(c.id, { apiKey: e.target.value })}
                    placeholder="API Key (optional if local)"
                    className="w-full rounded-lg bg-white/5 px-3 py-1.5 pr-8 font-mono text-xs text-white outline-none placeholder-white/25"
                  />
                  <button
                    onClick={() => setShowKeyMap((s) => ({ ...s, [c.id]: !s[c.id] }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    {showKeyMap[c.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>

                {/* Active / Use button */}
                <button
                  onClick={() => {
                    updateSettings({ aiProvider: c.id });
                    sounds.success();
                  }}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? "bg-[var(--accent)] text-black shadow-lg shadow-[var(--accent)]/30 font-bold"
                      : "bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
                  }`}
                >
                  {isActive ? "Active ✓" : "Use"}
                </button>
              </div>

              {/* Status / error message */}
              {health?.status === "error" && health.error && (
                <p className="text-[10px] text-red-300/80">⚠️ {health.error}</p>
              )}
            </div>
          );
        })}
      </div>
      <GlowButton onClick={add} className="mt-3"><Plus size={14} /> नया प्रोवाइडर जोड़ें</GlowButton>
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

function CloudflareDeploymentSection() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const ip = useLocalIP();
  const [pagesUrl, setPagesUrl] = useState(() => localStorage.getItem("pika_cf_pages_url") || "https://pika.pages.dev");
  const [tunnelUrl, setTunnelUrl] = useState(() => localStorage.getItem("pika_cf_tunnel_url") || "");
  const [copied, setCopied] = useState<string | null>(null);
  const isConnected = useStore((s) => s.isConnected);

  const savePages = (v: string) => { setPagesUrl(v); localStorage.setItem("pika_cf_pages_url", v); };
  const saveTunnel = (v: string) => { setTunnelUrl(v); localStorage.setItem("pika_cf_tunnel_url", v); };

  const bridgeWs = settings.bridgeUrl || `ws://${ip}:8765`;
  const token = (() => { try { return localStorage.getItem("pika_ws_token") || ""; } catch { return ""; } })();
  const autoLink = (() => {
    if (!pagesUrl) return "";
    const base = pagesUrl.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (bridgeWs && bridgeWs !== "ws://localhost:8765") params.set("bridge", bridgeWs);
    else if (tunnelUrl) params.set("bridge", tunnelUrl);
    else params.set("bridge", bridgeWs);
    if (token) params.set("token", token.slice(0,16));
    // Cloudflare Tunnel wss hint
    if (tunnelUrl && tunnelUrl.startsWith("wss://")) params.set("mode", "tunnel");
    return `${base}?${params.toString()}`;
  })();

  const copyText = (t: string, id: string) => {
    navigator.clipboard.writeText(t);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Section icon={Database} title="☁️ Cloudflare Pages + Local Backend — Analysis & Auto-Connect">
      <p className="mb-3 text-xs text-white/50">Frontend Cloudflare Pages pe live, Backend local PC pe — kya achha, kya bekar, idea only (fix nahi). Browser me khule to websocket auto-connect link se kaise jode — yahi setting.</p>

      {/* Analysis */}
      <div className="grid gap-3 md:grid-cols-2 mb-4">
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3">
          <div className="text-xs font-bold text-emerald-300 mb-1.5">✅ Achha kya hai</div>
          <ul className="space-y-1 text-[11px] text-white/70 leading-relaxed">
            <li>• CDN global edge — Pages `https://pika.pages.dev` free, `dist/index.html` single-file seedha upload.</li>
            <li>• Phone QR se `?bridge=wss://` link — install bina demo, `PWA` cache offline shell.</li>
            <li>• `git push` auto deploy, `electron` alag — web demo + desktop full control parallel.</li>
            <li>• `wss://` tunnel se 4G se bhi local PC control (Dispatch jaisa).</li>
          </ul>
        </div>
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
          <div className="text-xs font-bold text-red-300 mb-1.5">⚠️ Bekar / Tutega kya</div>
          <ul className="space-y-1 text-[11px] text-white/70 leading-relaxed">
            <li>• `https` page → `ws://localhost` <b>Mixed Content Block</b> — browser `ws://` ko rok dega, `wss://` + cert chahiye.</li>
            <li>• `192.168.1.x` NAT — bahar se 4G connect nahi, dynamic IP, firewall.</li>
            <li>• Offline demo khatam — Pages ko net chahiye, PC band to frontend khulega par bridge dead.</li>
            <li>• Latency +15-30ms tunnel hop, `HOST 0.0.0.0` khula to WiFi attacker scan.</li>
          </ul>
        </div>
      </div>

      {/* Ideas */}
      <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-3 mb-4">
        <div className="text-xs font-bold text-cyan-300 mb-1.5">💡 Idea — bina kuch hataye (additive)</div>
        <ul className="space-y-1 text-[11px] text-white/70">
          <li>• <b>Cloudflared Tunnel</b> `cloudflared tunnel --url http://localhost:8765` → public `wss://pika-xxx.trycloudflare.com` — auto cert, no port-forward, `VITE_BRIDGE_URL=wss://...` Pages env me.</li>
          <li>• <b>Tailscale Funnel</b> private VPN — `wss://pika.tailnet.ts.net` — `ws_token` + Origin allowlist.</li>
          <li>• <b>BridgeUrl Env</b> `VITE_BRIDGE_URL` + `?bridge=` query override — browser link se auto-connect, fallback `ws://localhost:8765`.</li>
          <li>• <b>Hybrid</b>: Pages = demo/landing (read-only), Electron = full offline sab control — user choose.</li>
        </ul>
      </div>

      {/* Config */}
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-white/50">Cloudflare Pages URL (frontend live)</label>
          <div className="flex gap-2">
            <input value={pagesUrl} onChange={e=>savePages(e.target.value)} placeholder="https://pika.pages.dev" className="flex-1 rounded-lg bg-white/5 px-3 py-2 font-mono text-xs text-white outline-none placeholder-white/30" />
            <button onClick={()=>copyText(pagesUrl,"pages")} className="rounded-lg bg-white/10 px-3 text-xs text-white/70 hover:text-white">{copied==="pages"?<Check size={14} className="text-green-400"/>:<Copy size={14}/>}</button>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-white/50">Tunnel WSS URL (cloudflared / Tailscale) — khali to LAN ws:// use hoga</label>
          <div className="flex gap-2">
            <input value={tunnelUrl} onChange={e=>saveTunnel(e.target.value)} placeholder="wss://pika-xxx.trycloudflare.com" className="flex-1 rounded-lg bg-white/5 px-3 py-2 font-mono text-xs text-white outline-none placeholder-white/30" />
            <button onClick={()=>copyText(tunnelUrl,"tunnel")} className="rounded-lg bg-white/10 px-3 text-xs text-white/70 hover:text-white">{copied==="tunnel"?<Check size={14} className="text-green-400"/>:<Copy size={14}/>}</button>
          </div>
          <p className="mt-1 text-[10px] text-white/30">Local LAN test: <code className="bg-white/10 px-1 rounded text-cyan-300">ws://{ip}:8765</code> · Tunnel command: <code className="bg-white/10 px-1 rounded">cloudflared tunnel --url http://localhost:8765</code></p>
        </div>
        <div>
          <label className="mb-1 block text-xs text-white/50">Current Bridge URL (local backend) — Settings → Connection se sync</label>
          <div className="flex gap-2">
            <input value={bridgeWs} onChange={e=>updateSettings({ bridgeUrl: e.target.value })} className="flex-1 rounded-lg bg-white/5 px-3 py-2 font-mono text-xs text-white outline-none" />
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${isConnected?"bg-emerald-500/20 text-emerald-300":"bg-red-500/20 text-red-300"}`}>{isConnected?"ONLINE":"OFFLINE"}</span>
          </div>
        </div>
        <div className="rounded-xl bg-white/[0.06] p-3 border border-white/10">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-white">🔗 Auto-Connect Link (browser me khule to websocket auto-connect)</span>
            <button onClick={()=>copyText(autoLink,"autolink")} className="flex items-center gap-1 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-black hover:opacity-90">{copied==="autolink"?<Check size={14}/>:<Copy size={14}/>} {copied==="autolink"?"Copied":"Copy Link"}</button>
          </div>
          <code className="block break-all rounded bg-black/40 p-2 font-mono text-[11px] text-cyan-300">{autoLink}</code>
          <p className="mt-2 text-[11px] text-white/40">Kaise kaam karega: Browser `?bridge=wss://...&token=xxx` dekhega → `src/hooks/useAssistant.ts` `connect()` me `URLSearchParams` se `bridgeUrl` override → `localStorage:pika_ws_token` auto `auth` → direct `wss` connect, `wss` fail to `ws://localhost:8765` fallback. Link ko QR banao aur phone se scan karo — same WiFi/4G (tunnel pe) se bina type kiye connect.</p>
        </div>
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
