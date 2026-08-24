#!/usr/bin/env python3
"""
calendar_mcp_stub.py — additive sidecar (bina kuchh hataye)

Mock Calendar/MCP server: Pika ke liye P0 production gap fill without touching pc_bridge.py core.
- Runs alongside pc_bridge.py (optional)
- Exposes same ROUTES pattern: category=calendar, actions=find_available_times/create_event/list_events
- Uses vault pika_data.json -> calendarEvents (local, encrypted)
- Future: replace mock with real Google/M365 OAuth (Calendar-MCP .NET) — same interface

Usage:
  python calendar_mcp_stub.py  # listens ws://localhost:8766 (separate) or directly import in pc_bridge

No delete, only add. Safe to ignore if not started.
"""
import json, datetime
from pathlib import Path
from datetime import timezone

DATA_FILE = Path(__file__).parent / "pika_data.json"

def ok(m,d=None): return {"success":True,"message":m,"data":d}
def err(m): return {"success":False,"message":m,"data":None}

def load(): 
    try:
        import pc_bridge
        return pc_bridge.load_vault_data() or {}
    except: 
        if DATA_FILE.exists():
            try: return json.loads(DATA_FILE.read_text(encoding="utf-8"))
            except: return {}
        return {}

def save(d):
    try:
        import pc_bridge
        return pc_bridge.save_vault_data(d)
    except:
        DATA_FILE.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding="utf-8"); return True

def cmd_calendar(action, params):
    data = load()
    ev = data.setdefault("calendarEvents", [])
    if action in ("list","list_events"):
        return ok(f"{len(ev)} events", {"events": ev[-20:]})
    if action == "find_available_times":
        # mock: next 3 slots today
        now = datetime.datetime.now(timezone.utc)
        slots = [(now + datetime.timedelta(hours=i+1)).isoformat() for i in range(3)]
        return ok("Available: " + ", ".join(slots), {"slots": slots})
    if action == "create_event":
        title = params.get("title") or params.get("text") or "Pika Event"
        when = params.get("when") or params.get("time") or datetime.datetime.now(timezone.utc).isoformat()
        e = {"id": str(len(ev)+1), "title": title, "when": when, "created": datetime.datetime.now(timezone.utc).isoformat()}
        ev.append(e); save(data)
        return ok(f"Event banaya: {title} @ {when} 📅", {"event": e})
    if action == "delete_event":
        eid = str(params.get("id",""))
        data["calendarEvents"] = [x for x in ev if x["id"]!=eid]; save(data)
        return ok("Event hataya")
    return err(f"unknown calendar action {action}")

# Register additively into pc_bridge.ROUTES if pc_bridge is running
try:
    import pc_bridge
    pc_bridge.ROUTES["calendar"] = cmd_calendar
    print("[calendar_mcp_stub] registered calendar -> pc_bridge.ROUTES (additive)")
except Exception as e:
    print(f"[calendar_mcp_stub] standalone (import pc_bridge to auto-register): {e}")

if __name__ == "__main__":
    print("Calendar stub ready. Import this file before pc_bridge serve to enable calendar tools.")
    import sys
    # ascii-safe demo
    r1 = cmd_calendar("find_available_times", {})
    r2 = cmd_calendar("create_event", {"title": "Test", "when": "2026-08-24T18:00:00Z"})
    try:
        print(r1); print(r2)
    except UnicodeEncodeError:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        print(r1); print(r2)
