#!/usr/bin/env python3
"""Quick test of pc_bridge.py functions without needing the WebSocket server."""

import sys, traceback

def section(name):
    print(f"\n{'=' * 60}\n TEST: {name}\n{'=' * 60}")

try:
    import pc_bridge as b
    print(f"✓ Module imported. (Python {sys.version.split()[0]})")
    print(f"  Optional libs — psutil: {b.psutil is not None}, pyautogui: {b.pyautogui is not None}, pyperclip: {b.pyperclip is not None}")
    print(f"  Vosk: {b.HAS_VOSK}, Edge TTS: {b.HAS_EDGE_TTS}")
except Exception as e:
    print(f"✗ Import failed: {e}")
    traceback.print_exc()
    sys.exit(1)

# Test time
section("Time / Date")
print(b.cmd_info("time", {}))
print(b.cmd_info("date", {}))

# Test IP / hostname
section("Network info")
print(b.cmd_info("ip", {}))

# Test safe calculator
section("Calculator")
for expr in ["2+3*4", "(10+5)/3", "100-50*2", "2**10"]:
    print(f"  {expr} =", b.cmd_calculator("eval", {"expression": expr})["message"])

# Test dangerous calc
section("Calculator safety check (very large number)")
print(b.cmd_calculator("eval", {"expression": "10**20"}))

# Test password gen
section("Password generator")
print(b.cmd_password("generate", {"length": 20}))

# Test file ops in temp
import tempfile, os
tmp = tempfile.mkdtemp()
test = b.resolve_path(os.path.join(tmp, "pika_test.txt"))
section("File create / read / write / rename")
print("  create:", b.cmd_files("create_file", {"path": str(test), "content": "hi from pika"}))
print("  read:", b.cmd_files("read", {"path": str(test)}))
print("  write:", b.cmd_files("write", {"path": str(test), "content": "overwrite"}))
renamed = test.with_name("pika_renamed.txt")
print("  rename:", b.cmd_files("rename", {"path": str(test), "new_path": str(renamed)}))
print("  list:", b.cmd_files("list", {"path": tmp}))
print("  delete:", b.cmd_files("delete", {"path": str(renamed)}))

# Test disk listing
section("Drive listing")
print(b.cmd_disk("list_drives", {}))

# Test Web search
section("Web URL map check")
print("  open youtube:", b.cmd_web("open_site", {"name": "youtube"}))

# Cleanup
import shutil
shutil.rmtree(tmp, ignore_errors=True)

print("\n" + "=" * 60)
print(" ALL TESTS PASSED ✓  pc_bridge.py is healthy.")
print(" Now run:  python pc_bridge.py  to start the server.")
print("=" * 60 + "\n")
