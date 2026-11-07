# VeriDegree

VeriDegree is a full-stack application for issuing, storing, and verifying academic credential records on Ethereum. It consists of a Solidity contract, a FastAPI backend, and a Next.js interface.

Authorized institutions register credential hashes from their MetaMask wallets. Anyone can verify an uploaded certificate without a wallet, while students can view records associated with their address.

The current application is configured for the Ethereum Sepolia test network. Before using a deployed contract, verify its address and source on Sepolia Etherscan and update the contract address in the root environment file, `backend/.env`, and `frontend/.env.local`.

## Features

- Public verification for PDF, JPG, and PNG files
- SHA-256 hashing of exact file bytes
- Institution approval and credential issuance through MetaMask
- Direct credential revocation by approved institutions
- Student credential history
- Live on-chain activity updates
- Contract event indexing and recent reorganisation checks

Certificate files and personal profiles are not stored in the database or on-chain. Transaction signing happens in MetaMask; the backend does not hold a wallet private key.

## Repository layout

```text
VeriDegree/
├── contracts/       Solidity contracts
├── scripts/         Deployment, verification, and hashing utilities
├── test/            Hardhat contract tests
├── backend/         FastAPI API and event listener
│   ├── app/
│   └── tests/
├── frontend/        Next.js application
│   └── src/
├── docs/            Project documentation
├── .env.example     Hardhat deployment settings
└── README.md
```

## Start here

See [`START_HERE.md`](START_HERE.md) for the Windows setup procedure.

## Prerequisites

- Node.js 20.9 or later
- Python 3.10 or later
- MetaMask browser extension with Sepolia enabled.
- A Sepolia RPC endpoint (Infura or another provider).
- Sepolia test ETH for institution wallets that issue or revoke.

## Backend

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

Copy the generated value into `SESSION_SECRET` in `backend/.env`, then set:

```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
CONTRACT_ADDRESS=0x1d355800fFA522d654cFd5186B6eE213aA292e75
CHAIN_ID=11155111
CONTRACT_DEPLOYMENT_BLOCK=-1
SESSION_SECRET=YOUR_GENERATED_RANDOM_SECRET
APP_DOMAIN=localhost:3000
CORS_ORIGINS=http://localhost:3000
```

With `CONTRACT_DEPLOYMENT_BLOCK=-1`, the backend locates the contract creation block. Set it to a known deployment block to speed startup. The backend uses a read-only RPC connection; do not place a private key in `backend/.env`.

Run the API from the `backend/` directory:

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Check the API at http://127.0.0.1:8000/api/health and its interactive documentation at http://127.0.0.1:8000/docs.

## Frontend

Open a second terminal in `frontend/`:

```powershell
Copy-Item .env.local.example .env.local
npm install
npm run dev
```

The example environment file contains local API and WebSocket URLs. Open http://localhost:3000 after the development server starts.

The Next.js app uses `NEXT_PUBLIC_*` variables for public configuration only. Do not place RPC credentials, private keys, or backend secrets in frontend environment variables.

## Use the application

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

## Tests

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

Run these checks after installing dependencies. End-to-end verification should also include issuing, verifying, revoking, and verifying again on Sepolia.

## Security and privacy notes

- Never commit `.env`, `backend/.env`, `frontend/.env.local`, wallet keys, seed phrases, or database files.
- The deployer private key belongs only in the Hardhat root `.env` when deploying; the running app does not use it.
- The backend only holds a read RPC URL and a session-signing secret. It never has a transaction-signing wallet.
- Public blockchain data may expose wallet addresses, credential hashes, timestamps, and transaction metadata.
- Wallet sign-in is a one-time EIP-191 signature. It does not send a transaction or require gas.
- Institution role checks are enforced in both the backend and the contract.
- Renaming, exporting, scanning, or recompressing a certificate changes its SHA-256 hash.

## Documentation

- [Setup guide](START_HERE.md)
- [Project scope](docs/SCOPE.md)
- [Technical design](docs/TECHNICAL.md)
- [Contract changes](docs/CONTRACT_CHANGES.md)
- [Demo guide](docs/DEMO_GUIDE.md)
- [Visual design system](docs/VISUAL_DESIGN_SYSTEM.md)
