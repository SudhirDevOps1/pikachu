# Pika AI Assistant

<div align="center">

[![Version](https://img.shields.io/badge/version-1.2.0-7c3aed.svg?style=for-the-badge)](https://github.com/SudhirDevOps1/pikachu)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981.svg?style=for-the-badge)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?style=for-the-badge&logo=react)](https://react.dev)
[![Electron](https://img.shields.io/badge/Electron-41-47848F.svg?style=for-the-badge&logo=electron)](https://www.electronjs.org)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB.svg?style=for-the-badge&logo=python)](https://www.python.org)
[![WebSocket](https://img.shields.io/badge/WebSocket-8765-010101.svg?style=for-the-badge)](pc_bridge.py)

**An open-source, voice-enabled Desktop AI Assistant with local system automation.**

*Hindi · English · Hinglish — Offline-first · Privacy-focused · Agentic*

[Features](#key-features) · [How It Works](#-how-it-works--kaise-kaam-karta-hai) · [Tech Stack](#-tech-stack--kiska-kya-use-hua) · [Quick Start](#getting-started) · [Voice Commands](#voice-commands) · [Architecture](#architecture)

</div>

---

## Overview

Pika AI is a highly capable personal AI assistant designed to integrate seamlessly with your Windows PC. It offers native text-to-speech (TTS), offline speech-to-text (STT), hardware-level system controls, and a multi-agent framework. Built with a React frontend and a Python WebSocket backend, Pika emphasizes privacy, offline capabilities, and extensive customizability.

> **Philosophy:** Light, fast, no heavy PyTorch on local PC. Cloud brains (Groq/Gemini) + local tools (agent-mini) = best of both worlds.

---

## Key Features

> *(Original features preserved — enhanced with new additions)*

- **Multilingual Voice AI**: Features high-quality TTS using Edge TTS (`hi-IN` / `en-US`) with a fallback to offline Piper TTS. Includes offline Vosk STT for fully disconnected usage.
- **Full Air-Gapped Offline Mode**: Capable of running with zero internet access by combining Vosk (STT), Ollama (Local LLM), and Piper TTS.
- **Hardware & Desktop Automation**: Natively controls Windows volume, screen brightness, processes, and fast application launching by scanning `HKLM`/`HKCU` and Start Menu shortcuts.
- **Agentic Swarm Framework**: Build and manage custom sub-agents with specific roles, system prompts, and tool permissions (Web Search, Screen Vision, File Management).
- **Obsidian Second Brain Integration**: Syncs conversations, creates notes, and searches your Obsidian vault natively using the Obsidian Local REST API.
- **Secure Data Storage**: Sensitive API keys and user preferences stored in `pika_data.json` are encrypted using Windows Native DPAPI (User Master Key) and AES-256.
- **Multi-API Key Rotation**: Automatically rotates through comma-separated API keys to seamlessly handle rate limits. Connects to Groq, Mistral, Gemini, DeepSeek, Ollama, and custom OmniRoute endpoints.
- **Token Telemetry**: Persistent token usage tracking across sessions, categorized by provider.

### ✨ New - Added in v1.2.0+

- **Command Palette (Ctrl+K)** — VS Code-style global search for every tab/action (`src/components/CommandPalette.tsx:1`)
- **Notes Hub (नोट्स)** — Markdown notes, pin, search, localStorage + Obsidian-ready (`src/components/NotesPanel.tsx:1`, `src/store/assistantStore.ts:324`)
- **Pomodoro / Focus Timer** — 25/5 timer with HUD, auto break/focus switch (`src/components/PomodoroHUD.tsx:1`)
- **Shortcuts Help (?)** — Press `?` for all hotkeys (`src/components/ShortcutsHelp.tsx:1`)
- **Terminal Panel** — PowerShell/bash execution via `pc_bridge.py:1480` `terminal.exec` (HOME-safe, blocked `rm -rf /`)
- **Enhanced Clipboard** — Search, pin, Bridge Sync (`clipboard/get`), Export (`src/components/ControlPanel.tsx:188`)
- **File Preview** — Image/text preview in Tools → File Manager

---

## 🧰 Tech Stack — Kiska Kya Use Hua

### Frontend — `package.json`

| Layer | Library | Version | Kaam |
|---|---|---|---|
| **UI Framework** | `react`, `react-dom` | 19.2.6 | Component model, hooks, concurrent rendering |
| **Language** | `typescript` | 5.9.3 | Type safety (`src/types/index.ts`) |
| **Build** | `vite`, `@vitejs/plugin-react` | 7.3.2 | HMR dev at `:3000`, singlefile prod `vite-plugin-singlefile` |
| **Styling** | `tailwindcss`, `@tailwindcss/vite` | 4.1.17 | Glassmorphism, aurora, tokens via `src/index.css` |
| **State** | `zustand` | 5.0.14 | Single store `src/store/assistantStore.ts` (persist to localStorage) |
| **Animation** | `framer-motion` | 12.42.2 | Page transitions, orb, PiP drag, palette |
| **Icons** | `lucide-react` | 1.22.0 | 60+ icons (consistent stroke) |
| **Charts** | `recharts` | 3.9.1 | `LiveMetricsChart`, `SystemHealthPanel` |
| **Desktop** | `electron`, `electron-builder` | 41.7.1 | `electron/main.cjs` + `preload.cjs` → native titlebar, tray, IPC |
| **Utils** | `clsx`, `tailwind-merge` | 2.1.1 | `cn()` in `src/utils/cn.ts` |
| **Dev** | `concurrently`, `wait-on`, `cross-env` | - | `start.bat` orchestrates `pc_bridge.py` + `vite` |

### Backend — `requirements.txt`

| Package | Purpose | Kahan use |
|---|---|---|
| `websockets>=13.0` | **MUST** `ws://0.0.0.0:8765` server | `pc_bridge.py:62` |
| `apscheduler>=3.10` | Cron scheduler | `cmd_scheduler` |
| `vosk>=0.3.45` | Offline Hindi STT (45 MB model) | `HAS_VOSK`, `VOSK_MODEL_DIR` |
| `edge-tts>=6.1.0` | Neural TTS `hi-IN-SwaraNeural` | `HAS_EDGE_TTS` |
| `piper-tts` | Offline TTS fallback | `ttsEngine=piper` |
| `pyautogui>=0.9.54` | Mouse/keyboard, volume keys | `atomic_clipboard_inject`, `bezier_move` |
| `pygetwindow` | Window focus/enum | `cmd_window: focus` |
| `pyperclip>=1.8.2` | Clipboard R/W | `cmd_clipboard` |
| `screen_brightness_control` | Brightness | `cmd_screen: brightness_set` |
| `psutil>=5.9.0` | CPU/RAM/Disk/Battery/IP | `cmd_info`, `systemStatus` poll |
| `cryptography>=43.0` | Fernet AES-256 fallback | `save_vault_data()` |
| `pywin32>=306` | DPAPI `CryptProtectData` | `load_vault_data()` (Windows) |
| `requests`, `aiohttp`, `python-dotenv` | HTTP + env | LLM router, weather, connectors |
| `agent-mini`, `Pillow`, `duckduckgo-search` | Agent + vision + research | `agent_mini/agent.py` |
| `pytest`, `pytest-asyncio` | Tests | `tests/`, `vitest` bridge |

### OS / System

| API | Use |
|---|---|
| `winreg` (`HKLM`/`HKCU` + `App Paths` + Start Menu `.lnk` walk) | `find_installed_app_fast()` <10ms app launch |
| `PowerShell` + `WMI` | brightness, WiFi/Bluetooth toggle, recycle bin |
| `DPAPI` (`CryptProtectData`) | `pika_data.json` vault `src/store/assistantStore.ts:324` |

---

## 🔄 How It Works — Kaise Kaam Karta Hai

### 1) High-Level Flow (3 Layers)

```mermaid
flowchart LR
  UI[React + Electron<br/>:3000] <== WebSocket JSON<br/>ws://localhost:8765 ==> PY[Python Bridge<br/>pc_bridge.py]
  PY --> OS[Windows APIs<br/>psutil/pyautogui/winreg]
  PY --> STT[Vosk / WebSpeech]
  PY --> TTS[Edge TTS / Piper]
  PY --> LLM[Groq/Gemini/Ollama<br/>+ agent-mini]
  PY --> DB[(pika_data.json<br/>DPAPI+Fernet)]
```

### 2) Detailed Pipeline — "chrome kholo" bolne par kya hota hai

```mermaid
sequenceDiagram
  actor U as User
  participant Mic as Mic
  participant WS as WebSpeech / Vosk
  participant Hook as useVoice.ts
  participant Engine as commandEngine.ts (120+ regex)
  participant WSS as ws://8765
  participant Router as ROUTES[category/action]
  participant Win as Windows (os.startfile)
  participant TTS as Edge TTS
  participant UI as Chat + Toast
  U->>Mic: "chrome kholo"
  Mic->>WS: audio → text
  WS->>Hook: transcript
  Hook->>Engine: try_voice_shortcut / regex
  alt Direct command
    Engine->>WSS: {category:"apps", action:"open", params:{name:"chrome"}}
  else LLM needed
    Engine->>WSS: {type:"query", data:"chrome kholo"}
    WSS->>Router: LLM router (Groq→Gemini fallback)
  end
  WSS->>Router: find_installed_app_fast("chrome") → chrome.exe
  Router->>Win: os.startfile
  Router->>TTS: ok("Chrome खोल दिया 🚀") → edge-tts
  Router->>UI: envelope(response) → Toast + chat stream
```

### 3) Safety — Bina Kuch Hatye / Todne Ke Kaise

| Guard | File | Kya karta |
|---|---|---|
| ** Graceful Degradation** | `brain.md:10` | Whisper.cpp exists → use, else WebSpeech, never crash |
| **Path Sandbox** | `pc_bridge.py:592` `is_path_safe()` | Blocks `C:\`, `C:\Windows`, `..`, UNC, hidden `.sys/.dll` |
| **Confirm Gate** | `ROUTES: CONFIRM_REQUIRED` | `system/shutdown`, `files/delete`, `processes/kill` needs `confirmation_id` |
| **DPAPI Vault** | `pc_bridge.py:148` | `pika_data.json` → `CryptProtectData` + Fernet hardware-bound, other PC pe nahi khulega |
| **WS Token** | `pc_bridge.py:639` `get_or_create_ws_token()` | LAN token, stored in vault |
| **Blocked Terminal** | `pc_bridge.py:1480` | `rm -rf /`, `format c:` blocked |
| ** Additive Only** | `src/store/assistantStore.ts:324` | New fields (`notes`, `pomodoro`) use own localStorage keys, old data untouched |
| **Store Migration** | `loadAppData` | Allows only whitelisted `allowedSettingsKeys`, validates `bridgeUrl` regex |

> **Bina kuch hatye:** All new features are additive — new `TabName="notes"`, new `ToolsSubTab="terminal"`, new files (`CommandPalette.tsx`, `NotesPanel.tsx`, etc.) — no existing component deleted or behavior broken. Build still single-file `vite-plugin-singlefile`.

### 4) Data Persistence

- **Frontend:** `zustand` → `localStorage` (`pika_notes`, `pika_pomodoro`, `pika_activeTab`, `pika_token_usage`)
- **Backend:** `pika_data.json` encrypted vault (DPAPI on Win, Fernet+hostname entropy elsewhere)
- **Schedule:** `scheduledJobs` in vault + `_schedule_job_internal()` via APScheduler / fallback `threading.Timer`

---

## Architecture

Pika AI operates on a separated frontend-backend architecture connected via WebSockets:

- **Frontend (React + Vite)**: A responsive UI hosted at `http://localhost:3000`. Handles user interactions, voice waveform visualization, chat UI, and inline prompt editing. Electron wrapper `electron/main.cjs` provides native titlebar (`DesktopTitleBar.tsx`), single-instance lock, and `preload.cjs` bridge.
- **Backend (Python)**: A WebSocket server (`pc_bridge.py` at `ws://localhost:8765`) that interfaces with LLM APIs, executes system automation commands, handles STT/TTS processing, and manages state. Router `ROUTES` maps `category/action` → `cmd_*` handlers.

**Extended:** See `docs/02-ARCHITECTURE.md` (mermaid 3-layer) and `docs/05-FOLDER-STRUCTURE.md`.

**Folder Structure (condensed):**

```
pika-ai-assistant-prompt/
├── electron/            # main.cjs, preload.cjs
├── src/
│   ├── components/      # 50+ (HUDView, FuturisticDashboard, NotesPanel, TerminalPanel, PomodoroHUD...)
│   ├── hooks/           # useVoice, useAssistant, AssistantContext
│   ├── store/           # assistantStore.ts (zustand)
│   ├── lib/             # commandEngine.ts, connectors.ts, constants.ts
│   └── types/           # index.ts (TabName, ToolsSubTab, QuickNote, PomodoroState)
├── pc_bridge.py         # 3200+ line WS server + all cmd_* handlers
├── pika_data.json       # encrypted vault
├── start.bat / start.py # 1-click launcher
└── docs/                # 00..25 guides
```

---

## Getting Started

### Prerequisites
- **OS**: Windows 10/11 (Linux/macOS supported for non-hardware specific tasks)
- **Python**: 3.10+ (3.12 recommended)
- **Node.js**: v18+ (v20+ recommended)

### Installation

**Method 1: Windows 1-Click Launcher**
Simply double-click `start.bat` in the project directory. The script will automatically configure the Python `venv`, install dependencies, start the backend, and launch the web UI.

**Method 2: Manual Installation**
```bash
# 1. Clone the repository
git clone https://github.com/SudhirDevOps1/pikachu.git
cd pikachu

# 2. Setup Python backend
python -m venv venv
.\venv\Scripts\activate   # Windows
# source venv/bin/activate # Linux/macOS
pip install -r requirements.txt

# 3. Setup Node frontend
npm install

# 4. Start the Application
# Terminal 1: Start PC Bridge
python pc_bridge.py

# Terminal 2: Start Web UI
npm run dev
# or desktop:
npm run electron:dev  # (if script exists) else electron .
```

**Build (single-file dist):**
```bash
npm run build   # vite → dist/index.html (1.1 MB, gzip 324 KB) [verified]
npm run lint    # tsc --noEmit
```

---

## Voice Commands

Pika supports natural language commands in English, Hindi, and Hinglish.

| Action | Example Command | Engine |
| :--- | :--- | :--- |
| **App Launch** | "Open VS Code", "Chrome kholo" | `find_installed_app_fast` + `APP_MAP` |
| **System Volume** | "Volume 50%", "Awaaz badhao", "Mute volume" | `cmd_volume` via `pyautogui` |
| **Brightness** | "Brightness 80%" | `cmd_screen` via `sbc` / PowerShell |
| **Screen Capture** | "Take screenshot", "Screenshot lo" | `screen_peeler()` + `PIL` |
| **System Info** | "Battery check", "List processes" | `cmd_info` via `psutil` |
| **Obsidian** | "Obsidian me daily note banao", "Search Obsidian for <query>" | `cmd_obsidian` Local REST |
| **Terminal** *(new)* | "terminal me dir chalao" | `terminal.exec` |
| **Notes** *(new)* | "note banao meeting kal 10 baje" | `NotesPanel` + `commandPalette` |
| **Pomodoro** *(new)* | "focus shuru karo" | `PomodoroHUD` |

**Shortcuts:**

| Key | Action |
|---|---|
| `Ctrl+K` | Command Palette |
| `Ctrl+Space` | Push-to-Talk |
| `F` | Fullscreen |
| `?` | Shortcuts Help |

---

## Configuration

Settings and API keys can be configured directly from the UI settings panel. 
Alternatively, use the `.env` file for backend configurations (see `.env.example`).

**Obsidian Integration:**
To enable Obsidian integration, install the "Local REST API" community plugin in Obsidian, copy your Bearer Token, and paste it alongside the local URL into Pika's Settings panel.

**AI Providers:**
Groq, Gemini, Mistral, Cerebras, DeepSeek, OpenRouter, Z.ai, Nvidia, Together, Ollama (local). Add `GROQ_API_KEY` etc. in Settings → AI Provider. Key rotation via comma-separated keys.

**Voice Engines:**

| STT | TTS |
|---|---|
| `webspeech` (browser, default) | `edge` (`hi-IN-SwaraNeural`, default) |
| `vosk` (offline, `models/hi`) | `piper` (offline) |
| `whisper` (`C:\whisper\ggml-tiny.bin` if exists) | `webspeech` / `none` |

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `python not recognized` | Reinstall Python with "Add to PATH" ticked |
| `ws://8765` not connected | `python pc_bridge.py` running? Firewall allow? |
| Vosk not loaded | `pip install vosk` + model in `models/hi` |
| Edge TTS silent | Check internet; fallback `pyttsx3` / `pip install edge-tts` |
| `npm run build` fails | `npm install` again; Node 18+ required |

---

## Docs & Brain

- `docs/00-START-HERE.md` → `25-PACKAGING...` — full course (requirements, viva, debugging)
- `brain.md` — Long-term memory: STT/TTS journey (Parakeet → Whisper tiny 75 MB, Silero → Edge TTS), agent-mini (~3000 lines), regex routing cleanup

---

## Contributing

PRs welcome. Keep changes additive. Run `npm run lint` + `npm run build` before pushing.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
