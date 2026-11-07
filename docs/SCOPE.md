# Satwik — VeriDegree v2 Scope Document

## 1. One-liner

VeriDegree lets approved educational institutions issue and revoke hash-backed academic credentials, while students and employers can check a certificate's on-chain record through a simple web application.

## 2. The problem

Employers often need to confirm that an academic certificate was issued by the claimed institution and has not been revoked. A deployed smart contract alone does not solve the usability problem: ordinary employers and students should not need Remix, Hardhat, a block explorer, or knowledge of contract functions to check a certificate.

VeriDegree provides a web interface around the existing Sepolia contract. The original certificate remains off-chain. The application calculates SHA-256 over the exact uploaded file bytes and looks up that digest on-chain.

## 3. Users and roles

| Role | Needs a wallet? | What they can do |
|---|---|---|
| Institution staff | Yes | Sign in by signing a backend challenge; if the connected address is currently approved, open the institution workspace, issue credentials, and revoke credentials it issued. |
| Student | Yes, to see wallet-linked records | Connect a wallet and view credential IDs and public credential status associated with that address. No personal profile or password account is created. |
| Employer / public verifier | No | Upload a certificate and see `Valid`, `Revoked`, `Issuer not currently approved`, or `Not found`, with a clear explanation. |
| Contract administrators | Yes; three fixed admin addresses | Approve/remove institutions and perform emergency administrative actions through the contract's 2-of-3 multisig. Admin governance is a contract capability, not a separate core application screen in this scope. |

## 4. User flows

### A. Institution signs in and issues a credential

1. Institution staff opens the VeriDegree website and connects MetaMask.
2. The frontend asks the FastAPI backend for a one-time sign-in challenge.
3. The wallet signs the challenge; the backend verifies the signature and checks `approvedInstitutions(address)` on Sepolia.
4. If approved, the backend establishes a short-lived session. If not approved, access to the institution workspace is denied.
5. Staff selects the exact certificate file and enters the student's wallet address.
6. The application calculates SHA-256 from the exact file bytes. The frontend asks MetaMask to call `issueCredential(bytes32,address)`.
7. The UI shows pending, confirmed, or failed status. A `CredentialIssued` event updates the visible activity without a manual page refresh.

### B. Institution revokes a credential

1. Approved institution staff signs in and finds the credential by ID or certificate hash.
2. The application displays the credential's issuer, student wallet, issue time, and current revocation state.
3. The institution calls `revokeCredential(credentialId)` from its approved wallet through MetaMask.
4. The UI displays pending, confirmed, or failed status and updates when `CredentialRevoked` is observed.

### C. Employer verifies a certificate

1. Employer opens the public verification page; no wallet or account is required.
2. Employer uploads the certificate file.
3. The backend calculates SHA-256 over the exact uploaded bytes and looks up the hash on Sepolia.
4. If no hash is registered, the page displays `Not found`.
5. If found, the page displays whether the record is revoked and separately whether the original issuer is currently approved. It must not label a credential `Valid` solely because `revoked == false`.

### D. Student views wallet-linked credentials

1. Student connects MetaMask.
2. The frontend checks that MetaMask is on Sepolia.
3. The backend reads the connected wallet's credential IDs using paginated contract reads.
4. The page displays credential status and public metadata. It does not expose private personal information because the contract does not store it.

## 5. Screens

The application is limited to four screens, with no separate marketing-only page required.

1. **Public home and certificate verification** — product introduction, certificate upload, result states (`Valid`, `Revoked`, `Issuer not currently approved`, `Not found`), and a link to connect a student or institution wallet.
2. **Institution workspace** — wallet connection/sign-in status, institution approval status, issue form, credential lookup, revoke action, transaction feedback, and recent on-chain activity.
3. **Student credentials** — connected wallet, paginated credential list, issuer and issue time, revocation status, and issuer-approval status.
4. **Access / wallet state** — connect wallet, wrong-network guidance, sign-in challenge, and clear denied/rejected/expired session states. This may be implemented as shared UI rather than a standalone route.

## 6. What lives where

| Responsibility | Smart contract | Python / FastAPI backend | Next.js frontend |
|---|---|---|---|
| Credential records and revocation | Source of truth | Reads and formats state | Displays state |
| Issuer approval | Source of truth | Checks approval for sign-in and verification | Displays approval status |
| Certificate hashing | Accepts `bytes32` | SHA-256 of exact uploaded bytes for public verification | SHA-256 of exact selected file bytes before issuance |
| Institution issue/revoke transactions | Enforces permissions and stores changes | Does not hold institution keys or submit institution transactions | MetaMask asks institution to sign and submit |
| Wallet sign-in | No session management | Issues and verifies one-time challenge; creates short-lived session | Requests challenge and asks wallet to sign |
| Live updates | Emits events | Watches logs and broadcasts event messages | Updates activity/status without refresh |
| Personal data / original certificate | Not stored | Not persisted for this project | Held only during the upload/issue interaction; not retained by default |

## 7. Custody model

- The deployer private key is used only for deployment and is not part of the running web application.
- Institution staff keep their own MetaMask keys. MetaMask signs issuance and institution-initiated revocation transactions.
- The three contract administrator keys remain with their respective administrators. Two of the three must approve supported administrative actions through the on-chain multisig.
- The FastAPI backend does not store user, institution, or administrator private keys and does not sign contract transactions. It uses a read-only Sepolia RPC connection for contract reads and event monitoring.
- The backend session secret and RPC URL are server configuration secrets. They are not wallet custody keys and must be stored in `.env` files excluded from Git.
- Students use their own wallets to identify the address whose credential list they want to read. Reading public chain data does not require signing a transaction.

This non-custodial model is appropriate because the institution remains responsible for its credential actions and the user sees and approves each transaction in MetaMask.

## 8. Extension: Wallet sign-in

Wallet sign-in is the single selected extension. The backend creates a one-time challenge containing a nonce, domain/application name, wallet address, chain context, and expiry. The wallet signs the challenge. The backend verifies the signature, consumes the nonce, checks that the address is an approved institution on Sepolia, and issues a short-lived session. A session does not grant blockchain permissions: the contract remains the final authority, and MetaMask must sign every state-changing transaction.

## 9. Contract changes since the Solidity course

The changes are recorded in [`CONTRACT_CHANGES.md`](CONTRACT_CHANGES.md). The v2 contract adds live issuer permission checks, unique SHA-256 hash lookup, destination-wallet-signed recovery, admin rotation, bounded emergency batch revocation, constrained/cancellable/expiring admin proposals, and O(1) student credential removal with pagination. The deployed contract uses the v2 ABI.

## 10. In scope / out of scope

### In scope

- Sepolia contract integration using the deployed v2 contract.
- FastAPI backend with at least three JSON endpoints.
- Wallet sign-in for approved institutions.
- Institution issue and direct revoke flows using MetaMask.
- Public certificate upload and hash-based verification.
- Student wallet-linked credential listing.
- At least one event-driven UI update without refreshing the page.
- Wrong-network, rejected-signature, rejected-transaction, pending, confirmed, and failed states.
- `.env.example` templates, setup documentation, tests, and a short demo.

### Out of scope

- Storing original certificate files or personal student data on-chain.
- Full university ERP/student information system integration.
- KYC, government identity checks, or automated proof that an institution is legally legitimate.
- Payments, tokens, NFTs, or an NFT marketplace.
- Custodial transaction signing or backend-held institution/admin private keys.
- IPFS or permanent file hosting.
- A separate admin governance dashboard; admins use the contract's 2-of-3 multisig through the documented contract interaction workflow for this project.
- Production hosting, mobile apps, and enterprise-scale indexing.

## 11. Acceptance criteria

- [ ] A fresh setup can start the backend and frontend using the README instructions and example environment files.
- [ ] An institution wallet can sign a one-time challenge and is admitted only if `approvedInstitutions(address)` is true on Sepolia.
- [ ] An unapproved wallet cannot access institution-only API actions or issue through the contract.
- [ ] An approved institution can issue a credential using SHA-256 of the exact certificate file bytes and MetaMask.
- [ ] An approved issuer can revoke a credential it issued, with pending, confirmed, and failed UI states.
- [ ] An employer can upload a certificate without connecting a wallet and see `Not found` for an unknown hash.
- [ ] A found certificate displays revocation state and issuer approval as separate facts.
- [ ] A student can connect a wallet and view that address's paginated credential list.
- [ ] At least one contract event updates the frontend without a manual refresh.
- [ ] The frontend clearly handles missing MetaMask, wrong network, rejected signature, rejected transaction, and backend/RPC failure.
- [ ] No private key, seed phrase, API secret, or real `.env` file is committed.

## 12. Open questions and risks

- **File format and exact bytes:** Verification only succeeds when the uploaded file is byte-for-byte identical to the file originally hashed. A re-saved or scanned copy may have different bytes. The UI must explain this limitation.
- **Issuer trust:** The chain proves that an approved address issued a hash-backed record; it does not independently prove the institution's real-world claims. Admins must vet institutions before approving them.
- **Public metadata:** Student wallet addresses, certificate hashes, issuer addresses, timestamps, and revocation state are public on Sepolia. The app must not imply complete privacy.
- **Event listener downtime:** The backend must resume from a stored last-processed block or safely backfill logs after restart so events are not silently missed.
- **Wallet session expiry:** A sign-in session must expire and be re-established with a new signature. Signing in does not replace transaction signatures.
