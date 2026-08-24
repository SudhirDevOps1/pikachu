# Pika AI Assistant

<div align="center">

<img src="public/pika-icon.png" width="130" height="130" alt="Pika AI Icon" style="border-radius: 28px; box-shadow: 0 10px 30px rgba(0, 240, 255, 0.25);" />

<br/>

[![Version](https://img.shields.io/badge/version-1.2.1-7c3aed.svg?style=for-the-badge)](https://github.com/SudhirDevOps1/pikachu)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981.svg?style=for-the-badge)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?style=for-the-badge&logo=react)](https://react.dev)
[![Electron](https://img.shields.io/badge/Electron-41-47848F.svg?style=for-the-badge&logo=electron)](https://www.electronjs.org)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB.svg?style=for-the-badge&logo=python)](https://www.python.org)
[![WebSocket](https://img.shields.io/badge/WebSocket-8765-010101.svg?style=for-the-badge)](pc_bridge.py)

**Open-source Desktop AI Assistant with voice, system automation, and agentic reasoning.**

*Hindi / English / Hinglish — Offline-first — Privacy-focused — Agentic*

[Features](#features) · [Architecture](#architecture) · [Quick Start](#quick-start) · [Voice Commands](#voice-commands) · [Tech Stack](#tech-stack) · [Requirements](#requirements)

</div>

---

## Overview

Pika AI is a desktop assistant that runs locally on your Windows PC. It connects a React/Electron frontend to a Python WebSocket backend, enabling natural language control of your system — volume, brightness, apps, files, browser, screen, and more.

**Core principles:**
- Privacy-first: data stays on your machine (DPAPI vault)
- Offline-capable: Vosk STT + Ollama LLM + Piper TTS = zero internet needed
- Additive-only: every new feature adds without breaking existing ones
- No heavy ML on local PC: cloud brains (Groq/Gemini) + local tools

---

## Features

### System Control (25+ actions)

| Feature | Status | How |
|---|---|---|
| Volume set exact (pycaw) | Working | `cmd_volume` — pycaw CoreAudio → PowerShell AudioDevice → nircmd fallback |
| Volume up/down/mute | Working | `pyautogui.press("volumeup")` |
| Brightness set | Working | `screen_brightness_control` → PowerShell WMI fallback |
| Shutdown / Restart / Sleep / Hibernate | Working | `cmd_system` — requires confirmation |
| Lock screen | Working | `LockWorkStation()` via ctypes |
| Empty Recycle Bin | Working | `SHEmptyRecycleBinW` via ctypes |
| Flush DNS | Working | `ipconfig /flushdns` |
| Temp file cleanup | Working | `%TEMP%` recursive delete |
| Airplane Mode (WiFi + Bluetooth) | Working | `Disable-NetAdapter` + `Disable-PnpDevice -Class Bluetooth` |
| WiFi toggle | Working | `netsh` + PowerShell |
| Bluetooth toggle | Working | `Enable-PnpDevice -Class Bluetooth` |
| Process list / kill | Working | `psutil` |
| Battery status | Working | `psutil.sensors_battery()` |
| CPU / RAM / Disk info | Working | `psutil` |
| IP address | Working | `psutil.net_if_addrs()` |
| System info full report | Working | `platform` + `psutil` |
| Time / Date | Working | `datetime` |
| App launch | Working | `winreg` HKLM/HKCU + Start Menu `.lnk` scan (`find_installed_app_fast`) |
| App close | Working | `taskkill` |
| App list (installed) | Working | Registry + Start Menu scan |
| WhatsApp message | Working | `whatsapp://` URI or `cmd_apps whatsapp_msg` |

### Voice & Speech (3 engines)

| Feature | Status | How |
|---|---|---|
| Push-to-Talk (Ctrl+Space) | Working | `useVoice.ts` — WebSpeech API |
| Offline STT (Vosk) | Working | `vosk` + `models/hi/` (45 MB Hindi model) |
| Neural TTS (Edge) | Working | `edge-tts` — `hi-IN-SwaraNeural` / `en-US-GuyNeural` |
| Offline TTS (Piper) | Working | `piper-tts` fallback |
| Hinglish filler strip | Working | `stripFiller()` — removes "to jara", "please", "ek bar" etc. |
| 70+ regex voice rules | Working | `commandEngine.ts` — Hindi/English/Hinglish patterns |
| Voice-to-text live dictation | Working | `cmd_keyboard voice_to_text` — records mic + Vosk transcribe |
| System-wide dictation | Working | `cmd_keyboard dictate` — types wherever cursor is via clipboard |

### Desktop Automation / UIA

| Feature | Status | How |
|---|---|---|
| Mouse move (Bézier curve) | Working | `bezier_move()` — smooth human-like cursor |
| Click / Right-click / Double-click | Working | `pyautogui.click()` |
| Drag & drop | Working | `pyautogui.drag()` |
| Keyboard type / hotkey | Working | `pyautogui.typewrite()` / `hotkey()` |
| Scroll up/down | Working | `pyautogui.scroll()` |
| Window focus/minimize/maximize/close | Working | `pygetwindow` |
| Window snap left/right | Working | `win + arrow` via `pyautogui` |
| OCR text click (find text on screen) | Working | `pytesseract` — `uia/find_text` |
| Image template match + click | Working | `opencv` `matchTemplate` — `uia/find_image` |
| Multi-monitor awareness | Working | `get_monitors()` — per-monitor offset |
| Screen recording | Working | `cv2.VideoWriter` → `~/Videos/Pika_Recordings/` |
| Screenshot (full / window / region) | Working | `PIL.ImageGrab` + `screen_peeler()` |
| Screenshot OCR | Working | `pytesseract.image_to_data()` |
| Deep Windows UIA element tree | Working | PowerShell `UIAutomationClient` — full hierarchy with AutomationId, ClassName, BoundingBox |
| UIA click by AutomationId | Working | `UIAutomationElement.FindFirst` + `InvokePattern.Invoke()` |
| UIA set value by AutomationId | Working | `ValuePattern.SetValue()` |
| PiP always-on-top window | Working | `SetWindowPos(HWND_TOPMOST)` — resizes to 320x180 bottom-right |
| PiP off (remove topmost) | Working | `SetWindowPos(HWND_NOTOPMOST)` |

### Browser Automation

| Feature | Status | How |
|---|---|---|
| Open URL | Working | `playwright.chromium.launch()` |
| Click element (CSS/XPath/text) | Working | `page.click()` / `page.get_by_text()` |
| Type in element | Working | `page.fill()` |
| Navigate (back/forward/reload) | Working | `page.go_back()` etc. |
| Screenshot page | Working | `page.screenshot()` |
| Get page text | Working | `page.inner_text("body")` |
| Scroll page | Working | `page.mouse.wheel()` |
| Evaluate JS | Working | `page.evaluate()` |
| Tab management (list/close/new) | Working | `page.context.pages` |
| Wait for element | Working | `page.wait_for_selector()` |

### Code Execution (REPL)

| Feature | Status | How |
|---|---|---|
| Persistent Python REPL | Working | `cmd_code exec` — state persists across calls |
| Self-healing auto-import | Working | On `NameError`, auto-`pip install` missing module |
| Auto-load common libs | Working | `pandas`, `numpy`, `requests` loaded if installed |
| Evaluate expressions | Working | `cmd_code eval` — safe AST evaluation |
| Pip install from chat | Working | `cmd_code pip_install <pkg>` |
| REPL history | Working | `cmd_code history` |
| REPL clear | Working | `cmd_code clear` |
| Subprocess blocked | Working | `import subprocess` raises error |

### Files & Disk

| Feature | Status | How |
|---|---|---|
| Create file | Working | `cmd_files create` — atomic write |
| Read file | Working | `cmd_files read` — 2MB limit |
| Write file | Working | `cmd_files write` |
| Copy / Move file | Working | `shutil.copy2` / `shutil.move` |
| Delete file | Working | `cmd_files delete` — requires confirmation |
| Rename file | Working | `Path.rename()` |
| Search files | Working | `pathlib.rglob()` |
| Path safety sandbox | Working | `is_path_safe()` — blocks `C:\`, `C:\Windows`, UNC, `.sys/.dll` |
| Open Explorer | Working | `os.startfile()` |
| List drives | Working | `string.ascii_uppercase` + `os.path.exists()` |
| Disk usage | Working | `psutil.disk_usage()` |

### Clipboard

| Feature | Status | How |
|---|---|---|
| Get clipboard | Working | `pyperclip.paste()` |
| Set clipboard | Working | `pyperclip.copy()` |
| Clipboard history | Working | Clipboard monitoring + localStorage persist |
| Pin to clipboard | Working | `clipboard_pin` in vault |
| Hindi/special char injection | Working | `atomic_clipboard_inject()` — Ctrl+V paste for Unicode |
| Clipboard save/export | Working | `clipboard_save` action |

### Reminders & Scheduler

| Feature | Status | How |
|---|---|---|
| Create reminder (N minutes) | Working | `threading.Timer` + vault persist |
| Recurring reminders | Working | `interval` param — auto-repeating |
| Cancel reminder | Working | `_reminder_timers[id].cancel()` |
| List / delete reminders | Working | `cmd_reminders` |
| Schedule tasks (cron-like) | Working | `APScheduler` + fallback `threading.Timer` |
| Parse natural schedule | Working | `_parse_schedule_to_seconds()` — "every 30 minutes", "hourly", "daily at 09:00" |
| Cancel scheduled task | Working | `_fallback_timers[id].cancel()` |

### Memory & Knowledge

| Feature | Status | How |
|---|---|---|
| Long-term memory (SQLite) | Working | `~/.pika/memory/memory.db` — facts with category/importance |
| Memory search (TF-IDF) | Working | `memory_search()` — ranked retrieval |
| Memory sync to MEMORY.md | Working | Auto-synced for Obsidian |
| User profile (USER.md) | Working | Auto-extracted from conversations |
| Memory injected into LLM prompt | Working | `_build_memory_context()` — auto-appended to system prompt |
| Legacy vault memory | Working | `memoryVault` in `pika_data.json` |

### Skills (Auto-Generated)

| Feature | Status | How |
|---|---|---|
| Auto-generate skill from conversation | Working | LLM summarizes workflow → saves as `.md` |
| List / get / delete skills | Working | `cmd_memory` actions |
| Skills stored in `~/.pika/memory/skills/` | Working | Markdown format |

### Connectors (OAuth)

| Feature | Status | How |
|---|---|---|
| Google OAuth2 flow | Working | Auth URL → callback → token exchange |
| Gmail list messages | Working | Gmail API `messages.list` + `messages.get` |
| Google Calendar events | Working | Calendar API `events.list` |
| Google Drive files | Working | Drive API `files.list` |
| Connect / disconnect | Working | Token stored in vault |
| Non-Google placeholders | Working | Slack, Notion, GitHub — stub |

### Telegram Bot Bridge

| Feature | Status | How |
|---|---|---|
| Telegram bot polling | Working | `urllib` polling — receives messages, routes to Pika |
| Command handling (/start, /status, /screenshot) | Working | Pattern matching |
| General message → LLM response | Working | Routes through `_quick_llm_response()` |
| Activate via env var | Working | `TELEGRAM_BOT_TOKEN` in `.env` |

### Vision & Image

| Feature | Status | How |
|---|---|---|
| Screenshot + OCR | Working | `pytesseract` |
| Image template match | Working | `opencv.matchTemplate` |
| VLM vision grounding | Working | `handle_vlm_grounding()` — screenshot → VLM identifies clickable elements with X,Y coordinates |
| Multi-provider VLM | Working | Groq (LLaVA) → Gemini → Mistral fallback |
| Image generation (DALL-E 3) | Working | `OPENAI_API_KEY` → OpenAI images API |
| Image generation (local SD) | Working | `STABLE_DIFFUSION_URL` → ComfyUI/A1111 API |
| Generated images saved | Working | `~/.pika/images/` |

### Chat & LLM

| Feature | Status | How |
|---|---|---|
| Multi-provider LLM routing | Working | Groq → Gemini → Mistral → Cerebras → DeepSeek → Ollama |
| API key rotation | Working | Comma-separated keys, auto-rotate on 429 |
| Token counting | Working | `tiktoken` encoding |
| History summarization | Working | LLM-based conversation summary |
| Prompt injection filter | Working | `is_injection()` — blocks "ignore previous instructions" etc. |
| Rate limiting | Working | `check_rate()` — 12/min per category |
| Audit log | Working | `pika_audit.jsonl` — every tool call logged |
| ReAct agent loop | Working | `handle_react_agent()` — Thought → Action → Observation → Final Answer (max 8 steps) |
| Hermes-style tool calling | Working | 25 structured tool definitions (`HERMES_TOOLS`) |
| Multi-format tool parsing | Working | JSON object, `<tool_call>` tags, `Action:` format |

### Frontend UI (65+ components)

| Component | Purpose |
|---|---|
| `FuturisticDashboard` | Main aurora-themed dashboard |
| `ChatInterface` / `ChatMessage` | Chat UI with typewriter effect |
| `CommandPalette` (Ctrl+K) | VS Code-style global search |
| `Sidebar` / `TopBar` / `StatusBar` | Navigation |
| `NotesPanel` | Markdown notes (localStorage + Obsidian-ready) |
| `PomodoroHUD` | 25/5 focus timer |
| `TerminalPanel` | PowerShell execution |
| `CursorControlHUD` | Mouse/keyboard automation UI |
| `ToolsPanel` / `ControlPanel` | Tools & settings |
| `SettingsPanel` | API keys, voice, theme config |
| `DriveExplorerHUD` | File browser |
| `ProcessManager` | Task manager |
| `SchedulerPanel` / `RemindersHUD` | Scheduled tasks |
| `WeatherWidgetPro` / `WeatherHUD` | Weather display |
| `WebcamPanel` | Camera feed |
| `LiveMetricsChart` / `SystemHealthPanel` | System monitoring |
| `TelemetryPanel` / `NetworkTelemetryPro` | Network & telemetry |
| `PiPWindow` / `LivePiP` | Picture-in-Picture |
| `PikaOrb` / `PikaAvatar` | Animated AI avatar |
| `VoiceWaveform` / `VoiceButton` | Voice visualization |
| `ShortcutsHelp` | Keyboard shortcuts overlay |
| `MacroEngine` | Automation macros |
| `WorldClockHUD` | Multi-timezone clock |
| `ConfirmationDialog` | Safety confirmation gates |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  React + Electron (localhost:3000)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │ Chat     │ │ Tools    │ │ Voice    │ │ Dashboard  │ │
│  │ Interface│ │ Panel    │ │ Button   │ │ HUD        │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬──────┘ │
│       └─────────────┼───────────┼──────────────┘        │
│              useAssistant.ts (WebSocket)                  │
└──────────────────────────┬──────────────────────────────┘
                           │ ws://localhost:8765
┌──────────────────────────┴──────────────────────────────┐
│  Python Backend (pc_bridge.py)                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │ ROUTES   │ │ LLM      │ │ Memory   │ │ ReAct      │ │
│  │ 25 cmds  │ │ Router   │ │ SQLite   │ │ Agent Loop │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬──────┘ │
│       └─────────────┼───────────┼──────────────┘        │
│              Windows APIs (psutil/pyautogui/winreg)      │
└─────────────────────────────────────────────────────────┘
```

### Backend (`pc_bridge.py` — 5700+ lines)

**25 command handlers** routed via `ROUTES` dict:

| Handler | Categories | Actions |
|---|---|---|
| `cmd_system` | `system` | shutdown, restart, sleep, lock, logoff, hibernate, empty_recycle_bin, flush_dns, temp_clean |
| `cmd_volume` | `volume` | up, down, mute, unmute, set (pycaw exact) |
| `cmd_media` | `media` | play_pause, next, previous, stop |
| `cmd_apps` | `apps`, `app` | open, close, list, focus, whatsapp_msg |
| `cmd_window` | `window` | minimize, maximize, fullscreen, snap_left, snap_right, show_desktop, switch, close |
| `cmd_info` | `info` | battery, cpu, ram, disk, time, date, full_report, ip |
| `cmd_processes` | `processes` | list, kill |
| `cmd_files` | `files`, `file` | create, read, write, copy, move, delete, rename, search, open_explorer |
| `cmd_disk` | `disk` | list_drives, usage, cleanup_temp |
| `cmd_uia` | `uia`, `computer` | move, click, right_click, double_click, drag, type, scroll, find_text, find_image, get_monitors, screenshot_region, deep_tree, uia_click_by_id, uia_set_value |
| `cmd_browser` | `browser` | open, click, type, navigate, screenshot, get_text, scroll, eval_js, tabs, wait_for |
| `cmd_clipboard` | `clipboard` | get, set, clear, save, history |
| `cmd_screen` | `screen` | screenshot, peel, ocr, start_recording, stop_recording, recording_status, brightness_set, brightness_up, brightness_down, pip, pip_off, generate_image |
| `cmd_keyboard` | `keyboard` | type, hotkey, dictate, voice_to_text |
| `cmd_web` | `web` | open_site, search, youtube_play, youtube_search |
| `cmd_calculator` | `calculator` | eval |
| `cmd_password` | `password` | generate |
| `cmd_translator` | `translator` | translate |
| `cmd_weather` | `weather` | get |
| `cmd_reminders` | `reminders`, `reminder` | create, list, delete, cancel |
| `cmd_obsidian` | `obsidian` | read_file, search, create_note, daily |
| `cmd_memory` | `memory` | add, get, list, search, delete, user_profile, skill_save, skill_list, skill_get, skill_delete, skill_auto_gen |
| `cmd_connectors` | `connectors` | list, connect, disconnect, status, oauth_callback, gmail_list, calendar_list, drive_list |
| `cmd_scheduler` | `scheduler` | add, list, remove, pause, resume |
| `cmd_code` | `code`, `python`, `execute` | exec, eval, history, clear, pip_install |
| `cmd_vision` | `vision` | describe, ocr |

**WebSocket message types:**

| Type | Handler |
|---|---|
| `command` | `route_command()` |
| `query` | LLM router (Groq → Gemini → Mistral fallback) |
| `react_agent` | `handle_react_agent()` — multi-step ReAct loop |
| `vlm_grounding` | `handle_vlm_grounding()` — VLM element detection |

### Frontend (`src/` — 65+ components)

| Directory | Contents |
|---|---|
| `components/` | 65+ React components (chat, dashboard, tools, HUDs, panels) |
| `hooks/` | `useAssistant.ts` (WebSocket), `useVoice.ts` (STT/TTS), `useWeather.ts`, `useRealPiP.ts`, `useLocalIP.ts`, `useAccentColor.ts` |
| `store/` | `assistantStore.ts` — Zustand store (localStorage persist) |
| `lib/` | `commandEngine.ts` (70+ regex rules), `constants.ts`, `utils.ts`, `connectors.ts` |
| `types/` | `index.ts` — TypeScript interfaces |

---

## Tech Stack

### Frontend

| Layer | Library | Version |
|---|---|---|
| UI Framework | `react`, `react-dom` | 19.2.6 |
| Language | `typescript` | 5.9.3 |
| Build | `vite` + `vite-plugin-singlefile` | 7.3.2 |
| Styling | `tailwindcss` | 4.1.17 |
| State | `zustand` | 5.0.14 |
| Animation | `framer-motion` | 12.42.2 |
| Icons | `lucide-react` | 1.22.0 |
| Charts | `recharts` | 3.9.1 |
| Desktop | `electron` + `electron-builder` | 41.7.1 |

### Backend

| Package | Purpose |
|---|---|
| `websockets` 13.1 | WebSocket server (`ws://0.0.0.0:8765`) |
| `pyautogui` 0.9.54 | Mouse/keyboard automation |
| `pygetwindow` 0.0.9 | Window management |
| `psutil` 5.9.8 | System metrics |
| `Pillow` 10.4.0 | Image capture/processing |
| `opencv-python` 4.13 | Template matching, screen recording |
| `pytesseract` 0.3.13 | OCR |
| `pyperclip` 1.8.2 | Clipboard |
| `screen_brightness_control` 0.23 | Brightness |
| `vosk` 0.3.45 | Offline STT |
| `edge-tts` 6.1.10 | Neural TTS |
| `piper-tts` 1.2 | Offline TTS fallback |
| `apscheduler` 3.10 | Cron scheduler |
| `cryptography` 43.x | Fernet AES-256 vault |
| `pywin32` 306 | DPAPI encryption |
| `playwright` | Browser automation |
| `pycaw` | Windows Core Audio (volume) |
| `requests` / `aiohttp` | HTTP clients |
| `tiktoken` | Token counting |
| `pytest` / `pytest-asyncio` | Testing |

### OS Integration

| API | Use |
|---|---|
| `winreg` (HKLM/HKCU + Start Menu `.lnk`) | App launch (`find_installed_app_fast` <10ms) |
| PowerShell + WMI | Brightness, WiFi/Bluetooth, UIA tree |
| DPAPI (`CryptProtectData`) | Vault encryption |
| Win32 (`user32.dll`) | PiP topmost, window find |
| `pycaw` (CoreAudio) | Exact volume control |

---

## Requirements

### Hardware

| Component | Minimum | Recommended |
|---|---|---|
| OS | Windows 10 64-bit | Windows 11 22H2+ |
| CPU | Dual-core 2.0 GHz | Quad-core 3.0 GHz+ |
| RAM | 4 GB | 8 GB+ |
| Storage | 2 GB free | 5 GB free |
| Mic | Any | Noise-cancelling |
| GPU | Not needed | Not needed |

### Software

| Requirement | Version |
|---|---|
| Python | 3.10+ (3.12 recommended) |
| Node.js | 18+ (20+ recommended) |
| npm | 9+ |

### API Keys (free tier, no card required)

| Provider | Free Limit | Env Variable |
|---|---|---|
| Groq | 30 req/min | `GROQ_API_KEY` |
| Gemini | 15 RPM | `GEMINI_API_KEY` |
| Mistral | 1M tok/day | `MISTRAL_API_KEY` |
| OpenAI (DALL-E) | Pay-per-image | `OPENAI_API_KEY` |

> Keys optional — 80% of features (system/apps/files/cursor/offline) work without any API key.

---

## Quick Start

### Method 1: Windows 1-Click

Double-click `start.bat` — auto-configures venv, installs deps, starts backend + frontend.

### Method 2: Manual

```bash
# Clone
git clone https://github.com/SudhirDevOps1/pikachu.git
cd pikachu

# Backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

# Frontend
npm install

# Run (2 terminals)
python pc_bridge.py        # Terminal 1 — ws://8765
npm run dev                # Terminal 2 — http://localhost:3000
```

### Build

```bash
npm run build    # dist/index.html — 1.13 MB (gzip 328 KB)
npm run lint     # TypeScript check
```

---

## Voice Commands

Pika supports natural language in English, Hindi, and Hinglish.

### Quick Reference

| Category | Example Commands |
|---|---|
| **Apps** | "chrome kholo", "notepad open", "close spotify" |
| **Volume** | "volume 50%", "aawaz badhao", "mute karo" |
| **Brightness** | "brightness 80%", "screen dim karo" |
| **System** | "shutdown", "restart", "sleep", "lock screen" |
| **Files** | "create file test.txt", "read Desktop/note.md" |
| **Screen** | "screenshot lo", "screen recording start" |
| **Cursor** | "cursor ko center le jao", "right click karo" |
| **Browser** | "open google.com", "youtube pe song bajao" |
| **Info** | "battery check", "cpu usage", "mera ip" |
| **Window** | "minimize window", "snap left", "show desktop" |
| **Keyboard** | "copy karo", "paste karo", "ctrl+s dabao" |
| **Media** | "next song", "play pause" |
| **Calculator** | "calculate 25*4", "sqrt 16 kitna" |
| **Weather** | "Delhi ka mausam" |
| **Remind** | "remind me in 30 minutes" |
| **Translate** | "translate hello to Hindi" |
| **Password** | "generate password 20" |
| **Memory** | "yaad rakho ki mera naam Sudhir hai" |
| **Code** | "execute print('hello')" |
| **Terminal** | "terminal me dir chalao" |
| **PiP** | "pip mode Chrome" |
| **Image** | "generate image sunset over mountains" |

### Shortcuts

| Key | Action |
|---|---|
| `Ctrl+K` | Command Palette |
| `Ctrl+Space` | Push-to-Talk |
| `?` | Shortcuts Help |

---

## Security

| Feature | Implementation |
|---|---|
| Path sandbox | `is_path_safe()` — blocks `C:\`, `C:\Windows`, UNC, `.sys/.dll` |
| Confirmation gates | Shutdown/restart/delete/kill require `confirmation_id` |
| Prompt injection filter | `is_injection()` — blocks "ignore previous instructions", "you are now" etc. |
| Rate limiting | 12 requests/min per category |
| DPAPI vault | `pika_data.json` encrypted with Windows user key |
| Audit log | `pika_audit.jsonl` — every tool call logged |
| Terminal blocklist | `rm -rf /`, `format c:` blocked |
| Code execution sandbox | `subprocess` import blocked in REPL |

---

## Testing

```bash
python -m pytest test_pc_bridge.py -v    # 70 tests
npm run build                             # Frontend build verification
python -m py_compile pc_bridge.py         # Backend syntax check
```

**Test coverage:** Vault encryption, path safety, injection filter, rate limiting, calculator AST, password generator, translator, weather cache, file operations, memory system, skill system, LLM routing, command routing, system commands, UIA, browser, reminders, volume, clipboard, MCP manifest, code execution, scheduler, ReAct agent, broadcast function.

---

## Configuration

Settings can be configured via:
1. **UI Settings Panel** — API keys, voice engine, theme
2. **`.env` file** — backend secrets (see `.env.example`)
3. **Environment variables** — `GROQ_API_KEY`, `TELEGRAM_BOT_TOKEN`, etc.

### Voice Engines

| STT | TTS |
|---|---|
| `webspeech` (browser, default) | `edge` (`hi-IN-SwaraNeural`, default) |
| `vosk` (offline, `models/hi`) | `piper` (offline) |
| `whisper` (optional, `C:\whisper\ggml-tiny.bin`) | `webspeech` / `none` |

### AI Providers

Groq, Gemini, Mistral, Cerebras, DeepSeek, OpenRouter, Z.ai, Nvidia, Together, Ollama (local). Supports comma-separated key rotation for rate limit handling.

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `python not recognized` | Reinstall Python with "Add to PATH" |
| `ws://8765` not connected / `BRIDGE OFF` | Run `python pc_bridge.py`; cold-start needs 12s (PyInstaller exe). UI shows `BRIDGE STARTING…` then `LIVE` |
| `WinError 10013` / `Failed to fetch` / `Failed to establish a new connection` | **Windows Firewall ne `pc_bridge.exe` ko block kiya** — API key sahi hone par bhi `api.mistral.ai:443` fail. **Abhi turant fix (1 min):** |
| Vosk not loaded | `pip install vosk` + model in `models/hi/` |
| Edge TTS silent | Check internet; fallback to piper |
| `npm run build` fails | `npm install` again; Node 18+ required |
| Volume set not working | `pip install pycaw` for exact volume control |
| PiP not staying on top | Run as admin for `SetWindowPos` permission |

> ### 🔥 `WinError 10013` — Abhi turant fix (1 min) — tabhi download ke baad user ka `Fetch live models` kaam karega
> 1. **Admin PowerShell** kholo — Start → `PowerShell` → **Run as Administrator**
> 2. **Paste karo** (dono commands):
> ```powershell
> netsh advfirewall firewall add rule name="Pika AI Bridge" dir=out action=allow program="C:\Users\DELL\AppData\Local\Programs\pika-ai-assistant\resources\bin\pc_bridge.exe" enable=yes
> netsh advfirewall firewall add rule name="Pika AI Bridge Python" dir=out action=allow program="C:\Users\DELL\AppData\Local\Programs\Python\Python312\python.exe" enable=yes
> ```
> 3. Pika band karke dobara kholo → Settings → Mistral `Use` → `Fetch live models` → ab `OK` ayega, `Failed to fetch` gayab
> 4. Agar phir bhi aaye to **Windows Defender → Allow an app** me `pc_bridge.exe` ko ✅ karo
>
> *Note:* Naya `Pika AI Assistant Setup 1.2.1.exe (410 MB)` ye rule auto-try karta hai, par Admin bina manual step chahiye ho sakta hai. Python fallback (`resources/pc_bridge.py`) already `python.exe` ke allow se kaam karega.

---

## Project Structure

```
pika-ai-assistant-prompt/
├── electron/                # main.cjs, preload.cjs
├── src/
│   ├── components/          # 65+ React components
│   ├── hooks/               # useAssistant, useVoice, useWeather, useRealPiP
│   ├── store/               # assistantStore.ts (zustand)
│   ├── lib/                 # commandEngine.ts, constants.ts, utils.ts
│   └── types/               # TypeScript interfaces
├── pc_bridge.py             # 5700+ line Python WebSocket backend
├── test_pc_bridge.py        # 70 pytest tests
├── brain.md                 # Project memory/history
├── pika_data.json           # Encrypted vault (DPAPI)
├── calendar_mcp_stub.py     # Calendar sidecar
├── start.bat                # 1-click launcher
├── requirements.txt         # Python dependencies
└── docs/                    # Documentation
```

---

## Contributing

PRs welcome. Keep changes additive — no existing behavior deleted. Run `npm run lint` + `npm run build` + `python -m pytest test_pc_bridge.py -v` before pushing.

## License

MIT License — see [LICENSE](LICENSE).
