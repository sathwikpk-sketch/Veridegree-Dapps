from types import SimpleNamespace

from app import database
from app import event_listener as listener


class FakeEvent:
    def process_log(self, raw_log):
        raise AssertionError("No raw event logs are expected in this test")


class FakeEvents:
    def __getattr__(self, _name):
        return lambda: FakeEvent()


class FakeEth:
    def __init__(self, latest, hashes=None):
        self.block_number = latest
        self.hashes = hashes or {}
        self.requested_ranges = []

    def get_block(self, number):
        return {"hash": self.hashes.get(number, bytes.fromhex(f"{number:02x}" * 32))}

    def get_logs(self, request):
        self.requested_ranges.append(request)
        return []


class FakeChain:
    address = "0x" + "11" * 20

    def __init__(self, latest, hashes=None):
        self.w3 = SimpleNamespace(eth=FakeEth(latest, hashes))
        self.contract = SimpleNamespace(events=FakeEvents())

    def detect_deployment_block(self):
        return 100


def _configure_db(tmp_path, monkeypatch):
    monkeypatch.setattr(database, "get_settings", lambda: SimpleNamespace(database_path=str(tmp_path / "events.sqlite3")))
    database.init_db()


def test_event_scanner_waits_for_confirmation_buffer(tmp_path, monkeypatch):
    _configure_db(tmp_path, monkeypatch)
    monkeypatch.setattr(listener, "get_settings", lambda: SimpleNamespace(
        event_confirmations=3,
        event_block_step=500,
        event_reorg_checkpoints=128,
    ))
    chain = FakeChain(latest=110)

    events = listener.scan_next_range(chain)

    assert events == []
    assert chain.w3.eth.requested_ranges == [{"fromBlock": 100, "toBlock": 107, "address": chain.address}]
    assert database.get_state(f"last_scanned_block:{chain.address.lower()}") == "107"
    assert database.get_checkpoint_hash(107) is not None


def test_event_scanner_rewinds_after_checkpoint_hash_mismatch(tmp_path, monkeypatch):
    _configure_db(tmp_path, monkeypatch)
    monkeypatch.setattr(listener, "get_settings", lambda: SimpleNamespace(
        event_confirmations=3,
        event_block_step=500,
        event_reorg_checkpoints=128,
    ))
    chain = FakeChain(latest=110, hashes={
        102: bytes.fromhex("22" * 32),
        104: bytes.fromhex("44" * 32),
    })
    cursor_key = f"last_scanned_block:{chain.address.lower()}"
    database.save_checkpoint(102, "0x" + "22" * 32)
    database.save_checkpoint(104, "0x" + "99" * 32)  # Old, no longer canonical hash.
    database.set_state(cursor_key, "104")
    database.save_event("orphaned:0", 103, {"type": "CredentialIssued", "blockNumber": 103})

    events = listener.scan_next_range(chain)

    assert events and events[0]["type"] == "ChainReorg"
    assert events[0]["rewoundToBlock"] == 102
    assert database.recent_events(5) == []
    assert database.get_state(cursor_key) == "107"
