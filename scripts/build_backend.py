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

def _existing_imports(mods):
    """Sirf installed modules return karta hai — missing hidden-imports build fail nahi karenge."""
    import importlib.util
    ok, skipped = [], []
    for m in mods:
        (ok if importlib.util.find_spec(m) else skipped).append(m)
    if skipped:
        print(f"[skip] Not installed (optional): {', '.join(skipped)}")
    return ok

def build():
    print("=" * 60)
    print("  Pika AI — Building Backend Executable")
    print("=" * 60)
    
    if not BRIDGE.exists():
        print(f"ERROR: {BRIDGE} not found!")
        sys.exit(1)
    
    hidden = _existing_imports([
        "websockets", "websockets.legacy", "websockets.exceptions",
        "pyautogui", "pygetwindow", "pyperclip", "psutil",
        "PIL", "PIL.ImageGrab", "cv2", "pytesseract", "requests",
        "aiohttp", "aiohttp.client", "edge_tts", "vosk",
        "cryptography", "cryptography.fernet",
        "json", "re", "time", "datetime", "pathlib", "platform",
        "math", "base64", "hashlib", "uuid", "statistics", "decimal",
        "fractions", "copy", "pprint", "itertools", "collections",
        "functools", "string", "tiktoken",
        # Windows-specific
        "winreg", "ctypes", "ctypes.wintypes",
        "win32api", "win32con", "win32gui", "win32process",
        "numpy", "mss",
    ])
    
    # PyInstaller command — workpath ko Temp me rakho (path me space + antivirus lock se bachne)
    import tempfile
    work_dir = Path(tempfile.gettempdir()) / "pika_pyinstaller_build"
    work_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--name", "pc_bridge",
        "--distpath", str(DIST_DIR),
        "--workpath", str(work_dir),
        "--specpath", str(ROOT),
        "--noconfirm",
    ]
    # Exclude conflicting Qt bindings, heavy unused ML/GUI packages to keep binary fast and lean
    excludes = [
        "PyQt5", "PyQt6", "PySide2", "PySide6",
        "matplotlib", "notebook", "IPython", "jupyter",
        "tkinter", "PIL.TkImage",
        "torch", "torchvision", "torchaudio", "tensorflow", "tensorboard", "keras",
        "scipy", "sympy", "sklearn", "transformers", "pandas"
    ]
    for exc in excludes:
        cmd.extend(["--exclude-module", exc])
    
    for h in hidden:
        cmd.extend(["--hidden-import", h])
    # NOTE: models folder yahan bundle NAHI karte — wo electron-builder
    # extraResources se <install>/resources/models me jaate hain.
    
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
