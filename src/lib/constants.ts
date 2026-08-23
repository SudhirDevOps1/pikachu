// ============================================================================
// Pika AI Assistant — App names, website shortcuts, providers and command maps
// ============================================================================

export const APP_LIST: { name: string; key: string; icon: string }[] = [
  { name: "Chrome", key: "chrome", icon: "🌐" },
  { name: "Firefox", key: "firefox", icon: "🦊" },
  { name: "Brave", key: "brave", icon: "🦁" },
  { name: "VS Code", key: "code", icon: "💻" },
  { name: "Notepad", key: "notepad", icon: "📝" },
  { name: "Terminal", key: "wt", icon: "⌨️" },
  { name: "File Explorer", key: "explorer", icon: "📂" },
  { name: "Spotify", key: "spotify", icon: "🎵" },
  { name: "VLC", key: "vlc", icon: "🎬" },
  { name: "Telegram", key: "telegram", icon: "✈️" },
  { name: "Discord", key: "discord", icon: "🎮" },
  { name: "Word", key: "winword", icon: "📘" },
  { name: "Excel", key: "excel", icon: "📗" },
  { name: "PowerPoint", key: "powerpnt", icon: "📙" },
  { name: "Paint", key: "mspaint", icon: "🎨" },
  { name: "Calculator", key: "calc", icon: "🧮" },
  { name: "Settings", key: "ms-settings:", icon: "⚙️" },
  { name: "Task Manager", key: "taskmgr", icon: "📊" },
  { name: "Control Panel", key: "control", icon: "🛠️" },
  { name: "Command Prompt", key: "cmd", icon: "🖥️" },
];

export const WEBSITE_LIST: { name: string; url: string; icon: string }[] = [
  { name: "YouTube", url: "https://youtube.com", icon: "▶️" },
  { name: "Google", url: "https://google.com", icon: "🔍" },
  { name: "GitHub", url: "https://github.com", icon: "🐙" },
  { name: "Gmail", url: "https://mail.google.com", icon: "✉️" },
  { name: "Twitter / X", url: "https://x.com", icon: "🐦" },
  { name: "Facebook", url: "https://facebook.com", icon: "📘" },
  { name: "Instagram", url: "https://instagram.com", icon: "📸" },
  { name: "WhatsApp", url: "https://web.whatsapp.com", icon: "💬" },
  { name: "StackOverflow", url: "https://stackoverflow.com", icon: "📚" },
  { name: "Wikipedia", url: "https://wikipedia.org", icon: "📖" },
  { name: "Reddit", url: "https://reddit.com", icon: "👽" },
  { name: "LinkedIn", url: "https://linkedin.com", icon: "💼" },
  { name: "Amazon", url: "https://amazon.in", icon: "🛒" },
  { name: "Flipkart", url: "https://flipkart.com", icon: "🛍️" },
  { name: "Netflix", url: "https://netflix.com", icon: "🍿" },
  { name: "Hotstar", url: "https://hotstar.com", icon: "⭐" },
  { name: "OmniRoute", url: "http://127.0.0.1:20128", icon: "🌐" },
  { name: "Ollama", url: "http://127.0.0.1:11434", icon: "🦙" },
  { name: "LM Studio", url: "http://127.0.0.1:1234", icon: "🤖" },
];

export interface Provider {
  id: string;
  name: string;
  model: string;
  keyEnv: string;
  desc: string;
}

export const PROVIDERS: Provider[] = [
  { id: "groq", name: "Groq", model: "llama-3.3-70b-versatile", keyEnv: "GROQ_API_KEY", desc: "सबसे तेज़ · Fastest (Llama 3.3, R1, Mixtral)" },
  { id: "gemini", name: "Google AI Studio", model: "gemini-2.0-flash", keyEnv: "GEMINI_API_KEY", desc: "Gemini 2.0 Flash / Pro · Multimodal" },
  { id: "nvidia", name: "Nvidia NIM", model: "meta/llama-3.3-70b-instruct", keyEnv: "NVIDIA_API_KEY", desc: "Nvidia Enterprise Cloud AI" },
  { id: "together", name: "Together AI", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", keyEnv: "TOGETHER_API_KEY", desc: "Open-source Model Hub" },
  { id: "cohere", name: "Cohere", model: "command-r-plus", keyEnv: "COHERE_API_KEY", desc: "Command R+ · Reasoning" },
  { id: "mistral", name: "Mistral", model: "mistral-small-latest", keyEnv: "MISTRAL_API_KEY", desc: "1M tokens/day · Pixtral" },
  { id: "cerebras", name: "Cerebras", model: "llama-3.3-70b", keyEnv: "CEREBRAS_API_KEY", desc: "Ultra-fast Wafer Inference" },
  { id: "openrouter", name: "OpenRouter", model: "meta-llama/llama-3.3-70b-instruct:free", keyEnv: "OPENROUTER_API_KEY", desc: "100+ Free & Paid Models" },
  { id: "deepseek", name: "DeepSeek", model: "deepseek-chat", keyEnv: "DEEPSEEK_API_KEY", desc: "DeepSeek V3 / R1" },
  { id: "ollama", name: "Ollama (Local)", model: "llama3.2:3b", keyEnv: "OLLAMA_API_KEY", desc: "100% Offline Local Models" },
  { id: "zai", name: "Z.ai", model: "glm-4-flash", keyEnv: "ZAI_API_KEY", desc: "GLM · 100/day" },
  { id: "omniroute", name: "OmniRoute", model: "gemini-2.5-flash", keyEnv: "OMNIROUTE_API_KEY", desc: "Local API Router" },
];

export const SUGGESTIONS: string[] = [
  "volume up",
  "volume down",
  "volume 50%",
  "mute",
  "open chrome",
  "open notepad",
  "open youtube",
  "screenshot लो",
  "battery dikhao",
  "cpu usage",
  "ram usage",
  "lock computer",
  "play music",
  "next song",
  "calculate 25 * 4",
  "weather delhi",
  "switch to gemini",
  "namaste",
];

export const EMOTIONAL_RESPONSES: { keywords: string[]; response: string }[] = [
  { keywords: ["thak gaya", "tired", "थक गया"], response: "आराम करो, थोड़ा पानी पीओ ☕ थोड़ी देर ब्रेक लो।" },
  { keywords: ["bored", "bore ho raha", "बोर"], response: "बोरियत दूर करते हैं! 🎵 गाना सुनो, या YouTube खोलूं?" },
  { keywords: ["sad", "dukhi", "दुखी", "udaas"], response: "हर मुश्किल के बाद आसानी आती है 🌈 खुद पर भरोसा रखो! तुम कर सकते हो।" },
  { keywords: ["happy", "khush", "खुश"], response: "बहुत बढ़िया! 😄 खुशियाँ ऐसे ही बनी रहें।" },
  { keywords: ["hello", "hi", "hey", "namaste", "नमस्ते"], response: "नमस्ते! ⚡ मैं पिका हूँ। मैं आपकी क्या मदद कर सकता हूँ?" },
  { keywords: ["thank", "thanks", "shukriya", "धन्यवाद"], response: "आपका स्वागत है! 🙏 और कुछ चाहिए तो बताइए।" },
];

// Quantity hints for smart parsing (Hinglish)
export const QUANTITY_HINTS: Record<string, number> = {
  thoda: 5,
  "थोड़ा": 5,
  bahut: 20,
  "बहुत": 20,
  "ek dam": 100,
  "एकदम": 100,
};
