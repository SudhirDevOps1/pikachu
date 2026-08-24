import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from pc_bridge import _memory_search_ranked

def test_ranked_search_prefers_relevant():
    vault = [
        {"fact": "mera naam Sudhir hai", "created_at": "2026-08-20T10:00:00"},
        {"fact": "mujhe cricket pasand hai", "created_at": "2026-08-21T10:00:00"},
        {"fact": "mera favorite color blue hai", "created_at": "2026-08-22T10:00:00"},
    ]
    res = _memory_search_ranked("naam kya hai", vault, top_k=2)
    assert res[0]["fact"] == "mera naam Sudhir hai"

def test_empty_query_returns_recent():
    vault = [{"fact": f"fact {i}", "created_at": "2026-08-20T10:00:00"} for i in range(5)]
    res = _memory_search_ranked("", vault, top_k=3)
    assert len(res) == 3
