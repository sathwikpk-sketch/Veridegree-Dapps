# VeriDegree — Complete Frontend Experience and Engineering Brief

> Use this brief with the existing VeriDegree repository. It is an implementation brief, not permission to replace the working product with a new mock application.

## 1. Project objective

VeriDegree is a blockchain-based academic credential verification platform. Transform the existing application into a premium, professional and highly interactive digital experience. The website should tell a coherent story: visitors enter the VeriDegree brand, see its message emerge, and follow the life of an academic credential from institutional issue to blockchain registration and employer verification.

This is not a generic SaaS website, blockchain dashboard or simple landing page. Preserve the existing product, contract integration and functional workflows.

## 2. Reference direction

Use the following sites as references for principles, not as templates to copy:

- Lusion — creative interaction, sophisticated animation, depth and responsive visual behaviour: https://www.lusion.co/
- Genesis — restrained luxury, premium presentation, elegant typography and controlled spacing: https://www.genesis.com/worldwide/en
- Vishvu Tech — staged brand opening, large visual compositions, progressive text reveals and scroll-led storytelling: https://vishvutechmain.vercel.app/

Create an original identity for VeriDegree. Do not copy layouts, copywriting, images, animations or brand assets from these sites.

## 3. Product design principles

The visual language should communicate trust, authenticity, academic achievement, permanence and verification. Keep it minimal but memorable. Every visual element must support the subject of credentials and verification.

Avoid generic AI-generated templates, excessive rounded cards, random glowing circles, too many gradients, purple-blue AI aesthetics, unnecessary glassmorphism, excessive neon accents, decorative particles without meaning, repetitive card sections and large empty areas without purpose.

## 4. Colour system

Use this coordinated palette consistently:

| Colour | Hex | Role |
|---|---|---|
| Midnight Navy | `#14283B` | Cinematic sections and authority |
| Porcelain | `#F3F6F7` | Main light backgrounds |
| Deep Teal | `#287A76` | Primary actions and brand accents |
| Muted Bronze | `#AD895C` | Academic seals and premium details |
| Sea Glass | `#83B9B0` | Secondary highlights and data visuals |

Alternate dark and light sections where appropriate. Do not make every page dark. Use bronze sparingly and teal for meaningful actions and status accents. Maintain accessible contrast.

## 5. Opening animation — VeriDegree brand reveal

Create a short, full-screen introduction:

1. Begin with a quiet Midnight Navy background.
2. Reveal the circular VeriDegree emblem in the centre using a controlled stroke draw or circular reveal.
3. Reveal `VERIDEGREE` progressively, with carefully controlled spacing. Do not use a basic typing effect.
4. Reveal the tagline: **“Trust, made verifiable.”**
5. A fine line travels across the screen and transitions naturally into the hero.

Keep the sequence around 1.5–2 seconds. It must not behave like a loading screen. Show it once per session, allow it to be skipped, and provide an immediate reduced-motion alternative. Do not replay it during ordinary route navigation.

## 6. Main hero

Use a full-width composition with a strong headline and a custom credential visual. Suggested headline: **“An achievement deserves proof.”**

Supporting copy: “Academic credentials should be easy to trust and simple to verify. VeriDegree gives every registered certificate a verifiable record on Ethereum.”

Include the brand, headline, concise copy, Verify a certificate and For institutions actions, a custom certificate visual and a subtle Sepolia network indicator.

The certificate should feel like a physical academic document: embossed seal, elegant typography, paper texture, layered depth, refined shadows and restrained detail. It may respond gently to pointer movement. Do not spin continuously or use a generic stock illustration.

## 7. Main scroll storytelling — central experience

Build a continuous scroll-controlled story, not unrelated content cards. Use a sticky visual stage beside progressive content. The main visual must evolve in response to scroll progress and remain connected to the current chapter.

### Chapter 01 — The achievement

Headline: **“Every qualification begins with an achievement.”**

Show an academic certificate emerging and gradually unfolding. Reveal its seal and academic details. Explain that an approved institution creates the original certificate.

### Chapter 02 — The fingerprint

Headline: **“But a document needs proof.”**

As the visitor scrolls, transition the paper into a structured digital fingerprint representation. The document's edges may transform into organised lines and data, but avoid random particle explosions. Show an illustrative SHA-256 fingerprint and explain that the digest is calculated from the exact original file bytes.

### Chapter 03 — The registry

Headline: **“The proof becomes a record.”**

Move the fingerprint into a refined Ethereum-style ledger visual. Show connected registry records and explain that VeriDegree stores the fingerprint and relevant credential information on Sepolia, not the full certificate PDF.

### Chapter 04 — Verification

Headline: **“Now anyone can check the record.”**

Bring the document back into view and compare its fingerprint with the registry. Explain three separate checks:

1. Is the fingerprint registered?
2. Has the credential been revoked?
3. Is the issuing institution currently approved?

Make clear why these checks are separate. Transition naturally into the real verification feature.

### Chapter 05 — The result

Headline: **“Trust should not depend on a promise.”**

Show the document and verification result together. End with clear actions: Verify a certificate and Issue a credential. Transition into the actual application.

### Story interaction requirements

- Scroll-controlled stages and a sticky visual composition.
- Progressive text emergence and meaningful visual transformations.
- Chapter progress indicator.
- Smooth transitions and restrained pointer-responsive 3D elements.
- Normal browser scrolling; do not hijack or lock scrolling.
- Responsive mobile adaptation that turns pinned desktop scenes into natural vertical storytelling.
- Respect `prefers-reduced-motion` and keep all important content available without animation.
- Use existing animation dependencies where possible. Add GSAP/ScrollTrigger or another substantial library only if justified and compatible with the current project.

## 8. Public certificate verification — `/verify`

This is a core product workflow and must work without a connected wallet.

Create a premium document-upload experience with:

- Clear explanation and large drag-and-drop area.
- File picker, selected file name and size, remove/replace controls.
- Upload and verification progress states.
- Clear outcomes: `Valid`, `Revoked`, `Not found`, and `Issuer not currently approved`.
- Separate display of revocation and current issuer approval.
- Human-readable explanations instead of raw JSON or technical stack traces.

The public verifier must not combine issuer approval and revocation into one status. A record can remain historically registered and not revoked even if the institution is later removed. Explain that the verifier processes the selected file to calculate its hash; do not imply that the browser alone makes the blockchain decision.

## 9. Institution workspace — `/institution`

Keep this as a practical working environment, not a marketing page.

Workflow:

1. Connect MetaMask.
2. Sign a one-time authentication challenge.
3. Backend verifies wallet ownership.
4. Backend checks current institution approval.
5. Approved institution enters the workspace.
6. Institution issues and manages credentials.

Include:

### Institution overview
- Connected institution wallet.
- Current network and approval status.
- Credential activity.

### Issue credential
- Student wallet address.
- Original certificate file.
- Calculated fingerprint.
- Issue credential action.

Hash the exact file bytes with SHA-256. MetaMask must show the real transaction for user approval. Show waiting for wallet confirmation, submitted, confirmed, rejected and failed states.

### Credential management
Allow the institution to find a credential by ID, inspect its details and status, and revoke eligible records. The original issuer may directly revoke its own credentials only while it retains the required approved issuer permissions. The contract remains the final permission authority.

## 10. Student dashboard — `/student`

Keep this page simple and useful. Include connected wallet details, paginated credential history, credential ID, issuer address, issue timestamp, fingerprint, current status and a credential detail view.

Design explicit disconnected, loading, empty, error and populated states. Do not leave a large blank area when no records exist. Give the student clear guidance on which wallet to connect.

## 11. Local demonstration preparation

Prepare the application for a classroom demonstration without creating an unsafe public backdoor.

Create a small Demo Preparation area available only in local development. Include:

- Sepolia network and chain ID.
- Deployed contract address.
- Current connected wallet.
- Three administrator public addresses read from the deployed contract.
- Institution and student test addresses from environment configuration.
- Sample certificate download.
- Sample academic details and concise transaction instructions.
- Copy buttons for public addresses and IDs.

Never invent wallet addresses. Read the administrator addresses from the actual contract. Use environment variables for demo institution/student addresses and show clear setup instructions if missing.

Provide a fictional sample certificate with these details:

- Student: Aarav Mehta
- Institution: Northline Institute
- Programme: Applied Computing — Product Systems
- Cohort: 2026

Clearly mark the PDF: **“DEMONSTRATION COPY — NOT AN OFFICIAL ACADEMIC QUALIFICATION”.** The demo may prefill a form, load the sample PDF and prepare a transaction, but must not automatically issue a credential or pretend a sample exists on-chain. Every real transaction still requires MetaMask approval. After an actual successful issue, use the returned credential ID in the management flow.

Keep demo preparation disabled or unavailable in production unless deliberately configured.

## 12. Preserve the existing technical stack and repository

This is an existing application. Inspect the repository before editing. Read the deployed contract ABI, API routes, wallet context, authentication flow, environment configuration and event listener. Do not delete or replace working files just to simplify the redesign.

Preserve:

- Next.js, React and TypeScript frontend.
- Python and FastAPI backend.
- Web3.py blockchain integration.
- MetaMask wallet connection.
- Wallet challenge authentication.
- Solidity and Hardhat contract project.
- Ethereum Sepolia deployment.
- SHA-256 certificate fingerprinting.
- Institution approval/removal and credential issue/revoke.
- Student credential history.
- WebSocket event updates.

## 13. Contract rules that must remain consistent

### Certificate hashing

Use SHA-256 over the exact original file bytes in the frontend, backend and helper scripts. The resulting 32-byte digest is passed to the contract as `bytes32`. Internal Ethereum Keccak-256 calculations for selectors or signatures are separate from certificate file hashing.

### Uniqueness and lookup

Duplicate certificate hashes must be rejected. Use the contract's direct hash-to-credential lookup instead of scanning every credential.

### Validity semantics

Do not redefine the contract's `isValid`. It means the credential has not been revoked. The application separately checks whether the institution is currently approved.

### Institution removal

A removed institution loses its live issuer permissions. Its historical records remain. The administrator multisignature emergency revocation path remains available.

### Student recovery

Recovery requires a signature from the destination wallet. The signed challenge must retain chain, contract, credential, old/new wallet and nonce protection.

### Administration

Preserve the 2-of-3 administrator model, admin rotation, proposal restrictions, expiry, cancellation and emergency revocation. Do not redeploy the contract merely to make frontend visual changes.

## 14. Wallet authentication and security

The application is non-custodial. MetaMask holds the user's wallet key. The browser signs the login challenge. The backend verifies the signature and manages a short-lived session. The backend never collects an institution private key. Actual transactions are signed in MetaMask, and the contract applies final permission checks.

Handle wallet not installed, wallet disconnected, wrong network, account changed, rejected signature, rejected transaction, expired session, RPC unavailable and backend unavailable. Give users clear messages. Log detailed exceptions privately and do not return raw provider errors or stack traces to the browser.

## 15. Backend and live updates

Preserve existing FastAPI routes. At minimum, retain usable health/network, certificate verification and institution/student credential endpoints.

The backend must:

- Load configuration from environment variables.
- Check Sepolia chain ID and contract address.
- Verify wallet challenge signatures and short-lived sessions.
- Validate uploads independently of browser restrictions.
- Enforce file-size limits, supported file types and actual file signatures.
- Hash exact file bytes with SHA-256.
- Avoid permanently storing original certificate files.
- Read contract state and monitor relevant contract events.
- Publish confirmed activity over WebSocket.
- Handle confirmation buffers, restart/resume, missed blocks, duplicate events and recent chain reorganisations.

Never publish an event as confirmed before the configured confirmation threshold.

## 16. Responsiveness, motion and accessibility

Support large desktop, laptop, tablet and mobile layouts. Adapt sticky storytelling for mobile instead of forcing desktop pinning onto small screens. Respect reduced-motion preferences. Keep primary actions keyboard accessible with visible focus. Do not hide content behind animation. The site must remain understandable if animation fails. Avoid large animation assets that slow first load.

## 17. Testing and quality gates

Do not stop after the website looks good. Run and report actual results for:

### Solidity
- Hardhat compile.
- Full contract test suite.

### Backend
- Python syntax checks.
- Full pytest suite.
- Health endpoint and Sepolia connection.
- Upload validation.
- Authentication.
- Event listener and recovery tests.

### Frontend
- ESLint.
- TypeScript checks.
- Next.js production build.
- Responsive layout checks.
- Hydration and browser-console checks.

### End-to-end class demonstration

1. Connect an administrator wallet.
2. Sign in as administrator.
3. Approve a test institution through two distinct admin confirmations.
4. Connect the institution wallet.
5. Sign in to the institution workspace.
6. Load the sample certificate.
7. Issue a credential through MetaMask.
8. Wait for actual transaction confirmation.
9. Upload the same original certificate on the public verification page.
10. Confirm that the actual on-chain record is found.
11. Connect the student wallet.
12. Confirm the issued credential appears in the student dashboard.
13. Revoke the credential from the institution workspace.
14. Upload the certificate again.
15. Confirm that the result reports `Revoked`.

Use actual blockchain state for all issuance, verification and revocation results. If a step cannot be completed, state the exact reason and remaining work. Never claim a test or build passed unless it was executed.

## 18. Deliverables

Provide:

1. Complete updated VeriDegree project.
2. One final ZIP.
3. Updated Scope and Technical documentation.
4. Updated README and Windows setup guide.
5. Environment example files with placeholders only.
6. Demo certificate and demo instructions.
7. Actual test/build results.
8. Remaining limitations, if any.

Never include real `.env` files, wallet private keys, seed phrases, Infura secrets or personal account credentials.

## Final creative direction

The visitor should remember the VeriDegree name appearing from darkness, words emerging gradually, an academic certificate unfolding, the transformation from document to fingerprint, the fingerprint becoming a blockchain record, and the final verification result.

The landing page should tell the story without requiring a long explanation. The application pages should then make real workflows easy to complete.

Make it premium, cinematic, minimal, smooth, interactive and technically reliable. Do not add animation just to make the page busy. Every transition should have a reason. The result should feel like a real product created by a professional digital design and engineering team, not a generated template.

---

# Final refinement: restrained design and word-by-word scroll journey

The visual direction has been refined to be quieter and more focused. Do not increase the number of visual effects. Use one clear focal object at a time and let spacing, typography, material and transition timing carry the experience.

- Keep the certificate as the main hero object. Remove oversized halos, floating badges, dense grids and decorative motion that does not explain the product.
- Keep the story palette restrained: Midnight Navy `#14283B`, Porcelain `#F3F6F7`, Deep Teal `#287A76`, Muted Bronze `#AD895C`, Sea Glass `#83B9B0`.
- As the visitor scrolls through each story chapter, reveal the heading word by word. Each word should rise slightly and sharpen into focus in reading order. The effect must follow actual scroll progress, not run as an unrelated timed text animation.
- Keep the story visual sticky on desktop and change it smoothly between the certificate, fingerprint and verification scenes. On mobile, put the visual back into the normal page flow and keep scrolling natural.
- Reduce glow, particles, scanlines, continuous floating and heavy shadows. Do not add effects simply to make the page look active.
- Ensure the words remain available to screen readers and fully visible when `prefers-reduced-motion` is enabled or JavaScript is unavailable.
- Keep native smooth scrolling. Do not hijack the scroll wheel, lock page scrolling or force users through a scripted sequence.

The aim is a calm, well-paced journey: the visitor sees the achievement, follows its fingerprint into the registry, and understands how an employer checks the record. The animation should clarify that sequence rather than compete with it.
