# VeriDegree — Start Here (Windows)

The repository contains a Solidity/Hardhat contract project, a FastAPI backend, and a Next.js frontend. The example configuration uses:

`0x1d355800fFA522d654cFd5186B6eE213aA292e75` on Sepolia (`11155111`).

## Before you start

- Install Node.js 20.9+ (Node 22 or 24 is suitable).
- Install Python 3.10+.
- Install the MetaMask browser extension.
- Have your Sepolia RPC HTTPS endpoint from Infura (or another provider).
- The wallet that uses the institution workspace must already be approved by the contract administrators.

Do not send private keys, recovery phrases, `.env` files, or API secrets to anyone. The running dApp does not need the Hardhat deployer private key.

## 1. Configure and start the backend

Open a PowerShell terminal in the `backend` folder.

```powershell
Copy-Item .env.example .env
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

If PowerShell blocks virtual-environment activation, run this once in that terminal:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

Open `backend/.env` and set:

- `SEPOLIA_RPC_URL` — paste your Infura Sepolia HTTPS endpoint.
- `CONTRACT_ADDRESS` — keep the configured deployed v2 address unless you deploy a replacement.
- `SESSION_SECRET` — generate one with the command below and paste the result.

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Leave `CHAIN_ID=11155111`, `APP_DOMAIN=localhost:3000`, and `CORS_ORIGINS=http://localhost:3000` for local development. Keep `CONTRACT_DEPLOYMENT_BLOCK=-1` to let the backend find the contract creation block automatically. `EVENT_CONFIRMATIONS=3` is the default confirmation buffer before the live activity panel receives an event. The listener also stores recent block checkpoints so it can reconcile a short chain reorganisation.

Start the API:

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Check these addresses in your browser:

- API health: http://127.0.0.1:8000/api/health
- Interactive API docs: http://127.0.0.1:8000/docs

Keep this terminal running.

## 2. Configure and start the frontend

Open a second PowerShell terminal in the `frontend` folder.

```powershell
Copy-Item .env.local.example .env.local
npm install
npm run dev
```

Open http://localhost:3000.

## 3. Prepare a repeatable class demonstration

Read [`docs/DEMO_GUIDE.md`](docs/DEMO_GUIDE.md) before the presentation. It explains the separate admin, institution and student wallets, the sample certificate, and the issue → verify → student view → revoke → verify again flow. The institution workspace has a **Load demo record** button that loads the sample PDF and uses `NEXT_PUBLIC_DEMO_STUDENT_ADDRESS` (or the last valid address entered in that browser).

The sample certificate is a fictional specimen clearly marked as a demonstration document. Names and programme details are visible in the PDF only; the deployed contract does not store them as credential metadata.

## 4. Try the four app areas

- `/` — VeriDegree landing page.
- `/verify` — public certificate upload and verification. PDF, JPG and PNG file signatures are checked by both the browser and backend. Upload the exact same file bytes that the institution originally registered; re-exported or scanned copies normally have different hashes.
- `/institution` — connect an approved issuer wallet, sign the wallet challenge, then issue or directly revoke its own credentials. MetaMask signs each transaction; the backend never holds the wallet key.
- `/student` — connect the wallet associated with credentials to read its credential history.

The admin 2-of-3 governance functions remain in the smart contract; the web app does not include a separate admin governance console.

## 5. Run checks

From `backend/` with the virtual environment activated:

```powershell
python -m compileall app tests
python -m pytest -q
```

From `frontend/`:

```powershell
npm run lint
npm run build
```

From the repository root for the Solidity project:

```powershell
npm test
npm run compile
```

## 6. Troubleshooting

- If `/api/health` reports `degraded`, check `SEPOLIA_RPC_URL`, `CONTRACT_ADDRESS`, and that the provider is connected to Sepolia.
- If the institution sign-in is denied, the connected wallet may not be approved in `approvedInstitutions(address)` or the backend may be unable to read Sepolia.
- If MetaMask reports the wrong network, switch the wallet to Sepolia.
- If certificate verification says `Not found`, make sure the uploaded file is byte-for-byte identical to the file registered by the institution.
- If `npm install` or `pip install` fails, check internet access / registry connectivity and retry. The source archive intentionally does not include dependency folders.

## 7. Before submitting or demonstrating

1. Run all Solidity, backend, and frontend checks above.
2. Confirm the contract address and Sepolia source verification in Etherscan.
3. Test the complete flow: issue, verify, revoke, and verify again.
4. Use only test wallets and test ETH.
