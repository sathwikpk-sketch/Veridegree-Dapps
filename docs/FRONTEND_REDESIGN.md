# Frontend direction — VeriDegree

The current interface is designed around the subject of the product: an academic credential and the record that makes it verifiable. It uses warm paper, forest green, restrained brass accents and a clear typographic hierarchy.

## Homepage experience

The homepage is a three-part product story rather than a static marketing page:

1. **Issue:** an institution creates the record from its own wallet.
2. **Register:** the exact certificate file bytes are fingerprinted with SHA-256 and the digest is recorded on Sepolia.
3. **Verify:** an employer uploads the original file and sees the registry match, revocation state and issuer approval separately.

The story stage stays in view while the reader moves through the steps. Its visual changes to match the stage. This borrows the general idea of visual storytelling, scroll-led progression and product restraint from the supplied reference sites, but the layout, copy and credential illustrations are original to VeriDegree.

## Product routes

- `/verify` is a direct task page with a real upload and registry lookup. It also provides the clearly marked demonstration PDF for repeatable testing.
- `/institution` focuses on authentication, issuance and direct revocation. Its demo kit loads a sample certificate and can prefill a separate student test-wallet address.
- `/student` has explicit connected, loading, empty and populated states so the page remains useful even when the wallet has no credentials.

## Motion and accessibility

Motion is used for the credential tilt, story-stage transitions, button feedback and scroll reveals. It is not required to understand the information. Reduced-motion preferences disable the decorative motion, all primary actions remain keyboard accessible, and the sample visuals are labelled as illustrative rather than live blockchain results.

## Demo data boundary

The sample PDF contains fictional display details (Northline Institute, Aarav Mehta and Applied Computing — Product Systems). Those details are inside the uploaded file. The contract only stores the hash and wallet-linked credential fields defined by the Solidity implementation; it does not store the student's name or programme title.

## Final visual refinement
The latest pass reduces the decorative layer further: the hero now has one clear focal point (the specimen certificate), large glow rings and floating stamps are removed, and the story stage uses a restrained solid surface with lighter shadows. The main journey uses Midnight Navy `#14283B`, Porcelain `#F3F6F7`, Deep Teal `#287A76`, Muted Bronze `#AD895C` and Sea Glass `#83B9B0`.

The story headings now reveal word by word according to scroll progress. Each word rises slightly and sharpens as the reader moves through the chapter; the sticky stage changes between the document, fingerprint and verification scenes. Mobile uses an inline visual for each chapter instead of forcing the desktop sticky composition onto a small screen. Native scrolling is preserved, and reduced-motion users see the complete text without the reveal animation.
