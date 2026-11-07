import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

from web3 import Web3

from .config import get_settings
from .status import credential_status

logger = logging.getLogger("veridegree.chain")
ABI_PATH = Path(__file__).parent / "abi" / "VeriDegree.json"


class ChainUnavailable(RuntimeError):
    pass


class Chain:
    def __init__(self) -> None:
        settings = get_settings()
        if not settings.sepolia_rpc_url or not settings.contract_address:
            raise ChainUnavailable("Set SEPOLIA_RPC_URL and CONTRACT_ADDRESS in backend/.env.")
        if not Web3.is_address(settings.contract_address):
            raise ChainUnavailable("CONTRACT_ADDRESS is not a valid Ethereum address.")
        if not settings.session_secret or len(settings.session_secret) < 32:
            logger.warning("SESSION_SECRET is missing or shorter than 32 characters.")
        self.w3 = Web3(Web3.HTTPProvider(settings.sepolia_rpc_url, request_kwargs={"timeout": 15}))
        if not self.w3.is_connected():
            raise ChainUnavailable("Could not connect to the configured Sepolia RPC provider.")
        actual_chain_id = self.w3.eth.chain_id
        if actual_chain_id != settings.chain_id:
            raise ChainUnavailable(f"RPC chain ID is {actual_chain_id}; expected {settings.chain_id} (Sepolia).")
        abi = json.loads(ABI_PATH.read_text(encoding="utf-8"))
        self.address = Web3.to_checksum_address(settings.contract_address)
        self.contract = self.w3.eth.contract(address=self.address, abi=abi)
        self.deployment_block = settings.contract_deployment_block

    def detect_deployment_block(self) -> int:
        if self.deployment_block >= 0:
            return self.deployment_block
        latest = self.w3.eth.block_number
        if not self.w3.eth.get_code(self.address, block_identifier=latest):
            raise ChainUnavailable("No contract bytecode found at CONTRACT_ADDRESS on Sepolia.")
        low, high = 0, latest
        while low < high:
            mid = (low + high) // 2
            code = self.w3.eth.get_code(self.address, block_identifier=mid)
            if code:
                high = mid
            else:
                low = mid + 1
        self.deployment_block = low
        logger.info("Detected VeriDegree deployment block: %s", low)
        return low

    def credential(self, credential_id: int) -> dict[str, Any]:
        cert_hash, issuer, student, issued_at, not_revoked = self.contract.functions.verifyCredential(credential_id).call()
        issuer_approved = self.contract.functions.approvedInstitutions(issuer).call()
        return self._credential_dict(credential_id, cert_hash, issuer, student, issued_at, not_revoked, issuer_approved)

    @staticmethod
    def _status(not_revoked: bool, issuer_approved: bool) -> str:
        return credential_status(not_revoked, issuer_approved)

    def _credential_dict(self, credential_id: int, cert_hash: bytes, issuer: str, student: str, issued_at: int, not_revoked: bool, issuer_approved: bool) -> dict[str, Any]:
        return {
            "credentialId": int(credential_id),
            "certificateHash": Web3.to_hex(cert_hash),
            "issuer": Web3.to_checksum_address(issuer),
            "student": Web3.to_checksum_address(student),
            "issuedAt": int(issued_at),
            "revoked": not bool(not_revoked),
            "isValid": bool(not_revoked),
            "issuerApproved": bool(issuer_approved),
            "status": self._status(bool(not_revoked), bool(issuer_approved)),
        }


@lru_cache

def get_chain() -> Chain:
    return Chain()


def to_json_value(value: Any) -> Any:
    if isinstance(value, (bytes, bytearray)):
        return Web3.to_hex(value)
    if isinstance(value, int):
        return value
    if isinstance(value, (list, tuple)):
        return [to_json_value(item) for item in value]
    if isinstance(value, dict):
        return {str(key): to_json_value(item) for key, item in value.items()}
    return value
