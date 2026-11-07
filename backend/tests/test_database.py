from types import SimpleNamespace

from app import database


def test_wallet_challenge_is_single_use(tmp_path, monkeypatch):
    monkeypatch.setattr(database, "get_settings", lambda: SimpleNamespace(database_path=str(tmp_path / "test.sqlite3")))
    database.init_db()
    database.save_challenge("0xAbC", "nonce-1", "signed message", 123456)
    assert database.get_challenge("0xabc")["message"] == "signed message"
    assert database.consume_challenge("0xABC", "nonce-1") is True
    assert database.consume_challenge("0xABC", "nonce-1") is False


def test_event_store_deduplicates_transaction_logs(tmp_path, monkeypatch):
    monkeypatch.setattr(database, "get_settings", lambda: SimpleNamespace(database_path=str(tmp_path / "test.sqlite3")))
    database.init_db()
    payload = {"type": "CredentialIssued", "blockNumber": 123, "credentialId": 0}
    assert database.save_event("0xabc:0", 123, payload) is True
    assert database.save_event("0xabc:0", 123, payload) is False
    assert database.recent_events(5) == [payload]



def test_chain_checkpoints_and_rollback(tmp_path, monkeypatch):
    monkeypatch.setattr(database, "get_settings", lambda: SimpleNamespace(database_path=str(tmp_path / "test.sqlite3")))
    database.init_db()
    database.save_checkpoint(100, "0xabc")
    database.save_checkpoint(200, "0xdef")
    assert database.get_checkpoint_hash(100) == "0xabc"
    assert database.recent_checkpoints(5)[0]["block_number"] == 200
    database.save_event("tx:0", 150, {"type": "CredentialIssued", "blockNumber": 150})
    database.rollback_chain_after(100)
    assert database.recent_events(5) == []
    assert [row["block_number"] for row in database.recent_checkpoints(5)] == [100]


def test_clear_chain_history_removes_events_and_checkpoints(tmp_path, monkeypatch):
    monkeypatch.setattr(database, "get_settings", lambda: SimpleNamespace(database_path=str(tmp_path / "test.sqlite3")))
    database.init_db()
    database.save_checkpoint(100, "0xabc")
    database.save_event("tx:1", 100, {"type": "CredentialIssued", "blockNumber": 100})
    database.clear_chain_history()
    assert database.recent_checkpoints(5) == []
    assert database.recent_events(5) == []
