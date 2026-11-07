import asyncio
import logging
from typing import Any

from web3 import Web3

from . import database
from .chain import Chain, get_chain
from .config import get_settings

logger = logging.getLogger("veridegree.events")


class EventHub:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[dict[str, Any]]] = set()

    def subscribe(self) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=100)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[dict[str, Any]]) -> None:
        self._subscribers.discard(queue)

    async def publish(self, payload: dict[str, Any]) -> None:
        for queue in list(self._subscribers):
            if queue.full():
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            await queue.put(payload)


hub = EventHub()
EVENT_SIGNATURES = {
    "CredentialIssued": "CredentialIssued(uint256,address,address,bytes32,uint256)",
    "CredentialRevoked": "CredentialRevoked(uint256,address,uint256)",
    "CredentialStudentUpdated": "CredentialStudentUpdated(uint256,address,address,uint256)",
    "InstitutionAdded": "InstitutionAdded(address)",
    "InstitutionRemoved": "InstitutionRemoved(address)",
    "AdminReplaced": "AdminReplaced(address,address)",
    "ProposalCreated": "ProposalCreated(uint256,address,bytes)",
    "ProposalConfirmed": "ProposalConfirmed(uint256,address,uint256)",
    "ProposalExecuted": "ProposalExecuted(uint256)",
    "ProposalCancelledEvent": "ProposalCancelledEvent(uint256,address)",
}


def _decode_value(value: Any) -> Any:
    if isinstance(value, (bytes, bytearray)):
        return Web3.to_hex(value)
    if isinstance(value, int):
        return int(value)
    if isinstance(value, (list, tuple)):
        return [_decode_value(item) for item in value]
    return value


def _canonical_hash(chain: Chain, block_number: int) -> str:
    return Web3.to_hex(chain.w3.eth.get_block(block_number)["hash"]).lower()


def _rewind_if_reorganised(chain: Chain, cursor: int, cursor_key: str, deployment_block: int) -> tuple[int, dict[str, Any] | None]:
    if cursor < deployment_block:
        return cursor, None

    saved_hash = database.get_checkpoint_hash(cursor)
    if saved_hash is None:
        # Existing databases from the pre-checkpoint listener are safely rebuilt once.
        logger.warning("No canonical checkpoint exists at saved cursor %s; rebuilding the event index.", cursor)
        ancestor = deployment_block - 1
        database.clear_chain_history()
        database.set_state(cursor_key, str(ancestor))
        return ancestor, {
            "type": "ChainReorg",
            "rewoundToBlock": ancestor,
            "message": "Event history is being rebuilt from the contract deployment block.",
        }

    current_hash = _canonical_hash(chain, cursor)
    if current_hash == saved_hash.lower():
        return cursor, None

    settings = get_settings()
    checkpoints = database.recent_checkpoints(settings.event_reorg_checkpoints)
    ancestor = deployment_block - 1
    for checkpoint in checkpoints:
        block_number = int(checkpoint["block_number"])
        if block_number > cursor or block_number < deployment_block:
            continue
        if _canonical_hash(chain, block_number) == str(checkpoint["block_hash"]).lower():
            ancestor = block_number
            break

    if ancestor == deployment_block - 1:
        database.clear_chain_history()
        logger.warning("Reorganisation exceeded retained checkpoints; rebuilding events from deployment block.")
        message = "The chain history changed beyond the retained checkpoints; rebuilding the event index."
    else:
        database.rollback_chain_after(ancestor)
        logger.warning("Chain reorganisation detected. Rewound event index to block %s.", ancestor)
        message = "A chain reorganisation was detected; recent activity has been reconciled."

    database.set_state(cursor_key, str(ancestor))
    return ancestor, {"type": "ChainReorg", "rewoundToBlock": ancestor, "message": message}


def scan_next_range(chain: Chain) -> list[dict[str, Any]]:
    settings = get_settings()
    cursor_key = f"last_scanned_block:{chain.address.lower()}"
    deployment_block = chain.detect_deployment_block()
    cursor_value = database.get_state(cursor_key)
    cursor = deployment_block - 1 if cursor_value is None else int(cursor_value)

    reorg_notice = None
    if cursor_value is not None:
        cursor, reorg_notice = _rewind_if_reorganised(chain, cursor, cursor_key, deployment_block)

    latest = int(chain.w3.eth.block_number)
    safe_latest = latest - max(0, settings.event_confirmations)
    if cursor >= safe_latest:
        return [reorg_notice] if reorg_notice else []

    start = cursor + 1
    end = min(safe_latest, start + settings.event_block_step - 1)
    # Ensure the queried range did not change while the RPC request was in flight.
    end_hash_before = _canonical_hash(chain, end)
    raw_logs = chain.w3.eth.get_logs({"fromBlock": start, "toBlock": end, "address": chain.address})
    end_hash_after = _canonical_hash(chain, end)
    if end_hash_before != end_hash_after:
        logger.info("Canonical block changed during event query; retrying the same range on the next poll.")
        return [reorg_notice] if reorg_notice else []

    topic_map = {
        Web3.to_hex(Web3.keccak(text=signature)): getattr(chain.contract.events, name)()
        for name, signature in EVENT_SIGNATURES.items()
    }
    decoded_events: list[dict[str, Any]] = []

    for raw_log in raw_logs:
        if not raw_log["topics"]:
            continue
        event = topic_map.get(Web3.to_hex(raw_log["topics"][0]))
        if event is None:
            continue
        decoded = event.process_log(raw_log)
        args = {key: _decode_value(value) for key, value in dict(decoded["args"]).items()}
        tx_hash = Web3.to_hex(raw_log["transactionHash"])
        log_index = int(raw_log["logIndex"])
        block_number = int(raw_log["blockNumber"])
        payload = {
            "type": decoded["event"],
            "blockNumber": block_number,
            "transactionHash": tx_hash,
            "logIndex": log_index,
            "confirmations": max(0, latest - block_number),
            "args": args,
        }
        event_key = f"{tx_hash}:{log_index}"
        if database.save_event(event_key, block_number, payload):
            decoded_events.append(payload)

    database.save_checkpoint(end, end_hash_after, keep=max(128, settings.event_reorg_checkpoints * 2))
    database.set_state(cursor_key, str(end))
    if reorg_notice:
        return [reorg_notice, *decoded_events]
    return decoded_events


async def event_listener() -> None:
    settings = get_settings()
    logger.info("VeriDegree Sepolia event listener started.")
    while True:
        try:
            chain = get_chain()
            events = await asyncio.to_thread(scan_next_range, chain)
            for payload in events:
                await hub.publish(payload)
        except Exception as exc:  # keep the API alive while an RPC provider recovers
            logger.warning("Event polling error: %s", exc)
        await asyncio.sleep(settings.event_poll_seconds)
