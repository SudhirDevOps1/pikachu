# ⚡ Pika AI Assistant (पिका एआई असिस्टेंट)

<div align="center">

[![Version](https://img.shields.io/badge/version-1.0.0-7c3aed.svg?style=for-the-badge)](https://github.com/SudhirDevOps1/pikachu)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981.svg?style=for-the-badge)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.10%20%7C%203.11%20%7C%203.12-3b82f6.svg?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B%20%7C%2020%2B%20%7C%2022%2B-22c55e.svg?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11%20%7C%20Linux%20%7C%20macOS-f59e0b.svg?style=for-the-badge)](https://github.com/SudhirDevOps1/pikachu)

**आपका व्यक्तिगत Jarvis-स्तरीय ऑटोनॉमस PC AI असिस्टेंट**  
*A privacy-first, ultra-responsive Desktop AI Assistant with natural Hindi/English/Hinglish speech, full PC automation, Obsidian second brain integration, and multi-LLM rotation.*

[🚀 Quick Start](#-1-click-quick-start) • [✨ Features](#-key-features) • [🧠 Architecture](#-architecture) • [🗣️ Voice Commands](#️-voice--chat-commands-cheatsheet) • [📓 Obsidian Setup](#-obsidian-second-brain-integration) • [⚠️ Limitations](#-limitations--best-practices)

</div>

---

## 🌟 Highlights

- 🗣️ **Natural Hindi, English & Hinglish Voice AI** — Speaks in crystal-clear **Microsoft Neural HD Voice (`hi-IN-SwaraNeural` / `en-US-JennyNeural`)** with real-time browser Web Speech STT and offline **Vosk** backup.
- 🎭 **Dynamic Animated Avatar** — Facial expressions react live to speaking (lip-sync), listening (waveform aura rings), thinking (cyber holographic eyes), and idle states.
- 🤖 **Autonomous Agent Mode (Powered by Agent-Mini)** — Give high-level goals (*"Desktop par ek folder banao aur research notes likho"*) and Pika safely executes multi-step terminal, shell, and file tools locally.
- 📓 **Obsidian Second Brain Integration** — Real-time read/write, search, and daily note creation in your Obsidian Vault via Local REST API.
- ⚡ **Multi-LLM Provider & Key Auto-Rotation** — Supports Mistral, Groq, Google Gemini, DeepSeek, Cerebras, OpenRouter, and Local Ollama with comma-separated multiple keys (`key1,key2,key3`) for zero quota limits.
- 💻 **Complete PC Automation** — App launcher, volume/brightness control, process killer, system lock/sleep/shutdown, screenshot capture, live CPU/RAM/Battery HUD, and macro automation.
- 📱 **Mobile & LAN Access** — Control your PC from your smartphone browser over your home Wi-Fi network.

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

## 🔑 Multi-API Key Setup & Auto-Rotation

To prevent rate limits (`429 Too Many Requests`) and quota exhaustion:
1. Open **Pika AI Settings → AI Providers**.
2. In any provider's API key field, enter multiple keys separated by commas:
   ```text
   gsk_key1..., gsk_key2..., gsk_key3...
   ```
3. Pika automatically rotates through your keys if any key hits a quota or rate limit.

Alternatively, configure your keys in a `.env` file (see [`.env.example`](.env.example)).

---

## ⚠️ Limitations & Best Practices

1. **Microphone Access:** Web Speech STT requires browser microphone permission. Click "Allow" when prompted on first launch.
2. **System Commands Safety:** High-impact commands like `shutdown` and `restart` require explicit on-screen or voice confirmation.
3. **Obsidian Connectivity:** Ensure Obsidian is open with the Local REST API plugin enabled when issuing Obsidian vault commands.
4. **LAN / Mobile Access:** To access Pika from your phone, your phone and PC must be connected to the same Wi-Fi network.

---

## 🛡️ Privacy & Security

- **100% Local Storage:** Settings, chat history, and API keys are stored locally on your PC in `pika_data.json` and `.env` (never uploaded to any third-party telemetry).
- **Zero Cloud Tracking:** All OS automation and shell executions happen directly on your local machine.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Made with ❤️ by [SudhirDevOps1](https://github.com/SudhirDevOps1)**  
*पिका — आपका अपना भरोसेमंद, तेज़ और समझदार AI साथी।* ⚡

</div>
