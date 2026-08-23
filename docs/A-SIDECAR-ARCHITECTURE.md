[🏠 Back to Master Index](./00-START-HERE.md) | [➡️ Next: A Packaging Guide](./A-PACKAGING-GUIDE.md)

---

# 🐍 A — Option A: Electron + Packaged Python Sidecar

> Pika ka sabse **production-ready** upgrade path. User ko Python install nahi karna
> padta — sirf ek `.exe` double-click, sab kuchh ho jaata hai. 🎯

---

## ⚡ 30-Second Comparison

```mermaid
flowchart LR
    subgraph OLD["❌ v4 — User Must Install Python"]
        P1["Python 3.10+ install"] --> P2["Add to PATH tick"]
        P2 --> P3["venv create"]
        P3 --> P4["pip install 5 min"]
        P4 --> P5["start.bat chalao"]
        P5 --> P6["2 console windows"]
        P6 --> P7["😤 Finally working"]
    end
    subgraph NEW["✅ v5 — Sidecar"]
        N1["Pika-AI-Setup.exe"]
        N1 --> N2["Double click"]
        N2 --> N3["🎉 Done in 30s"]
    end

    style OLD fill:#7f1d1d,stroke:#ef4444,color:#fff
    style NEW fill:#14532d,stroke:#22c55e,color:#fff
```

---

## 🏗️ Full Architecture

```mermaid
flowchart TB
    subgraph RENDERER["⚛️ React Renderer (Chromium)"]
        UI["React 19 + TypeScript + Zustand"]
    end

    subgraph MAIN["🖥️ Electron Main Process (Node.js 20)"]
        WIN["BrowserWindow + Tray + Hotkey"]
        IPC["ipcMain.handle()"]
        MG["Mobile Gateway\nexpress + ws :3000"]
    end

    subgraph BRIDGE["🐍 pika-bridge.exe (PyInstaller frozen)"]
        NLU["NLU: 120+ patterns"]
        VOSK["Vosk / Whisper STT"]
        TTS["Edge TTS + pyttsx3"]
        AUTO["pyautogui automation"]
        FILES["File / Drive / Process"]
        LLM["7 LLM Providers"]
        DB[("SQLite pika.db")]
    end

    subgraph PHONE["📱 Phone Browser"]
        PB["http://LAN_IP:3000"]
    end

    RENDERER -->|"contextBridge IPC\n(contextIsolation: true)"| MAIN
    MAIN -->|"stdin/stdout NDJSON\n(private, NOT network)"| BRIDGE
    MAIN --> MG
    PB -->|"WebSocket + PIN token"| MG

    style RENDERER fill:#16213e,stroke:#00f0ff,color:#fff
    style MAIN fill:#0f3460,stroke:#ff00ff,color:#fff
    style BRIDGE fill:#533483,stroke:#22c55e,color:#fff
    style PHONE fill:#7c2d12,stroke:#f97316,color:#fff
```

---

## 🔌 IPC Communication — WebSocket vs Sidecar

```mermaid
sequenceDiagram
    autonumber
    participant R as ⚛️ React
    participant P as 🖥️ Electron Preload
    participant M as ⚡ Main Process
    participant B as 🐍 pika-bridge.exe

    R->>P: window.pikaElectron.command({category:"volume", action:"set", params:{percent:50}})
    P->>M: ipcRenderer.invoke("pika:command", msg)
    M->>M: JSON.stringify(msg) + "\n"
    M->>B: stdin.write(line)
    B->>B: JSON.parse(line) → route_command()
    B->>B: pyautogui volume set
    B->>M: stdout: JSON response + "\n"
    M->>M: line buffer → JSON.parse → pending.resolve
    M-->>P: Promise resolved
    P-->>R: result
```

> **Security advantage:** Bridge na to `0.0.0.0:8765` par hai, na koi network port
> open karta hai. Sirf Electron ke stdin/stdout se baat karta hai — 100% private.

---

## 📦 How PyInstaller Works

```mermaid
flowchart LR
    A["pc_bridge.py"] --> B["PyInstaller\n--onefile --noconsole\n--collect-all vosk"]
    B --> C["python-dist/\npika-bridge.exe\n(~85 MB, standalone)"]
    C --> D["electron-builder\nextraResources"]
    D --> E["Pika-AI-Setup.exe\n(~200 MB total)\ncontains bridge inside"]
    E --> F["User installs\nDouble-click\n✅ No Python needed"]

    style C fill:#0f3460,stroke:#00f0ff,color:#fff
    style F fill:#14532d,stroke:#22c55e,color:#fff
```

---

## 🔄 Bridge Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Starting: app.whenReady()
    Starting --> Connected: connection_ready event
    Connected --> Heartbeat: every 15s ping
    Heartbeat --> Connected: pong OK
    Heartbeat --> Crashed: timeout / error
    Connected --> Crashed: process.on('close')
    Crashed --> Waiting: restarts < 5
    Waiting --> Starting: exponential backoff\n1s → 2s → 4s → 8s → 30s
    Crashed --> Failed: restarts >= 5
    Failed --> Dialog: show error dialog
    Connected --> Stopping: app quit
    Stopping --> [*]: taskkill /t (Windows)\nor SIGTERM → SIGKILL
```

---

## 🔐 Security Model

```mermaid
flowchart TD
    subgraph ATTACK_SURFACE["❌ v4 Attack Surface"]
        WS["ws://0.0.0.0:8765\nNO authentication\nAnyone on WiFi\ncan send shutdown!"]
    end
    subgraph SECURE["✅ v5 Secure Model"]
        STDIO["stdin/stdout\nPrivate, not network"]
        GATE["Mobile Gateway :3000\nPIN + HMAC token\nDestructive = desktop confirm"]
    end
    subgraph ELECTRON["Electron Hardening"]
        CI["contextIsolation: true"]
        NI["nodeIntegration: false"]
        WS2["webSecurity: true"]
        CB["contextBridge only\n15 safe functions"]
    end

    style WS fill:#7f1d1d,stroke:#ef4444,color:#fff
    style STDIO fill:#14532d,stroke:#22c55e,color:#fff
    style GATE fill:#14532d,stroke:#22c55e,color:#fff
```

---

## ✅ Feature Support

| Feature | v4 Python | v5 Sidecar | Notes |
|---------|:---------:|:----------:|-------|
| Offline Hindi STT | ✅ | ✅ | Vosk bundled |
| Wake word background | ✅ | ✅ | Python in background |
| Mouse/keyboard macro | ✅ | ✅ | pyautogui bundled |
| OCR (pytesseract) | ✅ | ✅ | Bundled |
| Edge TTS | ✅ | ✅ | Bundled |
| Offline TTS fallback | ✅ | ✅ | pyttsx3 bundled |
| All 120+ commands | ✅ | ✅ | Unchanged |
| No Python install needed | ❌ | ✅ | Key improvement |
| Single .exe installer | ❌ | ✅ | Key improvement |
| No .bat launcher | ❌ | ✅ | Key improvement |
| Cold start <2s | ❌ 3s | ✅ 1.5s | No interpreter startup |
| LAN auth security | ❌ | ✅ | PIN pairing |

---

## 📊 Bundle Size Breakdown

```mermaid
pie showData
    title Pika-AI-Setup.exe Size (~200 MB)
    "Electron runtime + Chromium" : 120
    "pika-bridge.exe (Python frozen)" : 80
    "React bundle" : 1
    "Vosk model" : 0
```

> Vosk model (~45 MB) ko **first run download** karo size bachane ke liye.
> `PIKA_MODELS_DIR` env var se custom path set hoti hai.

**Size optimization tips:**
```bash
# UPX compression (~30% reduction on bridge.exe)
pyinstaller --onefile --upx-dir C:\upx ...

# Exclude unused modules
--exclude-module tkinter --exclude-module matplotlib
--exclude-module numpy.testing --exclude-module PIL.ImageTk
```

---

## 🚀 Build Commands

```bash
# 1. Bridge compile karo
npm run build:bridge
# → python-dist/pika-bridge.exe

# 2. React build
npm run build
# → dist/index.html

# 3. Electron installer
npm run release:win
# → release/Pika-AI-Setup-1.0.0.exe
```

---

## 🤔 FAQ

**Q: Agar user ki machine par Python installed ho toh kya bridge use karega?**
A: Nahi. App packaged bridge.exe use karta hai, system Python ignore karta hai.

**Q: PyInstaller ka exe antivirus flag karega?**
A: Kabhi-kabhi hota hai unsigned binaries ke saath. Fix: code sign karo.
Detail → [A-PACKAGING-GUIDE.md](./A-PACKAGING-GUIDE.md)

**Q: pc_bridge.py ab bhi dev mein kaam karega?**
A: Haan. `PIKA_IPC_MODE` set na ho toh WebSocket mode chalega jaise pehle.

**Q: Models app ke saath bundle hote hain ya download hote hain?**
A: Dono possible hain. electron-builder.yml mein `from: models/ to: models/` add
karo bundling ke liye, ya first-run auto-download raho (chhota installer).

---

## 🔗 Related Docs

- [A-PACKAGING-GUIDE.md](./A-PACKAGING-GUIDE.md) — PyInstaller + signing + GitHub Releases
- [A-MOBILE-GATEWAY.md](./A-MOBILE-GATEWAY.md) — Phone PIN pairing guide
- [02-ARCHITECTURE.md](./02-ARCHITECTURE.md) — Overall system architecture
- [25-PACKAGING-DISTRIBUTION.md](./25-PACKAGING-DISTRIBUTION.md) — Distribution guide

---

[🏠 Back to Master Index](./00-START-HERE.md) | [➡️ Next: A Packaging Guide](./A-PACKAGING-GUIDE.md)
