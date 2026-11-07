import asyncio
import hashlib
import logging
import secrets
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

import jwt
from eth_account import Account
from eth_account.messages import encode_defunct
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from web3 import Web3

from . import database
from .chain import ChainUnavailable, get_chain
from .config import get_settings
from .event_listener import event_listener, hub
from .schemas import ChallengeRequest, VerifySignatureRequest
from .security import create_session, current_user, institution_user
from .uploads import InvalidCertificateFile, validate_certificate_file

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("veridegree.api")


@asynccontextmanager
async def lifespan(_: FastAPI):
    database.init_db()
    try:
        chain = get_chain()
        logger.info("Connected to chain %s at %s", chain.w3.eth.chain_id, chain.address)
    except Exception as exc:
        logger.warning("Chain integration is not ready yet; event listener will retry: %s", exc)
    listener_task = asyncio.create_task(event_listener())
    yield
    if listener_task:
        listener_task.cancel()
        try:
            await listener_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="VeriDegree API",
    description="Read-only Sepolia integration, wallet sign-in, certificate verification, and live contract events.",
    version="2.0.0",
    lifespan=lifespan,
)
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


def _chain_or_503():
    try:
        return get_chain()
    except ChainUnavailable as exc:
        logger.warning("Blockchain service unavailable: %s", exc)
        raise HTTPException(status_code=503, detail="The Sepolia blockchain service is unavailable. Check the backend configuration and RPC connection.")
    except Exception:
        logger.exception("Blockchain RPC operation failed")
        raise HTTPException(status_code=502, detail="The blockchain provider could not complete the request. Please try again.")



@app.get("/api/health")
def health():
    try:
        chain = get_chain()
        return {
            "status": "ok",
            "service": "veridegree-api",
            "chain": "sepolia",
            "chainId": chain.w3.eth.chain_id,
            "contractAddress": chain.address,
            "rpcConnected": True,
        }
    except Exception as exc:
        logger.warning("Health check reports degraded blockchain connection: %s", exc)
        return {
            "status": "degraded",
            "service": "veridegree-api",
            "chain": "sepolia",
            "rpcConnected": False,
            "message": "Blockchain connection is temporarily unavailable. Check the backend logs and RPC configuration.",
        }


@app.post("/api/auth/challenge")
def create_wallet_challenge(body: ChallengeRequest):
    if not Web3.is_address(body.address):
        raise HTTPException(status_code=422, detail="Enter a valid Ethereum wallet address.")
    address = Web3.to_checksum_address(body.address)
    nonce = secrets.token_urlsafe(24)
    now = int(time.time())
    expires_at = now + 300
    domain = get_settings().app_domain
    message = (
        "VeriDegree Wallet Sign-In\n"
        f"Domain: {domain}\n"
        f"Address: {address}\n"
        f"Chain ID: {get_settings().chain_id}\n"
        f"Nonce: {nonce}\n"
        f"Issued At: {datetime.fromtimestamp(now, timezone.utc).isoformat()}\n"
        f"Expiration Time: {datetime.fromtimestamp(expires_at, timezone.utc).isoformat()}"
    )
    database.save_challenge(address, nonce, message, expires_at)
    return {"address": address, "nonce": nonce, "message": message, "expiresAt": expires_at}


@app.post("/api/auth/verify")
def verify_wallet_signature(body: VerifySignatureRequest):
    if not Web3.is_address(body.address):
        raise HTTPException(status_code=422, detail="Invalid wallet address.")
    address = Web3.to_checksum_address(body.address)
    challenge = database.get_challenge(address)
    if not challenge or challenge["expires_at"] < int(time.time()):
        raise HTTPException(status_code=401, detail="Sign-in challenge is missing or expired. Request a new one.")
    if body.message != challenge["message"]:
        raise HTTPException(status_code=401, detail="The signed message does not match the issued challenge.")
    try:
        signer = Account.recover_message(encode_defunct(text=body.message), signature=body.signature)
    except Exception:
        raise HTTPException(status_code=401, detail="Wallet signature could not be verified.")
    if Web3.to_checksum_address(signer) != address:
        raise HTTPException(status_code=401, detail="The signature was created by a different wallet.")
    if not database.consume_challenge(address, challenge["nonce"]):
        raise HTTPException(status_code=409, detail="This sign-in challenge has already been used.")

    chain = _chain_or_503()
    is_admin = bool(chain.contract.functions.isAdmin(address).call())
    is_institution = bool(chain.contract.functions.approvedInstitutions(address).call())
    role = "institution" if is_institution else "admin" if is_admin else "student"
    token = create_session(address, role)
    return {
        "authenticated": True,
        "address": address,
        "role": role,
        "accessToken": token,
        "expiresIn": get_settings().session_ttl_minutes * 60,
        "institutionApproved": is_institution,
    }


@app.get("/api/auth/me")
def auth_me(user: dict[str, Any] = Depends(current_user)):
    chain = _chain_or_503()
    approved = bool(chain.contract.functions.approvedInstitutions(user["address"]).call())
    admin = bool(chain.contract.functions.isAdmin(user["address"]).call())
    role = "institution" if approved else "admin" if admin else "student"
    return {"address": user["address"], "role": role, "institutionApproved": approved}


@app.post("/api/verify/upload")
async def verify_uploaded_certificate(file: UploadFile = File(...)):
    settings = get_settings()
    if not file.filename:
        raise HTTPException(status_code=400, detail="Choose a certificate file first.")
    contents = await file.read(settings.max_upload_mb * 1024 * 1024 + 1)
    if not contents:
        raise HTTPException(status_code=400, detail="The selected file is empty.")
    if len(contents) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File exceeds the {settings.max_upload_mb} MB upload limit.")
    try:
        filename = validate_certificate_file(file.filename, file.content_type, contents)
    except InvalidCertificateFile as exc:
        raise HTTPException(status_code=415, detail=str(exc))
    digest = hashlib.sha256(contents).digest()
    digest_hex = "0x" + digest.hex()
    chain = _chain_or_503()
    try:
        credential_id_plus_one = int(chain.contract.functions.credentialIdPlusOneByHash(digest).call())
    except Exception as exc:
        logger.exception("Certificate hash lookup failed: %s", exc)
        raise HTTPException(status_code=502, detail="The blockchain provider could not complete the certificate lookup.")
    if credential_id_plus_one == 0:
        return {"status": "not_found", "message": "No credential is registered for this exact file.", "certificateHash": digest_hex, "filename": filename}
    credential_id = credential_id_plus_one - 1
    try:
        record = chain.contract.functions.verifyCredential(credential_id).call()
    except Exception as exc:    
        logger.exception("Credential record lookup failed: %s", exc)
        raise HTTPException(status_code=502, detail="The blockchain provider could not read the credential record.")
    cert_hash_on_chain, issuer, student, issued_at, not_revoked = record
    issuer = Web3.to_checksum_address(issuer)
    student = Web3.to_checksum_address(student)
    issuer_approved = bool(chain.contract.functions.approvedInstitutions(issuer).call())
    credential = chain._credential_dict(credential_id, digest, issuer, student, issued_at, not_revoked, issuer_approved)
    return {
        **credential,
        "filename": filename,
        "message": {
            "valid": "This certificate matches an on-chain credential from a currently approved institution.",
            "revoked": "This certificate matches a credential that has been revoked.",
            "issuer_unapproved": "The certificate is registered and not revoked, but its issuer is not currently approved.",
        }[credential["status"]],
    }


@app.get("/api/credentials/{credential_id}")
def get_credential(credential_id: int):
    if credential_id < 0:
        raise HTTPException(status_code=422, detail="Credential ID must be zero or greater.")
    chain = _chain_or_503()
    try:
        count = int(chain.contract.functions.nextCredentialId().call())
        if credential_id >= count:
            raise HTTPException(status_code=404, detail="Credential ID was not found on the contract.")
        return chain.credential(credential_id)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Credential read failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not read the credential from Sepolia.")


@app.get("/api/students/{address}/credentials")
def get_student_credentials(address: str, offset: int = 0, limit: int = 20):
    if not Web3.is_address(address):
        raise HTTPException(status_code=422, detail="Invalid student wallet address.")
    if offset < 0 or limit < 1 or limit > 25:
        raise HTTPException(status_code=422, detail="Use offset >= 0 and a limit between 1 and 25.")
    chain = _chain_or_503()
    student = Web3.to_checksum_address(address)
    try:
        # Fetch one additional ID to determine whether another page exists.
        # The contract accepts up to 100 IDs per call; API limits are capped at 25.
        ids = chain.contract.functions.getStudentCredentialsPage(student, offset, limit + 1).call()
        has_more = len(ids) > limit
        page_ids = ids[:limit]
        items = [chain.credential(int(credential_id)) for credential_id in page_ids]
        return {"student": student, "offset": offset, "limit": limit, "hasMore": has_more, "items": items}
    except Exception as exc:
        logger.exception("Student credential lookup failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not read the student's credential history from Sepolia.")


@app.get("/api/institutions/{address}/status")
def institution_status(address: str):
    if not Web3.is_address(address):
        raise HTTPException(status_code=422, detail="Invalid institution wallet address.")
    chain = _chain_or_503()
    checksum = Web3.to_checksum_address(address)
    approved = bool(chain.contract.functions.approvedInstitutions(checksum).call())
    name = chain.contract.functions.institutionNames(checksum).call() if hasattr(chain.contract.functions, "institutionNames") else ""
    return {"address": checksum, "approved": approved, "displayName": name, "displayNameIsTrusted": False}


@app.get("/api/institution/credentials/{credential_id}")
def get_institution_credential(credential_id: int, user: dict[str, Any] = Depends(institution_user)):
    chain = _chain_or_503()
    try:
        record = chain.credential(credential_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Credential not found.")
    if record["issuer"].lower() != user["address"].lower() and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="This credential was not issued by the signed-in institution.")
    return record


@app.get("/api/events")
def get_recent_events(limit: int = 20):
    if limit < 1 or limit > 50:
        raise HTTPException(status_code=422, detail="Limit must be between 1 and 50.")
    return {"items": database.recent_events(limit)}


@app.websocket("/ws/events")
async def websocket_events(websocket: WebSocket):
    await websocket.accept()
    queue = hub.subscribe()
    try:
        await websocket.send_json({"type": "Connected", "message": "Live Sepolia event stream connected."})
        while True:
            try:
                payload = await asyncio.wait_for(queue.get(), timeout=25)
                await websocket.send_json(payload)
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "Heartbeat", "timestamp": int(time.time())})
    except WebSocketDisconnect:
        pass
    finally:
        hub.unsubscribe(queue)
