# VeriDegree v2 — Full-stack dApp

VeriDegree is a blockchain-backed academic credential verification application. Approved institutions issue and revoke certificate fingerprints, students view wallet-linked records, and employers verify an exact certificate file against the Sepolia registry.

> The v2 Solidity contract is intended to be deployed and source-verified on Sepolia at `0x1d355800fFA522d654cFd5186B6eE213aA292e75` (chain ID `11155111`). **Confirm this on Sepolia Etherscan yourself before relying on it** — check that the address shows a "Contract" tab with verified source, not just an address with a balance. If it doesn't match your own deployment, redeploy with `npm run deploy:sepolia` and update this address everywhere it's referenced (`backend/.env`, `frontend/.env.local`, this README, `docs/TECHNICAL.md`).

## Product scope

- **Public verifier:** upload the original PDF, JPG or PNG; the backend validates the filename, MIME type and file signature, calculates SHA-256 over the exact bytes and checks the on-chain hash mapping. No wallet is required.
- **Institution workspace:** connect MetaMask, sign a one-time challenge, and access the workspace only when `approvedInstitutions(address)` is true. Issue and direct-revoke transactions are signed by the institution in MetaMask.
- **Student records:** connect the wallet and view paginated credentials linked to that address.
- **Live activity:** FastAPI polls Sepolia logs after a three-block confirmation buffer, stores a de-duplicated event index and canonical block checkpoints in SQLite, reconciles recent chain reorganisations, and broadcasts updates over WebSocket.

The app deliberately does not store original certificate files, personal student profiles, or wallet private keys. Public chain metadata remains publicly readable.

## Repository layout

```text
veridegree/
├── contracts/                 # Solidity v2 contract
├── scripts/                   # Hardhat deployment, verification and SHA-256 helper
├── test/                      # Hardhat contract tests
├── docs/
│   ├── SCOPE.md
│   ├── TECHNICAL.md
│   └── CONTRACT_CHANGES.md
├── backend/                   # FastAPI + Web3.py
│   ├── app/
│   │   ├── abi/VeriDegree.json
│   │   ├── main.py
│   │   ├── chain.py
│   │   ├── event_listener.py
│   │   ├── security.py
│   │   └── database.py
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
├── frontend/                  # Next.js App Router + TypeScript + ethers v6
│   ├── src/app/
│   ├── src/components/
│   ├── src/context/
│   └── src/lib/
├── .env.example               # Hardhat deploy/verify only
└── README.md
```

## Start here

For a guided Windows setup, follow [`START_HERE.md`](START_HERE.md). The longer sections below explain the architecture and individual setup steps.

## Prerequisites

- Node.js 20.9 or later (your Node.js 24.11.0 meets the Next.js minimum requirement).
- Python 3.10 or later (Python 3.13 is supported by the selected Web3.py 7.x line).
- MetaMask browser extension with Sepolia enabled.
- A Sepolia RPC endpoint (Infura or another provider).
- Sepolia test ETH for institution wallets that issue or revoke.

## 1. Configure the backend

Open a terminal in `backend/`:

### Windows PowerShell

```powershell
Copy-Item .env.example .env
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Copy the generated random value into `SESSION_SECRET` in `backend/.env`. Fill in:

```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
CONTRACT_ADDRESS=0x1d355800fFA522d654cFd5186B6eE213aA292e75
CHAIN_ID=11155111
CONTRACT_DEPLOYMENT_BLOCK=-1
SESSION_SECRET=YOUR_GENERATED_RANDOM_SECRET
APP_DOMAIN=localhost:3000
CORS_ORIGINS=http://localhost:3000
```

`CONTRACT_DEPLOYMENT_BLOCK=-1` tells the backend to locate the contract creation block using `eth_getCode` binary search. You can replace `-1` with the actual creation block to skip detection. `EVENT_CONFIRMATIONS=3` delays event broadcasts until three blocks have been added after the event block. The backend uses a read-only RPC connection; do **not** put `PRIVATE_KEY` in `backend/.env`.

Run the API from the `backend/` directory:

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Check `http://127.0.0.1:8000/api/health` and `http://127.0.0.1:8000/docs`.

## 2. Configure the frontend

Open a second terminal in `frontend/`:

```powershell
Copy-Item .env.local.example .env.local
npm install
npm run dev
```

The provided `.env.local.example` already contains the deployed contract address and local API/WebSocket URLs. Open `http://localhost:3000`.

The Next.js app uses `NEXT_PUBLIC_*` variables. Only public values belong there: chain ID, contract address, API URL and WebSocket URL. Never put RPC provider secrets, private keys, or the backend session secret in frontend variables.

## 3. Start using VeriDegree

1. **Employer:** open `/verify`, upload the exact original certificate file, and read the result. Statuses are `valid`, `revoked`, `issuer_unapproved`, and `not_found`.
2. **Institution:** open `/institution`, connect an approved issuer wallet, select **Sign in with wallet**, approve the zero-gas message signature, and issue/revoke with MetaMask. Transactions are not signed by the backend.
3. **Student:** open `/student`, connect the wallet that holds the credential records, and browse the paginated history.
4. **Live updates:** keep the app open while an institution issues/revokes a credential. The event panel receives the backend WebSocket broadcast without a page refresh.

### Institution approval

A wallet cannot issue just because it has signed in. It must first be approved in `approvedInstitutions` by the contract's 2-of-3 administrative process. The backend re-checks this on sign-in and protected institution requests; the contract is the final authority for transactions.

## API routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | API/RPC/network status |
| POST | `/api/auth/challenge` | Create one-time wallet sign-in message |
| POST | `/api/auth/verify` | Recover signer, consume nonce, check on-chain role, issue short-lived session token |
| GET | `/api/auth/me` | Re-check current wallet role |
| POST | `/api/verify/upload` | Validated PDF/JPG/PNG upload, SHA-256 digest and hash-based on-chain verification |
| GET | `/api/credentials/{id}` | Public credential record lookup |
| GET | `/api/students/{address}/credentials` | Paginated student credential history with bounded look-ahead `hasMore` |
| GET | `/api/institutions/{address}/status` | Current issuer approval and untrusted display metadata |
| GET | `/api/institution/credentials/{id}` | Protected record lookup for issuer/admin session |
| GET | `/api/events` | Most recent indexed events |
| WS | `/ws/events` | Live on-chain event stream |

## Development checks

### Hardhat (run from repository root)

```powershell
npm install
npm test
npm run compile
```

### Backend (run from `backend/`)

```powershell
python -m compileall app tests
pytest
```

### Frontend (run from `frontend/`)

```powershell
npm run lint
npm run build
```

Run all checks after installing dependencies. A source archive cannot prove the app is integrated with your own local MetaMask/RPC environment; the live issue → verify → revoke → verify flow must be demonstrated against Sepolia.

## Security and privacy notes

- Never commit `.env`, `backend/.env`, `frontend/.env.local`, wallet keys, seed phrases, or database files.
- The deployer private key belongs only in the Hardhat root `.env` when deploying; the running app does not use it.
- The backend only holds a read RPC URL and a session-signing secret. It never has a transaction-signing wallet.
- Wallet sign-in is a short-lived, single-use EIP-191 message signature; it is not a blockchain transaction and costs no gas.
- The app reports revocation and issuer approval independently. A non-revoked credential from a removed institution is not displayed as fully valid.
- Certificate hashing is SHA-256 over the exact bytes. Renaming, scanning, exporting or recompressing a certificate changes its hash.
- Student wallet addresses, issuer addresses, hashes and timestamps are public on-chain metadata. Do not put names, email addresses or original certificate contents in the contract.
- The contract's emergency admin actions remain governed by its 2-of-3 multisig. This web app does not implement a separate admin governance console.

## Documentation

- [Scope Document](docs/SCOPE.md)
- [Technical Design Document](docs/TECHNICAL.md)
- [Contract Changes](docs/CONTRACT_CHANGES.md)
- [V5 Review Fixes](docs/V5_REVIEW_FIXES.md)
- [Live Demo Guide](docs/DEMO_GUIDE.md)

## Acknowledgements

The implementation uses Solidity, Hardhat, FastAPI, Web3.py, eth-account, Next.js, React, TypeScript and ethers.js. Record any tutorials, external code snippets, and AI assistance used in your final `TECHNICAL.md` acknowledgement section.

## Frontend design

The interface uses a restrained editorial system built around the credential itself: warm paper, forest-green surfaces, brass details and measured typography. The homepage follows the record through three stages — institution issue, on-chain fingerprint and public verification — using a sticky scroll-led visual. The institution workspace includes a clearly marked sample certificate for repeatable demonstrations. The original PDF is illustrative only; the contract stores the fingerprint and wallet-linked record, not its display name or course text.

For the presenter workflow, see [`docs/DEMO_GUIDE.md`](docs/DEMO_GUIDE.md). The design uses original HTML/CSS illustrations and transitions rather than copied images or assets from the reference sites.


## Visual design
See [`docs/VISUAL_DESIGN_SYSTEM.md`](docs/VISUAL_DESIGN_SYSTEM.md) for the interface palette, layout and interaction principles.
