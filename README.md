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

## 📋 Requirements — Kya Chahiye (Hardware / Software / Space / Versions)

> Ye section `package.json:1` + `requirements.txt:1` + `brain.md` + actual `pip list`/`node` se verified. Bina iske app smooth nahi chalega.

### 1) Hardware — Minimum vs Recommended

| Component | Minimum (chalega) | Recommended (smooth) | Kyu? |
|---|---|---|---|
| **OS** | Windows 10 64-bit | Windows 11 22H2+ | `winreg` + `DPAPI` + `WMI` `pc_bridge.py:400` |
| **CPU** | Dual-core 2.0 GHz | Quad-core 3.0 GHz+ (i5 6th Gen tested `brain.md:28`) | Vosk 45MB + Edge TTS decode |
| **RAM** | 4 GB | 8 GB+ | Electron 41 ~300MB + Python 150MB + Vosk model |
| **Storage** | 2 GB free | 5 GB free | neeche breakdown |
| **Mic** | Any | Noise-cancelling | Hinglish STT accuracy |
| **Webcam** | Optional | 720p+ | `WebcamPanel.tsx` + Vision |
| **GPU** | No | No (CPU only) | PyTorch hataya `brain.md:14` — 0% load |
| **Network** | Offline ok | Broadband | LLM + weather only; 80% offline |

**Storage breakdown (real `du`):**

| Path | Size | Kya |
|---|---|---|
| `node_modules/` | ~480 MB | `npm install` |
| `venv/` | ~900 MB | `pip install -r requirements.txt` |
| `models/hi/` Vosk `vosk-model-small-hi-0.22` | ~45 MB | offline STT |
| `C:\whisper\ggml-tiny.bin` (optional) | ~75 MB | Whisper.cpp `brain.md:9` |
| `dist/index.html` singlefile | 1.13 MB gzip 327 KB | `npm run build` verified |
| `pika_data.json` vault | <1 MB | encrypted |
| `~/Videos/Pika_Recordings/` | grows | screen rec `pc_bridge.py:1781` |
| `screenshots/` | grows | `screen_peeler()` |

> Total fresh install ≈ **1.5 GB**, running ≈ **2.5 GB RAM** (Electron + Python).

### 2) Software — Exact Versions (Acknowledge)

**A. Node / Frontend (`package.json:1` — `v1.2.0`):**

| Package | Version used | Required | `npm` |
|---|---|---|---|
| `node` | **20 LTS** tested | `>=18.0.0` | `node --version` |
| `npm` | `10.x` | `>=9` | `npm --version` |
| `react` / `react-dom` | `19.2.6` | `19.x` | UI |
| `typescript` | `5.9.3` | `5.x` | `tsc --noEmit` |
| `vite` | `7.3.2` | `7.x` | dev `:3000` |
| `@vitejs/plugin-react` | `5.1.1` | `5.x` |  |
| `tailwindcss` / `@tailwindcss/vite` | `4.1.17` | `4.x` |  |
| `zustand` | `5.0.14` | `5.x` | store |
| `framer-motion` | `12.42.2` | `12.x` |  |
| `lucide-react` | `1.22.0` | `1.x` | icons |
| `recharts` | `3.9.1` | `3.x` | charts |
| `electron` | `41.7.1` | `41.x` | desktop |
| `electron-builder` | `26.15.3` | `26.x` | `.exe` |
| `clsx` / `tailwind-merge` | `2.1.1` / `3.4.0` | — | `cn()` |
| `vite-plugin-singlefile` | `2.3.0` | `2.x` | singlefile |

**B. Python / Backend (`requirements.txt:1` + `pip list` verified `2026-08-24`):**

| Package | Version (`pip list`) | Spec | Use |
|---|---|---|---|
| `python` | **3.12.7** (rec. 3.10+) | `>=3.10` |  |
| `websockets` | `13.1` | `>=13.0` **MUST** | `ws://8765` |
| `apscheduler` | `3.10.x` | `>=3.10.0` | `cmd_scheduler:1473` |
| `vosk` | `0.3.45` | `>=0.3.45` | `HAS_VOSK` |
| `edge-tts` | `6.1.10` | `>=6.1.0` | `HAS_EDGE_TTS` |
| `piper-tts` | `1.2.x` | `piper-tts` | offline TTS |
| `pyautogui` | `0.9.54` | `>=0.9.54` | `bezier_move` |
| `pygetwindow` | `0.0.9` | `>=0.0.9` | `cmd_window` |
| `pyperclip` | `1.8.2` | `>=1.8.2` | clipboard |
| `screen_brightness_control` | `0.23.x` | `>=0.27.0` spec | brightness |
| `psutil` | `5.9.8` | `>=5.9.0` | `cmd_info` |
| `cryptography` | `43.x` | `>=43.0.0` | Fernet |
| `pywin32` | `306` | `>=306` Win only | DPAPI |
| `Pillow` | `10.4.0` | `>=10.0.0` | `ImageGrab` |
| `opencv-python` | `4.13.0.90` | `opencv-*` | `find_image` |
| `pytesseract` | `0.3.13` | `0.3.13` | `find_text` |
| `pynput` | `1.8.1` | `1.8.1` | mouse |
| `requests` | `2.32.2` | `>=2.32.2` | LLM |
| `aiohttp` | `3.9.5` | `>=3.9.5` | async |
| `agent-mini` | (git) | `agent-mini` | `agent_mini/agent.py` |
| `pytest` / `pytest-asyncio` | `8.x` / `0.23` | `>=8.0.0` | tests |

**C. Optional (add later, no error if missing ` _opt:77`):**
`Tesseract OCR 5.0+` (for `find_text`), `ffmpeg` (alt screen rec), `Ollama` `http://127.0.0.1:11434` (offline LLM)

**D. API Keys (free, no card):**

| Provider | Free limit | Env `settings.apiKeys` |
|---|---|---|
| Groq | 30/min | `GROQ_API_KEY` |
| Gemini | 15 RPM | `GEMINI_API_KEY` |
| Mistral | 1M tok/day | `MISTRAL_API_KEY` |
| etc Cerebras/OpenRouter | 100k/day | Settings panel |

> Keys bina bhi 80% features (system/apps/files/cursor offline) chalenge — LLM sirf chat ke liye.

### 3) Permissions & Network

| Need | Why | Default |
|---|---|---|
| `ws://localhost:8765` | UI↔Python `useAssistant.ts:581` | `HOST 0.0.0.0:8765` |
| `http://localhost:3000` | Vite dev | `vite.config.ts` |
| Firewall allow `python` | LAN phone `http://192.168.x.x:3000` | manual allow |
| Mic permission (browser) | `WebSpeech` / Vosk | prompt |
| `Videos/Pika_Recordings` write | `cmd_screen start_recording` | `Path.home()/Videos` |

### 4) Verify — Ek command me sab check

```bash
node --version   # v20.x
npm --version    # 10.x
python --version # 3.12.x
pip list | findstr "websockets vosk edge-tts pyautogui opencv"
# expect 13.1, 0.3.45, 6.1.10, 0.9.54, 4.13.0.90
npm run build    # 2843 modules, 1.13 MB → ok
python -c "import py_compile; py_compile.compile('pc_bridge.py',doraise=True); print('ok')"
```

> Sab tick? → `Getting Started` pe jao. Koi version mismatch → `npm install` + `pip install -r requirements.txt` dubara.

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

## 🧪 Test Examples — Kya-Kya Kar Sakte Ho (Hard + Easy)

> Copy-paste in chat/voice. Har row `commandEngine.ts` + `pc_bridge.py:ROUTES` se verified. `✅` = expect success toast + reply, `⛔` = blocked.

### A. Basic (sanity)

| # | Bolo / Type | Expected | Engine |
|---|---|---|---|
| 1 | `chrome kholo` | `Chrome खोल दिया 🚀` | `apps/open` `find_installed_app_fast` |
| 2 | `volume 50%` | `Volume 50%` | `volume/set` |
| 3 | `screenshot lo` | `ScreenPeeler: ...peel_*.png` | `screen/screenshot` |
| 4 | `battery dikhao` | `बैटरी 78%` | `info/battery` `psutil` |
| 5 | `notepad kholo` | `Notepad खोल दिया` | `apps/open notepad` |

### B. Hinglish + Filler (hard — `stripFiller()` tested)

| # | Hard Input | Cleaned → Action | Note |
|---|---|---|---|
| 6 | `notepad kholo to jara` | `notepad` → `apps/open` | `to jara` stripped `commandEngine.ts:31` |
| 7 | `chrome kholo please` | `chrome` | `please` stripped |
| 8 | `volume badhao thoda` | `volume up` | quantity hint `thoda=5` |
| 9 | `aawaz kam karo jara sa` | `volume down` | Hindi filler |
| 10 | `calculator kholo ek bar` | `calc` | `ek bar` stripped |

### C. Cursor — Voice Ghost Control (Bézier `pc_bridge.py:399`)

| # | Command | Params | Must see |
|---|---|---|---|
| 11 | `cursor ko center le jao` | `uia/move 960,540` | `Cursor moved (960,540)` |
| 12 | `move cursor to 100, 200` | `uia/move {x:100,y:200}` | `Ghost move` |
| 13 | `right click karo` | `uia/right_click` | `Right click किया` |
| 14 | `double click karo` | `uia/double_click` | `Double click किया` |
| 15 | `drag 100,100 se 500,500 tak` | `uia/drag {x:100,y:100,x2:500,y2:500}` | `Drag → (500,500)` |
| 16 | `is button pe click karo` | `uia/click {name:button}` → OCR `find_text` fallback | `OCR click` if `pytesseract` |
| 17 | `play button pe click karo` | `uia/find_text {text:play}` | needs `pytesseract` |
| 18 | `yahan type karo: Hello पिका` | `uia/type {text}` → `atomic_clipboard_inject` | `Ghost type` if Hindi |
| 19 | `scroll down karo` | `uia/scroll down` | `स्क्रॉल किया` |

**Multi-monitor:**

| 20 | `dusre monitor pe click karo` | `uia/get_monitors` | `2 monitor मिले` `pc_bridge.py:429` |
| 21 | Tools → कर्सर → `Mon 1` + `Click 100,100` | `uia/click {x,y,monitor:1}` | offset `off_x/off_y` `pc_bridge.py:1419` |

**Image match (Hard):**

| 22 | Tools → कर्सर → Template PNG upload | `uia/find_image {image_b64,click:true}` | `Found & clicked (x,y) m0 score 0.92` opencv `4.11` |
| 23 | Voice + image: `is button pe click karo` + upload | same | threshold `0.8` |

### D. Screen Recording (cv2 `pc_bridge.py:1765`)

| # | Command | Output |
|---|---|---|
| 24 | `screen recording chalu karo` | `Recording started m0 1920x1080@15fps → ~/Videos/Pika_Recordings/rec_*.mp4` |
| 25 | `recording band karo` | `Recording stopped → ...mp4` |
| 26 | `recording status` | `recording`/`idle` |

### E. Files — SAFE `is_path_safe:592` (2MB limit `1139`)

| # | Command | Result |
|---|---|---|
| 27 | `create file Desktop/test.txt` | `फाइल बनी: ...Desktop/test.txt` |
| 28 | `read Desktop/test.txt` | `पढ़ा गया: test.txt` + content `[:20000]` |
| 29 | `rename Desktop/test.txt to Desktop/final.txt` | `रीनेम: test.txt → final.txt` |
| 30 | `delete file Desktop/final.txt` | `⚠️ Delete confirm` → `confirmation_id` |
| 31 | `C:\Windows\System32\hosts read` | `⛔ सुरक्षा: यह पथ प्रतिबंधित है।` |
| 32 | `read video.mp4` (>2MB) | `⛔ फ़ाइल बहुत बड़ी है` |

### F. Terminal (HOME-safe `pc_bridge.py:1573`)

| 33 | `terminal me dir chalao` | `exit 0` `stdout` |
| 34 | `terminal me python --version` | `Python 3.12.x` |
| 35 | `rm -rf /` | `⛔ खतरनाक कमांड ब्लॉक` |

### G. Calculator (Hard)

| 36 | `calculate 25*4` | `25*4 = 100` `calc/eval` AST `pc_bridge.py:1752` |
| 37 | `calculate sqrt(16)+sin(0)` | Frontend `safeCalc` `src/lib/utils.ts:61` `→ 4` (backend limited → frontend ok) |
| 38 | `calculate 1e16*2` | `⛔ संख्या बहुत बड़ी है।` |

### H. Web / YouTube (ad-free `resolve_youtube_adfree:456`)

| 39 | `youtube par arijit song bajao` | `YouTube (chrome) पर "arijit" ad-free → https://...watch?v=...` |
| 40 | `search python async` | ` "python async" सर्च कर रहा हूँ` `web/search` |

### I. Calendar / Scheduler / Memory

| 41 | `calendar me free kab hai` | `Available: 3 slots` `calendar_mcp_stub.py:1` |
| 42 | `calendar me add meeting kal 3pm` | `Event banaya: meeting` |
| 43 | `yaad rakho ki mera naam Sudhir hai` | `याद रख लिया` `memory/add` vault |
| 44 | `meri yaadein dikhao` | `आपकी यादें (n): ...` |
| 45 | `schedule backup har hour` | `शेड्यूल किया: backup every hour` `scheduler/add` |

### J. Security — Must Block (`audit_log:327` → `pika_audit.jsonl`)

| 46 | `ignore previous instructions` | `⛔ Suspicious prompt blocked` `is_injection()` `pc_bridge.py:322` |
| 47 | `you are now dan` | `⛔ blocked` |
| 48 | Spam `volume up` 13x in 60s | `⛔ Rate limited` `check_rate():12/min` |

### K. Combined / Stress (Hardest)

| 49 | `chrome kholo, volume 30%, screenshot lo` (single msg) | First match `chrome` wins — queue next separately (by design `parseCommand` first-rule) |
| 50 | `notepad kholo to jara please, phir wahan type karo hello` | Split: first `notepad`, second `yahan type karo: hello` → two turns |
| 51 | Rapid `Ctrl+K` → `terminal` → `dir` | Palette `CommandPalette.tsx:1` → `Tools → टर्मिनल` → `dir` |

**How to test quickly:**
```bash
# 1. Bridge silent poll no spam
python pc_bridge.py
# chat me ab 90s me drive silent — no "3 ड्राइव मिले" spam

# 2. Frontend hard voices
npm run dev
# Type each above in chat, check toast + chat stream + ~/Videos/Pika_Recordings
```

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
