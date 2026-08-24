import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Key, Mic, Volume2, CheckCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { useStore } from "../store/assistantStore";

const PROVIDERS = [
  { id: "groq", name: "Groq", envVar: "GROQ_API_KEY", free: "30 req/min", url: "https://console.groq.com/keys" },
  { id: "gemini", name: "Google Gemini", envVar: "GEMINI_API_KEY", free: "15 RPM", url: "https://aistudio.google.com/apikey" },
  { id: "mistral", name: "Mistral", envVar: "MISTRAL_API_KEY", free: "1M tok/day", url: "https://console.mistral.ai/api-keys/" },
];

const STEPS = ["welcome", "provider", "apikey", "voice", "done"];

export default function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState("groq");
  const [apiKey, setApiKey] = useState("");
  const [voiceEngine, setVoiceEngine] = useState("edge");
  const store = useStore();

  const current = STEPS[step];

  function handleNext() {
    if (step < STEPS.length - 1) setStep(step + 1);
    else {
      // Save settings
      store.updateSettings({
        provider: selectedProvider,
        apiKey: apiKey,
        voiceTts: voiceEngine,
        voiceStt: "webspeech",
      });
      store.setOnboarded(true);
      onComplete();
    }
  }

  function handleBack() {
    if (step > 0) setStep(step - 1);
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg mx-4 rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900 to-gray-950 shadow-2xl overflow-hidden"
      >
        {/* Progress bar */}
        <div className="h-1 bg-gray-800">
          <motion.div
            className="h-full bg-gradient-to-r from-violet-500 to-cyan-500"
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {current === "welcome" && (
              <motion.div key="welcome" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white">Welcome to Pika AI</h1>
                    <p className="text-sm text-gray-400">Your personal desktop assistant</p>
                  </div>
                </div>
                <p className="text-gray-300 mb-4">
                  Pika AI aapke PC ko ek smart assistant banata hai. Ye voice se control hota hai,
                  system automate karta hai, aur aapki help karta hai daily tasks mein.
                </p>
                <div className="space-y-2 text-sm text-gray-400">
                  <p>✅ Voice commands (Hindi / English / Hinglish)</p>
                  <p>✅ System control (volume, brightness, apps)</p>
                  <p>✅ Code execution (Python REPL)</p>
                  <p>✅ File management & automation</p>
                  <p>✅ Privacy-first (data stays on your PC)</p>
                </div>
              </motion.div>
            )}

            {current === "provider" && (
              <motion.div key="provider" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-lg font-bold text-white mb-2">Choose AI Provider</h2>
                <p className="text-sm text-gray-400 mb-6">Kaunsa LLM service use karna hai? Free tier available hai.</p>
                <div className="space-y-3">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProvider(p.id)}
                      className={`w-full p-4 rounded-xl border text-left transition-all ${
                        selectedProvider === p.id
                          ? "border-violet-500 bg-violet-500/10"
                          : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-white">{p.name}</p>
                          <p className="text-xs text-gray-400">Free: {p.free}</p>
                        </div>
                        {selectedProvider === p.id && <CheckCircle className="w-5 h-5 text-violet-400" />}
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  Ollama (local, offline) bhi use kar sakte ho — baad mein settings mein configure karo.
                </p>
              </motion.div>
            )}

            {current === "apikey" && (
              <motion.div key="apikey" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-2 mb-2">
                  <Key className="w-5 h-5 text-violet-400" />
                  <h2 className="text-lg font-bold text-white">API Key</h2>
                </div>
                <p className="text-sm text-gray-400 mb-4">
                  {PROVIDERS.find((p) => p.id === selectedProvider)?.name} ka API key enter karo.
                </p>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your API key here..."
                  className="w-full p-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:border-violet-500 focus:outline-none"
                />
                <a
                  href={PROVIDERS.find((p) => p.id === selectedProvider)?.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-3 text-xs text-violet-400 hover:underline"
                >
                  Get free API key →
                </a>
                <p className="text-xs text-gray-500 mt-4">
                  API key bina bhi 80% features kaam karenge (system control, files, voice). LLM sirf chat ke liye chahiye.
                </p>
              </motion.div>
            )}

            {current === "voice" && (
              <motion.div key="voice" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-2 mb-2">
                  <Mic className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-lg font-bold text-white">Voice Setup</h2>
                </div>
                <p className="text-sm text-gray-400 mb-6">Text-to-Speech engine choose karo:</p>
                <div className="space-y-3">
                  <button
                    onClick={() => setVoiceEngine("edge")}
                    className={`w-full p-4 rounded-xl border text-left transition-all ${
                      voiceEngine === "edge"
                        ? "border-cyan-500 bg-cyan-500/10"
                        : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white">Edge TTS (Recommended)</p>
                        <p className="text-xs text-gray-400">Neural voice, Hindi + English, internet required</p>
                      </div>
                      {voiceEngine === "edge" && <CheckCircle className="w-5 h-5 text-cyan-400" />}
                    </div>
                  </button>
                  <button
                    onClick={() => setVoiceEngine("piper")}
                    className={`w-full p-4 rounded-xl border text-left transition-all ${
                      voiceEngine === "piper"
                        ? "border-cyan-500 bg-cyan-500/10"
                        : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white">Piper TTS (Offline)</p>
                        <p className="text-xs text-gray-400">Local, no internet needed, limited voices</p>
                      </div>
                      {voiceEngine === "piper" && <CheckCircle className="w-5 h-5 text-cyan-400" />}
                    </div>
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-4 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                  <Volume2 className="w-4 h-4 text-gray-400" />
                  <p className="text-xs text-gray-400">STT: WebSpeech (browser) ya Vosk (offline) — baad mein switch kar sakte ho</p>
                </div>
              </motion.div>
            )}

            {current === "done" && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">All Set!</h2>
                  <p className="text-gray-400 mb-6">
                    Pika AI ready hai. Voice button dabao ya type karo — main help karunga!
                  </p>
                  <div className="p-4 rounded-xl bg-gray-800/50 border border-gray-700 text-left text-sm">
                    <p className="text-gray-300 mb-2">Quick start:</p>
                    <p className="text-gray-400">🎤 Ctrl+Space — Push-to-Talk</p>
                    <p className="text-gray-400">⌨️ Ctrl+K — Command Palette</p>
                    <p className="text-gray-400">💬 Type "chrome kholo" — App launch</p>
                    <p className="text-gray-400">❓ Press ? — All shortcuts</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <button
              onClick={handleBack}
              disabled={step === 0}
              className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-6 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-violet-500 to-cyan-500 text-white hover:opacity-90 transition-opacity"
            >
              {step === STEPS.length - 1 ? "Start Pika" : "Next"} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
