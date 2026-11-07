# VeriDegree v2 — Contract change record

This document records the changes made to the previous Solidity-course version for the full-stack dApp.

## Contract changes

1. **Institution removal now removes live issuer powers.** A removed institution cannot issue, directly revoke, or recover credentials. Existing credential records are preserved. The 2-of-3 multisig can still revoke any credential as an emergency action.
2. **Certificate hashes are unique.** Issuance rejects a hash already registered. `credentialIdPlusOneByHash` stores ID + 1 so credential ID zero remains distinguishable from an unknown hash. `getCredentialIdByHash` and `verifyCredentialByHash` provide direct upload-verification lookup.
3. **Validity is deliberately split.** `verifyCredential` still reports whether the record is revoked. The dApp must separately query `approvedInstitutions(issuer)` to determine whether the issuer is currently approved.
4. **Recovery requires destination-wallet control.** The original approved issuer must submit a signature from the destination wallet. The signed challenge binds the chain ID, contract address, credential ID, old and new student addresses, and a per-credential nonce. The nonce increments after successful recovery.
5. **Admin rotation is now possible.** `replaceAdmin(oldAdmin,newAdmin)` is available only through 2-of-3 approval. If two admin keys are lost before replacement, the quorum is still unrecoverable.
6. **Emergency batch revocation is supported.** `revokeCredentials(uint256[])` can revoke up to 50 credentials in one atomic multisig action.
7. **Admin proposals are constrained.** Only supported administrative selectors are accepted; arguments are decoded and checked before storage. A proposer can cancel their own unexecuted proposal. Proposals expire after seven days. The actual target custom error is bubbled if state changes between proposal and execution.
8. **Student credential indexing is O(1) for removal.** A per-student position mapping supports swap-and-pop removal. `getStudentCredentialsPage` provides bounded page reads.
9. **Redundant getter removed.** `getAdmins()` was removed because the public fixed-size `admins` array already supplies indexed getters (`admins(0)` through `admins(2)`).

## Tooling changes

- Added dotenv loading and a `.env.example` file.
- Added explicit Sepolia deployment checks for RPC URL, deployer private key and three unique admin addresses.
- Added Etherscan API configuration and `scripts/verify.js` for constructor-argument verification.
- Added `scripts/hash-certificate.js`, which hashes exact file bytes with SHA-256.
- Updated the README with permissions, hashing, recovery signing, validity semantics, privacy assumptions and deployment steps.

## Compatibility notes

- The constructor remains `constructor(address[3] memory _admins)`, so new deployments still take three admin addresses.
- The contract ABI changed. In particular, wallet recovery now requires a signature argument, duplicate hashes are rejected, and several new functions/events/errors were added. Any previously deployed contract remains unchanged; these changes require a new deployment to take effect.
- `verifyCredential` keeps its five return values and the same meaning for `isValid` (`!revoked`).
- Hashing standard is now SHA-256 of exact certificate file bytes. All app components must use this same convention.

## Validation status

- The developer reported a fresh Solidity compilation completed successfully.
- The developer reported all 50 Hardhat tests passed after the latest contract refactor.
- The updated contract was deployed successfully to Sepolia and source-verified on Etherscan.
- Slither was run; an earlier report showed eight detector results. The final post-refactoring Slither output must be retained and reviewed rather than claiming zero findings.
- The full-stack FastAPI and Next.js application is included in the repository. Seven backend unit tests passed in the packaging environment; 15 TypeScript/TSX source files passed syntax transpilation.
- Full dependency installation, frontend ESLint/production build, FastAPI-to-Sepolia live RPC checks, and the complete MetaMask issue → verify → revoke → verify flow still need to be run locally with the project owner's environment.
