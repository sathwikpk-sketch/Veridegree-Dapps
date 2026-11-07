# Workspace copy and readability refinement

This update simplifies the three main application workspaces without changing contract behaviour or API routes.

## Institution
- Shortened the page introduction and sign-in messages.
- Renamed the main action to **Issue a certificate**.
- Reduced the demo panel to the institution, sample student and a **Load demo** action.
- Shortened field guidance and made the credential lookup easier to identify.
- Replaced the long trust-model copy with three short steps: Connect, Sign in and Confirm.

## Student
- Replaced the long introduction with **Your credentials**.
- Simplified the wallet status, empty state and no-records message.
- Kept the credential ID, issuer, issue date and fingerprint visible.
- Reduced the side panel to a short wallet and privacy explanation.

## Public verification
- Changed the page heading to **Verify a certificate**.
- Shortened the upload instructions and privacy note.
- Kept the real SHA-256 lookup and result statuses unchanged.

## Readability
- Increased form labels, helper text, activity descriptions and status labels.
- Increased small button height and text size.
- Preserved mobile layouts and existing keyboard-accessible controls.

No smart-contract, ABI, wallet-authentication or endpoint behaviour was intentionally changed in this UI refinement.
