# ⚡ Pika AI Assistant (पिका एआई असिस्टेंट)

<div align="center">

[![Version](https://img.shields.io/badge/version-1.1.0-7c3aed.svg?style=for-the-badge)](https://github.com/SudhirDevOps1/pikachu)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981.svg?style=for-the-badge)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.10%20%7C%203.11%20%7C%203.12-3b82f6.svg?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B%20%7C%2020%2B%20%7C%2022%2B-22c55e.svg?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11%20%7C%20Linux%20%7C%20macOS-f59e0b.svg?style=for-the-badge)](https://github.com/SudhirDevOps1/pikachu)

**आपका व्यक्तिगत Jarvis-स्तरीय ऑटोनॉमस PC AI असिस्टेंट (v1.1.0 Production Release)**  
*A privacy-first, ultra-responsive Desktop AI Assistant with natural Hindi/English/Hinglish speech, multi-agent swarm builder, screen vision perception, token analytics, full PC automation, and Obsidian integration.*

[🚀 Quick Start](#-1-click-quick-start) • [✨ Highlights](#-highlights) • [🤖 Sub-Agent Swarm](#-custom-sub-agent-swarm-manager) • [📊 Token Analytics](#-token-usage--analytics-dashboard) • [🏗️ Architecture](#-architecture) • [🗣️ Voice Commands](#️-voice--chat-commands-cheatsheet) • [📓 Obsidian Setup](#-obsidian-second-brain-integration)

</div>

---

## 🌟 Highlights

- 🗣️ **Natural Hindi, English & Hinglish Voice AI** — Speaks in crystal-clear **Microsoft Neural HD Voice (`hi-IN-SwaraNeural` / `en-US-JennyNeural`)** and **100% Offline Neural Piper TTS (`models/piper/hi.onnx`)** with anti-repeat deduplication and offline **Vosk STT** backup.
- 🔌 **100% Air-Gapped Offline Mode** — Complete zero-internet autonomy using **Vosk (STT) + Ollama (LLM) + Piper TTS (Neural Voice)**.
- 🔐 **Military-Grade Hardware Vault Encryption** — All API keys, settings, and memories in `pika_data.json` are automatically protected using **Windows Native DPAPI (User Master Key) + AES-256** against data theft.
- 🌐 **OmniRoute & Custom OpenAI Provider Live Discovery** — Zero-CORS backend proxy to fetch live models from OmniRoute (`:20128`), LM Studio, vLLM, Ollama, Together, and any custom endpoint with interactive model selector and latency check.
- 🤖 **Custom Sub-Agent Swarm Builder** — Create and configure your own specialized sub-agents with custom names, roles, system prompts, models, and interactive tool permissions (Web Search, File Creator, Vision, Obsidian, Terminal).
- 📊 **Persistent Token Analytics & Cost Dashboard** — Real-time tracking of Prompt, Completion, and Total tokens with provider-wise visual progress bars and zero data loss (`pika_data.json` encrypted vault persistence).
- 💬 **Interactive Chat Toolbar & Inline Prompt Editor** — One-click markdown copy, inline prompt editing with instant re-run, TTS voice replay, and retry actions on every message bubble.
- 🔍 **Native Windows Installed Software Scanner & Fast App Launcher** — Scans registry (`HKLM`/`HKCU`), Desktop, and Start Menu shortcuts (`.lnk`) to instantly open and control real desktop apps (Brave, VS Code, Obsidian, 7-Zip, Chrome, etc.) with 10ms response time.
- ☀️ **True Hardware Screen Brightness & Windows Power Controls** — Real hardware monitor brightness control (`screen_brightness_control`), Empty Recycle Bin, DNS Flush, Temp Clean, and Window Snap controls.
- 👁️ **Multimodal Screen Perception + DuckDuckGo Research** — Analyzes active window errors/charts, runs live DuckDuckGo web research, and delivers AI-filtered step-by-step solutions in natural Hinglish.
- 🧠 **Long-Term Memory Vault & Obsidian Second Brain** — Contextual memory that persists user preferences across sessions and syncs in real-time to your Obsidian Vault.
- ⚡ **Multi-Key Auto-Rotation** — Comma-separated API keys (`key1,key2,key3`) for unlimited zero-quota failover.

---

## 🏗️ Architecture

```
                               ┌────────────────────────────────────────┐
                               │   Web UI Frontend (React + Vite + HUD) │
                               │   http://localhost:3000                │
                               └──────────────────┬─────────────────────┘
                                                  │ WebSocket (Port 8765)
                                                  ▼
                               ┌────────────────────────────────────────┐
                               │   Python PC Bridge (pc_bridge.py)      │
                               │   ws://localhost:8765                  │
                               └───────┬──────────────────┬─────────────┘
                                       │                  │
                ┌──────────────────────┴───────┐   ┌──────┴─────────────────────┐
                ▼                              ▼   ▼                            ▼
   ┌───────────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐
   │ AI Brains (Cloud & Local) │  │  Voice Engines        │  │  PC & App Automation  │
   │ • Mistral / Groq / Gemini │  │  • Edge-TTS Neural HD │  │  • App Launch & Kill  │
   │ • DeepSeek / Cerebras     │  │  • Web Speech API     │  │  • System/Volume/Screen│
   │ • Agent-Mini Autonomous   │  │  • Vosk Offline STT   │  │  • Obsidian REST API  │
   └───────────────────────────┘  └───────────────────────┘  └───────────────────────┘
```

---

## 📋 Prerequisites & Requirements

Before running Pika AI, ensure you have:

| Component | Requirement | Description |
| :--- | :--- | :--- |
| **Operating System** | Windows 10 / 11 *(Linux / macOS supported)* | Full hardware automation tested on Windows. |
| **Python** | `3.10` or higher (3.12 recommended) | Runs `pc_bridge.py` and local tools. |
| **Node.js** | `v18.0.0` or higher (v20+ recommended) | Runs the Vite React UI dashboard. |
| **Browser** | Chrome, Edge, Brave, or Chromium | Recommended for Web Speech API & audio streaming. |
| **AI Keys (Optional)** | Groq, Mistral, Gemini, etc. | Free keys can be added in Settings or `.env`. |

---

## 🚀 1-Click Quick Start

### Method 1: The Zero-Configuration Windows Launcher (Recommended)
Simply double-click **`start.bat`** in the project folder.

It automatically:
1. Detects or installs Python & Node.js via `winget` if missing.
2. Creates an isolated Python virtual environment (`venv`).
3. Installs required Python packages (`requirements.txt`).
4. Installs frontend packages (`npm install`).
5. Checks offline voice models.
6. Registers the global **`pika`** CLI command in your terminal.
7. Spawns the PC Bridge, Web UI server, and opens `http://localhost:3000` in your default browser.

---

### Method 2: Global Terminal Command
Once installed, open any **Command Prompt** or **PowerShell** window and simply type:
```cmd
pika
```

---

### Method 3: Manual Startup (Cross-Platform)

```bash
# 1. Clone the repository
git clone https://github.com/SudhirDevOps1/pikachu.git
cd pikachu

# 2. Setup Python environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt

# 3. Setup Frontend
npm install

# 4. Start PC Bridge (Backend)
python pc_bridge.py

# 5. Start Web UI (Frontend - In a separate terminal)
npm run dev
```
Open **`http://localhost:3000`** in your browser!

---

## 🗣️ Voice & Chat Commands Cheatsheet

Pika understands natural Hindi, Hinglish, and English commands:

### 💻 PC & System Control
| Command (Hinglish / English) | Action |
| :--- | :--- |
| `open chrome` / `chrome kholo` | Opens Google Chrome |
| `open vs code` / `code kholo` | Opens Visual Studio Code |
| `volume 50%` / `awaaz badhao` | Sets or increases volume |
| `mute karo` / `mute volume` | Toggles audio mute |
| `brightness 80%` | Adjusts display brightness |
| `screenshot lo` / `take screenshot` | Captures and saves screen |
| `screen lock karo` / `lock pc` | Locks the Windows workstation |
| `battery kitni hai` / `battery check` | Reports live battery percentage and charging status |
| `list processes` / `processes dikhao` | Lists active applications and memory usage |
| `kill notepad` / `notepad band karo` | Terminates specified application |

---

### 📓 Obsidian Second Brain Commands
| Command | Action |
| :--- | :--- |
| `Obsidian me daily note banao` | Creates today's daily note in your Obsidian Vault |
| `Obsidian me files dikhao` | Lists all files and folders in your vault |
| `Obsidian me search karo <query>` | Searches vault for notes containing `<query>` |
| `Obsidian me note banao <name> with <content>` | Creates a new note with formatted Markdown text |
| `Obsidian me read karo <filename>` | Reads and speaks the content of a note |

---

### 🤖 Autonomous Agent Commands (Agent Mode ON)
| Command | Action |
| :--- | :--- |
| `Desktop par 'Project_Alpha' folder banao aur 3 files likho` | Autonomously creates directories and starter files |
| `Internet par DeepSeek V3 ki summary search karo` | Searches the live web and summarizes results |
| `Mere PC ka full system diagnostic report banao` | Collects CPU/RAM/Disk stats and compiles a report |

---

## 📓 Obsidian Second Brain Integration

To connect Pika to your Obsidian Vault:

1. Open **Obsidian** → Go to **Settings** (`Ctrl + ,`) → **Community Plugins**.
2. Search and install **Local REST API** plugin, then enable it.
3. In Local REST API settings:
   - Note the **API Key (Bearer Token)**.
   - Enable **Insecure Server** (Port `27123`) or Secure HTTPS (Port `27124`).
4. In **Pika AI Settings → Obsidian**:
   - Paste your API Key and URL (`http://127.0.0.1:27123`).
   - Click **"Test Connection"** (Shows `Connected ✓`).
5. All your notes are now seamlessly controllable via voice and AI!

---

## 🤖 Custom Sub-Agent Swarm Manager

Pika allows you to build an autonomous multi-agent swarm right from the UI:

1. Open **Settings (⚙️) → Sub-Agent Team (सब-एजेंट टीम)**.
2. Click **`+ नया एजेंट जोड़ें` (Add New Agent)**.
3. Configure your specialized agent:
   - **Name & Role:** e.g. `📊 Data Analyst`, `🛡️ Security Auditor`, `🌐 Deep Web Researcher`.
   - **AI Provider & Model:** Assign any cloud model (Groq Llama 3.1 70B, Gemini 2.0 Flash, Mistral Large, Nvidia NIM) or offline Local Ollama.
   - **Custom System Persona:** Provide specialized operational guidelines.
   - **Interactive Tool Toggles:** Assign granular permissions for `DuckDuckGo Search`, `File Writer`, `Screen Vision`, `Obsidian Sync`, and `Terminal Automation`.
4. Enable or disable sub-agents with a single toggle switch or delete them at will.

---

## 📊 Token Usage & Analytics Dashboard

Track your LLM consumption with permanent, zero-data-loss telemetry:
- 🔢 **Prompt Tokens:** Total prompt tokens submitted.
- ✍️ **Completion Tokens:** Generated AI response tokens.
- 🏆 **Total Tokens:** Cumulative total with cost-saving calculations.
- 📈 **Provider Progress Bars:** Visual percentage breakdown for each connected provider.
- 💾 **Permanent Disk Persistence:** All telemetry is mirrored between `localStorage` and `pika_data.json` so data survives system restarts.
- 🔄 **One-Click Reset:** Reset your token usage counter anytime.

---

## 💬 Interactive Chat Toolbar & Inline Prompt Editor

Every chat bubble in the UI includes an intuitive hover action bar:
- 📋 **Copy to Clipboard:** 1-click Markdown copy for user prompts and assistant answers with visual feedback.
- ✏️ **Inline Prompt Editor (User Prompts):** Click the pencil icon to modify past messages in-place with **"Save & Re-send (🚀)"** or **"Save Only"**.
- 🔊 **TTS Voice Replay:** Click the speaker icon on any assistant response to hear it read aloud in natural Hindi/English neural voice.
- 🔄 **One-Click Re-run:** Re-execute any past command instantly.

---

## 🔑 Multi-API Key Setup & Live Model Auto-Discovery

### Live Model Discovery
When you enter an API key for any of the 12 supported providers (Groq, Google AI Studio, Nvidia NIM, Together AI, Cerebras, Cohere, Mistral, Ollama Local, OpenRouter, DeepSeek, Z.ai, OmniRoute) and click **"Test"**, Pika automatically discovers and populates the dropdown with all currently active, live models available on that endpoint.

### Zero-Quota Failover (Key Auto-Rotation)
In any provider's API key field, enter multiple keys separated by commas:
```text
gsk_key1..., gsk_key2..., gsk_key3...
```
Pika automatically rotates to the next key if a rate limit (`429 Too Many Requests`) or quota limit is reached.

Alternatively, configure your keys in a `.env` file (see [`.env.example`](.env.example)).

---

## ⚠️ Limitations & Best Practices

1. **Microphone Access:** Web Speech STT requires browser microphone permission. Click "Allow" when prompted on first launch.
2. **System Commands Safety:** High-impact commands like `shutdown` and `restart` require explicit on-screen or voice confirmation.
3. **Obsidian Connectivity:** Ensure Obsidian is open with the Local REST API plugin enabled when issuing Obsidian vault commands.
4. **LAN / Mobile Access:** To access Pika from your phone, your phone and PC must be connected to the same Wi-Fi network.

---

## 🛡️ Privacy & Security

- **🔐 Windows DPAPI & AES-256 Vault Encryption:** All sensitive settings, custom provider endpoints, and API keys stored in `pika_data.json` are cryptographically encrypted using Windows Native DPAPI tied to your hardware TPM and Windows User Master Key. The file is unreadable in plaintext and cannot be decrypted on other computers.
- **🔌 100% Air-Gapped Local Mode:** When using Vosk STT, Piper TTS, and Ollama local models, Pika runs entirely offline without sending a single byte outside your PC.
- **Zero Cloud Tracking:** No analytics, telemetry, or external tracking servers. Everything stays strictly under your control.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Made with ❤️ by [SudhirDevOps1](https://github.com/SudhirDevOps1)**  
*पिका — आपका अपना भरोसेमंद, तेज़ और समझदार AI साथी।* ⚡

</div>
