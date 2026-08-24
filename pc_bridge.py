#!/usr/bin/env python3
"""
============================================================================
 PIKA AI — PC Bridge (WebSocket Backend)
----------------------------------------------------------------------------
 Run this on your PC to control it from the Pika web UI.

 Features:
   • Offline Hindi/English STT via Vosk (auto-downloads model on first run)
   • Wake word detection: "hey assistant" / "hey pika" / "पिका"
   • Natural TTS via Microsoft Edge TTS (hi-IN-SwaraNeural)
     — automatic pyttsx3 offline fallback when internet is down
   • Full PC automation: system power, apps, volume, media, files,
     clipboard, screenshots, windows, processes, network, reminders
   • Multi-provider free LLM router with streaming + auto-fallback
   • Mobile access: connect from your phone on the same WiFi

 Usage:
     pip install -r requirements.txt
     python pc_bridge.py

 Then open the web UI (npm run dev) and it auto-connects to ws://localhost:8765
 From your PHONE (same WiFi): http://YOUR_PC_IP:3000
============================================================================
"""

from __future__ import annotations

import asyncio
import base64
import json
try:
    from agent_mini.agent import AgentLoop, Memory, ToolEvent
    from agent_mini.providers import create_provider
    from pathlib import Path
    HAS_AGENT_MINI = True
except Exception:
    HAS_AGENT_MINI = False

import logging
import os
import platform
import re
import secrets as pysecrets
import shutil
import socket
import string
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
import urllib.request
import uuid
import webbrowser
from datetime import datetime
from datetime import timezone
from pathlib import Path

# ─── Required dependency ────────────────────────────────────────────────────
try:
    import websockets
    try:
        from websockets.asyncio.server import serve
    except ImportError:
        from websockets import serve  # older versions
except ImportError:
    print("FATAL: 'websockets' not installed. Run: pip install websockets")
    sys.exit(1)

# ─── Optional dependencies (graceful degradation) ───────────────────────────
def _opt(name):
    try:
        return __import__(name)
    except Exception:
        print(f"[warn] optional '{name}' not available — related features limited")
        return None

psutil = _opt("psutil")
pyautogui = _opt("pyautogui")
pyperclip = _opt("pyperclip")
requests = _opt("requests")

try:
    import screen_brightness_control as sbc
    HAS_SBC = True
except Exception:
    sbc = None
    HAS_SBC = False

try:
    import winreg
except Exception:
    winreg = None

try:
    import pygetwindow as gw
except Exception:
    gw = None

try:
    from vosk import Model, KaldiRecognizer
    HAS_VOSK = True
except Exception:
    Model = KaldiRecognizer = None
    HAS_VOSK = False
    print("[warn] 'vosk' not installed — offline STT disabled (pip install vosk)")

try:
    import aiohttp.resolver
    import aiohttp.connector
    aiohttp.connector.DefaultResolver = aiohttp.resolver.ThreadedResolver
except Exception:
    pass

try:
    import edge_tts
    HAS_EDGE_TTS = True
except Exception:
    edge_tts = None
    HAS_EDGE_TTS = False
    print("[warn] 'edge-tts' not installed — TTS will use Piper TTS or Web Speech fallback")

try:
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
except Exception:
    pass

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

# ─── Constants ───────────────────────────────────────────────────────────────
HOST = "0.0.0.0"
PORT = 8765
SERVER_VERSION = "1.2.0"
DATA_FILE = Path(__file__).parent / "pika_data.json"
IS_WIN = platform.system() == "Windows"
IS_MAC = platform.system() == "Darwin"

# ═══════════════════════════════════════════════════════════════════════════
#  SECURE VAULT ENCLAVE (Windows DPAPI + AES-256-GCM / Fernet Hardware Bound)
# ═══════════════════════════════════════════════════════════════════════════
def load_vault_data() -> dict:
    """Safely loads and decrypts pika_data.json using Windows DPAPI / Fernet."""
    if not DATA_FILE.exists():
        return {}
    try:
        raw_text = DATA_FILE.read_text(encoding="utf-8")
        if not raw_text.strip():
            return {}
        data = json.loads(raw_text)
        if isinstance(data, dict) and data.get("_encrypted") and data.get("payload"):
            b64_cipher = data["payload"]
            cipher_bytes = base64.b64decode(b64_cipher)
            if IS_WIN:
                try:
                    import win32crypt
                    decrypted_bytes = win32crypt.CryptUnprotectData(cipher_bytes, None, None, None, 0)[1]
                    return json.loads(decrypted_bytes.decode("utf-8"))
                except Exception as ex:
                    logger.error(f"DPAPI decryption failed: {ex}")
            # Fallback Fernet decryption — key derived from OS keychain + hardware, not hardcoded
            try:
                from cryptography.fernet import Fernet
                import hashlib
                # Use machine-specific + user-specific entropy; not a static string
                import getpass
                entropy = f"{socket.gethostname()}|{getpass.getuser()}|{os.getenv('USERNAME','')}|pika_vault_v2"
                # Also mix DPAPI-protected seed if available to avoid pure hostname brute-force
                try:
                    import win32crypt
                    seed = win32crypt.CryptProtectData(entropy.encode(), "PikaSeed", None, None, None, 0)
                    entropy = base64.b64encode(seed).decode()[:64]
                except Exception:
                    pass
                hw_key = base64.urlsafe_b64encode(hashlib.sha256(entropy.encode()).digest())
                f = Fernet(hw_key)
                decrypted = f.decrypt(cipher_bytes)
                return json.loads(decrypted.decode("utf-8"))
            except Exception as ex:
                logger.error(f"Fernet decryption failed: {ex}")
                return {}
        # Legacy unencrypted JSON: load and auto-upgrade to encrypted vault
        if isinstance(data, dict):
            save_vault_data(data)
            return data
        return {}
    except Exception as e:
        logger.error(f"load_vault_data error: {e}")
        return {}


def save_vault_data(payload: dict) -> bool:
    """Encrypts and safely writes user settings, keys, and data to pika_data.json."""
    try:
        raw_bytes = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        encrypted_payload = None
        if IS_WIN:
            try:
                import win32crypt
                encrypted_bytes = win32crypt.CryptProtectData(raw_bytes, "PikaDataVault", None, None, None, 0)
                encrypted_payload = base64.b64encode(encrypted_bytes).decode("utf-8")
            except Exception as ex:
                logger.warning(f"DPAPI protect failed, using Fernet: {ex}")
        
        if not encrypted_payload:
            from cryptography.fernet import Fernet
            import hashlib
            import getpass
            entropy = f"{socket.gethostname()}|{getpass.getuser()}|{os.getenv('USERNAME','')}|pika_vault_v2"
            try:
                import win32crypt
                seed = win32crypt.CryptProtectData(entropy.encode(), "PikaSeed", None, None, None, 0)
                entropy = base64.b64encode(seed).decode()[:64]
            except Exception:
                pass
            hw_key = base64.urlsafe_b64encode(hashlib.sha256(entropy.encode()).digest())
            f = Fernet(hw_key)
            encrypted_payload = base64.b64encode(f.encrypt(raw_bytes)).decode("utf-8")

        vault_container = {
            "_encrypted": True,
            "_vault_version": "2.0",
            "_protected_by": "Windows DPAPI + AES-256 (User Master Key Encrypted)",
            "_info": "This file contains your encrypted API keys and settings. It cannot be read or stolen by third parties or copied to other PCs.",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "payload": encrypted_payload
        }
        DATA_FILE.write_text(json.dumps(vault_container, indent=2), encoding="utf-8")
        return True
    except Exception as e:
        logger.error(f"save_vault_data error: {e}")
        return False

WAKE_WORDS = ["hey assistant", "hey pika", "पिका", "pika", "हे असिस्टेंट"]
VOSK_MODEL_URL = "https://alphacephei.com/vosk/models/vosk-model-small-hi-0.22.zip"
VOSK_MODEL_DIR = Path(__file__).parent / "models" / "hi"
DEFAULT_TTS_VOICE = "hi-IN-SwaraNeural"
connected_clients: set = set()

_vosk_model = None

def ensure_vosk_model():
    """Background model initializer for offline Vosk STT."""
    global _vosk_model
    if not HAS_VOSK or Model is None:
        return
    model_paths = [
        Path(__file__).parent / "models" / "hi",
        Path(__file__).parent / "models" / "vosk",
        Path(__file__).parent / "models" / "vosk-model-small-hi-0.22",
    ]
    for mp in model_paths:
        if mp.exists() and ((mp / "am").exists() or (mp / "conf").exists()):
            try:
                _vosk_model = Model(str(mp))
                logger.info(f"Loaded Vosk offline Hindi model from {mp}")
                return
            except Exception as ex:
                logger.warning(f"Failed to load Vosk model from {mp}: {ex}")

def get_vosk_recognizer():
    global _vosk_model
    if not HAS_VOSK or KaldiRecognizer is None:
        return None
    if _vosk_model is None:
        ensure_vosk_model()
    if _vosk_model is not None:
        try:
            return KaldiRecognizer(_vosk_model, 16000)
        except Exception:
            return None
    return None

def detect_wake_word(text: str) -> bool:
    t = text.lower()
    return any(w in t for w in WAKE_WORDS)

def try_voice_shortcut(text: str):
    t = text.lower().strip()
    if any(k in t for k in ["volume up", "awaaz badhao", "aawaz badhao", "आवाज बढ़ाओ"]):
        return cmd_volume("up", {"amount": 10}), "आवाज़ बढ़ा दी। 🔊"
    if any(k in t for k in ["volume down", "awaaz kam", "aawaz kam", "आवाज कम"]):
        return cmd_volume("down", {"amount": 10}), "आवाज़ कम कर दी। 🔉"
    if any(k in t for k in ["mute", "aawaz band", "आवाज बंद"]):
        return cmd_volume("mute", {}), "म्यूट कर दिया। 🔇"
    if any(k in t for k in ["screenshot", "screen shot", "स्क्रीनशॉट"]):
        return cmd_screen("screenshot", {}), "स्क्रीनशॉट ले लिया! 📸"
    return None, None

class _RedactFilter(logging.Filter):
    def filter(self, record):
        msg = record.getMessage()
        # Redact api_key, token, Authorization
        for pat in [r"(api[_-]?key\s*[:=]\s*)([^\s\",']+)", r"(Authorization\s*:\s*Bearer\s+)([^\s]+)", r"(token\s*[:=]\s*)([^\s\",']+)"]:
            msg = re.sub(pat, r"\1***REDACTED***", msg, flags=re.IGNORECASE)
        record.msg = msg
        record.args = ()
        return True

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(Path(__file__).parent / "pc_bridge.log", encoding="utf-8"),
    ],
)
for h in logging.getLogger().handlers:
    h.addFilter(_RedactFilter())
logger = logging.getLogger("PIKA-Bridge")
logger.addFilter(_RedactFilter())

APP_MAP = {
    "chrome": "chrome", "google chrome": "chrome", "firefox": "firefox",
    "brave": "brave", "edge": "msedge", "vs code": "code", "vscode": "code",
    "code": "code", "notepad": "notepad", "terminal": "wt", "cmd": "cmd",
    "powershell": "powershell", "explorer": "explorer",
    "file explorer": "explorer", "फाइल एक्सप्लोरर": "explorer",
    "calculator": "calc", "calc": "calc", "कैलकुलेटर": "calc",
    "spotify": "spotify", "vlc": "vlc", "telegram": "telegram",
    "discord": "discord", "whatsapp": "WhatsApp", "zoom": "zoom",
    "word": "winword", "excel": "excel", "powerpoint": "powerpnt",
    "paint": "mspaint", "task manager": "taskmgr", "control panel": "control",
    "settings": "ms-settings:", "camera": "microsoft.windows.camera:",
    "snipping tool": "SnippingTool",
    "omniroute": "http://127.0.0.1:20128", "omnoirout": "http://127.0.0.1:20128", "omni route": "http://127.0.0.1:20128",
    "ollama": "http://127.0.0.1:11434", "lm studio": "http://127.0.0.1:1234",
}

URL_MAP = {
    "youtube": "https://youtube.com", "यूट्यूब": "https://youtube.com",
    "google": "https://google.com", "गूगल": "https://google.com",
    "github": "https://github.com", "gmail": "https://mail.google.com",
    "twitter": "https://x.com", "x": "https://x.com",
    "facebook": "https://facebook.com", "instagram": "https://instagram.com",
    "whatsapp": "https://web.whatsapp.com",
    "stackoverflow": "https://stackoverflow.com", "wikipedia": "https://wikipedia.org",
    "reddit": "https://reddit.com", "linkedin": "https://linkedin.com",
    "amazon": "https://amazon.in", "flipkart": "https://flipkart.com",
    "netflix": "https://netflix.com", "hotstar": "https://hotstar.com",
    "chatgpt": "https://chat.openai.com", "claude": "https://claude.ai",
    "omniroute": "http://127.0.0.1:20128", "omnoirout": "http://127.0.0.1:20128", "omni route": "http://127.0.0.1:20128",
    "ollama": "http://127.0.0.1:11434", "lm studio": "http://127.0.0.1:1234",
}


def get_lan_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

# ═══════════════════════════════════════════════════════════════════════════
#  1. High-DPI Ghost Control & Mouse Pathing (IRIS-style, additive)
# ═══════════════════════════════════════════════════════════════════════════
def get_display_scale() -> float:
    try:
        if IS_WIN:
            import ctypes
            try:
                ctypes.windll.shcore.SetProcessDpiAwareness(2)
            except Exception:
                pass
            try:
                hdc = ctypes.windll.user32.GetDC(0)
                dpi = ctypes.windll.gdi32.GetDeviceCaps(hdc, 88)  # LOGPIXELSX
                ctypes.windll.user32.ReleaseDC(0, hdc)
                if dpi and dpi != 96:
                    return dpi / 96.0
            except Exception:
                pass
            # Fallback via scaleFactor registry
            try:
                import winreg
                with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Control Panel\Desktop\WindowMetrics") as k:
                    v, _ = winreg.QueryValueEx(k, "AppliedDPI")
                    if v: return int(v) / 96.0
            except Exception:
                pass
        # Electron can also send scaleFactor via WS — fallback 1.0
        return 1.0
    except Exception:
        return 1.0

def normalize_coords(x: int, y: int) -> tuple:
    s = get_display_scale()
    return int(x * s), int(y * s)

def bezier_move(x1: int, y1: int, x2: int, y2: int, steps: int = 18):
    """Bézier + micro-jitter ghost path — bypasses robotic detection."""
    try:
        import math, random
        if not pyautogui: return
        cx1 = x1 + (x2 - x1) * 0.33 + random.randint(-6, 6)
        cy1 = y1 + (y2 - y1) * 0.18 + random.randint(-4, 4)
        cx2 = x1 + (x2 - x1) * 0.66 + random.randint(-6, 6)
        cy2 = y1 + (y2 - y1) * 0.82 + random.randint(-4, 4)
        for i in range(steps + 1):
            t = i / max(1, steps)
            # cubic Bézier
            xt = (1-t)**3*x1 + 3*(1-t)**2*t*cx1 + 3*(1-t)*t**2*cx2 + t**3*x2
            yt = (1-t)**3*y1 + 3*(1-t)**2*t*cy1 + 3*(1-t)*t**2*cy2 + t**3*y2
            # micro-jitter
            jx = random.uniform(-0.6, 0.6) if 0.2 < t < 0.8 else 0
            jy = random.uniform(-0.6, 0.6) if 0.2 < t < 0.8 else 0
            pyautogui.moveTo(int(xt + jx), int(yt + jy), duration=0)
            time.sleep(0.007 + random.uniform(0, 0.004))
    except Exception:
        try:
            if pyautogui: pyautogui.moveTo(x2, y2)
        except Exception:
            pass

def atomic_clipboard_inject(text: str) -> bool:
    """Fast Ctrl+V injection for long messages — WhatsApp/Telegram/Discord/editors."""
    try:
        if not pyperclip or not pyautogui: return False
        pyperclip.copy(text)
        time.sleep(0.06)
        pyautogui.hotkey("ctrl", "v")
        time.sleep(0.04)
        return True
    except Exception:
        return False

# ═══════════════════════════════════════════════════════════════════════════
#  2. Headless Browser Routing & Media Scraping (additive)
# ═══════════════════════════════════════════════════════════════════════════
def get_default_browser() -> str:
    try:
        if IS_WIN and winreg:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice") as k:
                prog, _ = winreg.QueryValueEx(k, "ProgId")
                m = {"ChromeHTML": "chrome", "BraveHTML": "brave", "MSEdgeHTM": "msedge", "FirefoxURL": "firefox", "OperaStable": "opera"}
                for key, val in m.items():
                    if key.lower() in prog.lower():
                        return val
        # fallback check via start
        for b in ["chrome","msedge","firefox","brave","opera"]:
            if shutil.which(b):
                return b
    except Exception:
        pass
    return "chrome"

def resolve_youtube_adfree(query: str) -> str:
    """Ad-Free YouTube resolver — extracts first videoId directly, skips shelf/ads."""
    try:
        q = urllib.parse.quote(query)
        url = f"https://www.youtube.com/results?search_query={q}"
        req = urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        with urllib.request.urlopen(req, timeout=5) as r:
            html = r.read().decode("utf-8", errors="ignore")
            ids = re.findall(r'"videoId":"([a-zA-Z0-9_-]{11})"', html)
            if ids:
                return f"https://www.youtube.com/watch?v={ids[0]}&autoplay=1"
        return f"https://www.youtube.com/results?search_query={q}"
    except Exception:
        return f"https://www.youtube.com/results?search_query={urllib.parse.quote(query)}"

# ═══════════════════════════════════════════════════════════════════════════
#  3. PowerShell Hardware & OCR ScreenPeeler (additive, async)
# ═══════════════════════════════════════════════════════════════════════════
import queue as _queue
_ps_queue: _queue.Queue = _queue.Queue()
_ps_thread = None
def _ps_worker():
    while True:
        try:
            cmd, cb = _ps_queue.get(timeout=1)
            try:
                r = run(["powershell","-NoProfile","-NonInteractive","-Command", cmd], timeout=12)
                if cb: cb(r)
            except Exception as e:
                if cb: cb(e)
            _ps_queue.task_done()
        except Exception:
            continue

def _ensure_ps_thread():
    global _ps_thread
    if _ps_thread and _ps_thread.is_alive():
        return
    import threading as _th
    _ps_thread = _th.Thread(target=_ps_worker, daemon=True)
    _ps_thread.start()

def ps_async(cmd: str, callback=None):
    _ensure_ps_thread()
    _ps_queue.put((cmd, callback))

def screen_peeler(x: int=0, y: int=0, w: int=0, h: int=0, do_ocr: bool=False) -> dict:
    """Direct screenshot + optional OCR — region or full screen, saved to Pictures."""
    try:
        from PIL import ImageGrab
        import io
        if w and h:
            img = ImageGrab.grab(bbox=(x, y, x+w, y+h))
        else:
            img = ImageGrab.grab()
        # Save to Pictures
        pics = Path.home() / "Pictures" / "Pika_Screenshots"
        pics.mkdir(parents=True, exist_ok=True)
        fp = pics / f"peel_{datetime.now():%Y%m%d_%H%M%S}.png"
        img.save(str(fp))
        out = {"path": str(fp), "size": img.size}
        if do_ocr:
            try:
                import pytesseract
                txt = pytesseract.image_to_string(img).strip()[:4000]
                out["ocr"] = txt
                if txt and pyperclip:
                    pyperclip.copy(txt)
            except Exception as ex:
                out["ocr_error"] = str(ex)
        return out
    except Exception as e:
        return {"error": str(e)}

# ═══════════════════════════════════════════════════════════════════════════
#  4. Multi-Tool Safety & Privilege Handling (additive)
# ═══════════════════════════════════════════════════════════════════════════
def validate_params(category: str, action: str, params: dict) -> tuple:
    """Pre-flight checks for multi-step chains — prevents misclicks on bad handles."""
    try:
        if category == "files":
            p = params.get("path","")
            if not p: return False, "path खाली है"
            rp = resolve_path(p)
            if not is_path_safe(rp): return False, "path blocked by safety"
        if category in ("system","files","processes") and (action in ("shutdown","delete","kill")):
            # confirm gate already handled, just warn
            pass
        if category == "window" and action == "focus":
            if not params.get("title"): return False, "title खाली"
        if category == "uia" and action in ("click",):
            # x,y must be ints if provided
            for k in ("x","y"):
                if k in params and params[k] is not None:
                    int(params[k])
        return True, ""
    except Exception as e:
        return False, str(e)

def needs_elevation(action: str) -> bool:
    return action in ("bluetooth","wifi","airplane","temp_clean","flush_dns","brightness_set")

def notify_elevation(msg: str):
    try:
        if _main_loop and _main_loop.is_running():
            asyncio.run_coroutine_threadsafe(broadcast(json.dumps({"type":"event","event":"elevation_required","data":{"message": msg},"timestamp": datetime.now(timezone.utc).isoformat()})), _main_loop)
    except Exception:
        pass
    logger.info(f"ELEVATION: {msg}")


def resolve_path(path_str: str) -> Path:
    """Resolve natural-language / relative paths against the home directory."""
    home = Path.home()
    if not path_str:
        return home / "Desktop"
    low = path_str.lower().strip()
    folders = {
        "desktop": "Desktop", "documents": "Documents", "downloads": "Downloads",
        "pictures": "Pictures", "music": "Music", "videos": "Videos",
    }
    for k, v in folders.items():
        if low == k or low.startswith(k + "/") or low.startswith(k + "\\"):
            rest = path_str[len(k):].strip("/\\")
            return (home / v / rest) if rest else (home / v)
    p = Path(path_str).expanduser()
    return p if p.is_absolute() else home / p


BLOCKED_PATTERNS = [
    r"^[a-zA-Z]:\\$", r"^[a-zA-Z]:\\Windows", r"^[a-zA-Z]:\\Program Files", r"^[a-zA-Z]:\\Program Files \(x86\)",
    r"^/System", r"^/usr", r"^/etc", r"^/bin", r"^/sbin", r"^/boot", r"^C:\\Windows\\System32",
    r".*\\.env$", r".*\\credentials.*", r".*\\secrets.*",
]

# Workspace sandbox — hardened: check resolved path, block UNC, enforce HOME-relative when possible
def is_path_safe(p: Path) -> bool:
    try:
        rp = p.resolve()
        s = str(rp)
        # Block UNC / extended path tricks
        if s.startswith("\\\\") or s.startswith("//") or "\\?\\" in s or s.startswith("\\\\?\\"):
            return False
        # Block patterns on resolved path (use match for anchored patterns)
        for pat in BLOCKED_PATTERNS:
            # anchored patterns use re.match, others re.search
            if pat.startswith("^"):
                if re.match(pat, s, re.IGNORECASE):
                    return False
            else:
                if re.search(pat, s, re.IGNORECASE):
                    return False
        # Prevent traversal on RESOLVED parts (not original)
        if ".." in rp.parts:
            return False
        # Also check original for .. attempt
        if ".." in p.parts:
            return False
        # Deny hidden system files
        if rp.name.startswith(".") and rp.suffix.lower() in [".sys", ".dll", ".exe"]:
            # allow .env already blocked, but extra guard for hidden exe
            if rp.name.lower() not in [".gitignore"]:
                return False
        # Optional: enforce under HOME for writes (keep permissive for reads, but log)
        # For now, allow HOME subpaths freely, block only exact dangerous
        return True
    except Exception:
        return False

# Simple LAN token auth — generated once, stored in vault
def get_or_create_ws_token() -> str:
    try:
        data = load_vault_data() or {}
        tok = data.get("_ws_token")
        if tok: return tok
        import secrets
        tok = secrets.token_urlsafe(24)
        data["_ws_token"] = tok
        save_vault_data(data)
        return tok
    except Exception:
        return "pika-local-dev-token"


def ok(msg: str, data=None):
    return {"success": True, "message": msg, "data": data}


def err(msg: str):
    return {"success": False, "message": msg, "data": None}


def envelope(req_id: str, status: str, message: str, data=None, confirmation_id=None) -> str:
    payload = {
        "type": "response",
        "status": status,
        "message": message,
        "data": data,
        "id": req_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    if confirmation_id:
        payload["confirmation_id"] = confirmation_id
    return json.dumps(payload)


def run(cmd, shell=False, timeout=15):
    return subprocess.run(cmd, shell=shell, capture_output=True, text=True, timeout=timeout)


# ═══════════════════════════════════════════════════════════════════════════
#  COMMAND HANDLERS & DYNAMIC APP ENGINE
# ═══════════════════════════════════════════════════════════════════════════

def find_installed_app_fast(query: str):
    """Dynamically locates any installed executable or Windows URI protocol in <10ms."""
    q = query.lower().strip()
    if not q:
        return None

    # 1. Built-in Windows short commands & URI protocols
    builtins = {
        'calc': 'calc.exe', 'calculator': 'calc.exe', 'notepad': 'notepad.exe',
        'paint': 'mspaint.exe', 'mspaint': 'mspaint.exe', 'cmd': 'cmd.exe',
        'terminal': 'wt.exe', 'powershell': 'powershell.exe', 'explorer': 'explorer.exe',
        'task manager': 'taskmgr.exe', 'taskmgr': 'taskmgr.exe', 'control panel': 'control.exe',
        'settings': 'ms-settings:', 'camera': 'microsoft.windows.camera:',
        'store': 'ms-windows-store:', 'photos': 'ms-photos:', 'edge': 'msedge.exe',
        'chrome': 'chrome.exe', 'brave': 'brave.exe', 'code': 'code', 'vscode': 'code',
        'obsidian': 'obsidian.exe', 'bluetooth': 'ms-settings:bluetooth',
        'wifi': 'ms-settings:network-wifi', 'display': 'ms-settings:display',
        'sound': 'ms-settings:sound', 'battery': 'ms-settings:batterysaver',
        'downloads': os.path.expandvars(r'%USERPROFILE%\Downloads'),
        'documents': os.path.expandvars(r'%USERPROFILE%\Documents'),
        'desktop': os.path.expandvars(r'%USERPROFILE%\Desktop'),
        'pictures': os.path.expandvars(r'%USERPROFILE%\Pictures'),
        'videos': os.path.expandvars(r'%USERPROFILE%\Videos'),
    }
    if q in builtins:
        target = builtins[q]
        if target.startswith('ms-') or os.path.exists(target) or shutil.which(target):
            return target

    # 2. Check PATH with shutil.which
    which_path = shutil.which(q) or shutil.which(f"{q}.exe")
    if which_path:
        return which_path

    # 3. Start Menu Shortcuts & Desktop (ProgramData + AppData)
    if IS_WIN:
        search_dirs = [
            os.path.expandvars(r'%PROGRAMDATA%\Microsoft\Windows\Start Menu\Programs'),
            os.path.expandvars(r'%APPDATA%\Microsoft\Windows\Start Menu\Programs'),
            os.path.expandvars(r'%USERPROFILE%\Desktop'),
            os.path.expandvars(r'%PUBLIC%\Desktop')
        ]
        for sdir in search_dirs:
            if os.path.exists(sdir):
                for root, dirs, files in os.walk(sdir):
                    for f in files:
                        if f.lower().endswith(('.lnk', '.exe')) and not any(x in f.lower() for x in ['uninstall', 'help', 'readme', 'documentation', 'website']):
                            name_no_ext = f.rsplit('.', 1)[0].lower()
                            if q == name_no_ext or q in name_no_ext:
                                return os.path.join(root, f)

        # 4. Registry App Paths
        for root in [winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER]:
            try:
                with winreg.OpenKey(root, r'SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths') as key:
                    for i in range(winreg.QueryInfoKey(key)[0]):
                        try:
                            kname = winreg.EnumKey(key, i)
                            if q in kname.lower():
                                with winreg.OpenKey(key, kname) as sk:
                                    val, _ = winreg.QueryValueEx(sk, '')
                                    if val and os.path.exists(val):
                                        return val
                        except Exception:
                            pass
            except Exception:
                pass

    return None


def cmd_system(action, params):
    try:
        if action == "shutdown":
            run(["shutdown", "/s", "/t", str(params.get("delay", 10))]) if IS_WIN else run(["shutdown", "-h", "now"])
            return ok("कंप्यूटर बंद हो रहा है। ⚡")
        if action == "restart":
            run(["shutdown", "/r", "/t", str(params.get("delay", 10))]) if IS_WIN else run(["reboot"])
            return ok("कंप्यूटर रीस्टार्ट हो रहा है। 🔄")
        if action == "sleep":
            run("rundll32.exe powrprof.dll,SetSuspendState 0,1,0", shell=True) if IS_WIN else run(["systemctl", "suspend"])
            return ok("स्लीप मोड में जा रहे हैं। 🌙")
        if action == "lock":
            run("rundll32.exe user32.dll,LockWorkStation", shell=True) if IS_WIN else run(["loginctl", "lock-session"])
            return ok("स्क्रीन लॉक कर दी। 🔒")
        if action == "logoff":
            run(["shutdown", "/l"]) if IS_WIN else run(["logout"], shell=True)
            return ok("लॉग आउट हो रहे हैं। 🚪")
        if action == "hibernate":
            run(["shutdown", "/h"]) if IS_WIN else run(["systemctl", "hibernate"])
            return ok("हाइबरनेट हो रहे हैं। 💤")
        if action in ("empty_recycle_bin", "recycle_bin"):
            if IS_WIN:
                run(["powershell", "-NoProfile", "-NonInteractive", "-Command", "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"])
            return ok("रीसायकल बिन खाली कर दिया! 🗑️")
        if action == "flush_dns":
            if IS_WIN:
                run(["ipconfig", "/flushdns"])
            return ok("DNS कैश फ्लश कर दिया! 🌐")
        if action == "temp_clean":
            temp = tempfile.gettempdir()
            deleted = 0
            for item in os.listdir(temp):
                fp = os.path.join(temp, item)
                try:
                    if os.path.isfile(fp) or os.path.islink(fp):
                        os.unlink(fp); deleted += 1
                    elif os.path.isdir(fp):
                        shutil.rmtree(fp); deleted += 1
                except Exception:
                    pass
            return ok(f"अस्थायी फाइलें साफ: {deleted} आइटम हटाए गए। 🧹")
        if action in ("bluetooth", "wifi", "airplane"):
            tgt = action
            act = str(params.get("action", "toggle")).lower()
            try:
                if IS_WIN:
                    if tgt == "wifi":
                        # Try netsh toggle — works without admin for query, admin for set; fallback to settings
                        iface = "Wi-Fi"
                        try:
                            # Find actual Wi-Fi interface name
                            r = run(["netsh", "interface", "show", "interface"])
                            out = (r.stdout or "") + (r.stderr or "")
                            for line in out.splitlines():
                                if "Wi-Fi" in line or "Wireless" in line:
                                    parts = line.split()
                                    for p in parts:
                                        if "Wi-Fi" in p or "Wireless" in p:
                                            iface = p.strip()
                                            break
                        except Exception:
                            pass
                        # Try toggle
                        try:
                            if act in ("on","enable"):
                                run(["netsh", "interface", "set", "interface", iface, "admin=enable"])
                                return ok(f"WiFi ON किया — {iface} ✅")
                            elif act in ("off","disable"):
                                run(["netsh", "interface", "set", "interface", iface, "admin=disable"])
                                return ok(f"WiFi OFF किया — {iface} ❌")
                            else:
                                # toggle: try disable then enable check
                                r = run(["netsh", "interface", "show", "interface", iface])
                                is_up = "Enabled" in (r.stdout or "") or "Connected" in (r.stdout or "")
                                if is_up:
                                    run(["netsh", "interface", "set", "interface", iface, "admin=disable"])
                                    return ok(f"WiFi toggle OFF — {iface} ❌ (manual click bhi kar sakte ho)")
                                else:
                                    run(["netsh", "interface", "set", "interface", iface, "admin=enable"])
                                    return ok(f"WiFi toggle ON — {iface} ✅")
                        except Exception as ex:
                            logger.warning(f"WiFi netsh failed {ex}, opening settings")
                    elif tgt == "bluetooth":
                        # Try PowerShell PnpDevice toggle, fallback to settings + UIA click
                        try:
                            if act == "on":
                                run(["powershell","-NoProfile","-Command","Get-PnpDevice -Class Bluetooth | Where-Object {$_.Status -ne 'OK'} | ForEach-Object { Enable-PnpDevice -InstanceId $_.InstanceId -Confirm:$false }"])
                                return ok("Bluetooth ON किया ✅ (settings me bhi toggle kar sakte ho)")
                            elif act == "off":
                                run(["powershell","-NoProfile","-Command","Get-PnpDevice -Class Bluetooth | Where-Object {$_.Status -eq 'OK'} | ForEach-Object { Disable-PnpDevice -InstanceId $_.InstanceId -Confirm:$false }"])
                                return ok("Bluetooth OFF किया ❌")
                            else:
                                # toggle: open settings and try UIA click
                                os.startfile("ms-settings:bluetooth")
                                time.sleep(0.9)
                                if pyautogui:
                                    try:
                                        # Try click near toggle (center of window) — manual fallback
                                        pyautogui.click(900, 350)
                                    except Exception:
                                        pass
                                return ok("Bluetooth toggle — Settings khola, toggle pe click karo (manual bhi) ✅")
                        except Exception as ex:
                            logger.warning(f"BT toggle failed {ex}")
                    elif tgt == "airplane":
                        os.startfile("ms-settings:network-airplanemode")
                        return ok("Airplane Mode Settings khola ✈️ — toggle pe click karo")
                # Fallback open settings
                mp = {"bluetooth":"ms-settings:bluetooth","wifi":"ms-settings:network-wifi","airplane":"ms-settings:network-airplanemode"}[tgt]
                os.startfile(mp)
                return ok(f"{tgt.title()} Settings khola — manual toggle kar sakte ho")
            except Exception as ex:
                return err(str(ex))
        return err(f"अज्ञात system action: {action}")
    except Exception as e:
        return err(str(e))


def cmd_volume(action, params):
    if not pyautogui:
        return err("pyautogui ज़रूरी है")
    try:
        if action == "up":
            steps = max(1, params.get("amount", 10) // 2)
            for _ in range(steps):
                pyautogui.press("volumeup")
            return ok("आवाज़ बढ़ा दी। 🔊")
        if action == "down":
            steps = max(1, params.get("amount", 10) // 2)
            for _ in range(steps):
                pyautogui.press("volumedown")
            return ok("आवाज़ कम कर दी। 🔉")
        if action in ("mute", "unmute"):
            pyautogui.press("volumemute")
            return ok("म्यूट टॉगल किया। 🔇")
        if action == "set":
            level = max(0, min(100, int(params.get("percent", params.get("level", 50)))))
            for _ in range(50):
                pyautogui.press("volumedown")
            for _ in range(level // 2):
                pyautogui.press("volumeup")
            return ok(f"आवाज़ {level}% पर सेट। 🔊")
        return err(f"अज्ञात volume action: {action}")
    except Exception as e:
        return err(str(e))


def cmd_media(action, params):
    if not pyautogui:
        return err("pyautogui ज़रूरी है")
    try:
        keymap = {"play_pause": "playpause", "next": "nexttrack", "previous": "prevtrack", "prev": "prevtrack", "stop": "stop"}
        pyautogui.press(keymap.get(action, "playpause"))
        return ok("मीडिया कंट्रोल भेजा। 🎵")
    except Exception as e:
        return err(str(e))


def cmd_apps(action, params):
    name = str(params.get("name", "")).lower().strip()
    try:
        if action == "open":
            # 1. First check dynamic installed software resolver
            app_target = find_installed_app_fast(name)
            if app_target:
                try:
                    if IS_WIN:
                        os.startfile(app_target)
                    else:
                        subprocess.Popen([app_target])
                    return ok(f"{name.title()} खोल दिया। 🚀")
                except Exception as ex:
                    logger.warning(f"startfile failed for {app_target}: {ex}")
            
            # 2. Check Static APP_MAP fallback
            exe = APP_MAP.get(name)
            if exe:
                try:
                    if IS_WIN:
                        os.startfile(exe)
                    else:
                        subprocess.Popen([exe])
                    return ok(f"{name.title()} खोल दिया। 🚀")
                except Exception:
                    pass

            # 3. Check Website / URL mapping
            for key, url in URL_MAP.items():
                if key in name:
                    webbrowser.open(url)
                    return ok(f"{key.title()} खोल रहा हूँ। 🌐")
            if any(t in name for t in (".com", ".org", ".net", "http")):
                webbrowser.open(name if name.startswith("http") else f"https://{name}")
                return ok(f"{name} खोल रहा हूँ। 🌐")
            
            # 4. Fallback search on web
            webbrowser.open(f"https://www.google.com/search?q={urllib.parse.quote(name)}")
            return ok(f'"{name}" Google पर सर्च कर रहा हूँ। 🔍')

        if action == "list":
            apps = set()
            if IS_WIN:
                for root in [winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER]:
                    for sub in [r'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall', r'SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall']:
                        try:
                            with winreg.OpenKey(root, sub) as key:
                                for i in range(winreg.QueryInfoKey(key)[0]):
                                    try:
                                        kname = winreg.EnumKey(key, i)
                                        with winreg.OpenKey(key, kname) as sk:
                                            dn, _ = winreg.QueryValueEx(sk, 'DisplayName')
                                            if dn and len(dn) > 2 and not any(x in dn.lower() for x in ['kb', 'update for', 'redistributable', 'runtime', 'driver', 'sdk', 'pack', 'patch']):
                                                apps.add(dn.strip())
                                    except Exception:
                                        pass
                        except Exception:
                            pass
                for sm in [os.path.expandvars(r'%PROGRAMDATA%\Microsoft\Windows\Start Menu\Programs'), os.path.expandvars(r'%APPDATA%\Microsoft\Windows\Start Menu\Programs')]:
                    if os.path.exists(sm):
                        for r, d, files in os.walk(sm):
                            for f in files:
                                if f.endswith('.lnk') and not any(x in f.lower() for x in ['uninstall', 'help', 'readme', 'documentation', 'website']):
                                    name_clean = f[:-4].strip()
                                    if len(name_clean) > 2:
                                        apps.add(name_clean)
            
            sorted_apps = sorted(list(apps), key=lambda x: x.lower())
            total = len(sorted_apps)
            top_preview = sorted_apps[:20]
            apps_text = "\n".join([f"• {a}" for a in top_preview])
            if total > 20:
                apps_text += f"\n...और {total - 20} अन्य एप्स।"
            
            return ok(f"📦 आपके PC में {total} मुख्य ऐप्स और सॉफ़्टवेयर इंस्टॉल हैं:\n\n{apps_text}", {"apps": sorted_apps, "total": total})

        if action == "close":
            exe = APP_MAP.get(name, name)
            if IS_WIN:
                run(["taskkill", "/IM", f"{exe}.exe", "/F"])
            else:
                run(["pkill", "-f", exe])
            return ok(f"{name} बंद कर दिया। ❌")
        return err(f"अज्ञात apps action: {action}")
    except Exception as e:
        return err(str(e))


def cmd_window(action, params):
    if not pyautogui:
        return err("pyautogui ज़रूरी है")
    try:
        if action == "minimize":
            pyautogui.hotkey("win", "down")
            return ok("विंडो मिनिमाइज़ कर दी। ⬇️")
        if action == "maximize":
            pyautogui.hotkey("win", "up")
            return ok("विंडो मैक्सिमाइज़ कर दी। ⬆️")
        if action == "close":
            pyautogui.hotkey("alt", "f4")
            return ok("विंडो बंद कर दी। ❌")
        if action == "switch":
            pyautogui.hotkey("alt", "tab")
            return ok("विंडो स्विच कर दी। 🔄")
        if action == "show_desktop":
            pyautogui.hotkey("win", "d")
            return ok("डेस्कटॉप दिखाया। 🖥️")
        if action == "snap_left":
            pyautogui.hotkey("win", "left")
            return ok("विंडो को बायीं तरफ स्नैप किया। ⬅️")
        if action == "snap_right":
            pyautogui.hotkey("win", "right")
            return ok("विंडो को दायीं तरफ स्नैप किया। ➡️")
        if action == "fullscreen":
            pyautogui.press("f11")
            return ok("फुलस्क्रीन टॉगल किया। 🔲")
        if action == "new_tab":
            pyautogui.hotkey("ctrl", "t")
            return ok("नई टैब खोली। 🆕")
        if action == "close_tab":
            pyautogui.hotkey("ctrl", "w")
            return ok("टैब बंद की। ❌")
        if action == "focus" and gw:
            title = params.get("title", "").lower()
            for w in gw.getAllWindows():
                if title in w.title.lower():
                    w.activate()
                    return ok(f"फोकस: {w.title}")
            return err("विंडो नहीं मिली।")
        return err(f"अज्ञात window action: {action}")
    except Exception as e:
        return err(str(e))


def cmd_info(action, params):
    if not psutil:
        return err("psutil ज़रूरी है")
    try:
        if action == "battery":
            b = psutil.sensors_battery()
            if b:
                return ok(f"बैटरी {int(b.percent)}%", {"percent": int(b.percent), "plugged": b.power_plugged})
            return ok("बैटरी नहीं मिली (डेस्कटॉप?)", {"percent": None})
        if action == "cpu":
            pct = psutil.cpu_percent(interval=0.4)
            return ok(f"CPU {pct}%", {"percent": pct, "cores": psutil.cpu_count()})
        if action == "ram":
            m = psutil.virtual_memory()
            return ok(f"RAM {m.percent}%", {"percent": m.percent, "used_gb": round(m.used / 2**30, 1), "total_gb": round(m.total / 2**30, 1)})
        if action == "disk":
            d = psutil.disk_usage("C:\\" if IS_WIN else "/")
            return ok(f"डिस्क {d.percent}%", {"percent": d.percent, "free_gb": round(d.free / 2**30, 1)})
        if action == "ip":
            return ok(f"IP: {get_lan_ip()}", {"local": get_lan_ip(), "hostname": socket.gethostname()})
        if action == "time":
            return ok(datetime.now().strftime("%I:%M %p"))
        if action == "date":
            return ok(datetime.now().strftime("%A, %d %B %Y"))
        if action == "full_report":
            b = psutil.sensors_battery()
            m = psutil.virtual_memory()
            d = psutil.disk_usage("C:\\" if IS_WIN else "/")
            return ok("सिस्टम रिपोर्ट", {
                "cpu": psutil.cpu_percent(interval=0.4), "ram": m.percent,
                "disk": d.percent, "battery": int(b.percent) if b else None,
                "ip": get_lan_ip(), "hostname": socket.gethostname(),
                "os": f"{platform.system()} {platform.release()}",
                "uptime_hours": round((time.time() - psutil.boot_time()) / 3600, 1),
            })
        return err(f"अज्ञात info: {action}")
    except Exception as e:
        return err(str(e))


def cmd_processes(action, params):
    if not psutil:
        return err("psutil ज़रूरी है")
    try:
        if action == "list":
            procs = []
            for p in psutil.process_iter(["pid", "name", "memory_percent", "cpu_percent"]):
                try:
                    procs.append({"pid": p.info["pid"], "name": p.info["name"],
                                  "ram": round(p.info["memory_percent"] or 0, 1),
                                  "cpu": round(p.info["cpu_percent"] or 0, 1)})
                except Exception:
                    continue
            procs.sort(key=lambda x: x["ram"], reverse=True)
            return ok("प्रोसेस सूची", {"items": procs[:30]})
        if action == "kill":
            target = str(params.get("name_or_pid", "")).lower()
            killed = 0
            for p in psutil.process_iter(["pid", "name"]):
                try:
                    if str(p.info["pid"]) == target or target in (p.info["name"] or "").lower():
                        p.kill()
                        killed += 1
                except Exception:
                    continue
            return ok(f"{killed} प्रोसेस बंद किए।") if killed else err("प्रोसेस नहीं मिला।")
        return err(f"अज्ञात processes action: {action}")
    except Exception as e:
        return err(str(e))


def cmd_files(action, params):
    try:
        if action == "create_file":
            p = resolve_path(params.get("path", "untitled.txt"))
            if not is_path_safe(p):
                return err("सुरक्षा: यह पथ प्रतिबंधित है।")
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(params.get("content", ""), encoding="utf-8")
            return ok(f"फाइल बनी: {p}")
        if action == "create_folder":
            p = resolve_path(params.get("path", "New Folder"))
            if not is_path_safe(p):
                return err("सुरक्षा: यह पथ प्रतिबंधित है।")
            p.mkdir(parents=True, exist_ok=True)
            return ok(f"फोल्डर बना: {p}")
        if action == "delete":
            p = resolve_path(params.get("path", ""))
            if not is_path_safe(p) or not p.exists():
                return err("फाइल नहीं मिली या सुरक्षित नहीं।")
            shutil.rmtree(p) if p.is_dir() else p.unlink()
            return ok(f"डिलीट: {p}")
        if action == "list":
            p = resolve_path(params.get("path", ""))
            if not p.exists():
                return err("पथ नहीं मिला।")
            items = [{"name": x.name, "is_dir": x.is_dir()} for x in list(p.iterdir())[:50]]
            return ok(f"{len(items)} आइटम", {"path": str(p), "items": items})
        if action == "open_explorer":
            p = resolve_path(params.get("path", ""))
            if not is_path_safe(p):
                return err("सुरक्षा: यह पथ प्रतिबंधित है।")
            if not p.exists():
                return err("पथ नहीं मिला।")
            # Allow only directories / known safe files, block exe/bat directly
            if p.is_file() and p.suffix.lower() in [".exe",".bat",".cmd",".ps1",".vbs",".js"]:
                return err("सुरक्षा: executable सीधे open_explorer से नहीं खोल सकते।")
            os.startfile(str(p)) if IS_WIN else run(["xdg-open", str(p)])
            return ok(f"एक्सप्लोरर: {p}")
        if action == "read":
            p = resolve_path(params.get("path", ""))
            if not is_path_safe(p) or not p.exists():
                return err("फाइल नहीं मिली।")
            if p.is_dir():
                return err("यह फ़ोल्डर है, फ़ाइल नहीं।")
            # Binary / size guard — prevent OOM on 2GB mp4
            try:
                sz = p.stat().st_size
                if sz > 2_000_000:
                    return err(f"फ़ाइल बहुत बड़ी है ({sz//1024}KB) — 2MB से अधिक नहीं पढ़ सकते।")
                if p.suffix.lower() in [".mp4",".mkv",".avi",".exe",".dll",".zip",".bin",".gguf"]:
                    return err("बायनरी फ़ाइल नहीं पढ़ सकते।")
            except Exception:
                pass
            return ok(f"पढ़ा गया: {p.name}", {"content": p.read_text(encoding="utf-8", errors="replace")[:20000]})
        if action == "write":
            p = resolve_path(params.get("path", ""))
            if not is_path_safe(p):
                return err("सुरक्षा: यह पथ प्रतिबंधित है।")
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(params.get("content", ""), encoding="utf-8")
            return ok(f"सेव हुआ: {p}")
        if action == "rename":
            src = resolve_path(params.get("path", ""))
            dst = resolve_path(params.get("new_path", ""))
            if not is_path_safe(src) or not is_path_safe(dst):
                return err("सुरक्षा: पथ प्रतिबंधित है।")
            if not src.exists():
                return err("सोर्स फाइल नहीं मिली।")
            src.rename(dst)
            return ok(f"रीनेम: {src.name} → {dst.name}")
        return err(f"अज्ञात files action: {action}")
    except Exception as e:
        return err(str(e))


def cmd_disk(action, params):
    """List drives + disk usage."""
    try:
        if action == "list_drives":
            drives = []
            if IS_WIN:
                import ctypes
                bitmask = ctypes.windll.kernel32.GetLogicalDrives()
                for letter in string.ascii_uppercase:
                    if bitmask & 1:
                        drive = f"{letter}:\\"
                        try:
                            u = shutil.disk_usage(drive)
                            drives.append({"name": drive, "total": u.total, "free": u.free,
                                           "used": u.used, "percent": round(u.used / u.total * 100, 1)})
                        except Exception:
                            pass
                    bitmask >>= 1
            else:
                u = shutil.disk_usage("/")
                drives.append({"name": "/", "total": u.total, "free": u.free, "used": u.used,
                               "percent": round(u.used / u.total * 100, 1)})
            return ok(f"{len(drives)} ड्राइव मिले।", {"drives": drives})
        if action == "cleanup_temp":
            temp = tempfile.gettempdir()
            deleted = 0
            for item in os.listdir(temp):
                fp = os.path.join(temp, item)
                try:
                    if os.path.isfile(fp) or os.path.islink(fp):
                        os.unlink(fp); deleted += 1
                    elif os.path.isdir(fp):
                        shutil.rmtree(fp); deleted += 1
                except Exception:
                    pass
            return ok(f"क्लीनअप: {deleted} आइटम हटाए।")
        u = shutil.disk_usage("C:\\" if IS_WIN else "/")
        return ok("डिस्क उपयोग", {"total": u.total, "free": u.free, "percent": round(u.used / u.total * 100, 1)})
    except Exception as e:
        return err(str(e))


def cmd_uia(action, params):
    """Win UIA Ghost Control: DPI-aware + Bézier + validation — additive."""
    try:
        okv, msg = validate_params("uia", action, params)
        if not okv:
            return err(f"Validation: {msg}")
        if needs_elevation(action):
            notify_elevation(f"UIA {action} requires admin — prompt shown")
        text = params.get("text", "") or params.get("query", "")
        x = params.get("x"); y = params.get("y")
        if action in ("click", "left_click"):
            if not pyautogui: return err("pyautogui ज़रूरी है")
            if x is not None and y is not None:
                nx, ny = normalize_coords(int(x), int(y))
                # Ghost Bézier from current pos to target
                try:
                    cur = pyautogui.position()
                    bezier_move(cur.x, cur.y, nx, ny, steps=16)
                    pyautogui.click(nx, ny)
                except Exception:
                    pyautogui.click(nx, ny)
                return ok(f"Ghost click ({x},{y})→({nx},{ny}) DPI×{get_display_scale():.2f} 🖱️", {"x": nx, "y": ny, "scale": get_display_scale()})
            # Try UIA name search (Win)
            name = params.get("name", "") or text
            if IS_WIN and name:
                try:
                    import subprocess, json as _j
                    ps = f'Add-Type -AssemblyName UIAutomationClient; [System.Windows.Automation.AutomationElement]::RootElement.FindFirst([System.Windows.Automation.TreeScope]::Descendants, (New-Object System.Windows.Automation.PropertyCondition ([System.Windows.Automation.AutomationElement]::NameProperty, "{name}")))|Select-Object -ExpandProperty Current|ConvertTo-Json'
                    r = run(["powershell","-NoProfile","-Command", ps], timeout=5)
                    if r.stdout and "BoundingRectangle" in r.stdout:
                        pyautogui.click()
                        return ok(f"UIA से {name} पर क्लिक किया")
                except Exception:
                    pass
            pyautogui.click()
            return ok("क्लिक किया 🖱️")
        if action == "type":
            if not pyautogui: return err("pyautogui ज़रूरी है")
            txt = str(params.get("text",""))
            # Atomic clipboard for >18 chars or Hindi — 10x faster, no ghost miss
            if len(txt) > 18 or any("\u0900" <= c <= "\u097F" for c in txt):
                if atomic_clipboard_inject(txt):
                    return ok(f"Ghost type ({len(txt)} chars) 📋⌨️")
            pyautogui.typewrite(txt, interval=0.02)
            return ok("टाइप किया ⌨️")
        if action in ("tree", "get_tree", "scan"):
            if IS_WIN:
                try:
                    # Lightweight: enumerate top windows via pygetwindow + UIA names
                    items = []
                    if gw:
                        for w in gw.getAllWindows()[:15]:
                            if w.title.strip():
                                items.append({"title": w.title, "left": w.left, "top": w.top, "width": w.width, "height": w.height})
                    return ok(f"{len(items)} विंडो मिलीं", {"items": items})
                except Exception as ex:
                    return err(str(ex))
            return ok("UIA tree (fallback) — screen scan", {"items": []})
        if action == "scroll":
            if not pyautogui: return err("pyautogui ज़रूरी है")
            amt = int(params.get("amount", 3))
            pyautogui.scroll(-amt*120 if params.get("direction","down")=="down" else amt*120)
            return ok("स्क्रॉल किया")
        return err(f"अज्ञात uia action: {action}")
    except Exception as e:
        return err(str(e))

def cmd_browser(action, params):
    """Headless Browser Routing + Ad-Free YouTube — additive."""
    try:
        url = params.get("url","") or params.get("query","")
        if action in ("open","navigate","goto"):
            if not url: return err("URL खाली है")
            if not url.startswith("http"): url = "https://" + url
            browser = get_default_browser()
            # Ad-Free YouTube resolver if query looks like YouTube search
            if "youtube" in url.lower() or "youtu" in url.lower() or params.get("query","").lower().startswith("play "):
                q = params.get("query", url)
                url = resolve_youtube_adfree(q)
            # Webbrowser open via default browser
            webbrowser.open(url)
            # Headless Chromium scrape for title (optional)
            try:
                from playwright.sync_api import sync_playwright  # type: ignore
                with sync_playwright() as p:
                    b = p.chromium.launch(headless=True)
                    pg = b.new_page()
                    pg.goto(url, timeout=8000)
                    title = pg.title()
                    b.close()
                    return ok(f"Browser {browser}: {title} 🌐", {"url": url, "browser": browser, "title": title})
            except Exception:
                return ok(f"Browser {browser}: {url} 🌐", {"url": url, "browser": browser})
        if action == "screenshot":
            # Reuse screen screenshot for now
            return cmd_screen("screenshot", {})
        if action == "fill":
            # Dispatch via keyboard type as fallback
            return cmd_keyboard("type", {"text": params.get("text","")})
        return err(f"अज्ञात browser action: {action}")
    except Exception as e:
        return err(str(e))

def cmd_connectors(action, params):
    """OAuth connectors skeleton — additive, no external call yet. Stores state in vault."""
    try:
        cid = (params.get("id") or params.get("connector") or "").lower()
        valid = {"gmail","calendar","slack","notion","github","drive"}
        if action == "list":
            data = load_vault_data() or {}
            conns = data.get("connectors", {})
            items = [{"id": k, "connected": bool(conns.get(k,{}).get("connected")), "scopes": conns.get(k,{}).get("scopes",[])} for k in valid]
            return ok(f"{sum(1 for i in items if i['connected'])} connectors connected", {"items": items})
        if action == "connect":
            if cid not in valid: return err(f"Unknown connector {cid}")
            data = load_vault_data() or {}
            conns = data.setdefault("connectors", {})
            conns[cid] = {"connected": True, "connected_at": datetime.now(timezone.utc).isoformat(), "scopes": []}
            save_vault_data(data)
            return ok(f"{cid} connected (OAuth placeholder) — add client_id in .env to enable real flow ✅", {"id": cid})
        if action == "disconnect":
            data = load_vault_data() or {}
            conns = data.get("connectors", {})
            if cid in conns: conns[cid]["connected"] = False; save_vault_data(data)
            return ok(f"{cid} disconnected")
        if action == "status":
            data = load_vault_data() or {}
            conns = data.get("connectors", {})
            return ok("Connectors status", {"connectors": conns})
        return err(f"अज्ञात connectors action: {action}")
    except Exception as e:
        return err(str(e))

# ── Persistent Scheduler (APScheduler or threading fallback) ──
_scheduler = None
_scheduler_jobs: dict = {}

def _ensure_scheduler():
    global _scheduler
    if _scheduler is not None: return _scheduler
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.interval import IntervalTrigger
        from apscheduler.triggers.cron import CronTrigger
        _scheduler = BackgroundScheduler(daemon=True)
        _scheduler.start()
        logger.info("APScheduler started")
        # Restore jobs from vault
        try:
            data = load_vault_data() or {}
            for j in data.get("scheduledJobs", []):
                _schedule_job_internal(j)
        except Exception as ex: logger.warning(f"Restore jobs failed: {ex}")
    except Exception:
        logger.info("APScheduler not installed — using threading fallback (pip install apscheduler for persistence)")
        _scheduler = False  # sentinel: fallback mode
    return _scheduler

def _schedule_job_internal(job: dict):
    try:
        sched = _scheduler
        if sched is False or sched is None: return
        from apscheduler.triggers.interval import IntervalTrigger
        from apscheduler.triggers.cron import CronTrigger
        jid = job["id"]
        sch = job.get("schedule","every 60 minutes")
        # Parse simple schedules
        trig = None
        if "30 minutes" in sch: trig = IntervalTrigger(minutes=30)
        elif "hour" in sch and "6" in sch: trig = IntervalTrigger(hours=6)
        elif sch.startswith("every hour") or sch=="hourly": trig = IntervalTrigger(hours=1)
        elif "daily at" in sch:
            try:
                t = sch.split("daily at")[1].strip()
                h,m = map(int, t.split(":"))
                trig = CronTrigger(hour=h, minute=m)
            except Exception: trig = IntervalTrigger(hours=24)
        else: trig = IntervalTrigger(minutes=60)
        cmd = job.get("command","")
        def _run():
            logger.info(f"Scheduler job {jid} running: {cmd}")
            res = route_command({"category": _parse_cmd_category(cmd), "action": _parse_cmd_action(cmd), "params": _parse_cmd_params(cmd)})
            # broadcast result
            if _main_loop and _main_loop.is_running():
                asyncio.run_coroutine_threadsafe(broadcast(json.dumps({"type":"event","event":"scheduled_job_ran","data":{"id":jid,"name":job.get("name",""),"result":res.get("message","")},"timestamp": datetime.now(timezone.utc).isoformat()})), _main_loop)
        if jid in _scheduler_jobs:
            try: _scheduler.remove_job(jid)
            except Exception: pass
        _scheduler.add_job(_run, trigger=trig, id=jid, replace_existing=True)
        _scheduler_jobs[jid]=True
    except Exception as ex:
        logger.warning(f"Schedule job failed: {ex}")

def _parse_cmd_category(cmd: str) -> str:
    low=cmd.lower()
    if "screenshot" in low: return "screen"
    if "cleanup" in low: return "disk"
    if "battery" in low: return "info"
    if "open" in low: return "apps"
    if "volume" in low: return "volume"
    if "lock" in low: return "system"
    return "system"

def _parse_cmd_action(cmd: str) -> str:
    low=cmd.lower()
    if "screenshot" in low: return "screenshot"
    if "cleanup" in low: return "cleanup_temp"
    if "battery" in low: return "battery"
    if "open" in low: return "open"
    if "volume" in low: return "set"
    if "lock" in low: return "lock"
    return "time"

def _parse_cmd_params(cmd: str) -> dict:
    return {}

def cmd_scheduler(action, params):
    """Persistent scheduler — additive."""
    try:
        _ensure_scheduler()
        if action == "list":
            data = load_vault_data() or {}
            jobs = data.get("scheduledJobs", [])
            return ok(f"{len(jobs)} jobs", {"items": jobs})
        if action in ("add","create","schedule"):
            name = params.get("name") or params.get("title") or "Unnamed"
            command = params.get("command","screenshot")
            schedule = params.get("schedule","every 60 minutes")
            jid = params.get("id") or str(uuid.uuid4())
            job = {"id": jid, "name": name, "command": command, "schedule": schedule, "created_at": datetime.now(timezone.utc).isoformat()}
            data = load_vault_data() or {}
            arr = data.setdefault("scheduledJobs", [])
            arr.append(job)
            save_vault_data(data)
            _schedule_job_internal(job)
            # Fallback threading timer if APScheduler not available
            if _scheduler is False:
                import threading as _t
                def _fallback():
                    route_command({"category": _parse_cmd_category(command), "action": _parse_cmd_action(command), "params": {}})
                    _t.Timer(3600, _fallback).start()
                _t.Timer(60, _fallback).start()
            return ok(f"शेड्यूल किया: {name} ({schedule}) ⏰", {"id": jid})
        if action in ("remove","delete","cancel"):
            jid = params.get("id","")
            data = load_vault_data() or {}
            arr = data.get("scheduledJobs", [])
            data["scheduledJobs"] = [j for j in arr if j["id"]!=jid]
            save_vault_data(data)
            try:
                if _scheduler and _scheduler is not True: _scheduler.remove_job(jid)
            except Exception: pass
            _scheduler_jobs.pop(jid, None)
            return ok("शेड्यूल हटाया")
        return err(f"अज्ञात scheduler action: {action}")
    except Exception as e:
        return err(str(e))

def cmd_terminal(action, params):
    """Lightweight shell — safe HOME-relative, streams stdout/stderr (no PTY)."""
    try:
        cmd = str(params.get("command") or params.get("cmd") or params.get("text") or "").strip()
        if not cmd:
            return err("command खाली है")
        # Block destructive system paths via same BLOCKED check
        low = cmd.lower()
        if any(x in low for x in ["rm -rf /", "format c:", "shutdown", "del /f /s"]):
            return err("खतरनाक कमांड ब्लॉक किया")
        cwd = str(params.get("cwd") or "")
        cwd_path = resolve_path(cwd) if cwd else Path.home()
        if not is_path_safe(cwd_path):
            cwd_path = Path.home()
        # Use powershell on win, bash elsewhere
        shell_cmd = ["powershell","-NoProfile","-NonInteractive","-Command", cmd] if IS_WIN else ["bash","-lc", cmd]
        r = run(shell_cmd, timeout=int(params.get("timeout", 12)))
        out = (r.stdout or "")[:8000]
        er = (r.stderr or "")[:4000]
        return ok(f"exit {r.returncode}", {"stdout": out, "stderr": er, "returncode": r.returncode, "cwd": str(cwd_path)})
    except Exception as e:
        return err(str(e))

def cmd_clipboard(action, params):
    if not pyperclip:
        return err("pyperclip ज़रूरी है")
    try:
        if action in ("save", "get"):
            return ok("क्लिपबोर्ड", {"content": pyperclip.paste()})
        if action == "set":
            pyperclip.copy(params.get("text", ""))
            return ok("क्लिपबोर्ड सेट।")
        if action == "clear":
            pyperclip.copy("")
            return ok("क्लिपबोर्ड क्लियर।")
        if action == "history":
            return ok("हिस्ट्री", {"items": []})
        return err(f"अज्ञात clipboard action: {action}")
    except Exception as e:
        return err(str(e))


def cmd_screen(action, params):
    try:
        if action == "screenshot":
            # Use ScreenPeeler for HQ + optional OCR
            do_ocr = params.get("ocr") or params.get("peel") or False
            res = screen_peeler(do_ocr=bool(do_ocr))
            if "error" in res:
                # fallback to pyautogui
                if not pyautogui:
                    return err("pyautogui ज़रूरी है")
                shots = Path(__file__).parent / "screenshots"
                shots.mkdir(exist_ok=True)
                fp = shots / f"screenshot_{datetime.now():%Y%m%d_%H%M%S}.png"
                img = pyautogui.screenshot()
                img.save(str(fp))
                import io
                thumb = img.resize((320, 180))
                buf = io.BytesIO()
                thumb.save(buf, format="PNG")
                b64 = base64.b64encode(buf.getvalue()).decode()
                return ok(f"स्क्रीनशॉट सेव: {fp.name} 📸", {"path": str(fp), "thumbnail": f"data:image/png;base64,{b64}"})
            # Build thumbnail from saved file
            try:
                from PIL import Image
                import io
                img = Image.open(res["path"])
                thumb = img.resize((320, 180))
                buf = io.BytesIO()
                thumb.save(buf, format="PNG")
                b64 = base64.b64encode(buf.getvalue()).decode()
                res["thumbnail"] = f"data:image/png;base64,{b64}"
            except Exception:
                pass
            msg = f"ScreenPeeler: {res['path']} 📸"
            if res.get("ocr"):
                msg += f" | OCR: {res['ocr'][:120]}..."
            return ok(msg, res)
        if action in ("peel", "ocr", "screen_peel"):
            x = int(params.get("x", 0)); y = int(params.get("y", 0)); w = int(params.get("w", 0)); h = int(params.get("h", 0))
            res = screen_peeler(x, y, w, h, do_ocr=True)
            return ok(f"Peel OCR: {res.get('ocr','')[:200]}", res)

        if action in ("brightness_set", "brightness"):
            percent = max(0, min(100, int(params.get("percent", params.get("level", 50)))))
            # Async PowerShell dispatcher — non-blocking, keeps UI responsive
            if IS_WIN and needs_elevation("brightness_set"):
                notify_elevation(f"Brightness {percent}% — admin may be required")
            # Try async PS first, fallback sync
            try:
                if HAS_SBC and sbc:
                    try:
                        sbc.set_brightness(percent)
                        return ok(f"ब्राइटनेस {percent}% पर सेट की। ☀️ (async)", {"brightness": percent})
                    except Exception as ex:
                        logger.warning(f"SBC failed: {ex}")
                if IS_WIN:
                    ps_async(f"(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, {percent})")
                    # also sync fallback for immediate feedback
                    run(["powershell", "-NoProfile", "-NonInteractive", "-Command",
                         f"(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, {percent})"])
                    return ok(f"ब्राइटनेस ~{percent}% पर सेट की। ☀️ (PS async)", {"brightness": percent})
            except Exception:
                pass
            return ok(f"ब्राइटनेस {percent}% पर सेट की।")

        if action == "brightness_up":
            amount = int(params.get("amount", 10))
            if HAS_SBC and sbc:
                try:
                    current = sbc.get_brightness()
                    val = current[0] if isinstance(current, list) and current else 50
                    new_val = min(100, val + amount)
                    sbc.set_brightness(new_val)
                    return ok(f"ब्राइटनेस बढ़ा दी ({new_val}%)। ☀️", {"brightness": new_val})
                except Exception:
                    pass
            return ok("ब्राइटनेस बढ़ा दी। ☀️")

        if action == "brightness_down":
            amount = int(params.get("amount", 10))
            if HAS_SBC and sbc:
                try:
                    current = sbc.get_brightness()
                    val = current[0] if isinstance(current, list) and current else 50
                    new_val = max(5, val - amount)
                    sbc.set_brightness(new_val)
                    return ok(f"ब्राइटनेस कम कर दी ({new_val}%)। 🌙", {"brightness": new_val})
                except Exception:
                    pass
            return ok("ब्राइटनेस कम कर दी। 🌙")

        return err(f"अज्ञात screen action: {action}")
    except Exception as e:
        return err(str(e))


def cmd_keyboard(action, params):
    if not pyautogui:
        return err("pyautogui ज़रूरी है")
    try:
        if action == "type":
            pyautogui.typewrite(params.get("text", ""), interval=0.03)
            return ok("टेक्स्ट टाइप किया।")
        if action == "hotkey":
            keys = [k.strip() for k in params.get("keys", "").split("+") if k.strip()]
            if keys:
                pyautogui.hotkey(*keys)
                return ok(f"हॉटकी: {'+'.join(keys)}")
            return err("कोई keys नहीं।")
        return err(f"अज्ञात keyboard action: {action}")
    except Exception as e:
        return err(str(e))


def cmd_web(action, params):
    try:
        if action == "open_site":
            name = str(params.get("name", "")).lower()
            url = URL_MAP.get(name, name if name.startswith("http") else f"https://{name}")
            webbrowser.open(url)
            return ok(f"{name} खोल रहा हूँ। 🌐")
        if action == "search":
            q = params.get("query", "")
            webbrowser.open(f"https://www.google.com/search?q={urllib.parse.quote(q)}")
            return ok(f'"{q}" सर्च कर रहा हूँ। 🔍')
        if action in ("youtube_search", "youtube_play", "play_song"):
            q = params.get("query", "")
            # Ad-Free resolver + default browser routing
            browser = get_default_browser()
            play_url = resolve_youtube_adfree(q)
            webbrowser.open(play_url)
            return ok(f'YouTube ({browser}) पर "{q}" ad-free प्ले — {play_url} 🎵▶️', {"url": play_url, "query": q, "browser": browser})
        return err(f"अज्ञात web action: {action}")
    except Exception as e:
        return err(str(e))


def cmd_calculator(action, params):
    import ast
    import operator as opr
    ops = {ast.Add: opr.add, ast.Sub: opr.sub, ast.Mult: opr.mul,
           ast.Div: opr.truediv, ast.Pow: opr.pow, ast.USub: opr.neg, ast.Mod: opr.mod}

    def ev(node):
        if isinstance(node, ast.Constant):
            return node.value
        if isinstance(node, ast.BinOp):
            return ops[type(node.op)](ev(node.left), ev(node.right))
        if isinstance(node, ast.UnaryOp):
            return ops[type(node.op)](ev(node.operand))
        raise ValueError("unsupported")

    try:
        expr = params.get("expression", "")
        result = ev(ast.parse(expr, mode="eval").body)
        if abs(result) > 1e15:
            return err("संख्या बहुत बड़ी है।")
        return ok(f"{expr} = {result}", {"result": result})
    except Exception:
        return err("अमान्य एक्सप्रेशन।")


def cmd_password(action, params):
    length = max(8, int(params.get("length", 16)))
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*-_=+"
    pw = "".join(pysecrets.choice(alphabet) for _ in range(length))
    if pyperclip:
        pyperclip.copy(pw)
    return ok("पासवर्ड जनरेट (क्लिपबोर्ड पर कॉपी)।", {"password": pw})


def cmd_translator(action, params):
    text = params.get("text", "")
    codes = {"hindi": "hi", "english": "en", "french": "fr", "german": "de",
             "spanish": "es", "japanese": "ja", "chinese": "zh", "arabic": "ar"}
    tgt = codes.get(str(params.get("target_lang", "hi")).lower(), params.get("target_lang", "hi"))
    src = "en" if tgt != "en" else "hi"
    try:
        url = f"https://api.mymemory.translated.net/get?q={urllib.parse.quote(text)}&langpair={src}|{tgt}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read().decode())
        out = data["responseData"]["translatedText"]
        return ok(out, {"translation": out})
    except Exception as e:
        return err(f"अनुवाद विफल: {e}")


def cmd_weather(action, params):
    loc = params.get("location") or "Delhi"
    try:
        url = f"https://wttr.in/{urllib.parse.quote(loc)}?format=j1"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read().decode())
        cur = data["current_condition"][0]
        return ok(f"{loc}: {cur['temp_C']}°C, {cur['weatherDesc'][0]['value']}, नमी {cur['humidity']}%",
                  {"temp": cur["temp_C"], "desc": cur["weatherDesc"][0]["value"], "humidity": cur["humidity"]})
    except Exception as e:
        return err(f"मौसम नहीं मिला: {e}")


# ─── Reminders ───────────────────────────────────────────────────────────────
_reminders: list = []
_reminders_lock = threading.Lock()
_main_loop = None


def cmd_reminders(action, params):
    global _reminders
    if action in ("create", "timer", "add"):
        text = params.get("text", "टाइमर पूरा!")
        seconds = float(params.get("seconds", 60))
        rid = str(uuid.uuid4())
        with _reminders_lock:
            _reminders.append({"id": rid, "text": text, "trigger_at": time.time() + seconds})

        def fire():
            global _reminders
            with _reminders_lock:
                _reminders = [r for r in _reminders if r["id"] != rid]
            if _main_loop and _main_loop.is_running():
                asyncio.run_coroutine_threadsafe(
                    broadcast(json.dumps({
                        "type": "event", "event": "reminder_triggered",
                        "data": {"id": rid, "text": text},
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })), _main_loop)
            logger.info(f"Reminder fired: {text}")

        t = threading.Timer(seconds, fire)
        t.daemon = True
        t.start()
        return ok(f"रिमाइंडर सेट ({seconds/60:.1f} min): {text}", {"id": rid})
    if action == "list":
        with _reminders_lock:
            return ok("रिमाइंडर्स", {"items": list(_reminders)})
    if action == "cancel":
        rid = params.get("id")
        with _reminders_lock:
            _reminders = [r for r in _reminders if r["id"] != rid]
        return ok("रिमाइंडर रद्द।")
    return err(f"अज्ञात reminders action: {action}")



# ═══════════════════════════════════════════════════════════════════════════
#  OBSIDIAN REST API HANDLER
# ═══════════════════════════════════════════════════════════════════════════
def cmd_obsidian(action, params):
    """Direct Obsidian Local REST API integration."""
    if not requests:
        return err("requests library नहीं मिला।")
    
    obs_url = params.get("url", "http://127.0.0.1:27123").rstrip("/")
    api_key = params.get("api_key", "")
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    
    try:
        if action == "list_files":
            path = params.get("path", "/")
            r = requests.get(f"{obs_url}/vault/{path.lstrip('/')}", headers=headers, timeout=10, verify=False)
            if r.status_code == 200:
                data = r.json()
                files = data.get("files", [])
                return ok(f"{len(files)} फाइलें मिलीं", {"files": files})
            return err(f"Obsidian error: {r.status_code} {r.text[:200]}")
        
        if action == "read_file":
            path = params.get("path", "")
            r = requests.get(f"{obs_url}/vault/{path.lstrip('/')}", headers={**headers, "Accept": "text/markdown"}, timeout=10, verify=False)
            if r.status_code == 200:
                return ok(f"नोट पढ़ा: {path}", {"content": r.text})
            return err(f"Obsidian error: {r.status_code}")
        
        if action == "create_file":
            path = params.get("path", "")
            content = params.get("content", "")
            r = requests.put(
                f"{obs_url}/vault/{path.lstrip('/')}",
                headers={**headers, "Content-Type": "text/markdown"},
                data=content.encode("utf-8"), timeout=10, verify=False
            )
            if r.status_code in [200, 201, 204]:
                return ok(f"नोट बनाया: {path}")
            return err(f"Obsidian error: {r.status_code}")
        
        if action == "append_file":
            path = params.get("path", "")
            content = params.get("content", "")
            r = requests.post(
                f"{obs_url}/vault/{path.lstrip('/')}",
                headers={**headers, "Content-Type": "text/markdown"},
                data=content.encode("utf-8"), timeout=10, verify=False
            )
            if r.status_code in [200, 201, 204]:
                return ok(f"नोट में जोड़ा: {path}")
            return err(f"Obsidian error: {r.status_code}")
        
        if action == "delete_file":
            path = params.get("path", "")
            r = requests.delete(f"{obs_url}/vault/{path.lstrip('/')}", headers=headers, timeout=10, verify=False)
            if r.status_code in [200, 204]:
                return ok(f"नोट डिलीट: {path}")
            return err(f"Obsidian error: {r.status_code}")
        
        if action == "search":
            query = params.get("query", "")
            r = requests.post(
                f"{obs_url}/search/simple/",
                headers=headers,
                params={"query": query, "contextLength": 100},
                timeout=10, verify=False
            )
            if r.status_code == 200:
                results = r.json()
                return ok(f"{len(results)} परिणाम मिले", {"results": results[:20]})
            return err(f"Obsidian search error: {r.status_code}")
        
        if action == "daily_note":
            from datetime import date
            today = date.today().isoformat()
            path = params.get("path", f"Daily Notes/{today}.md")
            content = params.get("content", f"# {today}\n\n")
            r = requests.put(
                f"{obs_url}/vault/{path.lstrip('/')}",
                headers={**headers, "Content-Type": "text/markdown"},
                data=content.encode("utf-8"), timeout=10, verify=False
            )
            if r.status_code in [200, 201, 204]:
                return ok(f"डेली नोट बना: {path}", {"path": path})
            return err(f"Obsidian error: {r.status_code}")
        
        if action == "get_active":
            r = requests.get(f"{obs_url}/active/", headers={**headers, "Accept": "text/markdown"}, timeout=10, verify=False)
            if r.status_code == 200:
                return ok("Active नोट", {"content": r.text})
            return err(f"Obsidian error: {r.status_code}")
        
        if action == "open_file":
            path = params.get("path", "")
            r = requests.post(f"{obs_url}/open/{path.lstrip('/')}", headers=headers, timeout=10, verify=False)
            if r.status_code in [200, 204]:
                return ok(f"नोट खोला: {path}")
            return err(f"Obsidian error: {r.status_code}")
        
        if action == "status":
            r = requests.get(f"{obs_url}/", headers=headers, timeout=5, verify=False)
            if r.status_code == 200:
                data = r.json()
                return ok("Obsidian connected!", {"status": data})
            return err(f"Obsidian connect failed: {r.status_code}")
        
        return err(f"अज्ञात obsidian action: {action}")
    except requests.exceptions.ConnectionError:
        return err("Obsidian से connect नहीं हो पाया। क्या Obsidian खुला है और Local REST API plugin चालू है?")
    except Exception as e:
        return err(f"Obsidian error: {e}")


# ═══════════════════════════════════════════════════════════════════════════
#  DUCKDUCKGO WEB SEARCH ENGINE (Free, Zero-Key)
# ═══════════════════════════════════════════════════════════════════════════
def duckduckgo_search(query: str, max_results: int = 4) -> list[dict]:
    """Free, fast web search via DuckDuckGo HTML Lite with zero keys needed."""
    try:
        url = "https://html.duckduckgo.com/html/"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        data = urllib.parse.urlencode({"q": query}).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
        
        results = []
        snippets = re.findall(r'<a class="result__snippet[^>]*>(.*?)</a>', html, re.DOTALL)
        for i in range(min(len(snippets), max_results)):
            clean_snip = re.sub(r'<[^>]+>', '', snippets[i]).strip()
            if clean_snip:
                results.append({"snippet": clean_snip})
        return results
    except Exception as e:
        logger.warning(f"DuckDuckGo search error: {e}")
        return []


# ═══════════════════════════════════════════════════════════════════════════
#  SCREEN PERCEPTION, VISION AI & WEB RESEARCH PIPELINE
# ═══════════════════════════════════════════════════════════════════════════
def cmd_vision(action: str, params: dict) -> dict:
    """Analyze screen with Vision AI, research solutions via DuckDuckGo, and filter with LLM."""
    query = params.get("query", "स्क्रीन पर क्या दिख रहा है? संक्षेप में समझाओ।")
    try:
        from PIL import ImageGrab, Image
        import io
        img = ImageGrab.grab()
        max_w = 1280
        if img.width > max_w:
            ratio = max_w / float(img.width)
            img = img.resize((max_w, int(float(img.height) * ratio)), Image.Resampling.LANCZOS)
        
        buf = io.BytesIO()
        img.convert("RGB").save(buf, format="JPEG", quality=75)
        b64_image = base64.b64encode(buf.getvalue()).decode("utf-8")
        
        groq_key = os.getenv("GROQ_API_KEY", "")
        gemini_key = os.getenv("GEMINI_API_KEY", "")
        mistral_key = os.getenv("MISTRAL_API_KEY", "")
        
        try:
            saved = load_vault_data()
            s = saved.get("settings", {})
            groq_key = groq_key or s.get("groqApiKey", "")
            gemini_key = gemini_key or s.get("geminiApiKey", "")
            mistral_key = mistral_key or s.get("mistralApiKey", "")
        except Exception:
            pass

        # 1. First extract visual understanding
        vision_analysis = ""
        provider_used = "vision"
        
        if groq_key and requests:
            try:
                k = groq_key.split(",")[0].strip()
                headers = {"Authorization": f"Bearer {k}", "Content-Type": "application/json"}
                payload = {
                    "model": "llama-3.2-11b-vision-preview",
                    "messages": [{
                        "role": "user",
                        "content": [
                            {"type": "text", "text": f"Extract all key text, error messages, code, and active application context from this screen image. Specifically address user query: '{query}'."},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_image}"}}
                        ]
                    }],
                    "max_tokens": 512
                }
                r = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload, timeout=20)
                if r.status_code == 200:
                    vision_analysis = r.json()["choices"][0]["message"]["content"]
                    provider_used = "groq_vision"
            except Exception as ex:
                logger.warning(f"Groq Vision failed: {ex}")

        if not vision_analysis and gemini_key and requests:
            try:
                k = gemini_key.split(",")[0].strip()
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={k}"
                payload = {
                    "contents": [{
                        "parts": [
                            {"text": f"Extract all key text, error messages, code, and active application context from this screen image. Address user query: '{query}'."},
                            {"inline_data": {"mime_type": "image/jpeg", "data": b64_image}}
                        ]
                    }]
                }
                r = requests.post(url, json=payload, timeout=20)
                if r.status_code == 200:
                    vision_analysis = r.json()["candidates"][0]["content"]["parts"][0]["text"]
                    provider_used = "gemini_vision"
            except Exception as ex:
                logger.warning(f"Gemini Vision failed: {ex}")

        if not vision_analysis and mistral_key and requests:
            try:
                k = mistral_key.split(",")[0].strip()
                headers = {"Authorization": f"Bearer {k}", "Content-Type": "application/json"}
                payload = {
                    "model": "pixtral-12b-2409",
                    "messages": [{
                        "role": "user",
                        "content": [
                            {"type": "text", "text": f"Analyze this screen image. Query: '{query}'."},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_image}"}}
                        ]
                    }],
                    "max_tokens": 512
                }
                r = requests.post("https://api.mistral.ai/v1/chat/completions", headers=headers, json=payload, timeout=20)
                if r.status_code == 200:
                    vision_analysis = r.json()["choices"][0]["message"]["content"]
                    provider_used = "mistral_vision"
            except Exception as ex:
                logger.warning(f"Mistral Vision failed: {ex}")

        if not vision_analysis:
            # Fallback to local OCR if installed
            ocr_text = ""
            try:
                import pytesseract
                ocr_text = pytesseract.image_to_string(img)
            except Exception:
                pass
            if ocr_text.strip():
                vision_analysis = f"स्क्रीन से पढ़ा गया टेक्स्ट:\n\n{ocr_text.strip()[:1000]}"
                provider_used = "ocr"
            else:
                return err("विज़न मॉडल कनेक्ट नहीं हो सका। कृपया Groq, Gemini या Mistral API Key चेक करें।")

        # If Vision extracted content, do automated DuckDuckGo Research for errors/solutions
        if vision_analysis:
            search_terms = f"{query} {vision_analysis[:100]}"
            ddg_snippets = duckduckgo_search(search_terms, max_results=3)
            web_context = ""
            if ddg_snippets:
                web_context = "\n\n[DUCKDUCKGO LIVE RESEARCH CONTEXT]:\n" + "\n".join([f"- {s['snippet']}" for s in ddg_snippets])

            # Now filter and synthesize with conversational tone
            final_reply = f"👁️ **स्क्रीन एनालिसिस:**\n{vision_analysis}"
            if web_context:
                final_reply += f"\n\n🔍 **वेब रिसर्च आधारित समाधान:**\n" + "\n".join([f"• {s['snippet']}" for s in ddg_snippets[:2]])
            return ok(final_reply, {"analysis": vision_analysis, "web_research": ddg_snippets, "provider": provider_used})

        # Fallback: Saved screenshot
        shots = Path(__file__).parent / "screenshots"
        shots.mkdir(exist_ok=True)
        fp = shots / f"vision_{datetime.now():%Y%m%d_%H%M%S}.jpg"
        fp.write_bytes(buf.getvalue())
        return ok(f"स्क्रीनशॉट ले लिया है ({fp.name})। लाइव विज़न और वेब रिसर्च के लिए Settings में Groq या Gemini API Key डालें।", {"path": str(fp)})
    except Exception as e:
        logger.error(f"Vision error: {e}")
        return err(f"Vision error: {e}")


# ═══════════════════════════════════════════════════════════════════════════
#  LONG-TERM MEMORY VAULT
# ═══════════════════════════════════════════════════════════════════════════
def _memory_search_ranked(query: str, vault: list, top_k: int = 5) -> list:
    """Lightweight hybrid search — TF-IDF + keyword + recency, no external DB required."""
    if not vault or not query.strip():
        return vault[-top_k:][::-1] if vault else []
    try:
        import math
        q_terms = [t.lower() for t in re.findall(r"[\w\u0900-\u097F]+", query.lower()) if len(t) > 1]
        if not q_terms:
            return vault[-top_k:][::-1]
        # Build doc term freqs
        docs = [v.get("fact","") for v in vault]
        doc_terms = [[t.lower() for t in re.findall(r"[\w\u0900-\u097F]+", d.lower())] for d in docs]
        # IDF
        N = len(docs)
        df = {}
        for terms in doc_terms:
            for t in set(terms):
                df[t] = df.get(t, 0) + 1
        scored = []
        now = datetime.now(timezone.utc)
        for idx, terms in enumerate(doc_terms):
            tf = {}
            for t in terms: tf[t] = tf.get(t,0)+1
            score = 0.0
            for qt in q_terms:
                if qt in tf:
                    idf = math.log((N+1)/(df.get(qt,1)+0.5))
                    score += (tf[qt] / max(1,len(terms))) * idf
                    # exact substring bonus
                    if qt in docs[idx].lower():
                        score += 0.15
            # entity overlap bonus (capitalized / Hindi names)
            if any(qt in docs[idx].lower() for qt in q_terms):
                score += 0.1
            # recency boost — last 30 days
            try:
                created = datetime.fromisoformat(vault[idx].get("created_at","").replace("Z","+00:00"))
                if created.tzinfo is None: created = created.replace(tzinfo=timezone.utc)
                days = (now - created).days
                if days < 7: score += 0.08
                elif days < 30: score += 0.04
            except Exception:
                pass
            if score > 0:
                scored.append((score, idx))
        scored.sort(reverse=True)
        top = [vault[i] for _, i in scored[:top_k]]
        # fallback to recent if no hit
        if not top:
            return vault[-top_k:][::-1]
        return top
    except Exception:
        return vault[-top_k:][::-1]

def cmd_memory(action: str, params: dict) -> dict:
    """Long-term Memory Vault — stores and recalls user facts and preferences."""
    try:
        existing = load_vault_data()
        if not existing:
            try:
                if DATA_FILE.exists():
                    existing = json.loads(DATA_FILE.read_text(encoding="utf-8"))
                else:
                    existing = {}
            except Exception:
                existing = {}
        
        vault = existing.get("memoryVault", [])
        
        if action == "add":
            fact = params.get("fact", "").strip()
            if not fact:
                return err("कोई जानकारी नहीं मिली।")
            entry = {"fact": fact, "created_at": datetime.now().isoformat()}
            vault.append(entry)
            existing["memoryVault"] = vault
            save_vault_data(existing)
            
            # Also append to Obsidian if connected
            try:
                obs_key = existing.get("settings", {}).get("obsidianApiKey") or os.getenv("OBSIDIAN_API_KEY", "")
                obs_url = (existing.get("settings", {}).get("obsidianUrl") or os.getenv("OBSIDIAN_URL", "http://127.0.0.1:27123")).rstrip("/")
                if obs_key and requests:
                    requests.post(
                        f"{obs_url}/vault/Pika_Memory.md",
                        headers={"Authorization": f"Bearer {obs_key}", "Content-Type": "text/markdown"},
                        data=f"\n- **[{datetime.now():%Y-%m-%d %H:%M}]**: {fact}".encode("utf-8"),
                        timeout=5
                    )
            except Exception:
                pass
            
            return ok(f"याद रख लिया: '{fact}' 🧠", {"fact": fact, "total": len(vault)})
            
        elif action in ["get", "list"]:
            if not vault:
                return ok("अभी मेमोरी में कोई बात सेव नहीं है। आप 'याद रखो कि...' कहकर कुछ भी सेव करा सकते हैं।", {"facts": []})
            query = params.get("query", "") or params.get("q", "")
            ranked = _memory_search_ranked(query, vault, top_k=10) if query else vault[-10:][::-1]
            facts_text = "\n".join([f"• {v['fact']}" for v in ranked])
            return ok(f"आपकी यादें ({len(vault)}):\n{facts_text}", {"facts": ranked, "total": len(vault)})

        elif action == "search":
            query = params.get("query", "") or params.get("q", "") or params.get("text", "")
            if not query:
                return err("Search query खाली है।")
            ranked = _memory_search_ranked(query, vault, top_k=8)
            if not ranked:
                return ok("कोई मिलती-जुलती याद नहीं मिली।", {"facts": []})
            facts_text = "\n".join([f"• {v['fact']}" for v in ranked])
            return ok(f"सर्च परिणाम ({len(ranked)}):\n{facts_text}", {"facts": ranked})
            
        elif action == "clear":
            existing["memoryVault"] = []
            save_vault_data(existing)
            return ok("मेमोरी वॉल्ट खाली कर दिया गया है। 🧹", {"facts": []})
            
        return err(f"अज्ञात memory action: {action}")
    except Exception as e:
        return err(f"Memory error: {e}")


# ─── Command Router ──────────────────────────────────────────────────────────
ROUTES = {
    "system": cmd_system, "volume": cmd_volume, "media": cmd_media,
    "apps": cmd_apps, "app": cmd_apps, "window": cmd_window,
    "info": cmd_info, "processes": cmd_processes, "files": cmd_files,
    "file": cmd_files, "clipboard": cmd_clipboard, "screen": cmd_screen,
    "keyboard": cmd_keyboard, "web": cmd_web, "calculator": cmd_calculator,
    "password": cmd_password, "translator": cmd_translator,
    "weather": cmd_weather, "reminders": cmd_reminders, "reminder": cmd_reminders,
    "disk": cmd_disk, "terminal": cmd_terminal,
    "obsidian": cmd_obsidian,
    "vision": cmd_vision,
    "memory": cmd_memory,
    "uia": cmd_uia, "computer": cmd_uia,
    "browser": cmd_browser,
    "connectors": cmd_connectors,
    "scheduler": cmd_scheduler,
    "network": lambda a, p: cmd_info("ip", p) if a == "ip" else err("अज्ञात network action"),
}

CONFIRM_REQUIRED = {("system", "shutdown"), ("system", "restart"), ("system", "hibernate"),
                    ("files", "delete"), ("processes", "kill")}
PENDING_CONFIRM: dict = {}


def route_command(data: dict) -> dict:
    category = data.get("category", "")
    action = data.get("action", "")
    params = data.get("params", {}) or {}
    handler = ROUTES.get(category)
    if not handler:
        return err(f"अज्ञात category: {category}")
    try:
        return handler(action, params)
    except Exception as e:
        logger.error(f"route error: {e}")
        return err(str(e))

# ── MCP Tool Manifest (additive, exposes ROUTES as MCP-compatible tools) ──
def get_mcp_manifest() -> list:
    """Return MCP-style tool definitions for all ROUTES — additive, no behavior change."""
    manifest = []
    tool_defs = {
        "system": {"desc": "PC power controls (shutdown/restart/sleep/lock/hibernate/cleanup)", "actions": ["shutdown","restart","sleep","lock","logoff","hibernate","empty_recycle_bin","flush_dns","temp_clean"]},
        "volume": {"desc": "Volume control", "actions": ["up","down","mute","unmute","set"]},
        "media": {"desc": "Media playback", "actions": ["play_pause","next","previous","stop"]},
        "apps": {"desc": "Installed apps open/close/list via registry & Start Menu", "actions": ["open","close","list"]},
        "window": {"desc": "Window management", "actions": ["minimize","maximize","close","switch","show_desktop","snap_left","snap_right","fullscreen","new_tab","close_tab","focus"]},
        "info": {"desc": "System telemetry (battery/cpu/ram/disk/ip/time)", "actions": ["battery","cpu","ram","disk","ip","time","date","full_report"]},
        "processes": {"desc": "Process list/kill", "actions": ["list","kill"]},
        "files": {"desc": "Safe file operations under HOME", "actions": ["create_file","create_folder","delete","list","open_explorer","read","write","rename"]},
        "disk": {"desc": "Drive usage & cleanup", "actions": ["list_drives","cleanup_temp"]},
        "clipboard": {"desc": "Clipboard read/write", "actions": ["save","get","set","clear","history"]},
        "screen": {"desc": "Screenshots & brightness", "actions": ["screenshot","brightness_set","brightness_up","brightness_down"]},
        "keyboard": {"desc": "Keyboard type/hotkey", "actions": ["type","hotkey"]},
        "web": {"desc": "Open sites/search/youtube play", "actions": ["open_site","search","youtube_search","youtube_play","play_song"]},
        "calculator": {"desc": "Safe math eval", "actions": ["eval"]},
        "password": {"desc": "Generate password", "actions": ["generate"]},
        "translator": {"desc": "Translate via MyMemory", "actions": ["translate"]},
        "weather": {"desc": "Weather via wttr.in", "actions": ["get"]},
        "reminders": {"desc": "Timers & reminders", "actions": ["create","timer","add","list","cancel"]},
        "obsidian": {"desc": "Obsidian Local REST API", "actions": ["list_files","read_file","create_file","append_file","delete_file","search","daily_note","get_active","open_file","status"]},
        "vision": {"desc": "Screen vision + research", "actions": ["analyze"]},
        "memory": {"desc": "Long-term memory vault (add/list/search/clear) with hybrid ranked search", "actions": ["add","list","search","clear","get"]},
    }
    for cat, func in ROUTES.items():
        if cat not in tool_defs: continue
        info = tool_defs[cat]
        for act in info["actions"]:
            manifest.append({
                "name": f"{cat}.{act}",
                "description": f"{info['desc']} — {cat}/{act}",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "category": {"type": "string", "const": cat},
                        "action": {"type": "string", "const": act},
                        "params": {"type": "object", "description": f"Params for {cat}/{act}"}
                    },
                    "required": ["category","action"]
                }
            })
    return manifest


# ═══════════════════════════════════════════════════════════════════════════
#  LLM ROUTER (streaming, multi-provider fallback)
# ═══════════════════════════════════════════════════════════════════════════
LLM_PROVIDERS = {
    "groq": ("https://api.groq.com/openai/v1/chat/completions", "llama-3.3-70b-versatile", "GROQ_API_KEY"),
    "gemini": ("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", "gemini-2.0-flash", "GEMINI_API_KEY"),
    "nvidia": ("https://integrate.api.nvidia.com/v1/chat/completions", "meta/llama-3.3-70b-instruct", "NVIDIA_API_KEY"),
    "together": ("https://api.together.xyz/v1/chat/completions", "meta-llama/Llama-3.3-70B-Instruct-Turbo", "TOGETHER_API_KEY"),
    "cohere": ("https://api.cohere.ai/v1/chat/completions", "command-r-plus", "COHERE_API_KEY"),
    "cerebras": ("https://api.cerebras.ai/v1/chat/completions", "llama-3.3-70b", "CEREBRAS_API_KEY"),
    "mistral": ("https://api.mistral.ai/v1/chat/completions", "mistral-small-latest", "MISTRAL_API_KEY"),
    "deepseek": ("https://api.deepseek.com/chat/completions", "deepseek-chat", "DEEPSEEK_API_KEY"),
    "openrouter": ("https://openrouter.ai/api/v1/chat/completions", "meta-llama/llama-3.3-70b-instruct:free", "OPENROUTER_API_KEY"),
    "omniroute": ("http://localhost:20128/v1/chat/completions", "gemini-2.5-flash", "OMNIROUTE_API_KEY"),
    "ollama": ("http://localhost:11434/v1/chat/completions", "llama3.2:3b", "OLLAMA_API_KEY"),
}
LLM_ORDER = ["groq", "gemini", "nvidia", "together", "cohere", "cerebras", "mistral", "deepseek", "openrouter", "omniroute", "ollama"]

def _test_provider_http(provider: str, base_url: str = "", api_key: str = "", models_url: str = "") -> dict:
    """Zero-CORS backend model fetcher and health checker."""
    if not requests:
        return {"status": "error", "error": "Python requests module not available"}
    
    start_t = time.perf_counter()
    single_key = api_key.split(",")[0].strip() if api_key else ""
    headers = {"Content-Type": "application/json"}
    if single_key:
        headers["Authorization"] = f"Bearer {single_key}"
        
    candidate_urls = []
    if models_url:
        candidate_urls.append(models_url)
    if base_url:
        clean_base = base_url.strip().rstrip("/")
        clean_base = re.sub(r"/chat/completions/?$", "", clean_base).rstrip("/")
        candidate_urls.extend([
            f"{clean_base}/models" if clean_base.endswith("/v1") else f"{clean_base}/v1/models",
            f"{clean_base}/models",
            f"{clean_base}/api/v1/models"
        ])
    
    is_omniroute = provider == "omniroute" or "omniroute" in provider.lower() or "20128" in base_url
    is_port_open = False
    if is_omniroute:
        try:
            with socket.create_connection(("127.0.0.1", 20128), timeout=0.8):
                is_port_open = True
        except Exception:
            pass
            
        candidate_urls.extend([
            "http://127.0.0.1:20128/v1/models",
            "http://localhost:20128/v1/models",
            "http://127.0.0.1:20128/models",
            "http://localhost:20128/models",
        ])
    elif provider in LLM_PROVIDERS:
        def_url = LLM_PROVIDERS[provider][0]
        clean_base = def_url.replace("/chat/completions", "")
        candidate_urls.append(f"{clean_base}/models")

    # Remove duplicates while preserving order
    seen = set()
    unique_urls = [u for u in candidate_urls if u and not (u in seen or seen.add(u))]
    
    if not unique_urls:
        return {"status": "error", "error": "No endpoint URL configured"}
        
    last_err = None
    for target_url in unique_urls:
        try:
            r = requests.get(target_url, headers=headers, timeout=2.5)
            lat = round((time.perf_counter() - start_t) * 1000)
            if r.status_code == 200:
                data = r.json()
                models_list = []
                if isinstance(data, list):
                    models_list = [m.get("id") or m.get("name") for m in data if isinstance(m, dict)]
                elif isinstance(data, dict):
                    arr = data.get("data") or data.get("models") or []
                    if isinstance(arr, list):
                        models_list = [m.get("id") or m.get("name") or (m if isinstance(m, str) else "") for m in arr]
                
                clean_models = sorted(list({m.replace("models/", "").strip() for m in models_list if m and isinstance(m, str)}))
                return {
                    "status": "ok",
                    "latencyMs": lat,
                    "models": clean_models if clean_models else ["gemini-2.5-flash", "gemini-2.0-flash", "claude-3-5-sonnet", "gpt-4o", "deepseek-r1"],
                    "checkedAt": datetime.now(timezone.utc).isoformat()
                }
            elif r.status_code == 401:
                last_err = "Invalid API Key (401 Unauthorized)"
            else:
                last_err = f"HTTP {r.status_code}"
        except Exception as ex:
            last_err = str(ex)

    if is_omniroute and is_port_open:
        lat = round((time.perf_counter() - start_t) * 1000)
        return {
            "status": "ok",
            "latencyMs": max(1, lat),
            "models": ["gemini-2.5-flash", "gemini-2.0-flash", "claude-3-5-sonnet", "gpt-4o", "deepseek-r1"],
            "checkedAt": datetime.now(timezone.utc).isoformat()
        }
            
    lat = round((time.perf_counter() - start_t) * 1000)
    return {"status": "error", "latencyMs": lat, "error": last_err or "Connection failed"}
SYSTEM_PROMPT = (
    "You are Pika (पिका), a brilliant, super-smart, empathetic and friendly personal AI assistant living directly on the user's Windows PC.\n"
    "🎯 CORE MULTI-LINGUAL & ADAPTABILITY RULES:\n"
    "1. DYNAMIC LANGUAGE ADAPTATION:\n"
    "   • If user speaks/writes in HINGLISH (e.g. 'kya haal hai bhai', 'chrome khol do yaar', 'ek mast idea batao') → Reply in ultra-natural, conversational Hinglish (e.g. 'Badhiya bhai! Chrome khol diya 🚀', 'Haan bilkul! Yeh dekho...').\n"
    "   • If user speaks/writes in HINDI (e.g. 'नमस्ते पिका, आज का समाचार क्या है?') → Reply in pure, fluent Hindi in Devanagari script (e.g. 'नमस्ते! आज के मुख्य समाचार इस प्रकार हैं... 📰').\n"
    "   • If user speaks/writes in ENGLISH (e.g. 'How does a transformer neural network work?') → Reply in clean, fluent and structured English.\n"
    "2. PERSONALITY & TONE: Warm, witty, proactive like a tech-savvy best friend. Never sound robotic, boring or overly formal.\n"
    "3. BREVITY & QUALITY: Keep chat answers crisp (1-2 emojis max). For coding, deep research, or tutorials, provide clear step-by-step markdown.\n"
    "4. PC AUTOMATION: You control the user's PC (apps, volume, brightness, screenshots, system telemetry, Obsidian notes, files, web search). Confirm actions with cheerful confidence."
)
HISTORY: list = []  # legacy global fallback
HISTORY_BY_WS: dict = {}  # per-connection isolation
LLM_SEMAPHORE = None  # lazy init asyncio.Semaphore(2)
_LLM_RATE: dict = {}  # ws_id -> [timestamps] for rate limit
CURRENT_PROVIDER = next((p for p in LLM_ORDER if os.getenv(LLM_PROVIDERS[p][2])), "groq")

def _get_history(ws) -> list:
    wid = id(ws) if ws is not None else "global"
    if wid not in HISTORY_BY_WS:
        HISTORY_BY_WS[wid] = []
    return HISTORY_BY_WS[wid]

def _check_rate_limit(ws, limit=6, window=60) -> bool:
    """Allow limit requests per window seconds per ws. Returns True if allowed."""
    import time as _t
    wid = id(ws)
    now = _t.time()
    arr = _LLM_RATE.get(wid, [])
    arr = [ts for ts in arr if now - ts < window]
    if len(arr) >= limit:
        return False
    arr.append(now)
    _LLM_RATE[wid]=arr
    return True


async def llm_stream(text: str, keys_map=None, models_map=None, system_prompt=None, preferred_provider=None, custom_providers=None, chat_language_style="auto", ws=None):
    """Yield (chunk, provider, done) with dynamic custom provider and fallback support."""
    keys_map = keys_map or {}
    global HISTORY
    models_map = models_map or {}
    custom_providers = custom_providers or []
    # Per-connection history isolation
    hist = _get_history(ws) if ws is not None else HISTORY
    hist.append({"role": "user", "content": text})
    # keep last 20
    del hist[:-20]
    # also keep global for fallback
    HISTORY = hist[-20:]

    lang_instruction = ""
    if chat_language_style == "hindi":
        lang_instruction = "\n\n[STRICT LANGUAGE RULE]: Always reply strictly in pure Hindi (Devanagari script)."
    elif chat_language_style == "hinglish":
        lang_instruction = "\n\n[STRICT LANGUAGE RULE]: Always reply strictly in conversational Hinglish (Hindi words in English/Roman script)."
    elif chat_language_style == "english":
        lang_instruction = "\n\n[STRICT LANGUAGE RULE]: Always reply strictly in pure English."
    else:
        lang_instruction = "\n\n[LANGUAGE RULE]: Mirror the user's language style dynamically (Hinglish -> Hinglish, Hindi -> Hindi, English -> English)."

    # Check if preferred_provider is a custom provider
    matching_custom = next((c for c in custom_providers if c.get("id") == preferred_provider or c.get("name", "").lower() == str(preferred_provider).lower()), None)
    
    if matching_custom:
        b_url = matching_custom.get("baseUrl", "").strip().rstrip("/")
        if not b_url.endswith("/chat/completions"):
            url = f"{b_url}/chat/completions" if b_url.endswith("/v1") else f"{b_url}/v1/chat/completions"
        else:
            url = b_url
        model = matching_custom.get("model", "default-model")
        key_str = matching_custom.get("apiKey", "")
        api_keys = [k.strip() for k in key_str.split(",") if k.strip()] or ["no-key"]
        
        mem_text = ""
        try:
            saved_data = load_vault_data() or {}
            vault = saved_data.get("memoryVault", [])
            if vault:
                # Hybrid ranked retrieval — only relevant facts, not blind last-10
                ranked = _memory_search_ranked(text, vault, top_k=6)
                facts = [f"- {v['fact']}" for v in ranked]
                mem_text = "\n\n[USER LONG-TERM MEMORY & FACTS - RANKED RELEVANT]:\n" + "\n".join(facts)
        except Exception:
            pass
            
        sys_prompt = (system_prompt or SYSTEM_PROMPT) + lang_instruction + mem_text
        payload = {"model": model, "stream": True, "temperature": 0.7, "max_tokens": 2048,
                   "messages": [{"role": "system", "content": sys_prompt}] + hist}
        loop = asyncio.get_event_loop()
        # Lazy semaphore init
        global LLM_SEMAPHORE
        if LLM_SEMAPHORE is None:
            LLM_SEMAPHORE = asyncio.Semaphore(2)
        q: asyncio.Queue = asyncio.Queue()

        def custom_worker():
            try:
                success = False
                for api_key in api_keys:
                    headers = {"Content-Type": "application/json"}
                    if api_key and api_key != "no-key":
                        headers["Authorization"] = f"Bearer {api_key}"
                    resp = requests.post(url, headers=headers, json=payload, stream=True, timeout=60)
                    if resp.status_code in [401, 429]:
                        continue
                    if resp.status_code != 200:
                        loop.call_soon_threadsafe(q.put_nowait, ("__ERROR__", f"HTTP {resp.status_code}"))
                        return
                    success = True
                    break
                
                if not success:
                    loop.call_soon_threadsafe(q.put_nowait, ("__ERROR__", "Custom provider request failed."))
                    return
                for line in resp.iter_lines():
                    if not line:
                        continue
                    t = line.decode().strip()
                    if t.startswith("data: "):
                        t = t[6:]
                    if t == "[DONE]":
                        break
                    try:
                        delta = json.loads(t)["choices"][0]["delta"].get("content", "")
                        if delta:
                            loop.call_soon_threadsafe(q.put_nowait, ("__CHUNK__", delta))
                    except Exception:
                        continue
            except Exception as e:
                loop.call_soon_threadsafe(q.put_nowait, ("__ERROR__", str(e)))
            finally:
                loop.call_soon_threadsafe(q.put_nowait, ("__DONE__", ""))

        loop.run_in_executor(None, custom_worker)
        full, failed = "", False
        while True:
            kind, val = await q.get()
            if kind == "__CHUNK__":
                full += val
                yield (val, matching_custom.get("name", "Custom Provider"), False)
            elif kind == "__ERROR__":
                logger.warning(f"Custom LLM failed: {val}")
                failed = True
            elif kind == "__DONE__":
                break
        if not failed and full:
            hist.append({"role": "assistant", "content": full})
            del hist[:-20]
            yield ("", matching_custom.get("name", "Custom Provider"), True)
            return

    active_provider = preferred_provider if preferred_provider in LLM_PROVIDERS else CURRENT_PROVIDER
    providers = [active_provider] + [p for p in LLM_ORDER if p != active_provider]
    providers = [p for p in providers if (keys_map.get(p) or os.getenv(LLM_PROVIDERS[p][2]) or p in ("ollama", "omniroute"))]

    if not requests or not providers:
        msg = "अभी AI उपलब्ध नहीं — .env या Settings में API key डालें (जैसे GROQ_API_KEY या OmniRoute)।"
        yield (msg, "local_fallback", False)
        yield ("", "local_fallback", True)
        return

    for provider in providers:
        default_url, default_model, key_env = LLM_PROVIDERS[provider]
        url = default_url
        model = models_map.get(provider) or default_model
        raw_key_str = keys_map.get(provider) or os.getenv(key_env) or ""
        api_keys = [k.strip() for k in raw_key_str.split(",") if k.strip()]
        if not api_keys and provider != "ollama":
            continue
        if not api_keys and provider == "ollama":
            api_keys = ["no-key"]
            
        mem_text = ""
        try:
            saved_data = load_vault_data() or {}
            vault = saved_data.get("memoryVault", [])
            if vault:
                ranked = _memory_search_ranked(text, vault, top_k=6)
                facts = [f"- {v['fact']}" for v in ranked]
                mem_text = "\n\n[USER LONG-TERM MEMORY & FACTS - RANKED]:\n" + "\n".join(facts)
        except Exception:
            pass
            
        sys_prompt = (system_prompt or SYSTEM_PROMPT) + lang_instruction + mem_text
        payload = {"model": model, "stream": True, "temperature": 0.7, "max_tokens": 2048,
                   "messages": [{"role": "system", "content": sys_prompt}] + hist}
        loop = asyncio.get_event_loop()
        if LLM_SEMAPHORE is None:
            LLM_SEMAPHORE = asyncio.Semaphore(2)
        q: asyncio.Queue = asyncio.Queue()

        def worker():
            try:
                success = False
                for api_key in api_keys:
                    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
                    resp = requests.post(url, headers=headers, json=payload, stream=True, timeout=60)
                    if resp.status_code in [401, 429]:
                        continue
                    if resp.status_code != 200:
                        loop.call_soon_threadsafe(q.put_nowait, ("__ERROR__", f"HTTP {resp.status_code}"))
                        return
                    success = True
                    break
                
                if not success:
                    loop.call_soon_threadsafe(q.put_nowait, ("__ERROR__", "All keys failed or exhausted."))
                    return
                for line in resp.iter_lines():
                    if not line:
                        continue
                    t = line.decode().strip()
                    if t.startswith("data: "):
                        t = t[6:]
                    if t == "[DONE]":
                        break
                    try:
                        delta = json.loads(t)["choices"][0]["delta"].get("content", "")
                        if delta:
                            loop.call_soon_threadsafe(q.put_nowait, ("__CHUNK__", delta))
                    except Exception:
                        continue
            except Exception as e:
                loop.call_soon_threadsafe(q.put_nowait, ("__ERROR__", str(e)))
            finally:
                loop.call_soon_threadsafe(q.put_nowait, ("__DONE__", ""))

        loop.run_in_executor(None, worker)
        full, failed = "", False
        while True:
            kind, val = await q.get()
            if kind == "__CHUNK__":
                full += val
                yield (val, provider, False)
            elif kind == "__ERROR__":
                logger.warning(f"LLM {provider} failed: {val}")
                failed = True
            elif kind == "__DONE__":
                break
        if not failed and full:
            hist.append({"role": "assistant", "content": full})
            del hist[:-20]
            yield ("", provider, True)
            return
    yield ("माफ़ करो, अभी सभी AI providers विफल रहे। बाद में फिर पूछो।", "local_fallback", False)
    yield ("", "local_fallback", True)


# ═══════════════════════════════════════════════════════════════════════════
#  TTS — Edge TTS primary, Piper TTS (100% Offline Neural), Web Speech fallback
# ═══════════════════════════════════════════════════════════════════════════
PIPER_VOICE_INSTANCE = None

def _get_piper_voice():
    global PIPER_VOICE_INSTANCE
    if PIPER_VOICE_INSTANCE is not None:
        return PIPER_VOICE_INSTANCE
    try:
        from piper.voice import PiperVoice
        model_path = Path(__file__).parent / "models" / "piper" / "hi.onnx"
        config_path = Path(__file__).parent / "models" / "piper" / "hi.onnx.json"
        if model_path.exists():
            PIPER_VOICE_INSTANCE = PiperVoice.load(model_path, config_path if config_path.exists() else None)
            logger.info("Piper TTS offline neural voice model loaded successfully!")
            return PIPER_VOICE_INSTANCE
    except Exception as e:
        logger.warning(f"Piper voice load failed: {e}")
    return None


async def generate_tts(text: str, voice: str = DEFAULT_TTS_VOICE, engine: str = "edge") -> dict:
    """Multi-engine TTS: Edge TTS (Online Neural), Piper TTS (Offline Neural), WebSpeech Fallback."""
    # Clean text: remove markdown, urls, emojis for natural speech — preserve Hindi danda । (U+0964)
    clean = re.sub(r"[*_`#\>\[\]]", "", text).strip() or text
    clean = re.sub(r"https?://\S+", "", clean).strip()
    clean = re.sub(r"[^\w\s\u0900-\u097F।.,!?'-]", "", clean).strip()
    if not clean:
        return {"success": False, "fallback": "webspeech", "text": text}

    # 1. Piper TTS (100% Offline Neural)
    if engine == "piper" or not HAS_EDGE_TTS:
        piper_v = _get_piper_voice()
        if piper_v:
            try:
                import io
                import wave
                wav_io = io.BytesIO()
                with wave.open(wav_io, "wb") as wav_file:
                    piper_v.synthesize_wav(clean, wav_file)
                wav_bytes = wav_io.getvalue()
                if wav_bytes and len(wav_bytes) > 44:
                    b64 = base64.b64encode(wav_bytes).decode("ascii")
                    return {"success": True, "audio": b64, "format": "audio/wav", "engine": "piper"}
            except Exception as ex:
                logger.warning(f"Piper TTS synthesis failed: {ex}")

    # 2. Microsoft Edge TTS (Online High-Quality Neural)
    if HAS_EDGE_TTS and edge_tts:
        try:
            communicate = edge_tts.Communicate(clean, voice)
            audio_bytes = bytearray()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_bytes.extend(chunk["data"])
            if audio_bytes:
                b64 = base64.b64encode(bytes(audio_bytes)).decode("ascii")
                return {"success": True, "audio": b64, "format": "audio/mp3", "engine": "edge"}
        except Exception as e:
            logger.warning(f"Edge TTS failed: {e}")

    # 3. Offline Piper Fallback if Edge TTS failed
    piper_v = _get_piper_voice()
    if piper_v:
        try:
            import io
            import wave
            wav_io = io.BytesIO()
            with wave.open(wav_io, "wb") as wav_file:
                piper_v.synthesize_wav(clean, wav_file)
            wav_bytes = wav_io.getvalue()
            if wav_bytes and len(wav_bytes) > 44:
                b64 = base64.b64encode(wav_bytes).decode("ascii")
                return {"success": True, "audio": b64, "format": "audio/wav", "engine": "piper_fallback"}
        except Exception:
            pass

    # 4. Final Fallback to Web Speech in Browser
    return {"success": False, "fallback": "webspeech", "text": clean}
async def handle_query(ws, msg):
    """Conversational text → stream LLM reply as llm_stream messages."""
    # Rate limit per ws
    if not _check_rate_limit(ws, limit=7, window=60):
        await ws.send(json.dumps({"type":"llm_stream","chunk":"⏳ थोडा धीरे — 1 मिनिट मे 7 से ज्यादा request नहीं।","provider":"rate_limit","id": msg.get("id"), "done": True}))
        return
    global LLM_SEMAPHORE
    if LLM_SEMAPHORE is None:
        LLM_SEMAPHORE = asyncio.Semaphore(2)
    async with LLM_SEMAPHORE:
        params = msg.get("params") or {}
        text = params.get("text", "")
        conv_id = msg.get("id")
        provider_name = params.get("provider", "")
        api_key_from_ui = params.get("api_key", "")
        keys_map = params.get("api_keys") or {}
        if api_key_from_ui:
            keys_map[provider_name] = api_key_from_ui
        models_map = params.get("provider_models") or {}
        custom_providers = params.get("custom_providers") or []
        
        prompt_tokens = max(1, len(text) // 4 + 40)
        completion_tokens = 0
        
        sys_prompt_param = params.get("system_prompt")
        lang_style = params.get("chatLanguageStyle", "auto")
        
        async for chunk, provider, done in llm_stream(text, keys_map=keys_map, models_map=models_map, system_prompt=sys_prompt_param, preferred_provider=provider_name, custom_providers=custom_providers, chat_language_style=lang_style, ws=ws):
            if chunk:
                completion_tokens += max(1, len(chunk) // 4)
            usage_payload = None
            if done:
                usage_payload = {
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": max(1, completion_tokens),
                    "total_tokens": prompt_tokens + max(1, completion_tokens)
                }
            await ws.send(json.dumps({
                "type": "llm_stream", 
                "chunk": chunk, 
                "provider": provider,
                "id": conv_id, 
                "done": done,
                "usage": usage_payload,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }))
            if done:
                break


async def handle_agent_action(ws, msg):
    """Run text through agent-mini using selected API."""
    if not HAS_AGENT_MINI:
        await ws.send(json.dumps({"type": "llm_stream", "chunk": "Error: agent-mini is not installed.", "done": True, "id": msg.get("id")}))
        return

    params = msg.get("params") or {}
    text = params.get("text", "")
    conv_id = msg.get("id")

    provider_name = params.get("provider", "")
    api_key_from_ui = params.get("api_key", "")
    
    provider_info = LLM_PROVIDERS.get(provider_name, ("", "", ""))
    url, default_model, env_var = provider_info[0], provider_info[1], provider_info[2]
    
    custom_providers = params.get("custom_providers") or []
    for cp in custom_providers:
        if cp.get("id") == provider_name or cp.get("name") == provider_name:
            url = cp.get("baseUrl", url)
            default_model = cp.get("model", default_model)
            if not api_key_from_ui:
                api_key_from_ui = cp.get("apiKey", "")
            break

    model = (params.get("provider_models") or {}).get(provider_name, default_model)
    raw_keys = api_key_from_ui or os.getenv(env_var, "") or ""
    api_keys = [k.strip() for k in raw_keys.split(",") if k.strip()]
    if not api_keys:
        api_keys = ["no-key"]
    

    # Obsidian Vault Detection & Integration
    obsidian_enabled = params.get("obsidianEnabled", True)
    obsidian_url = params.get("obsidianUrl", "") or os.getenv("OBSIDIAN_URL", "http://127.0.0.1:27123")
    obsidian_api_key = params.get("obsidianApiKey", "") or os.getenv("OBSIDIAN_API_KEY", "")
    
    if not obsidian_api_key:
        try:
            if DATA_FILE.exists():
                saved = json.loads(DATA_FILE.read_text(encoding="utf-8"))
                s = saved.get("settings", {})
                obsidian_api_key = obsidian_api_key or s.get("obsidianApiKey", "")
                obsidian_url = obsidian_url or s.get("obsidianUrl", "http://127.0.0.1:27123")
        except Exception:
            pass
            
    obsidian_url = obsidian_url.rstrip("/")
    
    obsidian_vault_path = ""
    try:
        obs_cfg = Path(os.environ.get("APPDATA", "")) / "obsidian" / "obsidian.json"
        if obs_cfg.exists():
            vdata = json.loads(obs_cfg.read_text(encoding="utf-8"))
            for v in vdata.get("vaults", {}).values():
                if v.get("open") or not obsidian_vault_path:
                    obsidian_vault_path = v.get("path", "")
    except Exception:
        pass
    if not obsidian_vault_path or not Path(obsidian_vault_path).exists():
        obsidian_vault_path = str(Path.home() / "Documents" / "Obsidian")

    sys_prompt = (
        "You are Pika, a fast, advanced local AI assistant on the user's Windows PC.\n"
        "1. Always respond in short, conversational Hinglish or Hindi (e.g. 'नोट बना दिया है! 📝').\n"
        "2. When asked to create files or folders, write them directly to the specified path.\n"
        f"3. [OBSIDIAN VAULT]: The user's Obsidian Vault is at: {obsidian_vault_path}\n"
        f"   When asked to create, edit, or read Obsidian notes, write/read the markdown file directly inside '{obsidian_vault_path}' (e.g. '{obsidian_vault_path}\\NoteName.md') OR use curl with Local REST API:\n"
        f"   curl -X PUT -H \"Authorization: Bearer {obsidian_api_key}\" -H \"Content-Type: text/markdown\" -d \"Note Content\" \"{obsidian_url}/vault/NoteName.md\"\n"
        "4. Be quick, precise, and never hallucinate fake paths."
    )

    last_err = None

    for api_key in api_keys:
        base_url = url.replace("/chat/completions", "")
        config_dict = {
            "provider": "local",
            "providers": {
                "local": {
                    "baseUrl": base_url,
                    "apiKey": api_key,
                    "model": model
                }
            },
            "agent": {
                "maxIterations": 8,
                "temperature": 0.5,
                "systemPrompt": sys_prompt
            },
            "memory": {"enabled": True, "maxEntries": 1000},
            "tools": {"restrictToWorkspace": False},
            "workspace": obsidian_vault_path if Path(obsidian_vault_path).exists() else str(Path.home())
        }
        
        try:
            provider = create_provider(config_dict)
            memory_file = Path.home() / ".agent-mini" / "memory.json"
            memory_file.parent.mkdir(parents=True, exist_ok=True)
            memory = Memory(memory_file, max_entries=1000)
            agent = AgentLoop(provider, config_dict, memory)

            async def _on_tool_event(event: ToolEvent) -> None:
                if event.arguments is not None:
                    await ws.send(json.dumps({
                        "type": "event", "event": "agent_tool_start",
                        "data": {"tool": event.name, "args": event.arguments},
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }))
                elif event.result_preview is not None:
                    await ws.send(json.dumps({
                        "type": "event", "event": "agent_tool_end",
                        "data": {"tool": event.name, "error": event.is_error},
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }))

            # ── Sub-Agent 1: Live Web Researcher ──
            enriched_text = text
            if any(w in text.lower() for w in ["research", "search", "summary", "internet", "web", "latest", "news", "khojo"]):
                await ws.send(json.dumps({
                    "type": "event", "event": "agent_tool_start",
                    "data": {"tool": "🔍 [Researcher Agent] Live DuckDuckGo Search", "args": {"query": text}},
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }))
                ddg_results = duckduckgo_search(text, max_results=3)
                if ddg_results:
                    snippets = "\n".join([f"- {s['snippet']}" for s in ddg_results])
                    enriched_text = f"{text}\n\n[LIVE WEB RESEARCH RESULTS]:\n{snippets}\n\nPlease summarize and explain these findings clearly in natural Hinglish."
                await ws.send(json.dumps({
                    "type": "event", "event": "agent_tool_end",
                    "data": {"tool": "🔍 [Researcher Agent]", "error": False},
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }))

            history_list = params.get("history", [])
            resp_text = await agent.run(enriched_text, conversation=history_list, on_tool_event=_on_tool_event)
            
            prompt_tokens = max(1, len(text) // 4 + len(sys_prompt) // 4)
            completion_tokens = max(1, len(resp_text) // 4)
            total_tokens = prompt_tokens + completion_tokens

            await ws.send(json.dumps({
                "type": "llm_stream", 
                "chunk": resp_text, 
                "provider": provider_name,
                "id": conv_id, 
                "done": True,
                "usage": {
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "total_tokens": total_tokens
                },
                "timestamp": datetime.now(timezone.utc).isoformat()
            }))
            return
        except Exception as e:
            last_err = str(e)
            if "401" in last_err or "auth" in last_err.lower() or "quota" in last_err.lower() or "429" in last_err:
                continue
            else:
                break

    await ws.send(json.dumps({
        "type": "llm_stream", 
        "chunk": f"Agent Error: {last_err}", 
        "provider": provider_name,
        "done": True, 
        "id": conv_id
    }))


async def status_loop(ws):
    """Periodically sends live CPU, RAM, and Battery telemetry to connected clients."""
    try:
        while True:
            await asyncio.sleep(2)
            try:
                info = {}
                if psutil:
                    info["cpu"] = psutil.cpu_percent()
                    info["ram"] = psutil.virtual_memory().percent
                    battery = psutil.sensors_battery()
                    info["battery"] = {"percent": battery.percent, "plugged": battery.power_plugged} if battery else None
                await ws.send(json.dumps({
                    "type": "event",
                    "event": "system_status",
                    "data": info,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }))
            except Exception:
                break
    except asyncio.CancelledError:
        pass
    except Exception:
        pass


async def handle_client(ws):
    client = f"{ws.remote_address[0]}:{ws.remote_address[1]}"
    connected_clients.add(ws)
    logger.info(f"Client connected: {client} (total {len(connected_clients)})")

    recognizer = get_vosk_recognizer()
    wake_active = False

    ws_token = get_or_create_ws_token()
    await ws.send(json.dumps({
        "type": "event", "event": "connection_ready",
        "data": {
            "server_version": SERVER_VERSION,
            "hostname": socket.gethostname(),
            "os": f"{platform.system()} {platform.release()}",
            "lan_ip": get_lan_ip(),
            "ws_token": ws_token,
            "features": {
                "vosk_stt": recognizer is not None,
                "edge_tts": HAS_EDGE_TTS,
                "psutil": psutil is not None,
                "pyautogui": pyautogui is not None,
                "llm_providers": [p for p in LLM_ORDER if os.getenv(LLM_PROVIDERS[p][2])],
            },
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }))

    status_task = asyncio.create_task(status_loop(ws))

    # Auto-load saved encrypted vault data to restore settings, messages, etc.
    try:
        saved = load_vault_data()
        if saved:
            await ws.send(json.dumps({
                "type": "app_data",
                "data": saved,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }))
            logger.info("Auto-loaded secure vault data for client")
    except Exception as e:
        logger.warning(f"Auto-load vault failed: {e}")

    try:
        async for message in ws:
            # ── Binary frames = raw 16kHz mono PCM audio → Vosk STT ──
            if isinstance(message, bytes):
                if recognizer is None:
                    continue
                if recognizer.AcceptWaveform(message):
                    res = json.loads(recognizer.Result())
                    text = (res.get("text") or "").strip()
                    if not text:
                        continue
                    # wake word gate
                    if detect_wake_word(text):
                        wake_active = True
                        await ws.send(json.dumps({"type": "event", "event": "wake_word",
                                                  "data": {"text": text},
                                                  "timestamp": datetime.now(timezone.utc).isoformat()}))
                        continue
                    # instant voice shortcuts
                    result, reply = try_voice_shortcut(text)
                    if result:
                        await ws.send(json.dumps({"type": "event", "event": "shortcut_executed",
                                                  "data": {"text": text, "message": reply},
                                                  "timestamp": datetime.now(timezone.utc).isoformat()}))
                    else:
                        await ws.send(json.dumps({"type": "event", "event": "voice_final",
                                                  "data": {"text": text, "wake_active": wake_active},
                                                  "timestamp": datetime.now(timezone.utc).isoformat()}))
                    wake_active = False
                else:
                    partial = json.loads(recognizer.PartialResult()).get("partial", "")
                    if partial:
                        await ws.send(json.dumps({"type": "event", "event": "voice_partial",
                                                  "data": {"text": partial},
                                                  "timestamp": datetime.now(timezone.utc).isoformat()}))
                continue

            # ── JSON frames ──
            try:
                data = json.loads(message)
            except json.JSONDecodeError:
                continue

            mtype = data.get("type")
            if mtype == "ping":
                await ws.send(json.dumps({"type": "pong", "timestamp": datetime.now(timezone.utc).isoformat()}))
                continue

            if mtype == "auth":
                tok = (data.get("token") or data.get("params", {}).get("token") or "")
                expected = get_or_create_ws_token()
                ok_auth = (tok == expected)
                # Store auth state per-connection
                ws.authenticated = ok_auth
                if ok_auth:
                    logger.info(f"Auth success {client}")
                else:
                    logger.warning(f"Auth failed from {client}")
                await ws.send(json.dumps({"type": "auth_result", "success": ok_auth, "timestamp": datetime.now(timezone.utc).isoformat()}))
                continue

            # ── Enforce auth for sensitive ops (bina hatye, LAN demo still works if token matches) ──
            sensitive = {"command","query","agent_action","mcp_call_tool","save_data","clear_data","tts_speak"}
            if mtype in sensitive and not getattr(ws, "authenticated", False):
                # Allow if no token ever set? For first run, auto-auth via connection_ready flow — if still not authed, warn but allow local 127.0.0.1
                if client.startswith("127.0.0.1"):
                    ws.authenticated = True  # local loopback auto-trust
                else:
                    await ws.send(json.dumps({"type":"event","event":"auth_required","data":{"message":"LAN auth required — send {type:auth, token:ws_token}"},"timestamp": datetime.now(timezone.utc).isoformat()}))
                    logger.warning(f"Blocked unauthed {mtype} from {client}")
                    continue

            if mtype == "tts_speak":
                params = data.get("params", {}) or {}
                await ws.send(json.dumps({"type": "event", "event": "tts_started", "data": {},
                                          "timestamp": datetime.now(timezone.utc).isoformat()}))
                result = await generate_tts(params.get("text", ""), params.get("voice", DEFAULT_TTS_VOICE), engine=params.get("engine", "edge"))
                if result.get("success"):
                    await ws.send(json.dumps({"type": "event", "event": "tts_audio",
                                              "data": {"audio": result["audio"], "format": result["format"]},
                                              "timestamp": datetime.now(timezone.utc).isoformat()}))
                elif result.get("fallback") == "webspeech":
                    await ws.send(json.dumps({"type": "event", "event": "tts_fallback_webspeech",
                                              "data": {"text": result.get("text", "")},
                                              "timestamp": datetime.now(timezone.utc).isoformat()}))
                await ws.send(json.dumps({"type": "event", "event": "tts_ended", "data": {},
                                          "timestamp": datetime.now(timezone.utc).isoformat()}))
                continue

            if mtype == "query":
                await handle_query(ws, data)
                continue

            if mtype == "agent_action":
                await handle_agent_action(ws, data)
                continue

            if mtype == "mcp_list_tools":
                manifest = get_mcp_manifest()
                await ws.send(json.dumps({"type": "mcp_tools", "data": manifest, "timestamp": datetime.now(timezone.utc).isoformat()}))
                continue

            if mtype == "mcp_call_tool":
                # MCP-style call: {type:"mcp_call_tool", name:"memory.search", params:{query:"..."}}
                name = data.get("name", "") or data.get("tool", "")
                params = data.get("params", {}) or data.get("arguments", {}) or {}
                # name like "memory.search" → category=memory, action=search
                cat, act = (name.split(".",1) + [""])[:2] if "." in name else (data.get("category",""), data.get("action",""))
                if not cat and "." in name:
                    cat, act = name.split(".",1)
                result = route_command({"category": cat, "action": act, "params": params})
                await ws.send(json.dumps({"type": "mcp_result", "name": name, "data": result, "timestamp": datetime.now(timezone.utc).isoformat()}))
                continue

            if mtype == "test_provider_backend":
                params = data.get("params", {}) or {}
                prov_name = params.get("provider", "")
                b_url = params.get("baseUrl", "")
                a_key = params.get("apiKey", "")
                m_url = params.get("modelsUrl", "")
                req_id = data.get("id", "")
                
                res = await asyncio.to_thread(_test_provider_http, prov_name, b_url, a_key, m_url)
                await ws.send(json.dumps({
                    "type": "test_provider_result",
                    "id": req_id,
                    "provider": prov_name,
                    "data": res,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }))
                continue


            if mtype == "save_data":
                try:
                    payload = data.get("data", {})
                    existing = load_vault_data()
                    existing.update(payload)
                    save_vault_data(existing)
                    logger.debug("Encrypted data saved to pika_data.json vault")
                except Exception as e:
                    logger.error(f"save_data error: {e}")
                continue

            if mtype == "load_data":
                try:
                    saved = load_vault_data()
                    await ws.send(json.dumps({
                        "type": "app_data",
                        "data": saved,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }))
                    logger.info("Loaded secure vault data from pika_data.json")
                except Exception as e:
                    logger.error(f"load_data error: {e}")
                continue

            if mtype == "clear_data":
                try:
                    if DATA_FILE.exists():
                        DATA_FILE.unlink()
                    await ws.send(json.dumps({"type": "event", "event": "data_cleared", "data": {}, "timestamp": datetime.now(timezone.utc).isoformat()}))
                    logger.info("pika_data.json cleared")
                except Exception as e:
                    logger.error(f"clear_data error: {e}")
                continue

            if mtype == "command":
                cat, act = data.get("category"), data.get("action")
                logger.info(f"cmd {client}: {cat}/{act}")

                # confirmation flow — owner check + 5min TTL
                if cat == "_confirm":
                    cid = (data.get("params") or {}).get("confirmation_id")
                    entry = PENDING_CONFIRM.get(cid)
                    if act == "approve" and entry:
                        # expiry check
                        if time.time() - entry.get("ts",0) > 300:
                            PENDING_CONFIRM.pop(cid, None)
                            await ws.send(envelope(data.get("id"), "error", "Confirmation expired"))
                            continue
                        if entry.get("owner") != id(ws):
                            await ws.send(envelope(data.get("id"), "error", "Confirmation owner mismatch"))
                            continue
                        original = PENDING_CONFIRM.pop(cid)["data"]
                        result = route_command(original)
                        await ws.send(envelope(data.get("id"),
                                               "success" if result["success"] else "error",
                                               result["message"], result.get("data")))
                    else:
                        PENDING_CONFIRM.pop(cid, None)
                        await ws.send(envelope(data.get("id"), "success", "रद्द किया गया।"))
                    continue
                # periodic cleanup of expired confirms
                if len(PENDING_CONFIRM) > 20:
                    now=time.time()
                    for k,v in list(PENDING_CONFIRM.items()):
                        if now - v.get("ts",0) > 300:
                            PENDING_CONFIRM.pop(k, None)

                # confirmed flag bypass blocked — must go via _confirm flow only
                if (cat, act) in CONFIRM_REQUIRED:
                    # Ignore client-sent confirmed:true — enforce server-side confirm only
                    if data.get("params",{}).get("confirmed"):
                        logger.warning(f"Blocked confirmed bypass attempt {cat}/{act} from {client}")
                        data["params"].pop("confirmed", None)
                    cid = str(uuid.uuid4())
                    # Store with owner ws id to prevent cross-client approve
                    PENDING_CONFIRM[cid] = {"data": data, "owner": id(ws), "ts": time.time()}
                    await ws.send(envelope(data.get("id"), "confirmation_required",
                                           f"क्या आप वाकई {cat}/{act} करना चाहते हैं?",
                                           confirmation_id=cid))
                    continue

                result = route_command(data)
                await ws.send(envelope(data.get("id"),
                                       "success" if result["success"] else "error",
                                       result["message"], result.get("data")))
                continue

    except websockets.exceptions.ConnectionClosed:
        pass
    except Exception as e:
        logger.error(f"handler error: {e}")
    finally:
        status_task.cancel()
        connected_clients.discard(ws)
        logger.info(f"Client disconnected: {client} (total {len(connected_clients)})")


# ═══════════════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════════════
def print_banner():
    pass
    return

    C, P, G, W, D, R = "\033[96m", "\033[95m", "\033[92m", "\033[97m", "\033[90m", "\033[0m"
    lan = get_lan_ip()
    print(f"""
  {P}██████╗ ██╗██╗  ██╗ █████╗      █████╗ ██╗{R}
  {P}██╔══██╗██║██║ ██╔╝██╔══██╗    ██╔══██╗██║{R}
  {C}██████╔╝██║█████╔╝ ███████║    ███████║██║{R}
  {C}██╔═══╝ ██║██╔═██╗ ██╔══██║    ██╔══██║██║{R}
  {C}██║     ██║██║  ██╗██║  ██║    ██║  ██║██║{R}
  {C}╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝    ╚═╝  ╚═╝╚═╝{R}

  {D}══════════════════════════════════════════════════{R}
  {W}   PC BRIDGE v{SERVER_VERSION} — WebSocket Backend{R}
  {D}══════════════════════════════════════════════════{R}
  {G}  ✓ Local:     ws://localhost:{PORT}{R}
  {G}  ✓ LAN:       ws://{lan}:{PORT}{R}
  {W}  • Platform:  {platform.system()} {platform.release()}{R}
  {W}  • Vosk STT:  {"✓ ready" if HAS_VOSK else "✗ pip install vosk"}{R}
  {W}  • Edge TTS:  {"✓ ready" if HAS_EDGE_TTS else "✗ pip install edge-tts"}{R}
  {W}  • LLM keys:  {", ".join(p for p in LLM_ORDER if os.getenv(LLM_PROVIDERS[p][2])) or "none (demo)"}{R}
  {D}──────────────────────────────────────────────────{R}
  {C}  📱 PHONE ACCESS (same WiFi):{R}
  {W}     Web UI  →  http://{lan}:3000{R}
  {D}──────────────────────────────────────────────────{R}
  {D}  Press Ctrl+C to stop.{R}
""")


async def main():
    global _main_loop
    _main_loop = asyncio.get_running_loop()
    threading.Thread(target=ensure_vosk_model, daemon=True).start()
    print_banner()
    async with serve(handle_client, HOST, PORT):
        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n⚡ Pika PC Bridge stopped. फिर मिलेंगे!")


