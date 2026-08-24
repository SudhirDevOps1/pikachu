"""
Pika AI — PyInstaller Build Script
Bundles pc_bridge.py into standalone pc_bridge.exe
with all dependencies embedded.
"""
import subprocess
import sys
import os
from pathlib import Path

ROOT = Path(__file__).parent.parent
BRIDGE = ROOT / "pc_bridge.py"
DIST_DIR = ROOT / "dist-bin"
MODELS_DIR = ROOT / "models"

def build():
    print("=" * 60)
    print("  Pika AI — Building Backend Executable")
    print("=" * 60)
    
    if not BRIDGE.exists():
        print(f"ERROR: {BRIDGE} not found!")
        sys.exit(1)
    
    # PyInstaller command
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--name", "pc_bridge",
        "--distpath", str(DIST_DIR),
        "--workpath", str(ROOT / "build"),
        "--specpath", str(ROOT),
        "--noconfirm",
        "--clean",
        # Hidden imports for all dependencies
        "--hidden-import", "websockets",
        "--hidden-import", "websockets.legacy",
        "--hidden-import", "websockets.exceptions",
        "--hidden-import", "pyautogui",
        "--hidden-import", "pygetwindow",
        "--hidden-import", "pyperclip",
        "--hidden-import", "psutil",
        "--hidden-import", "PIL",
        "--hidden-import", "PIL.ImageGrab",
        "--hidden-import", "cv2",
        "--hidden-import", "pytesseract",
        "--hidden-import", "requests",
        "--hidden-import", "aiohttp",
        "--hidden-import", "aiohttp.client",
        "--hidden-import", "edge_tts",
        "--hidden-import", "vosk",
        "--hidden-import", "apscheduler",
        "--hidden-import", "cryptography",
        "--hidden-import", "cryptography.fernet",
        "--hidden-import", "json",
        "--hidden-import", "re",
        "--hidden-import", "time",
        "--hidden-import", "datetime",
        "--hidden-import", "pathlib",
        "--hidden-import", "platform",
        "--hidden-import", "math",
        "--hidden-import", "base64",
        "--hidden-import", "hashlib",
        "--hidden-import", "uuid",
        "--hidden-import", "statistics",
        "--hidden-import", "decimal",
        "--hidden-import", "fractions",
        "--hidden-import", "copy",
        "--hidden-import", "pprint",
        "--hidden-import", "itertools",
        "--hidden-import", "collections",
        "--hidden-import", "functools",
        "--hidden-import", "string",
        "--hidden-import", "tiktoken",
        # Windows-specific
        "--hidden-import", "winreg",
        "--hidden-import", "ctypes",
        "--hidden-import", "ctypes.wintypes",
        "--hidden-import", "win32api",
        "--hidden-import", "win32con",
        "--hidden-import", "win32gui",
        "--hidden-import", "win32process",
        "--hidden-import", "win32security",
        "--hidden-import", "pywin32",
        # Screen recording
        "--hidden-import", "numpy",
        # Collect data files
        "--add-data", f"{ROOT / 'requirements.txt'};.",
    ]
    
    # Add models directory if exists
    if MODELS_DIR.exists():
        cmd.extend(["--add-data", f"{MODELS_DIR};models"])
    
    # Add the main script
    cmd.append(str(BRIDGE))
    
    print(f"\nBuilding: {BRIDGE}")
    print(f"Output: {DIST_DIR / 'pc_bridge.exe'}")
    print(f"\nRunning PyInstaller...")
    
    result = subprocess.run(cmd, cwd=str(ROOT))
    
    if result.returncode == 0:
        exe_path = DIST_DIR / "pc_bridge.exe"
        if exe_path.exists():
            size_mb = exe_path.stat().st_size / (1024 * 1024)
            print(f"\n{'=' * 60}")
            print(f"  BUILD SUCCESSFUL!")
            print(f"  Output: {exe_path}")
            print(f"  Size: {size_mb:.1f} MB")
            print(f"{'=' * 60}")
        else:
            print(f"\nERROR: Build completed but exe not found at {exe_path}")
            sys.exit(1)
    else:
        print(f"\nERROR: PyInstaller failed with code {result.returncode}")
        sys.exit(1)

if __name__ == "__main__":
    build()
