# ⚡ Pika AI Assistant (पिका एआई असिस्टेंट)

> आपका व्यक्तिगत AI डेस्कटॉप असिस्टेंट — हिंदी और अंग्रेज़ी में आवाज़ से कंट्रोल करो, अब Agent-Mini की सुपरपावर के साथ!

A local, privacy-first PC voice assistant with a premium glassmorphism web UI, Hindi/English/Hinglish command understanding, full desktop automation, and a multi-provider free LLM router. **Now upgraded with Agent Mode to autonomously execute complex PC tasks using Cloud AI intelligence and Local Execution!**

![version](https://img.shields.io/badge/version-2.0.0-purple)
![license](https://img.shields.io/badge/license-MIT-green)

## 🏗️ Architecture

```
React Frontend (Vite + Tailwind + Framer Motion)   ← Beautiful UI with Agent Toggle
        │  WebSocket JSON  (ws://localhost:8765)
        ▼
Python Bridge (pc_bridge.py)  ← PC control, LLM routing, Agent-Mini Engine
        │
        ├──▶ Normal Mode: Fast chat & direct OS commands
        └──▶ Agent Mode: Cloud LLM thinks -> Agent-Mini safely executes tools locally
```

The **frontend works fully on its own in Demo Mode**. When you run `pc_bridge.py`, the UI auto-connects over WebSocket and commands execute for real on your PC. 

## ✨ Features & Capabilities

- 🤖 **NEW: Agent Mode (Powered by Agent-Mini)** — Turn on Agent Mode in the UI and Pika will act as an autonomous all-rounder. It offloads heavy thinking to Cloud LLMs (no PC lag!) and safely executes tools on your PC (read/write files, run shell commands, fetch web data).
- 🪶 **Ultra-Lightweight** — PyTorch and heavy local ML dependencies have been completely removed! TTS and logic are now incredibly fast and battery-friendly.
- 🎤 **Voice control** — browser speech recognition + **whisper.cpp (Tiny Model)** support for extremely fast, near-zero load offline Hindi/English STT.
- 💬 **AI chat** — 7 free providers (Groq, Gemini, Mistral, Cerebras, OpenRouter, Z.ai, DeepSeek) with streaming + auto-fallback.
- 🖥️ **System** — shutdown / restart / sleep / lock / hibernate / log off (with confirmation).
- 🚀 **Apps** — open/close 20+ applications.
- 🔊 **Media & volume** — play/pause/next/prev, volume slider & mute.
- 📁 **Files** — create / delete / list / open explorer (path-safe).
- 📊 **System info** — CPU / RAM / disk / battery / IP live cards.
- 🎨 **Premium UI** — aurora gradient, floating particles, glassmorphism, PiP mode, and live Agent Tool execution toasts.

## 🚀 Quick Start

### 1. Backend (PC Control & Agent)
```bash
pip install -r requirements.txt
pip install agent-mini        # Required for the new autonomous Agent Mode!
python pc_bridge.py
```

### 2. Frontend (UI)
```bash
npm install
npm run dev
```
Or on Windows just double-click **`start.bat`**.

### Add free AI keys (optional)
Copy `.env.example` → `.env` and paste any provider key (Groq, Gemini, etc.), **or** enter keys in the app's **Settings → AI Provider** panel.

## 🗣️ How to Use Agent Mode?

Turn on the **"Agent Mode"** toggle in the UI (top left of the transcript panel). 
When enabled, you can ask Pika to do complex, multi-step tasks. 

**Agent Mode Examples:**
- _"Mera system check karo aur ek report banakar C drive mein system_report.txt mein save karo."_
- _"Current folder mein jitni bhi .txt files hain, un sabko ek naye folder 'Backup' mein move kar do."_
- _"Internet par Pika AI ke baare mein search karo aur mujhe summary do."_

The Agent will intelligently decide which tools (like `shell_exec`, `write_file`, `search_web`) it needs to run on your PC to complete the job! You will see live 🤖 Toasts in the UI telling you exactly what the Agent is doing.

## 🔒 Privacy & Security
- Destructive actions require **explicit confirmation**.
- File operations block sensitive system paths.
- Agent Mode runs safely and streams its tool activity directly to the UI so you always know what it is doing.
- API keys are stored locally only.

## 📜 License
MIT — free to use, modify, and distribute.

---
**पिका — तुम्हारा अपना स्मार्ट AI असिस्टेंट, अब और भी हल्का, तेज़ और समझदार।** ⚡
