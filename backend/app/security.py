from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from eth_account import Account
from eth_account.messages import encode_defunct
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from web3 import Web3

from .chain import ChainUnavailable, get_chain
from .config import get_settings

bearer = HTTPBearer(auto_error=False)


def create_session(address: str, role: str) -> str:
    settings = get_settings()
    if len(settings.session_secret) < 32:
        raise HTTPException(status_code=500, detail="Backend SESSION_SECRET must contain at least 32 characters.")
    now = datetime.now(timezone.utc)
    payload = {"sub": Web3.to_checksum_address(address), "role": role, "iat": now, "exp": now + timedelta(minutes=settings.session_ttl_minutes)}
    return jwt.encode(payload, settings.session_secret, algorithm="HS256")


async def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict[str, Any]:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Sign in with your wallet to continue.")
    settings = get_settings()
    try:
        payload = jwt.decode(credentials.credentials, settings.session_secret, algorithms=["HS256"])
        address = Web3.to_checksum_address(payload["sub"])
        return {"address": address, "role": payload["role"]}
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Your wallet session is invalid or expired. Sign in again.")


async def institution_user(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    if user["role"] not in {"institution", "admin"}:
        raise HTTPException(status_code=403, detail="This wallet is not an approved institution.")
    try:
        chain = get_chain()
        if user["role"] == "institution" and not chain.contract.functions.approvedInstitutions(user["address"]).call():
            raise HTTPException(status_code=403, detail="Institution approval has been removed. Sign in is no longer permitted.")
        if user["role"] == "admin" and not chain.contract.functions.isAdmin(user["address"]).call():
            raise HTTPException(status_code=403, detail="This wallet is no longer an administrator.")
    except ChainUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return user
