[⬅️ Previous: Database](./03-DATABASE.md) | [🏠 Back to Master Index](./00-START-HERE.md) | [➡️ Next: Folder Structure](./05-FOLDER-STRUCTURE.md)

---

# 🔌 04 — API & NETWORK FLOW (WebSocket Protocol)

> Pika mein **koi REST API nahi** hai. Sab kuch **WebSocket** par chalta hai — kyunki
> humein real-time bidirectional communication chahiye (voice streaming, live system
> stats, LLM token streaming). Yeh file poora protocol document karti hai. 📡

---

## 🤔 REST vs WebSocket — Humne WebSocket kyun choose kiya?

```mermaid
flowchart TB
    subgraph REST["❌ REST API (HTTP)"]
        R1["Client: GET /status"] --> R2["Server: 200 OK"]
        R2 --> R3["Connection CLOSE"]
        R3 --> R4["Client: GET /status again..."]
        R4 --> R5["Naya TCP handshake<br/>~50ms overhead har baar"]
    end

    subgraph WS["✅ WebSocket"]
        W1["Client: Upgrade handshake"] --> W2["Connection OPEN 🔓"]
        W2 --> W3["Server: push anytime"]
        W2 --> W4["Client: send anytime"]
        W3 --> W5["Same connection reused<br/>~2ms latency"]
        W4 --> W5
    end

    style REST fill:#7f1d1d,stroke:#ef4444,color:#fff
    style WS fill:#14532d,stroke:#22c55e,color:#fff
```

| Feature | REST | WebSocket | Pika ki zaroorat |
|---------|------|-----------|------------------|
| Server push | ❌ (polling chahiye) | ✅ Native | System stats har 5 sec |
| Latency | 50-100ms | 2-8ms | Voice must be instant |
| Binary data | ⚠️ Base64 (33% bigger) | ✅ Native binary | Audio streaming |
| Streaming | ⚠️ SSE/chunked | ✅ Native | LLM token-by-token |
| Overhead | Headers har request | Handshake once | Battery + CPU saving |

> **Viva line:** *"Agar REST use karte toh system stats ke liye har 5 second par
> polling karni padti — 720 requests per hour. WebSocket mein server khud push karta
> hai, sirf 1 connection. 99% less overhead."*

---

## 📨 Message Envelope Specification

Har message ek **fixed JSON structure** follow karta hai. Yeh **contract** hai —
dono side (React + Python) isi ko samajhte hain.

### Client → Server

```typescript
interface WSMessage {
  type: "command" | "query" | "config" | "voice_start" | "voice_stop"
      | "tts_speak" | "cancel" | "ping";
  category?: string;   // "system" | "apps" | "files" | ...
  action?: string;     // "shutdown" | "open" | "delete" | ...
  params?: Record<string, unknown>;
  id: string;          // UUID v4 — response matching ke liye
  timestamp: string;   // ISO 8601
}
```

**Real example:**
```json
{
  "type": "command",
  "category": "apps",
  "action": "open",
  "params": { "name": "chrome" },
  "id": "a3f1c8e2-4b7d-4f2a-9c1e-8d3b5a7f9e01",
  "timestamp": "2026-07-02T10:32:24.512Z"
}
```

### Server → Client (Response)

```typescript
interface WSResponse {
  type: "response";
  status: "success" | "error" | "confirmation_required";
  data?: unknown;
  message: string;              // Hindi/English human readable
  confirmation_id?: string | null;
  id: string;                   // SAME as request id
  timestamp: string;
}
```

### Server → Client (Push Event — no id)

```typescript
interface WSEvent {
  type: "event";
  event: "system_status" | "voice_partial" | "voice_final" | "wake_word"
       | "tts_started" | "tts_audio" | "tts_ended" | "reminder_triggered"
       | "battery_alert" | "shortcut_executed" | "connection_ready";
  data: unknown;
  timestamp: string;
}
```

### Server → Client (LLM Streaming)

```typescript
interface WSLLMStream {
  type: "llm_stream";
  chunk: string;       // partial text
  provider: string;    // "groq" | "gemini" | "local_fallback"
  id: string;          // conversation message id
  done: boolean;       // true = stream finished
  timestamp: string;
}
```

---

## 🔄 Sequence Diagram 1: Simple Command Execution

```mermaid
sequenceDiagram
    autonumber
    participant R as ⚛️ React
    participant WS as 🔌 WebSocket
    participant PY as 🐍 Python
    participant V as 🛡️ Validator
    participant OS as 💻 OS

    R->>WS: {"type":"command","category":"volume",<br/>"action":"set","params":{"percent":50},"id":"x1"}
    WS->>PY: Parse JSON
    PY->>V: needs_confirmation("volume","set")?
    V-->>PY: false (safe command)
    PY->>OS: pyautogui volume keys
    OS-->>PY: OK
    PY->>PY: db.log_command(...)
    PY-->>WS: {"type":"response","status":"success",<br/>"message":"आवाज़ 50% पर सेट","id":"x1"}
    WS-->>R: Match id "x1" → resolve
    R->>R: addToast("Volume 50%")
```

---

## ⚠️ Sequence Diagram 2: Confirmation Flow (Destructive Commands)

Shutdown, delete, kill process — yeh **khatarnaak** commands hain. Inke liye
**two-phase commit** pattern use hota hai.

```mermaid
sequenceDiagram
    autonumber
    actor U as 👤 User
    participant R as ⚛️ React
    participant PY as 🐍 Python
    participant P as 📋 PENDING_CONFIRM dict
    participant OS as 💻 OS

    U->>R: "shutdown karo"
    R->>PY: {"type":"command","category":"system",<br/>"action":"shutdown","id":"s1"}
    PY->>PY: CONFIRM_REQUIRED check → TRUE
    PY->>P: PENDING_CONFIRM[cid] = original_msg
    PY-->>R: {"status":"confirmation_required",<br/>"confirmation_id":"cid-99","id":"s1"}
    R->>U: 🚨 Modal: "क्या आप वाकई shutdown करना चाहते हैं?"

    alt User clicks "हाँ, करें"
        U->>R: Confirm
        R->>PY: {"category":"_confirm","action":"approve",<br/>"params":{"confirmation_id":"cid-99"}}
        PY->>P: original = PENDING_CONFIRM.pop("cid-99")
        PY->>OS: shutdown /s /t 10
        PY-->>R: {"status":"success","message":"बंद हो रहा है"}
    else User clicks "रद्द करें"
        U->>R: Cancel
        R->>PY: {"category":"_confirm","action":"reject",<br/>"params":{"confirmation_id":"cid-99"}}
        PY->>P: PENDING_CONFIRM.pop("cid-99")
        PY-->>R: {"status":"success","message":"रद्द किया गया"}
    end
```

**Commands requiring confirmation:**
| Category | Actions |
|----------|---------|
| `system` | shutdown, restart, hibernate |
| `files` | delete, delete_folder |
| `processes` | kill |
| `disk` | cleanup_temp |
| `macros` | play |
| `scheduler` | clear_all |

---

## 🎙️ Sequence Diagram 3: Voice Streaming with Wake Word

```mermaid
sequenceDiagram
    autonumber
    participant MIC as 🎙️ Mic
    participant R as ⚛️ React
    participant PY as 🐍 Python
    participant V as 🧠 Vosk

    loop Every 100ms audio chunk
        MIC->>R: Float32Array audio
        R->>R: Convert to 16-bit PCM
        R->>PY: Binary WebSocket frame
        PY->>V: recognizer.AcceptWaveform(bytes)

        alt Partial result
            V-->>PY: {"partial": "hey assi..."}
            PY-->>R: event: voice_partial
            R->>R: setPartial() — live text
        else Final result
            V-->>PY: {"text": "hey assistant chrome kholo"}
            PY->>PY: detect_wake_word() → TRUE
            PY-->>R: event: wake_word
            PY->>PY: try_voice_shortcut() → no match
            PY-->>R: event: voice_final {"text":"chrome kholo"}
            R->>R: processInput("chrome kholo")
        end
    end
```

---

## 📡 LLM Streaming Flow

```mermaid
sequenceDiagram
    autonumber
    participant R as ⚛️ React
    participant PY as 🐍 Python
    participant EX as 🧵 Executor Thread
    participant G as 🤖 Groq API
    participant C as 🤖 Cerebras (fallback)

    R->>PY: {"type":"query","params":{"text":"joke sunao"},"id":"q1"}
    PY->>PY: llm_stream() generator start
    PY->>EX: run_in_executor(worker)
    EX->>G: POST /chat/completions (stream=True)

    alt Groq responds
        loop Each SSE chunk
            G-->>EX: data: {"choices":[{"delta":{"content":"Ek "}}]}
            EX-->>PY: loop.call_soon_threadsafe(queue.put)
            PY-->>R: {"type":"llm_stream","chunk":"Ek ","done":false,"id":"q1"}
            R->>R: appendToMessage(id, chunk)
        end
        PY-->>R: {"type":"llm_stream","chunk":"","done":true}
        R->>R: finalizeMessage(id)
    else Groq fails (rate limit / no key)
        G-->>EX: HTTP 429
        EX-->>PY: __ERROR__
        PY->>C: Try next provider automatically
        C-->>PY: Stream chunks
        PY-->>R: {"provider":"cerebras", ...}
    end
```

---

## 📚 Complete Command Reference Table

### System Commands
| Category | Action | Params | Confirm? | Returns |
|----------|--------|--------|:--------:|---------|
| `system` | `shutdown` | `{delay?: number}` | ✅ | success message |
| `system` | `restart` | `{delay?: number}` | ✅ | success message |
| `system` | `sleep` | `{}` | ❌ | success message |
| `system` | `lock` | `{}` | ❌ | success message |
| `system` | `logoff` | `{}` | ❌ | success message |
| `system` | `hibernate` | `{}` | ✅ | success message |

### Application Commands
| Category | Action | Params | Confirm? | Returns |
|----------|--------|--------|:--------:|---------|
| `apps` | `open` | `{name: string}` | ❌ | success message |
| `apps` | `close` | `{name: string}` | ❌ | success message |

### Volume & Media
| Category | Action | Params | Returns |
|----------|--------|--------|---------|
| `volume` | `up` | `{amount?: 10}` | message |
| `volume` | `down` | `{amount?: 10}` | message |
| `volume` | `set` | `{percent: 0-100}` | message |
| `volume` | `mute` / `unmute` | `{}` | message |
| `media` | `play_pause` | `{}` | message |
| `media` | `next` / `previous` | `{}` | message |

### File Operations
| Category | Action | Params | Confirm? | Returns |
|----------|--------|--------|:--------:|---------|
| `files` | `create_file` | `{path, content?}` | ❌ | path |
| `files` | `create_folder` | `{path}` | ❌ | path |
| `files` | `read` | `{path}` | ❌ | `{content}` |
| `files` | `write` | `{path, content}` | ❌ | path |
| `files` | `rename` | `{path, new_path}` | ❌ | message |
| `files` | `delete` | `{path}` | ✅ | message |
| `files` | `list` | `{path}` | ❌ | `{items[]}` |
| `files` | `open_explorer` | `{path?}` | ❌ | message |

### System Info
| Category | Action | Returns |
|----------|--------|---------|
| `info` | `battery` | `{percent, plugged}` |
| `info` | `cpu` | `{percent, cores}` |
| `info` | `ram` | `{percent, used_gb, total_gb}` |
| `info` | `disk` | `{percent, free_gb}` |
| `info` | `time` / `date` | formatted string |
| `info` | `full_report` | complete object |
| `disk` | `list_drives` | `{drives[]}` |
| `network` | `ip` | `{local, hostname}` |

### Tools
| Category | Action | Params | Returns |
|----------|--------|--------|---------|
| `calculator` | `eval` | `{expression}` | `{result}` |
| `password` | `generate` | `{length?: 16}` | `{password}` |
| `translator` | `translate` | `{text, target_lang}` | `{translation}` |
| `weather` | `get` | `{location?}` | `{temp, desc, humidity}` |
| `web` | `open_site` | `{name}` | message |
| `web` | `search` | `{query}` | message |
| `processes` | `list` | `{}` | `{items[]}` |
| `processes` | `kill` | `{name_or_pid}` | ✅ message |

---

## 🚦 Connection State Machine

```mermaid
stateDiagram-v2
    [*] --> disconnected
    disconnected --> connecting: connect() called
    connecting --> connected: onopen + connection_ready event
    connecting --> error: timeout (4s) or refused
    error --> demo_mode: fallback activated
    demo_mode --> connecting: exponential backoff retry
    connected --> disconnected: onclose
    disconnected --> connecting: auto-reconnect (1s→2s→4s→...→30s)

    note right of demo_mode
        UI fully interactive
        Simulated responses
        No PC control
    end note

    note right of connected
        Full PC control
        Real system stats
        Vosk STT active
    end note
```

**Reconnection algorithm (exponential backoff):**
```typescript
let delay = 1000;  // 1 second
const MAX = 30000; // 30 seconds cap

socket.onclose = () => {
  setTimeout(() => {
    delay = Math.min(delay * 2, MAX);  // 1s → 2s → 4s → 8s → 16s → 30s
    connect();
  }, delay);
};

socket.onopen = () => {
  delay = 1000;  // reset on success
};
```

> **Kyun exponential?** Agar server band hai toh har second retry karne se CPU +
> network waste hota hai. Exponential backoff se gradually gap badhta hai. Yeh
> **industry standard** hai (AWS, Google sab use karte hain).

---

## 🔒 Error Codes & Handling

| Status | Meaning | Client Action |
|--------|---------|---------------|
| `success` | Command executed | Show green toast |
| `error` | Execution failed | Show red toast + message |
| `confirmation_required` | Needs user approval | Show modal dialog |

| Common Error Messages | Cause | Fix |
|----------------------|-------|-----|
| `pyautogui ज़रूरी है` | Library missing | `pip install pyautogui` |
| `psutil ज़रूरी है` | Library missing | `pip install psutil` |
| `सुरक्षा: यह पथ प्रतिबंधित है` | Blocked system path | Different path use karo |
| `फाइल नहीं मिली` | Path doesn't exist | Path verify karo |
| `अज्ञात कमांड` | No route match | Category/action check karo |

---

## 🔗 Related Reading
- Backend implementation → [11-BACKEND-BASICS.md](./11-BACKEND-BASICS.md)
- Line-by-line code → [13-CODE-WALKTHROUGH.md](./13-CODE-WALKTHROUGH.md)
- Testing the API → [19-TESTING-QUALITY.md](./19-TESTING-QUALITY.md)

**External:**
- [MDN WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
- [Python websockets library](https://websockets.readthedocs.io/)
- [WebSocket RFC 6455](https://datatracker.ietf.org/doc/html/rfc6455)
- [JSON Schema](https://json-schema.org/learn/getting-started-step-by-step)

---

[⬅️ Previous: Database](./03-DATABASE.md) | [🏠 Back to Master Index](./00-START-HERE.md) | [➡️ Next: Folder Structure](./05-FOLDER-STRUCTURE.md)
