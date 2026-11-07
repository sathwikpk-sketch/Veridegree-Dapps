# VeriDegree demonstration guide

This guide is for running the project presentation on the Sepolia test network. It uses a fictional sample certificate so the audience can follow the full issue → verify → revoke flow without using anyone's real academic document.

## Demo accounts

Use separate MetaMask test accounts for the institution and student roles.

- **Administrators:** use the three addresses configured when the VeriDegree contract was deployed. Two of the three administrator accounts are needed for institution approval and other administrative proposals.
- **Institution:** use a separate test wallet that has already been approved by the administrator multisig.
- **Student:** use a separate MetaMask test account. Copy its public address; do not use or share its private key.
- **Employer / verifier:** no wallet is needed for the public verification page.

The institution wallet must be approved on-chain before the issue button becomes usable. Signing in as an administrator does not automatically make that account an approved institution.

## Configure the demo student address once

Open `frontend/.env.local` and add:

```env
NEXT_PUBLIC_DEMO_STUDENT_ADDRESS=0xYOUR_SEPARATE_STUDENT_TEST_WALLET
```

Use the public address of the student test account, not an administrator or institution private key. Restart the Next.js development server after editing the environment file.

The institution workspace also remembers a valid student address entered in that browser. The configured environment value takes priority when loading the demo record.

## Sample certificate

The project includes:

`frontend/public/demo/veridegree-demo-certificate.pdf`

It is a fictional specimen for demonstration only. It is clearly marked as not being a real academic qualification. The sample displays:

- Issuer: Northline Institute (fictional demonstration issuer)
- Student name: Aarav Mehta
- Programme: Applied Computing — Product Systems
- Cohort: 2026

These display details are part of the PDF. The current smart contract does not store the student's name, programme title or institution display name as credential metadata. It stores the certificate fingerprint and the wallet/issuer record fields defined by the contract.

## Suggested live demonstration

1. Open the institution workspace and connect the approved institution wallet on Sepolia.
2. Select **Sign in with wallet** and approve the one-time login signature in MetaMask.
3. Select **Load demo record**. The page loads the sample PDF and, when configured, fills the student wallet address automatically.
4. Check the student wallet address before issuing. The issue action remains disabled until the institution is authenticated, approved, and the required fields are present.
5. Select **Issue credential** and confirm the transaction in MetaMask. Wait for the transaction to be confirmed on Sepolia. The UI reads the emitted credential ID and fills the record lookup field where available.
6. Open the public verification page. Use **Download the demonstration certificate** if you need another copy, upload the same PDF and verify it.
7. Switch MetaMask to the student test account and open Student access. The credential should appear under that wallet after the student page refreshes its registry query.
8. Return to the institution wallet, look up the credential ID and revoke it. Confirm the transaction in MetaMask.
9. Upload the same sample PDF again on the public verification page. The result should now report the revoked status.

## Important presentation notes

- A wallet login signature is not a blockchain transaction and does not use gas.
- Issuance and revocation are blockchain transactions. The user reviews and signs them in MetaMask.
- The public verifier needs no wallet.
- The original PDF is processed by the verification API to calculate its SHA-256 fingerprint. The application does not use the PDF as on-chain storage.
- A certificate's revocation status and the issuer's current approval status are separate checks.
- The sample PDF is fictional and must not be presented as a real qualification.
