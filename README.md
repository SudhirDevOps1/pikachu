# Pika AI Assistant

<div align="center">

[![Version](https://img.shields.io/badge/version-1.1.0-7c3aed.svg?style=for-the-badge)](https://github.com/SudhirDevOps1/pikachu)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981.svg?style=for-the-badge)](LICENSE)

**An open-source, voice-enabled Desktop AI Assistant with local system automation.**

</div>

## Overview

Pika AI is a highly capable personal AI assistant designed to integrate seamlessly with your Windows PC. It offers native text-to-speech (TTS), offline speech-to-text (STT), hardware-level system controls, and a multi-agent framework. Built with a React frontend and a Python WebSocket backend, Pika emphasizes privacy, offline capabilities, and extensive customizability.

## Key Features

- **Multilingual Voice AI**: Features high-quality TTS using Edge TTS (`hi-IN` / `en-US`) with a fallback to offline Piper TTS. Includes offline Vosk STT for fully disconnected usage.
- **Full Air-Gapped Offline Mode**: Capable of running with zero internet access by combining Vosk (STT), Ollama (Local LLM), and Piper TTS.
- **Hardware & Desktop Automation**: Natively controls Windows volume, screen brightness, processes, and fast application launching by scanning `HKLM`/`HKCU` and Start Menu shortcuts.
- **Agentic Swarm Framework**: Build and manage custom sub-agents with specific roles, system prompts, and tool permissions (Web Search, Screen Vision, File Management).
- **Obsidian Second Brain Integration**: Syncs conversations, creates notes, and searches your Obsidian vault natively using the Obsidian Local REST API.
- **Secure Data Storage**: Sensitive API keys and user preferences stored in `pika_data.json` are encrypted using Windows Native DPAPI (User Master Key) and AES-256.
- **Multi-API Key Rotation**: Automatically rotates through comma-separated API keys to seamlessly handle rate limits. Connects to Groq, Mistral, Gemini, DeepSeek, Ollama, and custom OmniRoute endpoints.
- **Token Telemetry**: Persistent token usage tracking across sessions, categorized by provider.

## Architecture

Pika AI operates on a separated frontend-backend architecture connected via WebSockets:

- **Frontend (React + Vite)**: A responsive UI hosted at `http://localhost:3000`. Handles user interactions, voice waveform visualization, chat UI, and inline prompt editing.
- **Backend (Python)**: A WebSocket server (`pc_bridge.py` at `ws://localhost:8765`) that interfaces with LLM APIs, executes system automation commands, handles STT/TTS processing, and manages state.

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
```

## Voice Commands

Pika supports natural language commands in English, Hindi, and Hinglish.

| Action | Example Command |
| :--- | :--- |
| **App Launch** | "Open VS Code", "Chrome kholo" |
| **System Volume** | "Volume 50%", "Awaaz badhao", "Mute volume" |
| **Brightness** | "Brightness 80%" |
| **Screen Capture** | "Take screenshot", "Screenshot lo" |
| **System Info** | "Battery check", "List processes" |
| **Obsidian** | "Obsidian me daily note banao", "Search Obsidian for <query>" |

## Configuration

Settings and API keys can be configured directly from the UI settings panel. 
Alternatively, use the `.env` file for backend configurations (see `.env.example`).

**Obsidian Integration:**
To enable Obsidian integration, install the "Local REST API" community plugin in Obsidian, copy your Bearer Token, and paste it alongside the local URL into Pika's Settings panel.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
