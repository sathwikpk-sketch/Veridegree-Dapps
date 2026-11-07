import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from .config import get_settings


def _connect() -> sqlite3.Connection:
    path = Path(get_settings().database_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=15)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def _db():
    conn = _connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with _db() as conn:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("CREATE TABLE IF NOT EXISTS challenges (address TEXT PRIMARY KEY, nonce TEXT NOT NULL, message TEXT NOT NULL, expires_at INTEGER NOT NULL)")
        conn.execute("CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
        conn.execute("CREATE TABLE IF NOT EXISTS chain_events (event_key TEXT PRIMARY KEY, block_number INTEGER NOT NULL, payload TEXT NOT NULL)")
        conn.execute("CREATE TABLE IF NOT EXISTS chain_checkpoints (block_number INTEGER PRIMARY KEY, block_hash TEXT NOT NULL)")


def save_challenge(address: str, nonce: str, message: str, expires_at: int) -> None:
    with _db() as conn:
        conn.execute("INSERT INTO challenges(address,nonce,message,expires_at) VALUES(?,?,?,?) ON CONFLICT(address) DO UPDATE SET nonce=excluded.nonce,message=excluded.message,expires_at=excluded.expires_at", (address.lower(), nonce, message, expires_at))


def get_challenge(address: str) -> dict[str, Any] | None:
    with _db() as conn:
        row = conn.execute("SELECT * FROM challenges WHERE address=?", (address.lower(),)).fetchone()
        return dict(row) if row else None


def consume_challenge(address: str, nonce: str) -> bool:
    with _db() as conn:
        cursor = conn.execute("DELETE FROM challenges WHERE address=? AND nonce=?", (address.lower(), nonce))
        return cursor.rowcount == 1


def get_state(key: str) -> str | None:
    with _db() as conn:
        row = conn.execute("SELECT value FROM app_state WHERE key=?", (key,)).fetchone()
        return row["value"] if row else None


def set_state(key: str, value: str) -> None:
    with _db() as conn:
        conn.execute("INSERT INTO app_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, value))


def save_event(event_key: str, block_number: int, payload: dict[str, Any]) -> bool:
    with _db() as conn:
        cursor = conn.execute("INSERT OR IGNORE INTO chain_events(event_key,block_number,payload) VALUES(?,?,?)", (event_key, block_number, json.dumps(payload)))
        return cursor.rowcount == 1


def recent_events(limit: int = 25) -> list[dict[str, Any]]:
    with _db() as conn:
        rows = conn.execute("SELECT payload FROM chain_events ORDER BY block_number DESC, rowid DESC LIMIT ?", (limit,)).fetchall()
        return [json.loads(row["payload"]) for row in rows]



def get_checkpoint_hash(block_number: int) -> str | None:
    with _db() as conn:
        row = conn.execute("SELECT block_hash FROM chain_checkpoints WHERE block_number=?", (block_number,)).fetchone()
        return str(row["block_hash"]) if row else None


def save_checkpoint(block_number: int, block_hash: str, keep: int = 256) -> None:
    with _db() as conn:
        conn.execute(
            "INSERT INTO chain_checkpoints(block_number,block_hash) VALUES(?,?) ON CONFLICT(block_number) DO UPDATE SET block_hash=excluded.block_hash",
            (block_number, block_hash.lower()),
        )
        conn.execute(
            "DELETE FROM chain_checkpoints WHERE block_number NOT IN (SELECT block_number FROM chain_checkpoints ORDER BY block_number DESC LIMIT ?)",
            (keep,),
        )


def recent_checkpoints(limit: int = 128) -> list[dict[str, Any]]:
    with _db() as conn:
        rows = conn.execute(
            "SELECT block_number,block_hash FROM chain_checkpoints ORDER BY block_number DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(row) for row in rows]


def rollback_chain_after(block_number: int) -> None:
    """Remove cached events/checkpoints after a known canonical ancestor."""
    with _db() as conn:
        conn.execute("DELETE FROM chain_events WHERE block_number > ?", (block_number,))
        conn.execute("DELETE FROM chain_checkpoints WHERE block_number > ?", (block_number,))


def clear_chain_history() -> None:
    with _db() as conn:
        conn.execute("DELETE FROM chain_events")
        conn.execute("DELETE FROM chain_checkpoints")
