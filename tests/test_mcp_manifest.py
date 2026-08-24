import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from pc_bridge import get_mcp_manifest, route_command

def test_manifest_not_empty():
    m = get_mcp_manifest()
    assert len(m) > 20
    names = {t["name"] for t in m}
    assert "memory.search" in names
    assert "system.shutdown" in names

def test_route_via_mcp_name():
    # simulate mcp_call_tool memory.search
    res = route_command({"category":"memory","action":"search","params":{"query":"test"}})
    assert "success" in res
