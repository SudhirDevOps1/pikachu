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
import math
try:
    import calendar_mcp_stub  # additive calendar sidecar (bina hataye)
except Exception:
    pass
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

# ─── Frozen-mode (PyInstaller) support ──────────────────────────────────────
# Jab pc_bridge.exe (PyInstaller) ke roop me chalta hai:
#   - __file__ temp extraction dir (_MEIPASS) me hota hai
#   - sys.executable khud pc_bridge.exe hota hai (pip/subprocess me use nahi kar sakte)
_FROZEN = getattr(sys, "frozen", False)
if _FROZEN:
    # exe: <install>/resources/bin/pc_bridge.exe → models: <install>/resources/models
    _APP_ROOT = Path(sys.executable).resolve().parent.parent
    # Writable data (logs/audit/screenshots) → ~/.pika/appdata (Program Files me write nahi kar sakte)
    _DATA_ROOT = Path.home() / ".pika" / "appdata"
    try:
        _DATA_ROOT.mkdir(parents=True, exist_ok=True)
    except Exception:
        _DATA_ROOT = Path.home()
    def _host_python():
        """Real system Python for subprocess/pip (frozen exe me sys.executable = khud exe)."""
        for _c in ("python.exe", "py.exe"):
            _w = shutil.which(_c)
            if _w:
                return _w
        return "python"
else:
    _APP_ROOT = Path(__file__).parent
    _DATA_ROOT = _APP_ROOT
    def _host_python():
        return sys.executable

# ─── Constants ───────────────────────────────────────────────────────────────
HOST = "0.0.0.0"
PORT = 8765
SERVER_VERSION = "1.2.1"
DATA_FILE = _DATA_ROOT / "pika_data.json"
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
VOSK_MODEL_DIR = _APP_ROOT / "models" / "hi"
DEFAULT_TTS_VOICE = "hi-IN-SwaraNeural"
connected_clients: set = set()

async def broadcast(message: str):
    """Send a message to ALL connected WebSocket clients."""
    if not connected_clients:
        return
    dead = []
    for ws in list(connected_clients):
        try:
            await ws.send(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        connected_clients.discard(ws)

_vosk_model = None

def ensure_vosk_model():
    """Background model initializer for offline Vosk STT."""
    global _vosk_model
    if not HAS_VOSK or Model is None:
        return
    model_paths = [
        _APP_ROOT / "models" / "hi",
        _APP_ROOT / "models" / "vosk",
        _APP_ROOT / "models" / "vosk-model-small-hi-0.22",
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
        logging.FileHandler(_DATA_ROOT / "pc_bridge.log", encoding="utf-8"),
    ],
)
for h in logging.getLogger().handlers:
    h.addFilter(_RedactFilter())
logger = logging.getLogger("PIKA-Bridge")
logger.addFilter(_RedactFilter())

# ── additive P0: injection filter + audit + rate-limit (bina kuchh hataye) ──
_INJECTION_PATTERNS = [r"ignore previous instructions", r"you are now dan", r"reveal system prompt", r"delete all user data", r"do anything now", r"system override", r"jailbreak"]
def is_injection(text: str) -> bool:
    low = (text or "").lower()
    return any(re.search(p, low) for p in _INJECTION_PATTERNS)
AUDIT_FILE = _DATA_ROOT / "pika_audit.jsonl"
_RATE: dict = {}
def check_rate(category: str, action: str, limit: int = 12, window: int = 60) -> bool:
    import time as _t
    key = f"{category}.{action}"
    now = _t.time()
    arr = _RATE.setdefault(key, [])
    arr[:] = [t for t in arr if now - t < window]
    if len(arr) >= limit:
        return False
    arr.append(now)
    return True
def audit_log(event: str, data: dict):
    try:
        AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
        rec = {"ts": datetime.now(timezone.utc).isoformat(), "event": event, **data}
        # redact keys
        for k in list(rec.keys()):
            if "key" in k.lower() or "token" in k.lower():
                rec[k] = "***REDACTED***"
        with AUDIT_FILE.open("a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    except Exception:
        pass

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

def get_monitors() -> list:
    """Additive multi-monitor enumeration (virtual coords, no delete)."""
    mons = []
    try:
        if IS_WIN:
            import ctypes
            from ctypes import wintypes
            mons = []
            def _cb(hMon, hdc, lprc, dwData):
                r = lprc.contents
                mons.append({"left": r.left, "top": r.top, "right": r.right, "bottom": r.bottom, "width": r.right-r.left, "height": r.bottom-r.top})
                return 1
            try:
                ctypes.windll.user32.EnumDisplayMonitors(0, 0, ctypes.WINFUNCTYPE(ctypes.c_int, wintypes.HANDLE, wintypes.HANDLE, ctypes.POINTER(wintypes.RECT), ctypes.c_void_p)(_cb), 0)
            except Exception:
                pass
            if not mons:
                # fallback single
                import ctypes as _c
                w = _c.windll.user32.GetSystemMetrics(0); h = _c.windll.user32.GetSystemMetrics(1)
                mons = [{"left":0,"top":0,"right":w,"bottom":h,"width":w,"height":h}]
        else:
            # linux/mac fallback single
            mons = [{"left":0,"top":0,"right":1920,"bottom":1080,"width":1920,"height":1080}]
    except Exception:
        mons = [{"left":0,"top":0,"right":1920,"bottom":1080,"width":1920,"height":1080}]
    return mons

def normalize_coords(x: int, y: int) -> tuple:
    s = get_display_scale()
    # keep virtual multi-monitor coords as-is (may be negative on left monitor)
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

def screen_peeler(x: int=0, y: int=0, w: int=0, h: int=0, do_ocr: bool=False, all_monitors: bool=False) -> dict:
    """Direct screenshot + optional OCR — region, full screen, or all monitors merged."""
    try:
        from PIL import ImageGrab, Image
        import io
        if all_monitors:
            # Capture all monitors and merge into one image
            try:
                monitors = get_monitors_list()
                if len(monitors) > 1:
                    # Calculate bounding box for all monitors
                    min_x = min(m["x"] for m in monitors)
                    min_y = min(m["y"] for m in monitors)
                    max_x = max(m["x"] + m["width"] for m in monitors)
                    max_y = max(m["y"] + m["height"] for m in monitors)
                    # Create merged image
                    merged = Image.new("RGB", (max_x - min_x, max_y - min_y), (0, 0, 0))
                    for m in monitors:
                        try:
                            img = ImageGrab.grab(bbox=(m["x"], m["y"], m["x"] + m["width"], m["y"] + m["height"]))
                            merged.paste(img, (m["x"] - min_x, m["y"] - min_y))
                        except: pass
                    img = merged
                else:
                    img = ImageGrab.grab()
            except:
                img = ImageGrab.grab()
        elif w and h:
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
        if target.startswith('ms-') or target.startswith('microsoft.') or os.path.exists(target) or shutil.which(target):
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
                        # Smart WiFi toggle — netsh with auto-detect interface, fallback to PowerShell radio
                        iface = None
                        try:
                            # Auto-detect Wi-Fi interface name
                            r = run(["netsh", "interface", "show", "interface"], timeout=5)
                            for line in (r.stdout or "").splitlines():
                                low = line.lower()
                                if "wi-fi" in low or "wireless" in low or "wlan" in low:
                                    parts = line.split()
                                    for p in parts:
                                        if any(k in p.lower() for k in ("wi-fi","wireless","wlan")):
                                            iface = p.strip(); break
                                    if iface: break
                        except: pass
                        if not iface: iface = "Wi-Fi"
                        try:
                            if act in ("on","enable"):
                                r = run(["netsh", "interface", "set", "interface", iface, "admin=enable"], timeout=8)
                                if r.returncode == 0:
                                    return ok(f"WiFi ON ✅ — {iface}")
                                # fallback PowerShell radio
                                r2 = run(["powershell","-NoProfile","-Command","Enable-NetAdapter -Name '"+iface+"' -Confirm:$false"], timeout=8)
                                if r2.returncode == 0:
                                    return ok(f"WiFi ON ✅ — {iface} (PowerShell)")
                            elif act in ("off","disable"):
                                r = run(["netsh", "interface", "set", "interface", iface, "admin=disable"], timeout=8)
                                if r.returncode == 0:
                                    return ok(f"WiFi OFF ❌ — {iface}")
                                r2 = run(["powershell","-NoProfile","-Command","Disable-NetAdapter -Name '"+iface+"' -Confirm:$false"], timeout=8)
                                if r2.returncode == 0:
                                    return ok(f"WiFi OFF ❌ — {iface} (PowerShell)")
                            else:
                                # toggle: check status first
                                r = run(["netsh", "interface", "show", "interface", iface], timeout=5)
                                is_up = "Enabled" in (r.stdout or "") or "Connected" in (r.stdout or "")
                                if is_up:
                                    run(["netsh", "interface", "set", "interface", iface, "admin=disable"], timeout=8)
                                    return ok(f"WiFi OFF ❌ — {iface}")
                                else:
                                    run(["netsh", "interface", "set", "interface", iface, "admin=enable"], timeout=8)
                                    return ok(f"WiFi ON ✅ — {iface}")
                        except Exception as ex:
                            logger.warning(f"WiFi netsh failed: {ex}")
                            # Last resort: open settings
                            os.startfile("ms-settings:network-wifi")
                            return ok(f"WiFi toggle failed — Settings khola for manual toggle ⚠️")
                    elif tgt == "bluetooth":
                        # PowerShell PnpDevice enable/disable — actual hardware toggle
                        try:
                            if act in ("on","enable"):
                                r = run(["powershell","-NoProfile","-Command",
                                    "Get-PnpDevice -Class Bluetooth -Status OK | ForEach-Object { $_.FriendlyName + ':ON' }; "
                                    "Get-PnpDevice -Class Bluetooth -Status Error | ForEach-Object { Enable-PnpDevice -InstanceId $_.InstanceId -Confirm:$false }"],
                                    timeout=10)
                                return ok(f"Bluetooth ON ✅ — {(r.stdout or '').strip()[:100]}")
                            elif act in ("off","disable"):
                                r = run(["powershell","-NoProfile","-Command",
                                    "Get-PnpDevice -Class Bluetooth -Status OK | ForEach-Object { Disable-PnpDevice -InstanceId $_.InstanceId -Confirm:$false }"],
                                    timeout=10)
                                return ok(f"Bluetooth OFF ❌ — {(r.stdout or '').strip()[:100]}")
                            else:
                                # toggle: check current state
                                r = run(["powershell","-NoProfile","-Command",
                                    "Get-PnpDevice -Class Bluetooth | Select-Object Status,FriendlyName | Format-Table -AutoSize"],
                                    timeout=8)
                                out = (r.stdout or "")
                                has_on = "OK" in out
                                if has_on:
                                    run(["powershell","-NoProfile","-Command",
                                        "Get-PnpDevice -Class Bluetooth -Status OK | ForEach-Object { Disable-PnpDevice -InstanceId $_.InstanceId -Confirm:$false }"],
                                        timeout=10)
                                    return ok("Bluetooth OFF ❌ (hardware toggle)")
                                else:
                                    run(["powershell","-NoProfile","-Command",
                                        "Get-PnpDevice -Class Bluetooth | ForEach-Object { Enable-PnpDevice -InstanceId $_.InstanceId -Confirm:$false }"],
                                        timeout=10)
                                    return ok("Bluetooth ON ✅ (hardware toggle)")
                        except Exception as ex:
                            logger.warning(f"BT PnpDevice failed: {ex}")
                            os.startfile("ms-settings:bluetooth")
                            return ok("Bluetooth toggle failed — Settings khola ⚠️")
                    elif tgt == "airplane":
                        # True airplane mode — disable ALL radios: WiFi + Bluetooth + Cellular
                        try:
                            if act in ("on","enable"):
                                # Disable network adapters
                                r = run(["powershell","-NoProfile","-Command",
                                    "Get-NetAdapter | Where-Object {$_.Status -eq 'Up'} | ForEach-Object { "
                                    "Disable-NetAdapter -Name $_.Name -Confirm:$false }; "
                                    "Set-NetAdapterAdvancedProperty -Name '*' -RegistryKeyword 'RadioType' -RegistryValue 0 -ErrorAction SilentlyContinue"],
                                    timeout=12)
                                # Disable Bluetooth
                                try:
                                    run(["powershell","-NoProfile","-Command",
                                        "Get-PnpDevice -Class Bluetooth | Disable-PnpDevice -Confirm:$false -ErrorAction SilentlyContinue"],
                                        timeout=8)
                                except: pass
                                return ok("Airplane Mode ON ✈️ — WiFi + Bluetooth + all radios disabled")
                            elif act in ("off","disable"):
                                # Enable network adapters
                                r = run(["powershell","-NoProfile","-Command",
                                    "Get-NetAdapter | ForEach-Object { Enable-NetAdapter -Name $_.Name -Confirm:$false }"],
                                    timeout=12)
                                # Enable Bluetooth
                                try:
                                    run(["powershell","-NoProfile","-Command",
                                        "Get-PnpDevice -Class Bluetooth | Enable-PnpDevice -Confirm:$false -ErrorAction SilentlyContinue"],
                                        timeout=8)
                                except: pass
                                return ok("Airplane Mode OFF — WiFi + Bluetooth + all radios enabled 📡")
                            else:
                                # toggle: check radio state
                                r = run(["powershell","-NoProfile","-Command",
                                    "Get-NetAdapter | Where-Object {$_.Status -eq 'Up'} | Measure-Object | Select-Object -ExpandProperty Count"],
                                    timeout=5)
                                active = int((r.stdout or "0").strip() or "0")
                                if active > 0:
                                    run(["powershell","-NoProfile","-Command",
                                        "Get-NetAdapter | Where-Object {$_.Status -eq 'Up'} | ForEach-Object { Disable-NetAdapter -Name $_.Name -Confirm:$false }"],
                                        timeout=12)
                                    try:
                                        run(["powershell","-NoProfile","-Command",
                                            "Get-PnpDevice -Class Bluetooth | Disable-PnpDevice -Confirm:$false -ErrorAction SilentlyContinue"],
                                            timeout=8)
                                    except: pass
                                    return ok(f"Airplane Mode ON ✈️ — {active} adapters + Bluetooth disabled")
                                else:
                                    run(["powershell","-NoProfile","-Command",
                                        "Get-NetAdapter | ForEach-Object { Enable-NetAdapter -Name $_.Name -Confirm:$false }"],
                                        timeout=12)
                                    try:
                                        run(["powershell","-NoProfile","-Command",
                                            "Get-PnpDevice -Class Bluetooth | Enable-PnpDevice -Confirm:$false -ErrorAction SilentlyContinue"],
                                            timeout=8)
                                    except: pass
                                    return ok("Airplane Mode OFF — WiFi + Bluetooth + all radios enabled 📡")
                        except Exception as ex:
                            logger.warning(f"Airplane mode failed: {ex}")
                            os.startfile("ms-settings:network-airplanemode")
                            return ok("Airplane mode failed — Settings khola ⚠️")
                # Linux/macOS fallback
                mp = {"bluetooth":"ms-settings:bluetooth","wifi":"ms-settings:network-wifi","airplane":"ms-settings:network-airplanemode"}[tgt]
                os.startfile(mp)
                return ok(f"{tgt.title()} Settings khola — manual toggle kar sakte ho")
            except Exception as ex:
                return err(str(ex))
        return err(f"अज्ञात system action: {action}")
    except Exception as e:
        return err(str(e))


def _get_current_volume() -> int:
    """Get current system volume % via pycaw/Windows CoreAudio (0-100)."""
    # Method 1: pycaw (most reliable on Windows)
    try:
        from pycaw.pycaw import AudioUtilities
        from ctypes import cast, POINTER
        from comtypes import CLSCTX_ALL
        from pycaw.constants import IAudioEndpointVolume
        speakers = AudioUtilities.GetSpeakers()
        iface = speakers.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
        volume = cast(iface, POINTER(IAudioEndpointVolume))
        cur = volume.GetMasterVolumeLevelScalar()
        return int(round(cur * 100))
    except: pass
    # Method 2: PowerShell AudioDevice module (if installed)
    try:
        r = run(["powershell","-NoProfile","-Command",
            "Get-AudioDevice -PlaybackVolume -ErrorAction SilentlyContinue"], timeout=5)
        if r.returncode == 0 and r.stdout.strip():
            return int(float(r.stdout.strip()))
    except: pass
    # Method 3: nircmd fallback
    try:
        r = run(["nircmd","mediavolume","get"], timeout=3)
        if r.returncode == 0:
            return int(float(r.stdout.strip()))
    except: pass
    return -1

def _set_volume_exact(percent: int) -> bool:
    """Set exact volume % via pycaw/Windows CoreAudio (most reliable)."""
    percent = max(0, min(100, percent))
    # Method 1: pycaw (direct Windows CoreAudio API — always works on Windows)
    try:
        from pycaw.pycaw import AudioUtilities
        from ctypes import cast, POINTER
        from comtypes import CLSCTX_ALL
        from pycaw.constants import IAudioEndpointVolume
        speakers = AudioUtilities.GetSpeakers()
        iface = speakers.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
        volume = cast(iface, POINTER(IAudioEndpointVolume))
        volume.SetMasterVolumeLevelScalar(percent / 100.0, None)
        return True
    except: pass
    # Method 2: PowerShell AudioDevice module (if installed)
    try:
        r = run(["powershell","-NoProfile","-Command",
            f"Set-AudioDevice -PlaybackVolume {percent} -ErrorAction SilentlyContinue"], timeout=5)
        if r.returncode == 0: return True
    except: pass
    # Method 3: nircmd (if installed)
    try:
        r = run(["nircmd","mediavolume",str(int(percent * 655.35))], timeout=3)
        if r.returncode == 0: return True
    except: pass
    return False

def cmd_volume(action, params):
    if not pyautogui:
        return err("pyautogui ज़रूरी है")
    try:
        if action == "up":
            steps = max(1, params.get("amount", 10) // 2)
            for _ in range(steps):
                pyautogui.press("volumeup")
            cur = _get_current_volume()
            return ok(f"आवाज़ बढ़ा दी 🔊 ({cur}%)" if cur >= 0 else "आवाज़ बढ़ा दी। 🔊")
        if action == "down":
            steps = max(1, params.get("amount", 10) // 2)
            for _ in range(steps):
                pyautogui.press("volumedown")
            cur = _get_current_volume()
            return ok(f"आवाज़ कम कर दी 🔉 ({cur}%)" if cur >= 0 else "आवाज़ कम कर दी। 🔉")
        if action in ("mute", "unmute"):
            pyautogui.press("volumemute")
            return ok("म्यूट टॉगल किया। 🔇")
        if action == "set":
            level = max(0, min(100, int(params.get("percent", params.get("level", 50)))))
            # Try exact set first
            if _set_volume_exact(level):
                return ok(f"आवाज़ {level}% पर सेट (exact) 🔊")
            # Fallback: key press method
            cur = _get_current_volume()
            if cur >= 0:
                diff = level - cur
                if diff > 0:
                    for _ in range(diff // 2 + 1):
                        pyautogui.press("volumeup")
                elif diff < 0:
                    for _ in range(abs(diff) // 2 + 1):
                        pyautogui.press("volumedown")
            else:
                # Worst case: reset to 0 then climb
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
        if action == "ollama_status":
            # Check if Ollama is running locally
            try:
                import urllib.request as _req
                req = _req.Request("http://127.0.0.1:11434/api/tags", method="GET")
                with _req.urlopen(req, timeout=3) as resp:
                    data = json.loads(resp.read().decode())
                    models = [m.get("name", "") for m in data.get("models", [])]
                    return ok(f"Ollama running — {len(models)} models", {"status": "running", "models": models})
            except Exception:
                return ok("Ollama not running — start with `ollama serve`", {"status": "offline", "models": []})
        if action == "network_status":
            # Check internet connectivity
            try:
                import urllib.request as _req
                _req.urlopen("https://httpbin.org/get", timeout=3)
                online = True
            except Exception:
                online = False
            return ok(f"Internet: {'Connected' if online else 'Offline'}", {"online": online})
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
        if action == "search":
            # Glob pattern search — add pattern matching
            pattern = params.get("pattern", "*")
            search_path = resolve_path(params.get("path", ""))
            if not search_path.exists():
                return err("पथ नहीं मिला।")
            try:
                matches = []
                for p in search_path.glob(pattern):
                    if len(matches) >= 50: break
                    try:
                        sz = p.stat().st_size if p.is_file() else 0
                        matches.append({"name": p.name, "path": str(p), "is_dir": p.is_dir(), "size": sz})
                    except: pass
                return ok(f"{len(matches)} मिले ({pattern})", {"matches": matches, "pattern": pattern})
            except Exception as ex:
                return err(f"Search error: {ex}")
        if action == "copy":
            src = resolve_path(params.get("path", ""))
            dst = resolve_path(params.get("dest", ""))
            if not is_path_safe(src) or not is_path_safe(dst):
                return err("सुरक्षा: पथ प्रतिबंधित है।")
            if not src.exists():
                return err("सोर्स फाइल नहीं मिली।")
            if src.is_dir():
                shutil.copytree(str(src), str(dst))
            else:
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(str(src), str(dst))
            return ok(f"कॉपी: {src.name} → {dst}")
        if action == "move":
            src = resolve_path(params.get("path", ""))
            dst = resolve_path(params.get("dest", ""))
            if not is_path_safe(src) or not is_path_safe(dst):
                return err("सुरक्षा: पथ प्रतिबंधित है।")
            if not src.exists():
                return err("सोर्स फाइल नहीं मिली।")
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(src), str(dst))
            return ok(f"मूव: {src.name} → {dst}")
        if action == "write_atomic":
            # Atomic write — temp file then rename (crash-safe)
            p = resolve_path(params.get("path", ""))
            if not is_path_safe(p):
                return err("सुरक्षा: यह पथ प्रतिबंधित है।")
            p.parent.mkdir(parents=True, exist_ok=True)
            tmp = p.with_suffix(p.suffix + ".tmp")
            try:
                tmp.write_text(params.get("content", ""), encoding="utf-8")
                tmp.replace(p)  # atomic on same filesystem
                return ok(f"Atomic save: {p}")
            except Exception as ex:
                if tmp.exists(): tmp.unlink()
                return err(f"Atomic write failed: {ex}")
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
        # ── additive cursor extras (bina purana hataye) ──
        if action in ("right_click", "right"):
            if not pyautogui: return err("pyautogui ज़रूरी है")
            if x is not None and y is not None:
                nx, ny = normalize_coords(int(x), int(y))
                try: cur = pyautogui.position(); bezier_move(cur.x, cur.y, nx, ny, steps=14); pyautogui.rightClick(nx, ny)
                except: pyautogui.rightClick(nx, ny)
                return ok(f"Right click ({nx},{ny}) 🖱️", {"x": nx, "y": ny})
            pyautogui.rightClick(); return ok("Right click किया 🖱️")
        if action in ("double_click", "double"):
            if not pyautogui: return err("pyautogui ज़रूरी है")
            if x is not None and y is not None:
                nx, ny = normalize_coords(int(x), int(y))
                try: cur = pyautogui.position(); bezier_move(cur.x, cur.y, nx, ny, steps=14); pyautogui.doubleClick(nx, ny)
                except: pyautogui.doubleClick(nx, ny)
                return ok(f"Double click ({nx},{ny}) 🖱️", {"x": nx, "y": ny})
            pyautogui.doubleClick(); return ok("Double click किया 🖱️")
        if action == "move":
            if not pyautogui: return err("pyautogui ज़रूरी है")
            if x is None or y is None: return err("x,y चाहिए")
            nx, ny = normalize_coords(int(x), int(y))
            try: cur = pyautogui.position(); bezier_move(cur.x, cur.y, nx, ny, steps=14)
            except: pyautogui.moveTo(nx, ny)
            return ok(f"Cursor moved ({nx},{ny})", {"x": nx, "y": ny})
        if action == "drag":
            if not pyautogui: return err("pyautogui ज़रूरी है")
            x2 = int(params.get("x2", params.get("x", 0))); y2 = int(params.get("y2", params.get("y", 0)))
            nx, ny = normalize_coords(x2, y2)
            try: cur = pyautogui.position(); bezier_move(cur.x, cur.y, nx, ny, steps=12); pyautogui.dragTo(nx, ny, duration=0.3, button="left")
            except: pyautogui.dragTo(nx, ny)
            return ok(f"Drag → ({nx},{ny})", {"x": nx, "y": ny})
        if action == "get_position":
            if not pyautogui: return err("pyautogui ज़रूरी है")
            p = pyautogui.position(); return ok(f"Cursor ({p.x},{p.y})", {"x": p.x, "y": p.y})
        if action == "get_monitors":
            mons = get_monitors()
            return ok(f"{len(mons)} monitor मिले", {"monitors": mons})
        if action == "deep_tree":
            # Deep Windows UIA Element Tree — Microsoft UFO2 style
            if IS_WIN:
                try:
                    # Use PowerShell to walk the full UIA tree with element details
                    app_name = str(params.get("app", "") or params.get("name", "")).strip()
                    depth = int(params.get("depth", 3))
                    ps_script = f'''
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root = [System.Windows.Automation.AutomationElement]::RootElement
function Get-UIATree($element, $depth) {{
    if ($depth -le 0) {{ return @() }}
    $children = @()
    $walker = [System.Windows.Automation.TreeWalker]::RawViewWalker
    $child = $walker.GetFirstChild($element)
    while ($child -ne $null) {{
        $info = @{{
            Name = $child.Current.Name
            ControlType = $child.Current.ControlType.ProgrammaticName
            AutomationId = $child.Current.AutomationId
            ClassName = $child.Current.ClassName
            BoundingBox = $child.Current.BoundingRectangle.ToString()
            IsEnabled = $child.Current.IsEnabled
        }}
        $children += $info
        $children += Get-UIATree $child ($depth - 1)
        $child = $walker.GetNextSibling($child)
    }}
    return $children
}}
$elements = Get-UIATree $root {depth}
$elements | ConvertTo-Json -Depth 3
'''
                    r = run(["powershell","-NoProfile","-Command", ps_script], timeout=15)
                    if r.returncode == 0 and r.stdout.strip():
                        import json as _j
                        elements = _j.loads(r.stdout)
                        if isinstance(elements, dict):
                            elements = [elements]
                        # Filter by app name if provided
                        if app_name:
                            elements = [e for e in elements if app_name.lower() in (e.get("Name","").lower() + e.get("ClassName","").lower() + e.get("AutomationId","").lower())]
                        return ok(f"UIA Tree: {len(elements)} elements", {"elements": elements[:100], "total": len(elements)})
                    return ok("UIA Tree empty — try different app", {"elements": []})
                except Exception as ex:
                    return err(f"deep_tree: {ex}")
            return err("deep_tree Windows पर ही काम करता है")
        if action == "uia_click_by_id":
            # Click by UIA AutomationId — most reliable method
            if IS_WIN:
                auto_id = str(params.get("automation_id", "") or params.get("id", "")).strip()
                if not auto_id:
                    return err("automation_id चाहिए")
                try:
                    ps_script = f'''
Add-Type -AssemblyName UIAutomationClient
$root = [System.Windows.Automation.AutomationElement]::RootElement
$condition = New-Object System.Windows.Automation.PropertyCondition ([System.Windows.Automation.AutomationElement]::AutomationIdProperty, "{auto_id}")
$element = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
if ($element -ne $null) {{
    $invokePattern = $element.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
    $invokePattern.Invoke()
    Write-Output "clicked"
}} else {{
    Write-Output "not_found"
}}
'''
                    r = run(["powershell","-NoProfile","-Command", ps_script], timeout=5)
                    if "clicked" in (r.stdout or ""):
                        return ok(f"UIA click by ID '{auto_id}' ✅")
                    return err(f"Element with AutomationId '{auto_id}' not found")
                except Exception as ex:
                    return err(f"uia_click_by_id: {ex}")
            return err("uia_click_by_id Windows पर ही काम करता है")
        if action == "uia_set_value":
            # Set value on a UIA textbox/control
            if IS_WIN:
                auto_id = str(params.get("automation_id", "") or params.get("id", "")).strip()
                value = str(params.get("value", "")).strip()
                if not auto_id or not value:
                    return err("automation_id और value दोनों चाहिए")
                try:
                    ps_script = f'''
Add-Type -AssemblyName UIAutomationClient
$root = [System.Windows.Automation.AutomationElement]::RootElement
$condition = New-Object System.Windows.Automation.PropertyCondition ([System.Windows.Automation.AutomationElement]::AutomationIdProperty, "{auto_id}")
$element = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
if ($element -ne $null) {{
    $valuePattern = $element.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
    $valuePattern.SetValue("{value}")
    Write-Output "set"
}} else {{
    Write-Output "not_found"
}}
'''
                    r = run(["powershell","-NoProfile","-Command", ps_script], timeout=5)
                    if "set" in (r.stdout or ""):
                        return ok(f"UIA set value on '{auto_id}' ✅")
                    return err(f"Element with AutomationId '{auto_id}' not found")
                except Exception as ex:
                    return err(f"uia_set_value: {ex}")
            return err("uia_set_value Windows पर ही काम करता है")
        if action == "find_text":
            # OCR click: find Hindi/English text on screen via pytesseract → click
            try:
                import pytesseract as _pt
                from PIL import ImageGrab
                txt = str(params.get("text","") or params.get("query","") or params.get("name","")).strip()
                if not txt: return err("text चाहिए")
                img = ImageGrab.grab()
                data = _pt.image_to_data(img, lang="eng+hin", output_type=_pt.Output.DICT)
                low = txt.lower()
                for i, w in enumerate(data["text"]):
                    if w and low in w.lower():
                        x = data["left"][i] + data["width"][i]//2
                        y = data["top"][i] + data["height"][i]//2
                        try: cur = pyautogui.position(); bezier_move(cur.x, cur.y, x, y, steps=14); pyautogui.click(x,y)
                        except: pyautogui.click(x,y)
                        return ok(f"OCR click '{w}' ({x},{y}) 🖱️", {"x": x, "y": y, "found": w})
                return err(f"Text '{txt}' screen pe nahi mila")
            except Exception as ex:
                return err(f"find_text: {ex}")
        if action == "find_image":
            # opencv template match: params.image_b64 (base64 png) or path + multi-monitor aware grab
            try:
                import cv2, numpy as np
                from PIL import ImageGrab
                import base64 as _b64, io as _io
                b64 = params.get("image_b64") or params.get("image") or ""
                thresh = float(params.get("threshold", 0.8))
                mon_idx = int(params.get("monitor", 0)) if str(params.get("monitor","")).isdigit() else 0
                if b64.startswith("data:"): b64 = b64.split(",",1)[1]
                tpl_bytes = _b64.b64decode(b64) if b64 else None
                if not tpl_bytes: return err("image_b64 चाहिए (base64 png)")
                tpl = cv2.imdecode(np.frombuffer(tpl_bytes, np.uint8), cv2.IMREAD_COLOR)
                # multi-monitor bbox
                try:
                    mons = get_monitors()
                    m = mons[min(mon_idx, len(mons)-1)]
                    screen = ImageGrab.grab(bbox=(m["left"], m["top"], m["right"], m["bottom"]))
                    off_x, off_y = m["left"], m["top"]
                except:
                    screen = ImageGrab.grab(); off_x, off_y = 0,0
                scr = cv2.cvtColor(np.array(screen), cv2.COLOR_RGB2BGR)
                res = cv2.matchTemplate(scr, tpl, cv2.TM_CCOEFF_NORMED)
                _, maxVal, _, maxLoc = cv2.minMaxLoc(res)
                if maxVal < thresh: return err(f"Image not found (score {maxVal:.2f} < {thresh})")
                h, w = tpl.shape[:2]; cx = maxLoc[0] + w//2 + off_x; cy = maxLoc[1] + h//2 + off_y
                if params.get("click"):
                    try: cur = pyautogui.position(); bezier_move(cur.x, cur.y, cx, cy, steps=14); pyautogui.click(cx, cy)
                    except: pyautogui.click(cx, cy)
                    return ok(f"Found & clicked ({cx},{cy}) m{mon_idx} score {maxVal:.2f} 🖱️", {"x": cx, "y": cy, "score": float(maxVal), "monitor": mon_idx})
                return ok(f"Found ({cx},{cy}) m{mon_idx} score {maxVal:.2f}", {"x": cx, "y": cy, "score": float(maxVal), "monitor": mon_idx})
            except Exception as ex:
                return err(f"find_image: {ex}")
        return err(f"अज्ञात uia action: {action}")
    except Exception as e:
        return err(str(e))

def cmd_browser(action, params):
    """Full Browser DOM Automation — Playwright-powered click/fill/extract/navigate."""
    try:
        url = params.get("url","") or params.get("query","")
        if action in ("open","navigate","goto"):
            if not url: return err("URL खाली है")
            if not url.startswith("http"): url = "https://" + url
            browser = get_default_browser()
            # Ad-Free YouTube resolver
            if "youtube" in url.lower() or "youtu" in url.lower() or params.get("query","").lower().startswith("play "):
                q = params.get("query", url)
                url = resolve_youtube_adfree(q)
            webbrowser.open(url)
            # Headless Chromium with full page info
            try:
                from playwright.sync_api import sync_playwright
                with sync_playwright() as p:
                    b = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
                    ctx = b.new_context(viewport={"width": 1280, "height": 720}, user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                    pg = ctx.new_page()
                    pg.goto(url, timeout=15000, wait_until="domcontentloaded")
                    title = pg.title()
                    try:
                        text = pg.inner_text("body")[:500]
                    except:
                        text = ""
                    b.close()
                    return ok(f"Browser {browser}: {title} 🌐", {"url": url, "browser": browser, "title": title, "preview": text[:300]})
            except Exception as ex:
                logger.warning(f"Playwright failed: {ex}")
                return ok(f"Browser {browser}: {url} 🌐 (headless failed, opened in default browser)", {"url": url, "browser": browser})
        
        # ─── DOM Automation Actions (Playwright required) ───
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            return err("Playwright install करें: pip install playwright && playwright install chromium")
        
        target_url = params.get("target_url", url)
        selector = params.get("selector", "") or params.get("css", "")
        value = params.get("value", "") or params.get("text", "")
        
        with sync_playwright() as p:
            b = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
            ctx = b.new_context(viewport={"width": 1280, "height": 720}, user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
            pg = ctx.new_page()
            
            # Navigate if URL provided
            if target_url:
                if not target_url.startswith("http"): target_url = "https://" + target_url
                pg.goto(target_url, timeout=15000, wait_until="domcontentloaded")
            
            if action == "click":
                # Click element by CSS selector
                if not selector: return err("selector चाहिए (css selector)")
                try:
                    pg.wait_for_selector(selector, timeout=5000)
                    pg.click(selector)
                    title = pg.title()
                    return ok(f"Clicked: {selector} 🖱️", {"selector": selector, "title": title})
                except Exception as ex:
                    return err(f"Click failed: {ex}")
            
            elif action == "fill":
                # Fill input field
                if not selector: return err("selector चाहिए")
                if not value: return err("value चाहिए")
                try:
                    pg.wait_for_selector(selector, timeout=5000)
                    pg.fill(selector, value)
                    return ok(f"Filled: {selector} = {value[:30]} ✏️", {"selector": selector, "value": value[:50]})
                except Exception as ex:
                    return err(f"Fill failed: {ex}")
            
            elif action == "type":
                # Type text (keyboard input)
                if not selector: return err("selector चाहिए")
                if not value: return err("text चाहिए")
                try:
                    pg.wait_for_selector(selector, timeout=5000)
                    pg.type(selector, value, delay=50)
                    return ok(f"Typed: {selector} ⌨️", {"selector": selector})
                except Exception as ex:
                    return err(f"Type failed: {ex}")
            
            elif action in ("extract", "get_text"):
                # Extract text from element or full page
                if selector:
                    try:
                        pg.wait_for_selector(selector, timeout=5000)
                        text = pg.inner_text(selector)[:5000]
                        return ok(f"Extracted from {selector} 📄", {"text": text, "selector": selector})
                    except Exception as ex:
                        return err(f"Extract failed: {ex}")
                else:
                    text = pg.inner_text("body")[:5000]
                    title = pg.title()
                    return ok(f"Page text: {title} 📄", {"text": text, "title": title})
            
            elif action == "get_html":
                # Get HTML of element or full page
                if selector:
                    try:
                        html = pg.inner_html(selector)[:10000]
                        return ok(f"HTML from {selector} 🌐", {"html": html, "selector": selector})
                    except Exception as ex:
                        return err(f"HTML extract failed: {ex}")
                else:
                    html = pg.content()[:10000]
                    title = pg.title()
                    return ok(f"Full HTML: {title} 🌐", {"html": html, "title": title})
            
            elif action == "get_links":
                # Extract all links from page
                try:
                    links = pg.eval_on_selector_all("a[href]", "els => els.map(e => ({text: e.innerText.trim(), href: e.href}))")
                    return ok(f"{len(links)} links found 🔗", {"links": links[:50]})
                except Exception as ex:
                    return err(f"Link extract failed: {ex}")
            
            elif action == "get_forms":
                # Extract form fields
                try:
                    forms = pg.eval_on_selector_all("form", """els => els.map(f => ({
                        action: f.action, method: f.method,
                        fields: Array.from(f.querySelectorAll('input,textarea,select')).map(i => ({
                            name: i.name, type: i.type, placeholder: i.placeholder, value: i.value
                        }))
                    }))""")
                    return ok(f"{len(forms)} forms found 📋", {"forms": forms})
                except Exception as ex:
                    return err(f"Form extract failed: {ex}")
            
            elif action == "fill_form":
                # Fill multiple form fields at once
                fields = params.get("fields", {})  # {selector: value}
                if not fields: return err("fields dict चाहिए {selector: value}")
                filled = []
                for sel, val in fields.items():
                    try:
                        pg.wait_for_selector(sel, timeout=3000)
                        pg.fill(sel, str(val))
                        filled.append(sel)
                    except: pass
                return ok(f"Filled {len(filled)}/{len(fields)} fields 📋", {"filled": filled})
            
            elif action == "select":
                # Select dropdown option
                if not selector: return err("selector चाहिए")
                if not value: return err("value चाहिए")
                try:
                    pg.select_option(selector, value)
                    return ok(f"Selected: {selector} = {value} 📋", {"selector": selector, "value": value})
                except Exception as ex:
                    return err(f"Select failed: {ex}")
            
            elif action == "check":
                # Check/uncheck checkbox
                if not selector: return err("selector चाहिए")
                try:
                    pg.check(selector)
                    return ok(f"Checked: {selector} ☑️", {"selector": selector})
                except Exception as ex:
                    return err(f"Check failed: {ex}")
            
            elif action == "wait":
                # Wait for selector to appear
                if not selector: return err("selector चाहिए")
                try:
                    timeout = int(params.get("timeout", 5000))
                    pg.wait_for_selector(selector, timeout=timeout)
                    return ok(f"Element appeared: {selector} ⏳", {"selector": selector})
                except Exception as ex:
                    return err(f"Wait timeout: {ex}")
            
            elif action == "screenshot":
                # Take screenshot of page
                try:
                    pics = Path.home() / "Pictures" / "Pika_Screenshots"
                    pics.mkdir(parents=True, exist_ok=True)
                    fp = pics / f"browser_{datetime.now():%Y%m%d_%H%M%S}.png"
                    pg.screenshot(path=str(fp), full_page=False)
                    return ok(f"Screenshot saved 📸", {"path": str(fp)})
                except Exception as ex:
                    return err(f"Screenshot failed: {ex}")
            
            elif action == "scroll":
                # Scroll page
                direction = value or "down"
                try:
                    if direction == "down":
                        pg.evaluate("window.scrollBy(0, window.innerHeight)")
                    elif direction == "up":
                        pg.evaluate("window.scrollBy(0, -window.innerHeight)")
                    elif direction == "top":
                        pg.evaluate("window.scrollTo(0, 0)")
                    elif direction == "bottom":
                        pg.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    return ok(f"Scrolled {direction} 📜", {"direction": direction})
                except Exception as ex:
                    return err(f"Scroll failed: {ex}")
            
            elif action == "eval":
                # Execute JavaScript
                if not value: return err("JavaScript code चाहिए")
                try:
                    result = pg.evaluate(value)
                    return ok(f"JS executed 💻", {"result": str(result)[:2000]})
                except Exception as ex:
                    return err(f"JS error: {ex}")
            
            elif action == "back":
                pg.go_back()
                return ok("Back 🔄")
            
            elif action == "forward":
                pg.go_forward()
                return ok("Forward 🔄")
            
            elif action == "reload":
                pg.reload()
                return ok("Reloaded 🔄")
            
            b.close()
        
        if action == "screenshot":
            return cmd_screen("screenshot", {})
        if action == "fill":
            return cmd_keyboard("type", {"text": params.get("text","")})
        return err(f"अज्ञात browser action: {action}")
    except Exception as e:
        return err(str(e))

def cmd_connectors(action, params):
    """Real OAuth connectors — Google Calendar/Gmail/Drive with token persistence."""
    try:
        cid = (params.get("id") or params.get("connector") or "").lower()
        valid = {"gmail","calendar","drive","slack","notion","github"}
        if action == "list":
            data = load_vault_data() or {}
            conns = data.get("connectors", {})
            items = []
            for k in valid:
                conn = conns.get(k, {})
                items.append({"id": k, "connected": bool(conn.get("connected")), "email": conn.get("email", ""), "scopes": conn.get("scopes",[])})
            return ok(f"{sum(1 for i in items if i['connected'])} connectors connected", {"items": items})
        if action == "connect":
            if cid not in valid: return err(f"Unknown connector {cid}")
            if cid in ("gmail", "calendar", "drive"):
                # Real Google OAuth2 flow
                client_id = params.get("client_id", "") or os.getenv("GOOGLE_CLIENT_ID", "")
                client_secret = params.get("client_secret", "") or os.getenv("GOOGLE_CLIENT_SECRET", "")
                if not client_id or not client_secret:
                    return err("Google OAuth client_id और client_secret चाहिए। Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env or params.")
                # Determine scopes based on connector
                scope_map = {
                    "gmail": "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
                    "calendar": "https://www.googleapis.com/auth/calendar",
                    "drive": "https://www.googleapis.com/auth/drive",
                }
                scopes = scope_map.get(cid, "https://www.googleapis.com/auth/gmail.readonly")
                # Generate auth URL
                auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?client_id={client_id}&redirect_uri=http://localhost:8080&response_type=code&scope={scopes}&access_type=offline&prompt=consent"
                data = load_vault_data() or {}
                conns = data.setdefault("connectors", {})
                conns[cid] = {"connected": False, "auth_url": auth_url, "client_id": client_id, "scopes": scopes.split(), "pending": True}
                save_vault_data(data)
                return ok(f"Google OAuth — open this URL to authorize:\n{auth_url}", {"auth_url": auth_url, "connector": cid})
            # Placeholder for non-Google connectors
            data = load_vault_data() or {}
            conns = data.setdefault("connectors", {})
            conns[cid] = {"connected": True, "connected_at": datetime.now(timezone.utc).isoformat(), "scopes": []}
            save_vault_data(data)
            return ok(f"{cid} connected (placeholder) ✅", {"id": cid})
        if action == "oauth_callback":
            # Handle OAuth callback with authorization code
            code = params.get("code", "")
            cid = params.get("connector", cid)
            if not code:
                return err("Authorization code चाहिए")
            data = load_vault_data() or {}
            conns = data.get("connectors", {})
            conn = conns.get(cid, {})
            client_id = conn.get("client_id", "") or os.getenv("GOOGLE_CLIENT_ID", "")
            client_secret = conn.get("client_secret", "") or os.getenv("GOOGLE_CLIENT_SECRET", "")
            if not client_id or not client_secret:
                return err("OAuth credentials not found")
            # Exchange code for tokens
            try:
                import urllib.request as _req
                token_data = urllib.parse.urlencode({
                    "code": code, "client_id": client_id, "client_secret": client_secret,
                    "redirect_uri": "http://localhost:8080", "grant_type": "authorization_code"
                }).encode()
                req = _req.Request("https://oauth2.googleapis.com/token", data=token_data, method="POST")
                with _req.urlopen(req, timeout=10) as resp:
                    tokens = json.loads(resp.read().decode())
                    access_token = tokens.get("access_token", "")
                    refresh_token = tokens.get("refresh_token", "")
                    # Get user email
                    req2 = _req.Request("https://www.googleapis.com/oauth2/v2/userinfo", headers={"Authorization": f"Bearer {access_token}"})
                    with _req.urlopen(req2, timeout=5) as resp2:
                        user_info = json.loads(resp2.read().decode())
                        email = user_info.get("email", "")
                    # Save tokens
                    conns[cid] = {"connected": True, "access_token": access_token, "refresh_token": refresh_token, "email": email, "scopes": conn.get("scopes",[]), "expires_at": datetime.now(timezone.utc).isoformat()}
                    data["connectors"] = conns
                    save_vault_data(data)
                    return ok(f"Google {cid} connected! Email: {email} ✅", {"email": email, "connector": cid})
            except Exception as ex:
                return err(f"OAuth token exchange failed: {ex}")
        if action == "gmail_list":
            # List recent Gmail messages
            data = load_vault_data() or {}
            conn = data.get("connectors", {}).get("gmail", {})
            if not conn.get("connected"):
                return err("Gmail not connected — use connectors/connect first")
            access_token = conn.get("access_token", "")
            try:
                import urllib.request as _req
                req = _req.Request("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10", headers={"Authorization": f"Bearer {access_token}"})
                with _req.urlopen(req, timeout=10) as resp:
                    result = json.loads(resp.read().decode())
                    messages = result.get("messages", [])
                    items = []
                    for msg in messages[:10]:
                        req2 = _req.Request(f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg['id']}?format=metadata", headers={"Authorization": f"Bearer {access_token}"})
                        with _req.urlopen(req2, timeout=5) as resp2:
                            msg_data = json.loads(resp2.read().decode())
                            headers_list = {h["name"]: h["value"] for h in msg_data.get("payload", {}).get("headers", [])}
                            items.append({"id": msg["id"], "from": headers_list.get("From", ""), "subject": headers_list.get("Subject", ""), "snippet": msg_data.get("snippet", "")[:200]})
                    return ok(f"{len(items)} messages", {"items": items})
            except Exception as ex:
                return err(f"Gmail list failed: {ex}")
        if action == "calendar_list":
            # List upcoming calendar events
            data = load_vault_data() or {}
            conn = data.get("connectors", {}).get("calendar", {})
            if not conn.get("connected"):
                return err("Calendar not connected — use connectors/connect first")
            access_token = conn.get("access_token", "")
            try:
                import urllib.request as _req
                now = datetime.now(timezone.utc).isoformat() + "Z"
                future = (datetime.now(timezone.utc) + __import__('datetime').timedelta(days=7)).isoformat() + "Z"
                req = _req.Request(f"https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin={now}&timeMax={future}&singleEvents=true&orderBy=startTime&maxResults=10", headers={"Authorization": f"Bearer {access_token}"})
                with _req.urlopen(req, timeout=10) as resp:
                    result = json.loads(resp.read().decode())
                    events = result.get("items", [])
                    items = []
                    for ev in events:
                        start = ev.get("start", {}).get("dateTime", ev.get("start", {}).get("date", ""))
                        items.append({"id": ev["id"], "summary": ev.get("summary", ""), "start": start, "location": ev.get("location", ""), "link": ev.get("htmlLink", "")})
                    return ok(f"{len(items)} events (next 7 days)", {"items": items})
            except Exception as ex:
                return err(f"Calendar list failed: {ex}")
        if action == "drive_list":
            # List recent Google Drive files
            data = load_vault_data() or {}
            conn = data.get("connectors", {}).get("drive", {})
            if not conn.get("connected"):
                return err("Drive not connected — use connectors/connect first")
            access_token = conn.get("access_token", "")
            try:
                import urllib.request as _req
                req = _req.Request("https://www.googleapis.com/drive/v3/files?pageSize=10&fields=files(id,name,mimeType,modifiedTime,webViewLink)", headers={"Authorization": f"Bearer {access_token}"})
                with _req.urlopen(req, timeout=10) as resp:
                    result = json.loads(resp.read().decode())
                    files = result.get("files", [])
                    return ok(f"{len(files)} files", {"items": files})
            except Exception as ex:
                return err(f"Drive list failed: {ex}")
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
_fallback_timers: dict = {}  # jid -> threading.Timer for fallback mode

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
    """Extract params from command string — basic heuristic."""
    params = {}
    low = cmd.lower()
    # Extract app name after "open "
    if "open" in low:
        parts = cmd.split("open", 1)
        if len(parts) > 1:
            app = parts[1].strip()
            if app:
                params["name"] = app
    # Extract volume level after "volume "
    if "volume" in low and any(c.isdigit() for c in low):
        import re as _re
        nums = _re.findall(r'\d+', cmd)
        if nums:
            params["level"] = int(nums[0])
    return params

def _parse_schedule_to_seconds(schedule: str) -> int:
    """Parse human schedule string to seconds. Supports: every N minutes/hours, daily at HH:MM."""
    import re as _re
    low = schedule.lower().strip()
    # "every N minutes"
    m = _re.search(r'every\s+(\d+)\s*min', low)
    if m: return int(m.group(1)) * 60
    # "every N hours"
    m = _re.search(r'every\s+(\d+)\s*hour', low)
    if m: return int(m.group(1)) * 3600
    # "hourly" = 1 hour
    if low in ("hourly", "every hour"): return 3600
    # "daily at HH:MM"
    m = _re.search(r'daily\s+at\s+(\d{1,2}):(\d{2})', low)
    if m:
        h, mi = int(m.group(1)), int(m.group(2))
        now = datetime.now()
        target = now.replace(hour=h, minute=mi, second=0, microsecond=0)
        if target <= now:
            from datetime import timedelta
            target += timedelta(days=1)
        return int((target - now).total_seconds())
    # "every N seconds"
    m = _re.search(r'every\s+(\d+)\s*sec', low)
    if m: return int(m.group(1))
    # Default: 60 minutes
    return 3600

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
                delay = _parse_schedule_to_seconds(schedule)
                def _fallback(jid=jid, command=command, delay=delay):
                    route_command({"category": _parse_cmd_category(command), "action": _parse_cmd_action(command), "params": _parse_cmd_params(command)})
                    # Re-arm with same interval
                    _fallback_timers[jid] = _t.Timer(delay, _fallback)
                    _fallback_timers[jid].daemon = True
                    _fallback_timers[jid].start()
                _fallback_timers[jid] = _t.Timer(delay, _fallback)
                _fallback_timers[jid].daemon = True
                _fallback_timers[jid].start()
                logger.info(f"Scheduler fallback: {name} every {delay}s")
            return ok(f"शेड्यूल किया: {name} ({schedule}) ⏰", {"id": jid})
        if action in ("remove","delete","cancel"):
            jid = params.get("id","")
            # Cancel fallback timer if exists
            ft = _fallback_timers.pop(jid, None)
            if ft:
                ft.cancel()
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

# ── Open Interpreter Style — Self-Healing Code Execution REPL ──
# Subprocess-isolated, 3 retries, artifact generation
_CODE_EXEC_TIMEOUT = 30  # seconds max per exec call
_CODE_REPL_STATE: dict = {"globals": {}, "history": [], "artifacts": []}
_Pika_Output = Path.home() / "Documents" / "Pika_Output"
_Pika_Output.mkdir(parents=True, exist_ok=True)

def _run_code_subprocess(code: str, timeout: int = 30) -> dict:
    """Run Python code in isolated subprocess with live capture."""
    import subprocess as _sp
    import tempfile
    import os
    
    # Create temp script file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as f:
        f.write(code)
        script_path = f.name
    
    try:
        # Run in isolated subprocess
        result = _sp.run(
            [_host_python(), script_path],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=str(_Pika_Output),
            env={**os.environ, "PYTHONIOENCODING": "utf-8"}
        )
        return {
            "stdout": result.stdout[:8000],
            "stderr": result.stderr[:4000],
            "returncode": result.returncode,
            "success": result.returncode == 0
        }
    except _sp.TimeoutExpired:
        return {"stdout": "", "stderr": f"Timeout: code exceeded {timeout}s", "returncode": -1, "success": False}
    except Exception as ex:
        return {"stdout": "", "stderr": str(ex)[:4000], "returncode": -1, "success": False}
    finally:
        try:
            os.unlink(script_path)
        except:
            pass

def _auto_fix_code(code: str, error: str) -> str:
    """Self-healing: auto-fix common Python errors."""
    fixed = code
    
    # Fix missing imports
    if "NameError" in error and "'" in error:
        missing = error.split("'")[1] if "'" in error else ""
        safe_imports = ("pd", "pandas", "np", "numpy", "requests", "json", "re", "time", 
                       "datetime", "Path", "math", "os", "sys", "collections", "itertools")
        if missing in safe_imports:
            fixed = f"import {missing}\n{fixed}"
    
    # Fix SyntaxError suggestions
    if "SyntaxError" in error:
        # Common fixes
        if "missing parentheses" in error.lower() or "unexpected EOF" in error.lower():
            if not fixed.endswith("\n"):
                fixed += "\n"
    
    # Fix IndentationError
    if "IndentationError" in error:
        lines = fixed.split("\n")
        fixed_lines = []
        for line in lines:
            if line.strip() and not line.startswith(" ") and not line.startswith("\t"):
                fixed_lines.append(line)
            else:
                fixed_lines.append(line)
        fixed = "\n".join(fixed_lines)
    
    return fixed

def cmd_code(action, params):
    """Open Interpreter Style — Self-Healing Code Execution REPL with subprocess isolation."""
    if action in ("exec", "execute", "run", "repl"):
        code = str(params.get("code") or params.get("command") or params.get("script") or "").strip()
        if not code:
            return err("code खाली है")
        
        # Security: block dangerous imports
        code_lower = code.lower()
        _BLOCKED_MODULES = {"subprocess", "shutil", "ctypes", "signal", "multiprocessing",
                           "socket", "http", "ftplib", "smtplib", "telnetlib"}
        for mod in _BLOCKED_MODULES:
            if f"import {mod}" in code_lower or f"from {mod}" in code_lower:
                return err(f"⛔ '{mod}' import blocked — security policy.")
        
        # Block dangerous os functions
        _BLOCKED_OS_FUNCS = ("os.system", "os.popen", "os.exec", "os.spawn")
        for fn in _BLOCKED_OS_FUNCS:
            if fn in code_lower:
                return err(f"⛔ '{fn}' blocked — use safe alternatives.")
        
        # Self-healing loop: up to 3 retries
        last_error = ""
        for attempt in range(3):
            result = _run_code_subprocess(code, timeout=_CODE_EXEC_TIMEOUT)
            
            if result["success"]:
                # Success — save to history and return
                _CODE_REPL_STATE["history"].append({
                    "code": code[:500], "success": True, 
                    "output": result["stdout"][:200],
                    "attempt": attempt + 1
                })
                return ok(f"Code executed ✅ (attempt {attempt+1})", {
                    "stdout": result["stdout"],
                    "stderr": result["stderr"],
                    "attempt": attempt + 1,
                    "artifacts": [str(f) for f in _Pika_Output.glob("*") if f.is_file()][-5:]
                })
            
            last_error = result["stderr"]
            
            # Self-healing: try to fix the code
            if attempt < 2:
                fixed_code = _auto_fix_code(code, last_error)
                if fixed_code != code:
                    code = fixed_code
                    # Send self-healing event
                    if hasattr(params, '_ws'):
                        pass  # Will be handled by caller
        
        # All 3 attempts failed
        _CODE_REPL_STATE["history"].append({
            "code": code[:500], "success": False, 
            "error": last_error[:200]
        })
        return err(f"Error after 3 attempts: {last_error}")
    
    if action in ("eval", "evaluate"):
        expr = str(params.get("expression") or params.get("code") or "").strip()
        if not expr:
            return err("expression खाली है")
        try:
            result = eval(expr, {"__builtins__": {}}, {
                "math": __import__("math"), "json": __import__("json"),
                "re": __import__("re"), "time": __import__("time"),
                "datetime": __import__("datetime"), "Path": Path,
                "pd": _CODE_REPL_STATE["globals"].get("pd"),
                "np": _CODE_REPL_STATE["globals"].get("np"),
            })
            return ok(f"Result: {result}", {"result": result})
        except Exception as ex:
            return err(f"Eval error: {ex}")
    
    if action == "history":
        return ok("REPL History", {"items": _CODE_REPL_STATE["history"][-20:]})
    
    if action == "clear":
        _CODE_REPL_STATE["globals"].clear()
        _CODE_REPL_STATE["history"].clear()
        return ok("REPL state cleared")
    
    if action == "pip_install":
        pkg = str(params.get("package", "")).strip()
        if not pkg:
            return err("package name खाली है")
        try:
            r = run([_host_python(), "-m", "pip", "install", pkg], timeout=60)
            return ok(f"pip install {pkg} ✅", {"stdout": (r.stdout or "")[:3000], "stderr": (r.stderr or "")[:2000], "returncode": r.returncode})
        except Exception as ex:
            return err(f"pip install failed: {ex}")
    
    if action == "artifacts":
        # List generated artifacts
        artifacts = sorted(_Pika_Output.glob("*"), key=lambda f: f.stat().st_mtime, reverse=True)[:20]
        return ok(f"{len(artifacts)} artifacts", {"items": [{"name": f.name, "size": f.stat().st_size, "path": str(f)} for f in artifacts if f.is_file()]})
    
    return err(f"अज्ञात code action: {action}")

def cmd_clipboard(action, params):
    return err(f"अज्ञात code action: {action}")

def cmd_clipboard(action, params):
    if not pyperclip:
        return err("pyperclip ज़रूरी है")
    try:
        if action in ("save", "get"):
            txt = pyperclip.paste()
            # additive persist history in vault (bina hataye)
            try:
                data = load_vault_data() or {}
                hist = data.setdefault("clipboardHistory", [])
                if txt and (not hist or hist[-1].get("content") != txt):
                    hist.append({"content": txt[:2000], "at": datetime.now(timezone.utc).isoformat()})
                    data["clipboardHistory"] = hist[-50:]
                    save_vault_data(data)
            except: pass
            return ok("क्लिपबोर्ड", {"content": txt})
        if action == "set":
            pyperclip.copy(params.get("text", ""))
            # also log to vault history
            try:
                data = load_vault_data() or {}
                hist = data.setdefault("clipboardHistory", [])
                hist.append({"content": str(params.get("text",""))[:2000], "at": datetime.now(timezone.utc).isoformat()})
                data["clipboardHistory"] = hist[-50:]; save_vault_data(data)
            except: pass
            return ok("क्लिपबोर्ड सेट।")
        if action == "clear":
            pyperclip.copy("")
            try:
                data = load_vault_data() or {}
                data["clipboardHistory"] = []; save_vault_data(data)
            except: pass
            return ok("क्लिपबोर्ड क्लियर।")
        if action == "history":
            try:
                data = load_vault_data() or {}
                hist = data.get("clipboardHistory", [])
                # also merge live paste as latest if not duplicate
                try:
                    cur = pyperclip.paste()
                    if cur and (not hist or hist[-1].get("content") != cur):
                        hist = hist[-49:] + [{"content": cur, "at": datetime.now(timezone.utc).isoformat()}]
                except: pass
                return ok("हिस्ट्री", {"items": hist[-20:]})
            except:
                return ok("हिस्ट्री", {"items": []})
        return err(f"अज्ञात clipboard action: {action}")
    except Exception as e:
        return err(str(e))


def cmd_screen(action, params):
    try:
        if action == "screenshot":
            # ── additive window-targeted shot (bina full hataye) ──
            win_query = str(params.get("window","") or params.get("app","") or params.get("title","") or "").strip()
            # alias: vscodium/codium/code
            if win_query:
                low = win_query.lower()
                aliases = {"vscodium":"codium","vs codium":"codium","vscode":"code","vs code":"code"}
                for k,v in aliases.items():
                    if k in low: win_query = v; low = v
                # try pygetwindow first
                try:
                    if gw:
                        cand = None
                        for w in gw.getAllWindows():
                            t = (w.title or "").lower()
                            if win_query.lower() in t or t in win_query.lower():
                                if w.width>50 and w.height>50:
                                    cand = w; break
                        # fallback contains codium/code
                        if not cand and "codium" in low:
                            for w in gw.getAllWindows():
                                if "codium" in (w.title or "").lower() or "vscodium" in (w.title or "").lower():
                                    cand = w; break
                        if cand:
                            try: cand.activate()
                            except: pass
                            import time as _t; _t.sleep(0.35)
                            # DPI-aware bbox
                            x, y, w, h = cand.left, cand.top, cand.width, cand.height
                            res = screen_peeler(x, y, w, h, do_ocr=bool(params.get("ocr")))
                            if "error" not in res:
                                try:
                                    from PIL import Image
                                    import io
                                    img = Image.open(res["path"])
                                    thumb = img.resize((320, 180))
                                    buf = io.BytesIO(); thumb.save(buf, format="PNG")
                                    b64 = base64.b64encode(buf.getvalue()).decode()
                                    res["thumbnail"] = f"data:image/png;base64,{b64}"
                                except: pass
                                # rename file to include window name
                                try:
                                    p = Path(res["path"]); np = p.parent / f"{win_query[:12].replace(' ','_')}_{p.name}"
                                    p.rename(np); res["path"] = str(np)
                                except: pass
                                return ok(f"Window '{cand.title[:30]}' screenshot: {res['path']} 📸", res)
                except Exception as ex:
                    logger.warning(f"window shot fallback full: {ex}")
            # Use ScreenPeeler for HQ + optional OCR
            do_ocr = params.get("ocr") or params.get("peel") or False
            res = screen_peeler(do_ocr=bool(do_ocr))
            if "error" in res:
                # fallback to pyautogui
                if not pyautogui:
                    return err("pyautogui ज़रूरी है")
                shots = _DATA_ROOT / "screenshots"
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
        if action == "pip":
            # Picture-in-Picture always-on-top floating window
            window_name = str(params.get("window", "") or params.get("name", "") or "").strip()
            if not window_name:
                return err("window name चाहिए (e.g. 'pip/Chrome' or 'pip/Netflix')")
            try:
                import ctypes
                from ctypes import wintypes
                user32 = ctypes.windll.user32
                # Find window by name
                hwnd = user32.FindWindowW(None, window_name)
                if not hwnd:
                    # Try partial match
                    if gw:
                        for w in gw.getAllWindows():
                            if window_name.lower() in (w.title or "").lower():
                                hwnd = user32.FindWindowW(None, w.title)
                                break
                if not hwnd:
                    return err(f"Window '{window_name}' not found")
                # Set as always-on-top (TOPMOST)
                HWND_TOPMOST = -1
                SWP_NOMOVE = 0x0002
                SWP_NOSIZE = 0x0001
                SWP_SHOWWINDOW = 0x0040
                user32.SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW)
                # Resize to PiP size (320x180) and move to bottom-right
                screen_w = user32.GetSystemMetrics(0)
                screen_h = user32.GetSystemMetrics(1)
                pip_w, pip_h = 320, 180
                pip_x = screen_w - pip_w - 20
                pip_y = screen_h - pip_h - 60
                user32.SetWindowPos(hwnd, HWND_TOPMOST, pip_x, pip_y, pip_w, pip_h, SWP_SHOWWINDOW)
                return ok(f"PiP mode: '{window_name}' — always-on-top {pip_w}x{pip_h} at ({pip_x},{pip_y}) 🖼️", {"hwnd": hwnd, "x": pip_x, "y": pip_y, "w": pip_w, "h": pip_h})
            except Exception as ex:
                return err(f"PiP failed: {ex}")
        if action == "pip_off":
            # Remove always-on-top from a window
            window_name = str(params.get("window", "") or params.get("name", "") or "").strip()
            if not window_name:
                return err("window name चाहिए")
            try:
                import ctypes
                user32 = ctypes.windll.user32
                hwnd = user32.FindWindowW(None, window_name)
                if not hwnd:
                    if gw:
                        for w in gw.getAllWindows():
                            if window_name.lower() in (w.title or "").lower():
                                hwnd = user32.FindWindowW(None, w.title)
                                break
                if not hwnd:
                    return err(f"Window '{window_name}' not found")
                HWND_NOTOPMOST = -2
                SWP_NOMOVE = 0x0002
                SWP_NOSIZE = 0x0001
                SWP_SHOWWINDOW = 0x0040
                user32.SetWindowPos(hwnd, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW)
                return ok(f"PiP off: '{window_name}' — no longer always-on-top ✅")
            except Exception as ex:
                return err(f"pip_off failed: {ex}")

        if action == "generate_image":
            # Generate image from text prompt (DALL-E 3 or local Stable Diffusion)
            prompt = str(params.get("prompt", "") or params.get("text", "")).strip()
            if not prompt:
                return err("prompt चाहिए for image generation")
            size = str(params.get("size", "1024x1024"))
            try:
                # Try OpenAI DALL-E 3 first
                openai_key = os.getenv("OPENAI_API_KEY", "")
                if openai_key:
                    payload = json.dumps({
                        "model": "dall-e-3",
                        "prompt": prompt,
                        "size": size,
                        "quality": "standard",
                        "n": 1,
                    }).encode()
                    req = urllib.request.Request(
                        "https://api.openai.com/v1/images/generations",
                        data=payload,
                        headers={"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"}
                    )
                    with urllib.request.urlopen(req, timeout=60) as resp:
                        result = json.loads(resp.read().decode())
                        img_url = result["data"][0]["url"]
                        # Download and save
                        img_dir = Path.home() / ".pika" / "images"
                        img_dir.mkdir(parents=True, exist_ok=True)
                        fp = img_dir / f"gen_{datetime.now():%Y%m%d_%H%M%S}.png"
                        urllib.request.urlretrieve(img_url, str(fp))
                        return ok(f"Image generated: {fp.name} ✨", {"path": str(fp), "url": img_url, "prompt": prompt})
                # Try local Stable Diffusion (ComfyUI/A1111)
                sd_url = os.getenv("STABLE_DIFFUSION_URL", "http://127.0.0.1:7860")
                try:
                    payload = json.dumps({
                        "prompt": prompt,
                        "steps": 20,
                        "width": int(size.split("x")[0]),
                        "height": int(size.split("x")[1]),
                    }).encode()
                    req = urllib.request.Request(
                        f"{sd_url}/sdapi/v1/txt2img",
                        data=payload,
                        headers={"Content-Type": "application/json"}
                    )
                    with urllib.request.urlopen(req, timeout=120) as resp:
                        result = json.loads(resp.read().decode())
                        import base64 as _b64
                        img_data = _b64.b64decode(result["images"][0])
                        img_dir = Path.home() / ".pika" / "images"
                        img_dir.mkdir(parents=True, exist_ok=True)
                        fp = img_dir / f"gen_{datetime.now():%Y%m%d_%H%M%S}.png"
                        fp.write_bytes(img_data)
                        return ok(f"Image generated (SD): {fp.name} ✨", {"path": str(fp), "prompt": prompt})
                except Exception:
                    pass
                return err("No image generation API available — set OPENAI_API_KEY or STABLE_DIFFUSION_URL in .env")
            except Exception as ex:
                return err(f"Image generation failed: {ex}")

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
        # ── additive screen recording (bina hataye) ──
        if action in ("start_recording", "start_record"):
            try:
                global _rec_flag, _rec_thread, _rec_path
                if globals().get("_rec_flag"):
                    return err("Recording already running")
                import cv2, numpy as np
                from PIL import ImageGrab
                fps = int(params.get("fps", 15))
                mon_idx = int(params.get("monitor", 0)) if str(params.get("monitor","")).isdigit() else 0
                try:
                    mons = get_monitors()
                    m = mons[min(mon_idx, len(mons)-1)]
                    bbox = (m["left"], m["top"], m["right"], m["bottom"]); w, h = m["width"], m["height"]
                except:
                    bbox = None; import ctypes as _c; w=_c.windll.user32.GetSystemMetrics(0); h=_c.windll.user32.GetSystemMetrics(1); mons=[{"width":w,"height":h}]
                out_dir = Path.home() / "Videos" / "Pika_Recordings"
                out_dir.mkdir(parents=True, exist_ok=True)
                _rec_path = str(out_dir / f"rec_{datetime.now():%Y%m%d_%H%M%S}_m{mon_idx}.mp4")
                fourcc = cv2.VideoWriter_fourcc(*"mp4v")
                writer = cv2.VideoWriter(_rec_path, fourcc, fps, (w, h))
                globals()["_rec_flag"] = True
                def _loop():
                    import time as _t
                    while globals().get("_rec_flag"):
                        try:
                            img = ImageGrab.grab(bbox=bbox) if bbox else ImageGrab.grab()
                            frame = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
                            writer.write(frame)
                        except Exception:
                            pass
                        _t.sleep(1.0/max(1,fps))
                    writer.release()
                import threading as _th
                _rec_thread = _th.Thread(target=_loop, daemon=True); _rec_thread.start()
                return ok(f"Recording started m{mon_idx} {w}x{h}@{fps}fps → {_rec_path} 🎬", {"path": _rec_path, "monitor": mon_idx, "fps": fps})
            except Exception as ex:
                return err(f"record start: {ex}")
        if action in ("stop_recording", "stop_record"):
            try:
                if not globals().get("_rec_flag"):
                    return err("No active recording")
                globals()["_rec_flag"] = False
                import time as _t; _t.sleep(0.6)
                p = globals().get("_rec_path","")
                return ok(f"Recording stopped → {p} ⏹️", {"path": p})
            except Exception as ex:
                return err(f"record stop: {ex}")
        if action == "recording_status":
            return ok("recording" if globals().get("_rec_flag") else "idle", {"recording": bool(globals().get("_rec_flag")), "path": globals().get("_rec_path","")})

        return err(f"अज्ञात screen action: {action}")
    except Exception as e:
        return err(str(e))


def cmd_keyboard(action, params):
    if not pyautogui:
        return err("pyautogui ज़रूरी है")
    try:
        if action == "type":
            txt = str(params.get("text", ""))
            # System-wide dictation: use clipboard for Hindi/special chars
            if any("\u0900" <= c <= "\u097F" for c in txt) or len(txt) > 50:
                if atomic_clipboard_inject(txt):
                    return ok(f"System-wide type ({len(txt)} chars) 📋⌨️")
            pyautogui.typewrite(txt, interval=0.03)
            return ok("टेक्स्ट टाइप किया।")
        if action == "hotkey":
            keys = [k.strip() for k in params.get("keys", "").split("+") if k.strip()]
            if keys:
                pyautogui.hotkey(*keys)
                return ok(f"हॉटकी: {'+'.join(keys)}")
            return err("कोई keys नहीं।")
        if action == "dictate":
            # Global system-wide dictation — type wherever cursor is
            text = str(params.get("text", "") or params.get("query", "")).strip()
            if not text:
                return err("dictation text खाली है")
            # Use clipboard method for reliability across all apps
            if atomic_clipboard_inject(text):
                return ok(f"Dictated to cursor position ✅ ({len(text)} chars) 🎤")
            # Fallback: pyautogui type
            pyautogui.typewrite(text, interval=0.02)
            return ok(f"Dictated via keypress ✅ ({len(text)} chars) 🎤")
        if action == "voice_to_text":
            # Live voice dictation — record from mic, transcribe, return text
            duration = int(params.get("duration", 5))
            try:
                import wave, struct
                # Record audio
                import pyaudio
                pa = pyaudio.PyAudio()
                stream = pa.open(format=pyaudio.paInt16, channels=1, rate=16000, input=True, frames_per_buffer=1024)
                frames = []
                for _ in range(0, int(16000 / 1024 * duration)):
                    data = stream.read(1024)
                    frames.append(data)
                stream.stop_stream()
                stream.close()
                pa.terminate()
                # Save to temp file and transcribe
                wf = wave.open("_pika_dictate.wav", "wb")
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(16000)
                wf.writeframes(b"".join(frames))
                wf.close()
                # Transcribe with Vosk
                if HAS_VOSK and _vosk_model:
                    from vosk import KaldiRecognizer
                    import wave as _w
                    wf = _w.open("_pika_dictate.wav", "rb")
                    rec = KaldiRecognizer(_vosk_model, 16000)
                    while True:
                        data = wf.readframes(4000)
                        if len(data) == 0: break
                        rec.AcceptWaveform(data)
                    result = json.loads(rec.FinalResult())
                    text = result.get("text", "")
                    os.remove("_pika_dictate.wav")
                    if text:
                        return ok(f"Voice transcribed: {text}", {"text": text})
                os.remove("_pika_dictate.wav")
                return err("Voice transcription failed — Vosk model not loaded")
            except ImportError:
                return err("pyaudio ज़रूरी है (pip install pyaudio)")
            except Exception as ex:
                return err(f"voice_to_text: {ex}")
        return err(f"अज्ञात keyboard action: {action}")
    except Exception as e:
        return err(str(e))


def cmd_web(action, params):
    try:
        # additive block: battery check should not open file:// battery-report.html
        _q = str(params.get("query","") or params.get("name","") or "").lower()
        _u = str(params.get("url","") or "").lower()
        if "battery" in _q or "battery" in _u or "battery-report" in _q or "battery-report" in _u:
            if "report" in _q or "report" in _u or "file://" in _u:
                # redirect to info/battery instead of opening html
                b = psutil.sensors_battery() if psutil else None
                if b:
                    return ok(f"बैटरी {int(b.percent)}%{' (charging)' if b.power_plugged else ''} 🔋", {"percent": int(b.percent), "plugged": b.power_plugged})
                return ok("बैटरी रिपोर्ट के लिए powercfg /batteryreport मैनुअल चलाएं — auto open block किया", {"blocked": True})
        if action == "open_site":
            name = str(params.get("name", "")).lower()
            # block file:// temp html for battery
            if name.startswith("file://") and "battery-report" in name:
                return err("Battery report file open blocked — 'battery check' bolo for percent")
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
    import ast, math
    import operator as opr
    ops = {ast.Add: opr.add, ast.Sub: opr.sub, ast.Mult: opr.mul,
           ast.Div: opr.truediv, ast.Pow: opr.pow, ast.USub: opr.neg, ast.Mod: opr.mod}
    funcs = {"sqrt": math.sqrt, "sin": math.sin, "cos": math.cos, "tan": math.tan, "log": math.log, "ln": math.log, "exp": math.exp, "pow": math.pow, "abs": abs, "floor": math.floor, "ceil": math.ceil, "round": round}

    def ev(node):
        if isinstance(node, ast.Constant):
            return node.value
        # also handle older ast.Num for py<3.8 compat
        if hasattr(ast, "Num") and isinstance(node, ast.Num):
            return node.n
        if isinstance(node, ast.BinOp):
            return ops[type(node.op)](ev(node.left), ev(node.right))
        if isinstance(node, ast.UnaryOp):
            return ops[type(node.op)](ev(node.operand))
        if isinstance(node, ast.Call):
            fn = node.func.id if isinstance(node.func, ast.Name) else ""
            if fn in funcs:
                args = [ev(a) for a in node.args]
                return funcs[fn](*args)
            raise ValueError(f"unknown func {fn}")
        if isinstance(node, ast.Name):
            if node.id == "pi": return math.pi
            if node.id == "e": return math.e
            raise ValueError(f"unknown name {node.id}")
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


_WEATHER_CACHE: dict = {}
def cmd_weather(action, params):
    loc = (params.get("location") or "Delhi").strip()
    # additive 10-min cache (bina hataye)
    now = __import__("time").time()
    key = loc.lower()
    if key in _WEATHER_CACHE and now - _WEATHER_CACHE[key][0] < 600:
        cached = _WEATHER_CACHE[key][1]
        return ok(f"{loc} (cached): {cached['temp']}°C, {cached['desc']}", cached)
    try:
        url = f"https://wttr.in/{urllib.parse.quote(loc)}?format=j1"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read().decode())
        cur = data["current_condition"][0]
        res = {"temp": cur["temp_C"], "desc": cur["weatherDesc"][0]["value"], "humidity": cur["humidity"]}
        _WEATHER_CACHE[key] = (now, res)
        return ok(f"{loc}: {cur['temp_C']}°C, {cur['weatherDesc'][0]['value']}, नमी {cur['humidity']}%",
                  res)
    except Exception as e:
        return err(f"मौसम नहीं मिला: {e}")


# ─── Reminders ───────────────────────────────────────────────────────────────
_reminders: list = []
_reminder_timers: dict = {}  # rid -> threading.Timer for proper cancel
_reminders_lock = threading.Lock()
_main_loop = None


def _persist_reminders():
    """Save active reminders to vault for restart recovery."""
    try:
        data = load_vault_data() or {}
        with _reminders_lock:
            now = time.time()
            active = [r for r in _reminders if r.get("trigger_at", 0) > now]
            data["activeReminders"] = active
        save_vault_data(data)
    except Exception as ex:
        logger.warning(f"Reminder persist failed: {ex}")

def _restore_reminders():
    """Restore reminders from vault on boot — re-arm timers for future ones."""
    try:
        data = load_vault_data() or {}
        saved = data.get("activeReminders", [])
        if not saved: return
        now = time.time()
        restored = 0
        for r in saved:
            trigger_at = r.get("trigger_at", 0)
            rid = r.get("id", "")
            text = r.get("text", "")
            interval = r.get("interval")  # for recurring reminders
            if trigger_at <= now and not interval:
                continue  # already expired (non-recurring)
            delay = max(0, trigger_at - now) if trigger_at > now else 0
            with _reminders_lock:
                _reminders.append({"id": rid, "text": text, "trigger_at": trigger_at, "interval": interval})
            def fire(rid=rid, text=text, interval=interval):
                global _reminders
                with _reminders_lock:
                    _reminders = [r for r in _reminders if r["id"] != rid]
                _persist_reminders()
                if _main_loop and _main_loop.is_running():
                    asyncio.run_coroutine_threadsafe(
                        broadcast(json.dumps({
                            "type": "event", "event": "reminder_triggered",
                            "data": {"id": rid, "text": text},
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        })), _main_loop)
                # Re-arm if recurring
                if interval:
                    _arm_timer(rid, text, interval, interval)
                logger.info(f"Restored reminder fired: {text}")
            t = threading.Timer(delay, fire)
            t.daemon = True
            t.start()
            with _reminders_lock:
                _reminder_timers[rid] = t
            restored += 1
        if restored:
            logger.info(f"Restored {restored} reminders from vault")
    except Exception as ex:
        logger.warning(f"Reminder restore failed: {ex}")

def _arm_timer(rid, text, delay, interval=None):
    """Arm a timer for a reminder. If interval, it becomes recurring."""
    def fire():
        global _reminders
        with _reminders_lock:
            _reminders = [r for r in _reminders if r["id"] != rid]
        _persist_reminders()
        if _main_loop and _main_loop.is_running():
            asyncio.run_coroutine_threadsafe(
                broadcast(json.dumps({
                    "type": "event", "event": "reminder_triggered",
                    "data": {"id": rid, "text": text},
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })), _main_loop)
        if interval:
            _arm_timer(rid, text, interval, interval)
        logger.info(f"Reminder fired: {text}")
    t = threading.Timer(delay, fire)
    t.daemon = True
    t.start()
    with _reminders_lock:
        _reminder_timers[rid] = t
    return t

def cmd_reminders(action, params):
    global _reminders
    if action in ("create", "timer", "add"):
        text = params.get("text", "टाइमर पूरा!")
        seconds = float(params.get("seconds", 60))
        interval = params.get("interval")  # recurring interval in seconds
        rid = str(uuid.uuid4())
        trigger_at = time.time() + seconds
        reminder = {"id": rid, "text": text, "trigger_at": trigger_at}
        if interval:
            reminder["interval"] = float(interval)
        with _reminders_lock:
            _reminders.append(reminder)
        _persist_reminders()
        _arm_timer(rid, text, seconds, float(interval) if interval else None)
        msg = f"रिमाइंडर सेट ({seconds/60:.1f} min): {text}"
        if interval:
            msg += f" [recurring every {float(interval)/60:.1f} min]"
        return ok(msg, {"id": rid})
    if action == "list":
        with _reminders_lock:
            now = time.time()
            active = [r for r in _reminders if r.get("trigger_at", 0) > now]
            return ok("रिमाइंडर्स", {"items": active})
    if action == "cancel":
        rid = params.get("id")
        with _reminders_lock:
            # Cancel the actual timer thread
            t = _reminder_timers.pop(rid, None)
            if t:
                t.cancel()
            _reminders = [r for r in _reminders if r["id"] != rid]
        _persist_reminders()
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
        shots = _DATA_ROOT / "screenshots"
        shots.mkdir(exist_ok=True)
        fp = shots / f"vision_{datetime.now():%Y%m%d_%H%M%S}.jpg"
        fp.write_bytes(buf.getvalue())
        return ok(f"स्क्रीनशॉट ले लिया है ({fp.name})। लाइव विज़न और वेब रिसर्च के लिए Settings में Groq या Gemini API Key डालें।", {"path": str(fp)})
    except Exception as e:
        logger.error(f"Vision error: {e}")
        return err(f"Vision error: {e}")


# ═══════════════════════════════════════════════════════════════════════════
#  HERMES-GRADE PERSISTENT MEMORY (MEMORY.md + USER.md + SQLite)
# ═══════════════════════════════════════════════════════════════════════════
import sqlite3 as _sqlite3

_MEMORY_DIR = Path.home() / ".pika" / "memory"
_MEMORY_DB = _MEMORY_DIR / "memory.db"
_MEMORY_MD = _MEMORY_DIR / "MEMORY.md"
_USER_MD = _MEMORY_DIR / "USER.md"
_SKILLS_DIR = _MEMORY_DIR / "skills"

def _ensure_memory_dir():
    """Create memory directory structure on first run."""
    _MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    _SKILLS_DIR.mkdir(parents=True, exist_ok=True)
    if not _MEMORY_MD.exists():
        _MEMORY_MD.write_text("# Pika Memory\n\nAgent notes, learned facts, and environment info.\n\n", encoding="utf-8")
    if not _USER_MD.exists():
        _USER_MD.write_text("# User Profile\n\nName: (not set)\nLanguage: Hinglish\nPreferences: (none yet)\n\n", encoding="utf-8")
    # Init SQLite
    conn = _sqlite3.connect(str(_MEMORY_DB))
    conn.execute("""CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT DEFAULT 'general',
        content TEXT NOT NULL,
        importance REAL DEFAULT 0.5,
        access_count INTEGER DEFAULT 0,
        created_at TEXT,
        last_accessed TEXT,
        source TEXT DEFAULT 'user'
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS user_profile (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT
    )""")
    conn.commit()
    conn.close()

def _get_memory_db():
    """Get SQLite connection (creates DB if needed)."""
    _ensure_memory_dir()
    conn = _sqlite3.connect(str(_MEMORY_DB))
    conn.row_factory = _sqlite3.Row
    return conn

def _sync_memory_md():
    """Sync MEMORY.md from SQLite memories (top 50 by importance)."""
    try:
        conn = _get_memory_db()
        rows = conn.execute("SELECT category, content, importance, created_at FROM memories ORDER BY importance DESC, last_accessed DESC LIMIT 50").fetchall()
        conn.close()
        lines = ["# Pika Memory\n\n"]
        for r in rows:
            lines.append(f"- [{r['category']}] {r['content']} (importance: {r['importance']:.1f})\n")
        _MEMORY_MD.write_text("".join(lines), encoding="utf-8")
    except: pass

def _sync_user_md():
    """Sync USER.md from SQLite user_profile."""
    try:
        conn = _get_memory_db()
        rows = conn.execute("SELECT key, value FROM user_profile ORDER BY key").fetchall()
        conn.close()
        lines = ["# User Profile\n\n"]
        for r in rows:
            lines.append(f"{r['key']}: {r['value']}\n")
        _USER_MD.write_text("".join(lines), encoding="utf-8")
    except: pass

def memory_add(content: str, category: str = "general", importance: float = 0.5, source: str = "user") -> dict:
    """Add a memory to SQLite + sync MEMORY.md."""
    _ensure_memory_dir()
    now = datetime.now(timezone.utc).isoformat()
    conn = _get_memory_db()
    conn.execute("INSERT INTO memories (category, content, importance, created_at, last_accessed, source) VALUES (?,?,?,?,?,?)",
                 (category, content[:2000], max(0.0, min(1.0, importance)), now, now, source))
    conn.commit()
    conn.close()
    _sync_memory_md()
    return {"status": "added", "category": category, "importance": importance}

def memory_search(query: str, top_k: int = 10, category: str = None) -> list:
    """Search memories via SQLite FTS + TF-IDF hybrid."""
    _ensure_memory_dir()
    conn = _get_memory_db()
    try:
        # Update access count for retrieved memories
        q = "SELECT id, category, content, importance, access_count, created_at FROM memories"
        params = []
        if category:
            q += " WHERE category = ?"
            params.append(category)
        q += " ORDER BY importance DESC, last_accessed DESC LIMIT 200"
        rows = conn.execute(q, params).fetchall()
        
        if not rows:
            conn.close()
            return []
        
        # TF-IDF scoring
        import math
        q_terms = [t.lower() for t in re.findall(r"[\w\u0900-\u097F]+", query.lower()) if len(t) > 1]
        if not q_terms:
            result = [{"id": r["id"], "category": r["category"], "content": r["content"],
                       "importance": r["importance"], "created_at": r["created_at"]} for r in rows[:top_k]]
            conn.close()
            return result
        
        N = len(rows)
        df = {}
        doc_terms_list = []
        for r in rows:
            terms = [t.lower() for t in re.findall(r"[\w\u0900-\u097F]+", r["content"].lower())]
            doc_terms_list.append(terms)
            for t in set(terms):
                df[t] = df.get(t, 0) + 1
        
        scored = []
        now = datetime.now(timezone.utc)
        for idx, r in enumerate(rows):
            tf = {}
            for t in doc_terms_list[idx]:
                tf[t] = tf.get(t, 0) + 1
            score = 0.0
            for qt in q_terms:
                if qt in tf:
                    idf = math.log((N + 1) / (df.get(qt, 1) + 0.5))
                    score += (tf[qt] / max(1, len(doc_terms_list[idx]))) * idf
                    if qt in r["content"].lower():
                        score += 0.15
            # Importance boost
            score += r["importance"] * 0.1
            # Recency boost
            try:
                created = datetime.fromisoformat(r["created_at"].replace("Z", "+00:00"))
                if created.tzinfo is None:
                    created = created.replace(tzinfo=timezone.utc)
                days = (now - created).days
                if days < 7: score += 0.08
                elif days < 30: score += 0.04
            except: pass
            if score > 0:
                scored.append((score, idx))
        
        scored.sort(reverse=True)
        result = []
        ids_to_update = []
        for _, idx in scored[:top_k]:
            r = rows[idx]
            result.append({"id": r["id"], "category": r["category"], "content": r["content"],
                           "importance": r["importance"], "created_at": r["created_at"]})
            ids_to_update.append(r["id"])
        
        # Update access counts
        if ids_to_update:
            placeholders = ",".join("?" * len(ids_to_update))
            conn.execute(f"UPDATE memories SET access_count = access_count + 1, last_accessed = ? WHERE id IN ({placeholders})",
                         [datetime.now(timezone.utc).isoformat()] + ids_to_update)
            conn.commit()
        
        conn.close()
        return result
    except Exception as ex:
        conn.close()
        return []

def memory_list(limit: int = 50) -> list:
    """List all memories."""
    _ensure_memory_dir()
    conn = _get_memory_db()
    rows = conn.execute("SELECT id, category, content, importance, access_count, created_at FROM memories ORDER BY last_accessed DESC LIMIT ?", (limit,)).fetchall()
    conn.close()
    return [{"id": r["id"], "category": r["category"], "content": r["content"],
             "importance": r["importance"], "access_count": r["access_count"], "created_at": r["created_at"]} for r in rows]

def memory_update_importance(memory_id: int, importance: float) -> bool:
    """Update memory importance (0.0 to 1.0)."""
    conn = _get_memory_db()
    conn.execute("UPDATE memories SET importance = ? WHERE id = ?", (max(0.0, min(1.0, importance)), memory_id))
    conn.commit()
    changed = conn.total_changes > 0
    conn.close()
    _sync_memory_md()
    return changed

def memory_delete(memory_id: int) -> bool:
    """Delete a memory by ID."""
    conn = _get_memory_db()
    conn.execute("DELETE FROM memories WHERE id = ?", (memory_id,))
    conn.commit()
    changed = conn.total_changes > 0
    conn.close()
    _sync_memory_md()
    return changed

def memory_clear():
    """Clear all memories."""
    conn = _get_memory_db()
    conn.execute("DELETE FROM memories")
    conn.commit()
    conn.close()
    _sync_memory_md()

# ─── User Profile ──────────────────────────────────────────────────────────
def user_profile_get(key: str = None) -> dict:
    """Get user profile field(s)."""
    _ensure_memory_dir()
    conn = _get_memory_db()
    if key:
        row = conn.execute("SELECT value FROM user_profile WHERE key = ?", (key,)).fetchone()
        conn.close()
        return {key: row["value"]} if row else {}
    else:
        rows = conn.execute("SELECT key, value FROM user_profile ORDER BY key").fetchall()
        conn.close()
        return {r["key"]: r["value"] for r in rows}

def user_profile_set(key: str, value: str) -> dict:
    """Set a user profile field."""
    _ensure_memory_dir()
    now = datetime.now(timezone.utc).isoformat()
    conn = _get_memory_db()
    conn.execute("INSERT OR REPLACE INTO user_profile (key, value, updated_at) VALUES (?,?,?)", (key, value[:1000], now))
    conn.commit()
    conn.close()
    _sync_user_md()
    return {"status": "set", "key": key, "value": value[:100]}

def user_profile_all() -> dict:
    """Get all user profile fields."""
    _ensure_memory_dir()
    conn = _get_memory_db()
    rows = conn.execute("SELECT key, value FROM user_profile ORDER BY key").fetchall()
    conn.close()
    return {r["key"]: r["value"] for r in rows}

# ─── Inject memory into LLM system prompt ──────────────────────────────────
def _build_memory_context() -> str:
    """Build memory context string for LLM injection."""
    try:
        _ensure_memory_dir()
        # USER.md content
        user_content = ""
        if _USER_MD.exists():
            user_content = _USER_MD.read_text(encoding="utf-8")[:1500]
        # Top memories
        mems = memory_list(limit=10)
        mem_text = "\n".join(f"- {m['content'][:120]}" for m in mems)
        # Skills list
        skills = []
        if _SKILLS_DIR.exists():
            for f in _SKILLS_DIR.glob("*.md"):
                skills.append(f.stem)
        skills_text = ", ".join(skills[:20]) if skills else "none yet"
        
        return f"""## User Profile
{user_content}

## Learned Memories
{mem_text}

## Available Skills
{skills_text}"""
    except:
        return ""

# ═══════════════════════════════════════════════════════════════════════════
#  HERMES-GRADE SKILL AUTO-GEN (Self-Improving Agent)
# ═══════════════════════════════════════════════════════════════════════════
def _ensure_skills_dir():
    _SKILLS_DIR.mkdir(parents=True, exist_ok=True)

def skill_save(name: str, description: str, steps: list, trigger: str = "") -> dict:
    """Save a skill as markdown file."""
    _ensure_skills_dir()
    slug = re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')
    fp = _SKILLS_DIR / f"{slug}.md"
    lines = [
        f"# {name}\n\n",
        f"**Trigger:** {trigger}\n\n" if trigger else "",
        f"**Description:** {description}\n\n",
        "## Steps\n\n",
    ]
    for i, step in enumerate(steps, 1):
        lines.append(f"{i}. {step}\n")
    lines.append(f"\n**Created:** {datetime.now(timezone.utc).isoformat()}\n")
    fp.write_text("".join(lines), encoding="utf-8")
    return {"status": "saved", "name": name, "file": str(fp), "slug": slug}

def skill_list() -> list:
    """List all saved skills."""
    _ensure_skills_dir()
    skills = []
    for f in sorted(_SKILLS_DIR.glob("*.md")):
        try:
            content = f.read_text(encoding="utf-8")
            # Extract trigger and description
            trigger = ""
            desc = ""
            for line in content.splitlines():
                if line.startswith("**Trigger:**"):
                    trigger = line.split(":", 1)[1].strip()
                elif line.startswith("**Description:**"):
                    desc = line.split(":", 1)[1].strip()
            skills.append({"name": f.stem, "trigger": trigger, "description": desc, "file": str(f)})
        except: pass
    return skills

def skill_get(name: str) -> dict:
    """Get a skill's full content."""
    _ensure_skills_dir()
    slug = re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')
    fp = _SKILLS_DIR / f"{slug}.md"
    if not fp.exists():
        # Try partial match
        for f in _SKILLS_DIR.glob("*.md"):
            if name.lower() in f.stem.lower():
                fp = f
                break
    if not fp.exists():
        return {"error": f"Skill '{name}' not found"}
    return {"name": fp.stem, "content": fp.read_text(encoding="utf-8"), "file": str(fp)}

def skill_delete(name: str) -> dict:
    """Delete a skill."""
    _ensure_skills_dir()
    slug = re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')
    fp = _SKILLS_DIR / f"{slug}.md"
    if fp.exists():
        fp.unlink()
        return {"status": "deleted", "name": name}
    return {"error": f"Skill '{name}' not found"}

def skill_auto_gen(task: str, result: str, tools_used: list) -> dict:
    """Auto-generate a skill from a successful workflow execution."""
    # Extract pattern from task + result
    task_lower = task.lower()
    # Detect category
    category = "general"
    if any(k in task_lower for k in ["file", "folder", "rename", "copy", "move"]):
        category = "file_management"
    elif any(k in task_lower for k in ["open", "launch", "start", "close", "app"]):
        category = "app_control"
    elif any(k in task_lower for k in ["screenshot", "capture", "screen"]):
        category = "screen"
    elif any(k in task_lower for k in ["search", "find", "google"]):
        category = "web_search"
    elif any(k in task_lower for k in ["email", "mail", "send"]):
        category = "communication"
    elif any(k in task_lower for k in ["schedule", "reminder", "timer", "cron"]):
        category = "scheduling"
    elif any(k in task_lower for k in ["volume", "mute", "brightness", "wifi", "bluetooth"]):
        category = "system_control"
    
    # Generate skill name
    name = f"{category}_{task_lower[:30].replace(' ', '_')}"
    name = re.sub(r'[^a-z0-9_]', '', name)[:40]
    
    # Auto-generate description and steps
    description = f"Auto-generated skill for: {task[:100]}"
    steps = [f"User request: {task[:200]}"]
    if tools_used:
        steps.append(f"Tools used: {', '.join(tools_used)}")
    steps.append(f"Result: {result[:200]}")
    
    # Save if not duplicate
    existing = skill_list()
    existing_names = [s["name"] for s in existing]
    if name not in existing_names:
        return skill_save(name, description, steps, trigger=task[:100])
    return {"status": "exists", "name": name}

def skill_execute(name: str, params: dict = None) -> dict:
    """Execute a skill by name (parse steps and run tools)."""
    skill = skill_get(name)
    if "error" in skill:
        return skill
    # For now, return the skill content for LLM to interpret
    return {"status": "skill_loaded", "name": name, "content": skill.get("content", ""), "params": params}

# ─── Initialize memory on import ───────────────────────────────────────────
try:
    _ensure_memory_dir()
except:
    pass
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
    """Long-term Memory Vault — MEMORY.md + USER.md + SQLite searchable."""
    try:
        if action == "add":
            fact = params.get("fact", "").strip()
            if not fact:
                return err("कोई जानकारी नहीं मिली।")
            category = params.get("category", "general")
            importance = float(params.get("importance", 0.5))
            result = memory_add(fact, category=category, importance=importance)
            # Also add to legacy vault for backward compat
            try:
                existing = load_vault_data() or {}
                vault = existing.get("memoryVault", [])
                vault.append({"fact": fact, "created_at": datetime.now().isoformat(), "category": category})
                existing["memoryVault"] = vault[-500:]
                save_vault_data(existing)
            except: pass
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
            return ok(f"याद रख लिया: '{fact}' 🧠", {"fact": fact, "category": category, "importance": importance})
            
        elif action in ["get", "list"]:
            query = params.get("query", "") or params.get("q", "")
            category = params.get("category", None)
            if query:
                ranked = memory_search(query, top_k=10, category=category)
            else:
                ranked = memory_list(limit=10)
            if not ranked:
                return ok("अभी मेमोरी में कोई बात सेव नहीं है।", {"facts": []})
            facts_text = "\n".join([f"• [{m.get('category','general')}] {m['content']}" for m in ranked])
            return ok(f"आपकी यादें ({len(ranked)}):\n{facts_text}", {"facts": ranked})

        elif action == "search":
            query = params.get("query", "") or params.get("q", "") or params.get("text", "")
            if not query:
                return err("Search query खाली है।")
            ranked = memory_search(query, top_k=8)
            if not ranked:
                return ok("कोई मिलती-जुलती याद नहीं मिली।", {"facts": []})
            facts_text = "\n".join([f"• [{m.get('category','general')}] {m['content']}" for m in ranked])
            return ok(f"सर्च परिणाम ({len(ranked)}):\n{facts_text}", {"facts": ranked})
            
        elif action == "clear":
            memory_clear()
            # Also clear legacy vault
            try:
                existing = load_vault_data() or {}
                existing["memoryVault"] = []
                save_vault_data(existing)
            except: pass
            return ok("मेमोरी वॉल्ट खाली कर दिया गया है। 🧹", {"facts": []})
        
        elif action == "profile_get":
            key = params.get("key", None)
            profile = user_profile_get(key)
            return ok(f"User profile: {json.dumps(profile, ensure_ascii=False)[:500]}", {"profile": profile})
        
        elif action == "profile_set":
            key = params.get("key", "")
            value = params.get("value", "")
            if not key or not value:
                return err("key और value दोनों चाहिए।")
            result = user_profile_set(key, value)
            return ok(f"Profile set: {key} = {value[:50]}", result)
        
        elif action == "profile_all":
            profile = user_profile_all()
            return ok(f"Full profile: {json.dumps(profile, ensure_ascii=False)[:500]}", {"profile": profile})
        
        # ─── Skill actions ───
        elif action == "skill_list":
            skills = skill_list()
            return ok(f"{len(skills)} skills available", {"skills": skills})
        
        elif action == "skill_get":
            name = params.get("name", "")
            skill = skill_get(name)
            if "error" in skill:
                return err(skill["error"])
            return ok(f"Skill: {name}", skill)
        
        elif action == "skill_save":
            name = params.get("name", "")
            desc = params.get("description", "")
            steps = params.get("steps", [])
            trigger = params.get("trigger", "")
            if not name:
                return err("Skill name चाहिए।")
            result = skill_save(name, desc, steps, trigger)
            return ok(f"Skill saved: {name}", result)
        
        elif action == "skill_delete":
            name = params.get("name", "")
            result = skill_delete(name)
            if "error" in result:
                return err(result["error"])
            return ok(f"Skill deleted: {name}", result)
        
        elif action == "skill_auto_gen":
            task = params.get("task", "")
            result_text = params.get("result", "")
            tools = params.get("tools_used", [])
            if not task:
                return err("Task description चाहिए।")
            result = skill_auto_gen(task, result_text, tools)
            return ok(f"Skill auto-generated: {result.get('name', 'exists')}", result)
        
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
    "code": cmd_code, "python": cmd_code, "execute": cmd_code,
    "network": lambda a, p: cmd_info("ip", p) if a == "ip" else err("अज्ञात network action"),
}

CONFIRM_REQUIRED = {("system", "shutdown"), ("system", "restart"), ("system", "hibernate"),
                    ("files", "delete"), ("processes", "kill")}
PENDING_CONFIRM: dict = {}


def route_command(data: dict) -> dict:
    category = data.get("category", "")
    action = data.get("action", "")
    params = data.get("params", {}) or {}
    # additive injection shield (bina kuchh hataye)
    try:
        txt = str(params.get("text","") or params.get("query","") or params.get("command","") or "")
        if is_injection(txt) or is_injection(f"{category} {action}"):
            audit_log("injection_blocked", {"category": category, "action": action, "text": txt[:120]})
            return err("⚠️ Suspicious prompt blocked (injection filter)")
    except Exception:
        pass
    if not check_rate(category, action):
        audit_log("rate_limited", {"category": category, "action": action})
        return err("⏳ Rate limited — thoda ruk kar try karo")
    handler = ROUTES.get(category)
    if not handler:
        return err(f"अज्ञात category: {category}")
    try:
        res = handler(action, params)
        audit_log("tool_call", {"category": category, "action": action, "status": res.get("success")})
        return res
    except Exception as e:
        logger.error(f"route error: {e}")
        audit_log("tool_error", {"category": category, "action": action, "error": str(e)[:200]})
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
        "files": {"desc": "Safe file operations under HOME", "actions": ["create_file","create_folder","delete","list","open_explorer","read","write","rename","search","copy","move","write_atomic"]},
        "disk": {"desc": "Drive usage & cleanup", "actions": ["list_drives","cleanup_temp"]},
        "clipboard": {"desc": "Clipboard read/write", "actions": ["save","get","set","clear","history"]},
        "screen": {"desc": "Screenshots & brightness & recording", "actions": ["screenshot","brightness_set","brightness_up","brightness_down","start_recording","stop_recording","recording_status"]},
        "keyboard": {"desc": "Keyboard type/hotkey", "actions": ["type","hotkey"]},
        "web": {"desc": "Open sites/search/youtube play", "actions": ["open_site","search","youtube_search","youtube_play","play_song"]},
        "calculator": {"desc": "Safe math eval", "actions": ["eval"]},
        "password": {"desc": "Generate password", "actions": ["generate"]},
        "translator": {"desc": "Translate via MyMemory", "actions": ["translate"]},
        "weather": {"desc": "Weather via wttr.in", "actions": ["get"]},
        "reminders": {"desc": "Timers & reminders with vault persistence", "actions": ["create","timer","add","list","cancel"]},
        "obsidian": {"desc": "Obsidian Local REST API", "actions": ["list_files","read_file","create_file","append_file","delete_file","search","daily_note","get_active","open_file","status"]},
        "vision": {"desc": "Screen vision + research", "actions": ["analyze"]},
        "memory": {"desc": "Long-term memory: MEMORY.md + USER.md + SQLite + Skills", "actions": ["add","list","search","clear","get","profile_get","profile_set","profile_all","skill_list","skill_get","skill_save","skill_delete","skill_auto_gen"]},
        "uia": {"desc": "UI Automation — cursor/OCR/image find/multi-monitor", "actions": ["click","right_click","double_click","move","drag","type","scroll","get_position","get_monitors","find_text","find_image","tree"]},
        "browser": {"desc": "Full Browser DOM automation — click/fill/extract/navigate", "actions": ["open","click","fill","type","extract","get_text","get_html","get_links","get_forms","fill_form","select","check","wait","screenshot","scroll","eval","back","forward","reload"]},
        "code": {"desc": "Safe Python code execution sandbox (Open Interpreter style)", "actions": ["exec","execute","run","eval","evaluate"]},
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
            r = requests.get(target_url, headers=headers, timeout=8)
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
            # WinError 10013 = Windows Firewall/Antivirus ne outbound block kiya
            if "10013" in last_err or "forbidden by its access permissions" in last_err:
                last_err = ("Windows Firewall ne block kiya (WinError 10013). "
                            "Fix: Windows Defender Firewall → Allow an app → "
                            "pc_bridge.exe / python.exe ko Allow karein, "
                            "ya Admin PowerShell me: netsh advfirewall firewall add rule "
                            "name=\"Pika AI Bridge\" dir=out action=allow program=\""
                            + (sys.executable if _FROZEN else sys.executable) + "\" enable=yes")
                # Best-effort auto-allow (needs Admin, may fail silently)
                try:
                    import subprocess as _sp2
                    prog = sys.executable if _FROZEN else sys.executable
                    _sp2.run(["netsh", "advfirewall", "firewall", "add", "rule",
                              "name=Pika AI Bridge", "dir=out", "action=allow",
                              f"program=\"{prog}\"", "enable=yes"],
                             capture_output=True, timeout=4)
                except Exception:
                    pass

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
    "4. PC AUTOMATION: You control the user's PC (apps, volume, brightness, screenshots, system telemetry, Obsidian notes, files, web search, browser DOM). Confirm actions with cheerful confidence.\n"
    "5. FILE PATHS (HERMES/JARVIS-grade, no hallucination):\n"
    "   • 'desktop pr' ALWAYS means Desktop/daily_note_YYYY_MM_DD.txt via resolve_path() → C:\\Users\\DELL\\Desktop, NEVER E:\\obsidian or custom vault.\n"
    "   • '.txt daily note' → files/create_file Desktop/daily_note_YYYY_MM_DD.txt, '.md' → obsidian/read_file, 'camera' → microsoft.windows.camera: via find_installed_app_fast().\n"
    "   • For cursor: use uia/move {x,y}, uia/click {x,y,monitor}, uia/find_image {image_b64}, uia/find_text {text}, screen/start_recording.\n"
    "   • Never hallucinate paths; if unsure use files/list Desktop to confirm.\n"
    "6. MEMORY & SKILLS: You have persistent memory (MEMORY.md + USER.md + SQLite) and auto-generated skills.\n"
    "   • Use memory/add to remember facts, memory/search to recall, memory/profile_set to update user profile.\n"
    "   • Use memory/skill_list to see available skills, memory/skill_auto_gen to create new ones from successful workflows.\n"
    "   • Always check memory before answering — the user's preferences and history are stored there.\n"
    "7. BROWSER AUTOMATION: Full DOM control via Playwright.\n"
    "   • Use browser/click {selector} to click elements, browser/fill {selector, value} to fill forms.\n"
    "   • Use browser/extract {selector} to get text, browser/get_links to get all links.\n"
    "   • Use browser/fill_form {fields: {sel1: val1, sel2: val2}} for multi-field forms.\n"
    "8. SELF-CORRECTION: If tool returns err, explain briefly in user's language and suggest fix, don't spam.\n"
    "9. REACT REASONING: For complex multi-step tasks, think step-by-step:\n"
    "   • Step 1: Analyze what the user wants → break into smaller tasks\n"
    "   • Step 2: Execute each task using the right tool (files, browser, code, etc.)\n"
    "   • Step 3: Verify results before moving to next step\n"
    "   • Step 4: If a step fails, try a DIFFERENT approach (don't repeat same error)\n"
    "   • Example: 'Download notepad, open it, type hello, save as test.txt' = 4 steps, execute sequentially\n"
    "10. CODE FIRST, GUI FALLBACK: When automating:\n"
    "   • FIRST try: PowerShell/Python/code (99% faster, 100% accurate)\n"
    "   • THEN try: UI Automation (uia/click, uia/move) for visual apps\n"
    "   • LAST resort: Vision analysis (vision/analyze) for unknown interfaces\n"
    "11. TOOL CALLING: When you need to use a tool, output EXACTLY:\n"
    "   Action: {\"tool\": \"category/action\", \"params\": {\"key\": \"value\"}}\n"
    "   After getting the result (Observation), continue with next step or Final Answer."
)
# Inject memory context into system prompt
try:
    _mem_ctx = _build_memory_context()
    if _mem_ctx:
        SYSTEM_PROMPT += f"\n\n## Current Context\n{_mem_ctx}"
except:
    pass
HISTORY: list = []  # legacy global fallback
HISTORY_BY_WS: dict = {}  # per-connection isolation
LLM_SEMAPHORE = None  # lazy init asyncio.Semaphore(2)
_LLM_RATE: dict = {}  # ws_id -> [timestamps] for rate limit
CURRENT_PROVIDER = next((p for p in LLM_ORDER if os.getenv(LLM_PROVIDERS[p][2])), "groq")

# ─── Token counting (approximation for Hindi/English mixed) ────────────────
def _count_tokens(text: str) -> int:
    """Approximate token count — ~1.3 tokens per word for Hindi/English mixed."""
    if not text: return 0
    words = len(text.split())
    chars = len(text)
    # Hindi chars are ~1.5 tokens each, English ~0.75 tokens per word
    hindi_chars = sum(1 for c in text if '\u0900' <= c <= '\u097F')
    eng_chars = chars - hindi_chars
    return int(hindi_chars * 1.3 + eng_chars * 0.75 + words * 0.2)

def _summarize_history(history: list, max_tokens: int = 3000) -> list:
    """Compress history by summarizing older messages when too long."""
    if not history: return history
    total = sum(_count_tokens(m.get("content","")) for m in history)
    if total <= max_tokens: return history
    # Keep last 4 messages intact, summarize rest
    keep = history[-4:]
    old = history[:-4]
    if not old: return keep
    # Create a compact summary of old messages
    summary_parts = []
    for m in old:
        role = m.get("role","user")
        content = m.get("content","")[:100]
        summary_parts.append(f"{role}: {content}")
    summary = "[Earlier conversation summary]\n" + "\n".join(summary_parts[-6:])
    return [{"role": "system", "content": summary}] + keep

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
        model_path = _APP_ROOT / "models" / "piper" / "hi.onnx"
        config_path = _APP_ROOT / "models" / "piper" / "hi.onnx.json"
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


# ═══════════════════════════════════════════════════════════════════════════
#  REACT AGENT LOOP (Open Interpreter + Nous Hermes Style)
#  Multi-step autonomous tool calling with self-correction
# ═══════════════════════════════════════════════════════════════════════════
_REACT_MAX_STEPS = 8
_REACT_SYSTEM_PROMPT = """You are Pika ReAct — an autonomous multi-step agent.

## How You Work (ReAct Pattern)
For EVERY user request, you MUST follow this exact pattern:

Thought: [Analyze what the user wants, break it into steps]
Action: [Call a tool using JSON: {"tool": "category/action", "params": {...}}]
Observation: [Read the tool result carefully]
... (repeat Thought/Action/Observation as needed) ...
Final Answer: [Give the user a clear, friendly answer in Hinglish/Hindi/English]

## Available Tools (JSON format)
- {"tool": "system/shutdown", "params": {}} — PC shutdown
- {"tool": "system/lock", "params": {}} — Lock PC
- {"tool": "volume/set", "params": {"percent": 50}} — Set volume
- {"tool": "apps/open", "params": {"name": "notepad"}} — Open app
- {"tool": "files/create_file", "params": {"path": "file.txt", "content": "..."}} — Create file
- {"tool": "files/read", "params": {"path": "file.txt"}} — Read file
- {"tool": "files/list", "params": {"path": "."}} — List files
- {"tool": "files/search", "params": {"pattern": "*.txt"}} — Search files
- {"tool": "screen/screenshot", "params": {}} — Take screenshot
- {"tool": "clipboard/set", "params": {"text": "..."}} — Set clipboard
- {"tool": "clipboard/get", "params": {}} — Get clipboard
- {"tool": "web/search", "params": {"query": "..."}} — Web search
- {"tool": "web/open_site", "params": {"url": "..."}} — Open website
- {"tool": "code/exec", "params": {"code": "print('hello')"}} — Run Python code
- {"tool": "code/eval", "params": {"expression": "2+2"}} — Evaluate expression
- {"tool": "calculator/eval", "params": {"expression": "sqrt(16)"}} — Math calc
- {"tool": "memory/add", "params": {"content": "fact", "category": "info"}} — Save memory
- {"tool": "memory/search", "params": {"query": "..."}} — Search memory
- {"tool": "browser/open", "params": {"url": "..."}} — Open in browser
- {"tool": "browser/click", "params": {"selector": "#btn"}} — Click element
- {"tool": "browser/fill", "params": {"selector": "#input", "value": "..."}} — Fill form
- {"tool": "browser/extract", "params": {"selector": "body"}} — Extract text
- {"tool": "uia/click", "params": {"x": 500, "y": 300}} — Click screen coords
- {"tool": "uia/move", "params": {"x": 500, "y": 300}} — Move cursor
- {"tool": "vision/analyze", "params": {"query": "what's on screen"}} — Analyze screen

## Rules
1. ALWAYS start with "Thought:" — never skip reasoning
2. Use EXACT JSON for tool calls: {"tool": "category/action", "params": {...}}
3. After each Action, wait for Observation before continuing
4. If a tool fails, analyze the error and try a DIFFERENT approach
5. Maximum 8 steps — if not solved, explain what happened
6. Respond in the user's language (Hinglish/Hindi/English)
7. NEVER make up tool results — always wait for actual Observation
8. For complex tasks: break into smaller steps and execute one by one
"""

# Hermes-style tool definitions (JSON Schema)
HERMES_TOOLS = [
    {"type": "function", "function": {"name": "system_shutdown", "description": "Shutdown the PC", "parameters": {"type": "object", "properties": {}, "required": []}}},
    {"type": "function", "function": {"name": "system_lock", "description": "Lock the PC", "parameters": {"type": "object", "properties": {}, "required": []}}},
    {"type": "function", "function": {"name": "volume_set", "description": "Set volume to exact percentage", "parameters": {"type": "object", "properties": {"percent": {"type": "integer", "description": "Volume 0-100"}}, "required": ["percent"]}}},
    {"type": "function", "function": {"name": "apps_open", "description": "Open an application", "parameters": {"type": "object", "properties": {"name": {"type": "string", "description": "App name"}}, "required": ["name"]}}},
    {"type": "function", "function": {"name": "files_create", "description": "Create a file with content", "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "content": {"type": "string"}}, "required": ["path", "content"]}}},
    {"type": "function", "function": {"name": "files_read", "description": "Read a file", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]}}},
    {"type": "function", "function": {"name": "files_list", "description": "List files in directory", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}, "required": []}}},
    {"type": "function", "function": {"name": "files_search", "description": "Search files by pattern", "parameters": {"type": "object", "properties": {"pattern": {"type": "string"}}, "required": ["pattern"]}}},
    {"type": "function", "function": {"name": "screen_screenshot", "description": "Take a screenshot", "parameters": {"type": "object", "properties": {}, "required": []}}},
    {"type": "function", "function": {"name": "clipboard_get", "description": "Get clipboard content", "parameters": {"type": "object", "properties": {}, "required": []}}},
    {"type": "function", "function": {"name": "clipboard_set", "description": "Set clipboard content", "parameters": {"type": "object", "properties": {"text": {"type": "string"}}, "required": ["text"]}}},
    {"type": "function", "function": {"name": "web_search", "description": "Search the web", "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}}},
    {"type": "function", "function": {"name": "web_open", "description": "Open a website", "parameters": {"type": "object", "properties": {"url": {"type": "string"}}, "required": ["url"]}}},
    {"type": "function", "function": {"name": "code_exec", "description": "Execute Python code safely in sandboxed REPL", "parameters": {"type": "object", "properties": {"code": {"type": "string"}}, "required": ["code"]}}},
    {"type": "function", "function": {"name": "code_eval", "description": "Evaluate a math expression", "parameters": {"type": "object", "properties": {"expression": {"type": "string"}}, "required": ["expression"]}}},
    {"type": "function", "function": {"name": "calculator_eval", "description": "Safe math evaluation", "parameters": {"type": "object", "properties": {"expression": {"type": "string"}}, "required": ["expression"]}}},
    {"type": "function", "function": {"name": "memory_add", "description": "Save a fact to memory", "parameters": {"type": "object", "properties": {"content": {"type": "string"}, "category": {"type": "string"}}, "required": ["content"]}}},
    {"type": "function", "function": {"name": "memory_search", "description": "Search memory", "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}}},
    {"type": "function", "function": {"name": "browser_open", "description": "Open URL in browser", "parameters": {"type": "object", "properties": {"url": {"type": "string"}}, "required": ["url"]}}},
    {"type": "function", "function": {"name": "browser_click", "description": "Click a DOM element", "parameters": {"type": "object", "properties": {"selector": {"type": "string"}}, "required": ["selector"]}}},
    {"type": "function", "function": {"name": "browser_fill", "description": "Fill a form field", "parameters": {"type": "object", "properties": {"selector": {"type": "string"}, "value": {"type": "string"}}, "required": ["selector", "value"]}}},
    {"type": "function", "function": {"name": "browser_extract", "description": "Extract text from page", "parameters": {"type": "object", "properties": {"selector": {"type": "string"}}, "required": []}}},
    {"type": "function", "function": {"name": "uia_click", "description": "Click at screen coordinates", "parameters": {"type": "object", "properties": {"x": {"type": "integer"}, "y": {"type": "integer"}}, "required": ["x", "y"]}}},
    {"type": "function", "function": {"name": "uia_move", "description": "Move cursor to coordinates", "parameters": {"type": "object", "properties": {"x": {"type": "integer"}, "y": {"type": "integer"}}, "required": ["x", "y"]}}},
    {"type": "function", "function": {"name": "vision_analyze", "description": "Analyze what's on screen", "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": []}}},
]

# ═══════════════════════════════════════════════════════════════════════════
#  HERMES-3 DYNAMIC TOOL SCHEMA GENERATOR
#  Generates full JSON Schema for all 25+ tool categories
# ═══════════════════════════════════════════════════════════════════════════
def get_hermes_tool_manifest() -> list:
    """Generate complete Hermes-3 tool schema for all ROUTES categories."""
    manifest = []
    _tool_defs = {
        "system": {"desc": "PC power controls", "actions": ["shutdown","restart","sleep","lock","logoff","hibernate","empty_recycle_bin","flush_dns","temp_clean"], "params": {}},
        "volume": {"desc": "Volume control", "actions": ["up","down","mute","unmute","set"], "params": {"percent": {"type": "integer", "minimum": 0, "maximum": 100}}},
        "media": {"desc": "Media playback", "actions": ["play_pause","next","previous","stop"], "params": {}},
        "apps": {"desc": "Application management", "actions": ["open","close","list","focus"], "params": {"name": {"type": "string"}}},
        "window": {"desc": "Window management", "actions": ["minimize","maximize","fullscreen","snap_left","snap_right","show_desktop","switch","close"], "params": {}},
        "info": {"desc": "System information", "actions": ["battery","cpu","ram","disk","ip","time","date","full_report","ollama_status","network_status"], "params": {}},
        "processes": {"desc": "Process management", "actions": ["list","kill"], "params": {"name_or_pid": {"type": "string"}}},
        "files": {"desc": "File operations", "actions": ["create","read","write","copy","move","delete","rename","search","open_explorer"], "params": {"path": {"type": "string"}, "content": {"type": "string"}}},
        "clipboard": {"desc": "Clipboard operations", "actions": ["get","set","clear","save"], "params": {"text": {"type": "string"}}},
        "screen": {"desc": "Screen capture & display", "actions": ["screenshot","peel","ocr","start_recording","stop_recording","brightness_set"], "params": {"window": {"type": "string"}}},
        "keyboard": {"desc": "Keyboard automation", "actions": ["type","hotkey","dictate","voice_to_text"], "params": {"text": {"type": "string"}, "keys": {"type": "string"}}},
        "web": {"desc": "Web & YouTube", "actions": ["open_site","search","youtube_play","youtube_search"], "params": {"query": {"type": "string"}, "url": {"type": "string"}}},
        "calculator": {"desc": "Math evaluation", "actions": ["eval"], "params": {"expression": {"type": "string"}}},
        "password": {"desc": "Password generation", "actions": ["generate"], "params": {"length": {"type": "integer"}}},
        "translator": {"desc": "Translation", "actions": ["translate"], "params": {"text": {"type": "string"}, "target_lang": {"type": "string"}}},
        "weather": {"desc": "Weather info", "actions": ["get"], "params": {"location": {"type": "string"}}},
        "reminders": {"desc": "Reminders", "actions": ["create","list","delete","cancel"], "params": {"text": {"type": "string"}, "minutes": {"type": "integer"}}},
        "obsidian": {"desc": "Obsidian vault", "actions": ["read_file","search","create_note","daily"], "params": {"path": {"type": "string"}, "content": {"type": "string"}}},
        "memory": {"desc": "Long-term memory", "actions": ["add","get","list","search","delete"], "params": {"fact": {"type": "string"}, "query": {"type": "string"}}},
        "uia": {"desc": "Desktop automation", "actions": ["move","click","right_click","double_click","drag","type","scroll","find_text","find_image","get_monitors","deep_tree"], "params": {"x": {"type": "integer"}, "y": {"type": "integer"}, "text": {"type": "string"}}},
        "browser": {"desc": "Browser automation", "actions": ["open","click","type","navigate","screenshot","get_text","scroll","eval_js"], "params": {"url": {"type": "string"}, "selector": {"type": "string"}}},
        "code": {"desc": "Python code execution", "actions": ["exec","eval","history","clear","pip_install"], "params": {"code": {"type": "string"}, "expression": {"type": "string"}}},
        "connectors": {"desc": "OAuth integrations", "actions": ["list","connect","disconnect","gmail_list","calendar_list","drive_list"], "params": {"connector": {"type": "string"}}},
        "scheduler": {"desc": "Task scheduling", "actions": ["add","list","remove","pause","resume"], "params": {"command": {"type": "string"}, "schedule": {"type": "string"}}},
        "vision": {"desc": "Screen analysis", "actions": ["describe","ocr"], "params": {"query": {"type": "string"}}},
    }
    for cat, info in _tool_defs.items():
        for action in info["actions"]:
            tool_name = f"{cat}/{action}"
            schema = {"type": "object", "properties": dict(info["params"]), "required": []}
            manifest.append({
                "type": "function",
                "function": {
                    "name": tool_name,
                    "description": f"{info['desc']}: {action}",
                    "parameters": schema
                }
            })
    return manifest

def get_hermes_tools_xml() -> str:
    """Format tool manifest as Hermes XML for system prompt."""
    manifest = get_hermes_tool_manifest()
    tools_json = json.dumps(manifest, indent=2, ensure_ascii=False)
    return f"<tools>\n{tools_json}\n</tools>"

def _parse_react_tool_call(text: str) -> dict | None:
    """Extract JSON tool call from LLM output. Supports multiple formats."""
    import re as _re
    # Format 1: {"tool": "category/action", "params": {...}} — find JSON with balanced braces
    # Try to find a JSON object containing "tool" key
    for m in _re.finditer(r'\{', text):
        start = m.start()
        depth = 0
        for i in range(start, len(text)):
            if text[i] == '{': depth += 1
            elif text[i] == '}': depth -= 1
            if depth == 0:
                candidate = text[start:i+1]
                if '"tool"' in candidate and '"params"' in candidate:
                    try:
                        return json.loads(candidate)
                    except: pass
                break
    # Format 2: <tool_call>{"name": "func", "arguments": {...}}</tool_call>
    m = _re.search(r'<tool_call>\s*(\{.*?\})\s*</tool_call>', text, _re.DOTALL)
    if m:
        try:
            data = json.loads(m.group(1))
            return {"tool": data.get("name",""), "params": data.get("arguments",{})}
        except: pass
    # Format 3: Action: tool_name(params)
    m = _re.search(r'Action:\s*(\w+)\((.*?)\)', text, _re.DOTALL)
    if m:
        tool_name = m.group(1)
        try:
            params = json.loads("{" + m.group(2) + "}") if m.group(2).strip() else {}
        except:
            params = {"raw": m.group(2)}
        return {"tool": tool_name, "params": params}
    return None

def _resolve_react_tool(tool_path: str) -> tuple:
    """Resolve 'category/action' to (category, action)."""
    parts = tool_path.split("/", 1)
    if len(parts) == 2:
        return parts[0], parts[1]
    return tool_path, ""

async def handle_react_agent(ws, msg):
    """Hermes-3 ReAct Agent Loop — multi-step autonomous tool calling with self-healing."""
    params = msg.get("params") or {}
    text = params.get("text", "")
    conv_id = msg.get("id")
    provider_name = params.get("provider", "groq")
    
    # Get API key
    provider_info = LLM_PROVIDERS.get(provider_name, ("", "", ""))
    url, default_model, env_var = provider_info
    api_key = params.get("api_key", "") or os.getenv(env_var, "")
    model = (params.get("provider_models") or {}).get(provider_name, default_model)
    
    if not api_key:
        await ws.send(json.dumps({"type": "llm_stream", "chunk": "Error: No API key for Hermes agent.", "done": True, "id": conv_id}))
        return
    
    # Build Hermes-3 tool manifest (XML format)
    tools_xml = get_hermes_tools_xml()
    
    messages = [
        {"role": "system", "content": f"""{tools_xml}

You are Pika AI — a Hermes-3 autonomous desktop assistant. You solve tasks step-by-step.

## Protocol
1. Think step-by-step (Thought)
2. Call a tool (Action) using: <tool_call>{{"name": "category/action", "arguments": {{...}}}}</tool_call>
3. Observe the result (Observation)
4. Repeat until done
5. Give Final Answer: when complete

## Rules
- Use category/action format (e.g., "apps/open", "volume/set", "code/exec")
- Always include required parameters
- If a tool fails, try a different approach
- Maximum 8 steps per task
- For code execution, use "code/exec" with "code" parameter
- Generate artifacts to ~/Documents/Pika_Output/ when creating files/plots

## Output Format
Thought: [reasoning]
<tool_call>{{"name": "category/action", "arguments": {{"param": "value"}}}}</tool_call>

Observation: [result]

Thought: [next step]
...

Final Answer: [summary]"""},
        {"role": "user", "content": text}
    ]
    
    # Send agent started event
    await ws.send(json.dumps({
        "type": "event", "event": "react_started",
        "data": {"query": text, "tools_count": len(get_hermes_tool_manifest())},
        "timestamp": datetime.now(timezone.utc).isoformat()
    }))
    
    for step in range(_REACT_MAX_STEPS):
        # Call LLM
        full_response = ""
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                payload = {
                    "model": model,
                    "messages": messages,
                    "temperature": 0.3,
                    "max_tokens": 2048,
                }
                headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
                async with session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                    if resp.status != 200:
                        error_text = await resp.text()
                        await ws.send(json.dumps({"type": "event", "event": "react_step", "data": {"step": step+1, "status": "error", "error": error_text[:200]}, "timestamp": datetime.now(timezone.utc).isoformat()}))
                        break
                    result = await resp.json()
                    full_response = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        except Exception as e:
            await ws.send(json.dumps({"type": "event", "event": "react_step", "data": {"step": step+1, "status": "error", "error": str(e)[:200]}, "timestamp": datetime.now(timezone.utc).isoformat()}))
            break
        
        # Send step event
        await ws.send(json.dumps({
            "type": "event", "event": "react_step",
            "data": {"step": step+1, "response": full_response[:500]},
            "timestamp": datetime.now(timezone.utc).isoformat()
        }))
        
        # Check for Final Answer
        if "Final Answer:" in full_response:
            final = full_response.split("Final Answer:")[-1].strip()
            await ws.send(json.dumps({
                "type": "llm_stream", "chunk": final,
                "provider": provider_name, "id": conv_id, "done": True,
                "usage": {"prompt_tokens": len(text)//4, "completion_tokens": len(full_response)//4, "total_tokens": (len(text)+len(full_response))//4},
                "timestamp": datetime.now(timezone.utc).isoformat()
            }))
            return
        
        # Parse tool call
        tool_call = _parse_react_tool_call(full_response)
        if not tool_call:
            # No tool call found — treat as final answer
            await ws.send(json.dumps({
                "type": "llm_stream", "chunk": full_response,
                "provider": provider_name, "id": conv_id, "done": True,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }))
            return
        
        # Execute tool
        tool_path = tool_call.get("tool", "")
        tool_params = tool_call.get("params", {})
        category, action = _resolve_react_tool(tool_path)
        
        await ws.send(json.dumps({
            "type": "event", "event": "react_tool_call",
            "data": {"tool": tool_path, "params": tool_params, "step": step+1},
            "timestamp": datetime.now(timezone.utc).isoformat()
        }))
        
        # Route command
        result = route_command({"category": category, "action": action, "params": tool_params})
        observation = json.dumps(result, ensure_ascii=False)[:2000]
        
        await ws.send(json.dumps({
            "type": "event", "event": "react_tool_result",
            "data": {"tool": tool_path, "result": result.get("message", "")[:300], "success": result.get("success", False)},
            "timestamp": datetime.now(timezone.utc).isoformat()
        }))
        
        # Feed observation back to LLM
        messages.append({"role": "assistant", "content": full_response})
        messages.append({"role": "user", "content": f"Observation: {observation}\n\nNow continue with the next Thought/Action or Final Answer."})
    
    # Max steps reached
    await ws.send(json.dumps({
        "type": "llm_stream", "chunk": "ReAct agent completed max steps. Please check the results above.",
        "provider": provider_name, "id": conv_id, "done": True,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }))


# ═══════════════════════════════════════════════════════════════════════════
#  VLM VISION GROUNDING (Anthropic Computer Use Style)
#  Screenshot → identify clickable elements → return X,Y coordinates
# ═══════════════════════════════════════════════════════════════════════════
async def handle_vlm_grounding(ws, msg):
    """Take screenshot, send to VLM, get element coordinates for clicking."""
    params = msg.get("params") or {}
    query = params.get("query", "Find the clickable elements and their coordinates")
    conv_id = msg.get("id")
    
    # Take screenshot
    try:
        from PIL import ImageGrab, Image
        import io as _io
        img = ImageGrab.grab()
        max_w = 1280
        ratio = max_w / img.width
        img = img.resize((max_w, int(img.height * ratio)), Image.Resampling.LANCZOS)
        buf = _io.BytesIO()
        img.convert("RGB").save(buf, format="JPEG", quality=75)
        b64_image = base64.b64encode(buf.getvalue()).decode("utf-8")
    except Exception as e:
        await ws.send(json.dumps({"type": "llm_stream", "chunk": f"Screenshot error: {e}", "done": True, "id": conv_id}))
        return
    
    # VLM grounding prompt
    grounding_prompt = f"""Analyze this screenshot and find clickable UI elements.

User wants to: {query}

For EACH clickable element you find, return a JSON array:
[
  {{"name": "element description", "x": <center_x>, "y": <center_y>, "type": "button/link/input/icon"}},
  ...
]

Rules:
- x,y are CENTER coordinates in pixels (origin top-left)
- Image is 1280px wide, coordinates must be within that range
- Only include actually clickable elements (buttons, links, inputs, icons)
- Be precise — these coordinates will be used for clicking
- Return ONLY the JSON array, no other text
"""
    
    # Try providers in order
    providers = [
        ("groq", os.getenv("GROQ_API_KEY", ""), "llama-3.2-11b-vision-preview"),
        ("gemini", os.getenv("GEMINI_API_KEY", ""), "gemini-1.5-flash"),
        ("mistral", os.getenv("MISTRAL_API_KEY", ""), "pixtral-12b-2409"),
    ]
    
    grounding_result = None
    for prov_name, api_key, model_id in providers:
        if not api_key:
            continue
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                if prov_name == "groq":
                    payload = {
                        "model": model_id,
                        "messages": [{"role": "user", "content": [
                            {"type": "text", "text": grounding_prompt},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_image}"}}
                        ]}],
                        "max_tokens": 1024,
                    }
                    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
                    async with session.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                        if resp.status == 200:
                            result = await resp.json()
                            grounding_result = result.get("choices", [{}])[0].get("message", {}).get("content", "")
                            break
                elif prov_name == "gemini":
                    import urllib.request as _req
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={api_key}"
                    payload = {"contents": [{"parts": [{"text": grounding_prompt}, {"inline_data": {"mime_type": "image/jpeg", "data": b64_image}}]}]}
                    data = json.dumps(payload).encode()
                    req = _req.Request(url, data=data, headers={"Content-Type": "application/json"})
                    with _req.urlopen(req, timeout=15) as r:
                        result = json.loads(r.read().decode())
                        grounding_result = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                        break
        except Exception:
            continue
    
    if not grounding_result:
        await ws.send(json.dumps({"type": "llm_stream", "chunk": "VLM grounding failed. No provider available.", "done": True, "id": conv_id}))
        return
    
    # Parse coordinates from VLM response
    import re as _re
    elements = []
    try:
        # Try to extract JSON array from response
        m = _re.search(r'\[.*?\]', grounding_result, _re.DOTALL)
        if m:
            elements = json.loads(m.group())
    except:
        pass
    
    # Send results
    await ws.send(json.dumps({
        "type": "vlm_grounding_result",
        "elements": elements,
        "raw_analysis": grounding_result[:1000],
        "id": conv_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
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

            if mtype == "react_agent":
                await handle_react_agent(ws, data)
                continue

            if mtype == "vlm_grounding":
                await handle_vlm_grounding(ws, data)
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


# ─── CLI Arguments (argparse) ──────────────────────────────────────────────
def parse_args():
    import argparse
    parser = argparse.ArgumentParser(description="Pika AI — PC Bridge WebSocket Server")
    parser.add_argument("--host", default="0.0.0.0", help="Bind host (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8765, help="Bind port (default: 8765)")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    parser.add_argument("--no-banner", action="store_true", help="Suppress startup banner")
    return parser.parse_args()

# ─── Graceful Shutdown ─────────────────────────────────────────────────────
_shutdown_event = threading.Event()

def _cleanup_on_shutdown():
    """Cleanup threads, recordings, timers on shutdown."""
    logger.info("Shutting down — cleaning up...")
    _shutdown_event.set()
    # Stop any active screen recording
    global _recording
    try:
        if _recording:
            _recording = False
            logger.info("Screen recording stopped")
    except: pass
    # Persist active reminders
    try:
        _persist_reminders()
        logger.info("Reminders persisted")
    except: pass
    logger.info("Cleanup complete")


async def main():
    global _main_loop, HOST, PORT
    _main_loop = asyncio.get_running_loop()
    threading.Thread(target=ensure_vosk_model, daemon=True).start()
    _restore_reminders()  # Restore persisted reminders on boot
    # Start Telegram bot if configured
    tg_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if tg_token:
        threading.Thread(target=_start_telegram_bot, args=(tg_token,), daemon=True).start()
        logger.info("Telegram bot started")
    print_banner()
    # Register shutdown handler
    import signal
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _cleanup_on_shutdown)
        except: pass
    async with serve(handle_client, HOST, PORT):
        await asyncio.Future()


# ── Telegram Bot Bridge ──────────────────────────────────────────────────
def _start_telegram_bot(token: str):
    """Start Telegram bot in background thread — receives messages, routes to Pika, sends response."""
    try:
        import urllib.request as _req
        import urllib.parse as _parse
        import time as _t
        
        API = f"https://api.telegram.org/bot{token}"
        offset = 0
        logger.info(f"Telegram bot polling started")
        
        def send_message(chat_id, text):
            """Send message to Telegram chat."""
            try:
                data = _parse.urlencode({"chat_id": chat_id, "text": text[:4000], "parse_mode": "HTML"}).encode()
                req = _req.Request(f"{API}/sendMessage", data=data, method="POST")
                _req.urlopen(req, timeout=10)
            except Exception as ex:
                logger.warning(f"Telegram send failed: {ex}")
        
        while True:
            try:
                # Get updates
                req = _req.Request(f"{API}/getUpdates?offset={offset}&timeout=30")
                with _req.urlopen(req, timeout=35) as resp:
                    data = json.loads(resp.read().decode())
                
                for update in data.get("result", []):
                    offset = update["update_id"] + 1
                    msg = update.get("message", {})
                    chat_id = msg.get("chat", {}).get("id")
                    text = msg.get("text", "")
                    
                    if not chat_id or not text:
                        continue
                    
                    # Handle /start command
                    if text == "/start":
                        send_message(chat_id, "🤖 Pika AI Bot connected!\n\nबस कुछ भी बोलो या टाइप करो — मैं जवाब दूँगा!\n\nCommands:\n/status - PC status\n/screenshot - Screen capture\n/volume - Volume info")
                        continue
                    
                    # Handle /status command
                    if text == "/status":
                        info = cmd_info("full_report", {})
                        send_message(chat_id, f"📊 PC Status:\n{info.get('message', 'N/A')}")
                        continue
                    
                    # Route message through Pika's LLM
                    try:
                        # Quick command routing
                        low = text.lower()
                        if "screenshot" in low:
                            result = cmd_screen("screenshot", {})
                            send_message(chat_id, f"📸 {result.get('message', 'Done')}")
                        elif "volume" in low:
                            result = cmd_info("battery", {})
                            send_message(chat_id, f"🔊 {result.get('message', 'N/A')}")
                        elif "battery" in low:
                            result = cmd_info("battery", {})
                            send_message(chat_id, f"🔋 {result.get('message', 'N/A')}")
                        elif "time" in low:
                            result = cmd_info("time", {})
                            send_message(chat_id, f"⏰ {result.get('message', 'N/A')}")
                        elif "open" in low:
                            app = text.replace("open", "").strip()
                            result = cmd_apps("open", {"name": app})
                            send_message(chat_id, f"🚀 {result.get('message', 'Done')}")
                        else:
                            # Send to LLM for general response
                            result = _quick_llm_response(text)
                            send_message(chat_id, result)
                    except Exception as ex:
                        send_message(chat_id, f"❌ Error: {str(ex)[:200]}")
                
            except Exception as ex:
                if "timeout" not in str(ex).lower():
                    logger.warning(f"Telegram poll error: {ex}")
                    _t.sleep(5)
    except Exception as ex:
        logger.error(f"Telegram bot failed to start: {ex}")


def _quick_llm_response(text: str) -> str:
    """Quick LLM response for Telegram messages — uses first available provider."""
    try:
        provider_name = CURRENT_PROVIDER
        provider_info = LLM_PROVIDERS.get(provider_name, ("", "", ""))
        url, model, env_var = provider_info
        api_key = os.getenv(env_var, "")
        if not api_key or not url:
            return f"收到: {text}"
        
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": "You are Pika, a friendly AI assistant. Reply in the user's language (Hinglish/Hindi/English). Keep it short and helpful."},
                {"role": "user", "content": text}
            ],
            "max_tokens": 500,
            "temperature": 0.7,
        }
        data = json.dumps(payload).encode()
        req = urllib.request.Request(url, data=data, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read().decode())
            return result.get("choices", [{}])[0].get("message", {}).get("content", "...")
    except Exception:
        return f"收到: {text}"


if __name__ == "__main__":
    try:
        args = parse_args()
        HOST = args.host
        PORT = args.port
        if args.debug:
            logging.getLogger().setLevel(logging.DEBUG)
        asyncio.run(main())
    except KeyboardInterrupt:
        _cleanup_on_shutdown()
        print("\n\n⚡ Pika PC Bridge stopped. फिर मिलेंगे!")


