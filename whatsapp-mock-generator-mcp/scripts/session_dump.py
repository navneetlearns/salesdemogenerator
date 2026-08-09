#!/usr/bin/env python3
"""Dump an OpenCode session transcript (tool calls + args + outputs).

Shows exactly what an agent did with the journey-builder MCP — which tools were
called, with what arguments, and what came back. Uses the OpenCode storage DB
(sessions are stored as JSON in message/part rows).

Usage:
  python3 session_dump.py                # list recent sessions
  python3 session_dump.py <session-id>   # dump that session's transcript
  OPENCODE_DB=/path/to/opencode.db python3 session_dump.py <session-id>

The DB is copied to a temp file first (the running app holds a lock, and WSL
reads are flaky against the live WAL).
"""
import json
import os
import shutil
import sqlite3
import sys
import tempfile

DEFAULT_DB = "/mnt/c/Users/sumit/.local/share/opencode/opencode.db"


def get_db():
    src = os.environ.get("OPENCODE_DB", DEFAULT_DB)
    if not os.path.exists(src):
        sys.exit(f"DB not found: {src} (set OPENCODE_DB or run on the sales machine)")
    tmp = os.path.join(tempfile.mkdtemp(), "opencode.db")
    for suffix in ("", "-wal", "-shm"):
        p = src + suffix
        if os.path.exists(p):
            shutil.copy2(p, tmp + suffix)
    return tmp


def short(s, n=220):
    s = str(s).replace("\n", " ")
    return s if len(s) <= n else s[:n] + "…"


def list_sessions(db):
    rows = db.execute(
        "SELECT id, title, time_created FROM session ORDER BY time_created DESC LIMIT 10"
    ).fetchall()
    print(f"{'time (UTC)':<22} {'session id':<28} title")
    for sid, title, ts in rows:
        import datetime
        when = datetime.datetime.fromtimestamp(ts / 1000, tz=datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        print(f"{when:<22} {sid:<28} {title}")
    return rows


def dump(db, sid):
    rows = db.execute(
        "SELECT p.data FROM part p JOIN message m ON p.message_id = m.id "
        "WHERE p.session_id=? ORDER BY p.time_created", (sid,)).fetchall()
    if not rows:
        sys.exit(f"No parts for session {sid}")
    for (data,) in rows:
        try:
            p = json.loads(data)
        except Exception:
            continue
        t = p.get("type")
        if t == "text":
            print(f"[text] {short(p.get('text', ''))}")
        elif t == "tool":
            st = p.get("state", {})
            inp = st.get("input", {})
            out = st.get("output", "")
            name = inp.get("tool") or inp.get("name") or "?"
            args = inp.get("input") or inp.get("arguments") or inp.get("args") or {}
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except Exception:
                    pass
            print(f"[tool] {name} args={json.dumps(args)[:400]}")
            if isinstance(out, str) and out.strip():
                print(f"        out: {short(out, 200)}")
            elif isinstance(out, dict):
                print(f"        out: {short(json.dumps(out)[:200], 200)}")
        elif t in ("reasoning", "step-start", "step-finish"):
            continue
        else:
            print(f"[{t}] {short(json.dumps(p)[:200], 180)}")


if __name__ == "__main__":
    db = sqlite3.connect(get_db())
    if len(sys.argv) < 2:
        list_sessions(db)
    else:
        dump(db, sys.argv[1])
    db.close()
