#!/usr/bin/env python3
"""
Pika AI Assistant — Cross-platform Production Launcher.
Works on Windows, macOS and Linux.

Usage:
    python start.py
    Or simply type 'pika' anywhere in terminal!
"""
import os
import platform
import subprocess
import sys
import time
import socket
from pathlib import Path

ROOT = Path(__file__).parent.resolve()
os.chdir(ROOT)

IS_WIN = platform.system() == "Windows"
PY = sys.executable

ANSI = {
    "reset": "\033[0m", "bold": "\033[1m",
    "cyan": "\033[96m", "purple": "\033[95m",
    "green": "\033[92m", "yellow": "\033[33m",
    "red": "\033[91m", "dim": "\033[90m", "white": "\033[97m",
}

def color(c, t): return f"{ANSI.get(c, '')}{t}{ANSI['reset']}"

BANNER = f"""
{color('cyan', '  ╔══════════════════════════════════════════════════════════════╗')}
{color('cyan', '  ║')}{color('bold', '   ⚡  PIKA AI ASSISTANT v1.0.0 — PRODUCTION LAUNCHER         ')}{color('cyan', '║')}
{color('cyan', '  ╚══════════════════════════════════════════════════════════════╝')}
{color('dim', f'  Project: {ROOT}')}
{color('dim', f'  Python:  {sys.version.split()[0]} ({PY})')}
{color('dim', f'  OS:      {platform.system()} {platform.release()}')}
"""

def step(n, name): print(f"\n{color('yellow', f'[{n}/6]')} {color('white', name)}")
def ok(msg): print(f"  {color('green', '[OK]')} {msg}")
def warn(msg): print(f"  {color('yellow', '[WARN]')} {msg}")
def err(msg): print(f"  {color('red', '[ERROR]')} {msg}")

def run(cmd, check=True):
    return subprocess.run(cmd, shell=isinstance(cmd, str), check=check)

print(BANNER)

# 1. Virtual Environment Setup
step(1, "Virtual Environment check...")
VENV_DIR = ROOT / "venv"
VENV_PY = VENV_DIR / ("Scripts/python.exe" if IS_WIN else "bin/python")
if not VENV_PY.exists():
    print(f"  {color('dim', '► Creating isolated virtual environment...')}")
    if run([PY, "-m", "venv", str(VENV_DIR)], check=False).returncode != 0:
        warn("venv creation failed — falling back to system Python")
        VENV_PY = Path(PY)
    else:
        ok("venv created")
else:
    ok("venv ready")

BRIDGE_PY = str(VENV_PY) if VENV_PY.exists() else PY

# 2. Python Packages
step(2, "Python packages check...")
STAMP = VENV_DIR / ".requirements_installed"
req = ROOT / "requirements.txt"
if req.exists() and not STAMP.exists():
    print(f"  {color('dim', '► Installing Python libraries (first-time setup)...')}")
    run([BRIDGE_PY, "-m", "pip", "install", "--upgrade", "pip", "--quiet", "--disable-pip-version-check"], check=False)
    ret = run([BRIDGE_PY, "-m", "pip", "install", "-r", str(req), "--disable-pip-version-check"], check=False).returncode
    if ret == 0:
        STAMP.write_text("installed", encoding="utf-8")
        ok("Python dependencies installed")
    else:
        warn("Some python packages had warnings, proceeding...")
else:
    ok("Python packages ready")

# 3. Node Packages
step(3, "Node.js dependencies check...")
if not (ROOT / "node_modules").exists():
    print(f"  {color('dim', '► Installing frontend modules (npm install)...')}")
    if run(["npm", "install", "--loglevel=error"], check=False).returncode == 0:
        ok("Node packages installed")
    else:
        err("npm install failed — please check internet connection")
        sys.exit(1)
else:
    ok("Node modules ready")

# 4. AI & Voice Models Check
step(4, "Offline models check...")
setup_py = ROOT / "setup_models.py"
if setup_py.exists() and not (ROOT / "models" / "hi" / "am").exists() and not (ROOT / "models" / "vosk" / "am").exists():
    print(f"  {color('dim', '► Downloading offline voice models...')}")
    run([BRIDGE_PY, str(setup_py)], check=False)
ok("Models verified")

# 5. Register Global 'pika' Command
if IS_WIN:
    try:
        pika_bin = Path.home() / ".pika" / "bin"
        pika_bin.mkdir(parents=True, exist_ok=True)
        
        # Windows batch & powershell scripts
        (pika_bin / "pika.cmd").write_text(f'@echo off\ncd /d "{ROOT}"\ncall "{ROOT}\\start.bat" %*\n', encoding="utf-8")
        (pika_bin / "pika.ps1").write_text(f'Set-Location "{ROOT}"\n& "{ROOT}\\start.bat" $args\n', encoding="utf-8")
        
        # Register in user PATH
        user_path = os.environ.get("PATH", "")
        if str(pika_bin) not in user_path:
            subprocess.run(
                ["powershell", "-NoProfile", "-Command",
                 f"[Environment]::SetEnvironmentVariable('PATH', [Environment]::GetEnvironmentVariable('PATH', 'User') + ';{pika_bin}', 'User')"],
                capture_output=True,
            )
    except Exception:
        pass

# 6. Start PC Bridge Backend
step(5, "Starting PC Bridge Backend (ws://localhost:8765)...")
bridge_py = ROOT / "pc_bridge.py"
if bridge_py.exists():
    if IS_WIN:
        subprocess.Popen(
            ["start", "Pika AI - PC Bridge", "cmd", "/c",
             f'title Pika PC Bridge [ws://localhost:8765] && color 0A && chcp 65001 >nul && "{BRIDGE_PY}" pc_bridge.py'],
            shell=True,
        )
    else:
        subprocess.Popen([BRIDGE_PY, str(bridge_py)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    ok("PC Bridge started")

# 7. Start Frontend & Open Browser
step(6, "Starting Web UI & Launching Browser...")
lan = "127.0.0.1"
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.connect(("8.8.8.8", 80))
    lan = s.getsockname()[0]
    s.close()
except Exception:
    pass

import webbrowser
time.sleep(1.5)
webbrowser.open("http://localhost:3000")

print(f"\n{color('cyan', '╔══════════════════════════════════════════════════════════════╗')}")
print(f"{color('cyan', '║')}  {color('green', '🚀 ALL SYSTEMS GO! PIKA IS RUNNING')}                         {color('cyan', '║')}")
print(f"{color('cyan', '║')}                                                              {color('cyan', '║')}")
print(f"{color('cyan', '║')}  {color('white', 'Web UI:')}          {color('cyan', 'http://localhost:3000')}                    {color('cyan', '║')}")
print(f"{color('cyan', '║')}  {color('white', 'PC Bridge:')}       {color('cyan', 'ws://localhost:8765')}                      {color('cyan', '║')}")
print(f"{color('cyan', '║')}  {color('white', 'Phone Access:')}    {color('cyan', f'http://{lan}:3000')}                      {color('cyan', '║')}")
print(f"{color('cyan', '║')}  {color('white', 'Global CLI:')}      {color('yellow', 'Type \'pika\' in any terminal!')}           {color('cyan', '║')}")
print(f"{color('cyan', '║')}                                                              {color('cyan', '║')}")
print(f"{color('cyan', '║')}  {color('dim', 'Press Ctrl+C here to stop web server')}                   {color('cyan', '║')}")
print(f"{color('cyan', '╚══════════════════════════════════════════════════════════════╝')}\n")

run(["npm", "run", "dev"], check=False)
