# V5 review fixes

This file records the cleanup applied to the uploaded V5 source. The Solidity contract and its ABI were not changed in this pass, so the existing Sepolia deployment does not need to be replaced for these application-level fixes.

## Configuration

- Corrected the deployed Sepolia contract address to the 42-character address previously validated by the project owner: `0x1d355800fFA522d654cFd5186B6eE213aA292e75`.
- Updated the backend and frontend environment examples, frontend fallback configuration, README, Start Here guide and Technical Design document consistently.

## Frontend

- Made the hero verification instrument deterministic during server rendering. The visual now shows a fixed sample fingerprint and labels the result as illustrative; it does not imply a live lookup.
- Removed state changes from the hero visual's mount effect while retaining the animated canvas background.
- Reworked student credential loading to use abortable requests and request-version checks, preventing stale responses from replacing data after a wallet change or rapid pagination.
- Replaced full-list pagination counts with the backend's bounded `hasMore` response.
- Added browser-side PDF/JPG/PNG type, signature and 12 MB size checks before a file is selected for verification or issuance.
- Refreshes the persisted event feed when the backend announces a chain reorganisation.

## Backend

- Validates upload extension, declared MIME type and file signature. The backend remains the enforcement point; browser checks are for earlier feedback only.
- Keeps raw RPC exception details in server logs and returns a generic health/error message to API clients.
- Replaced the full `getStudentCredentials(address)` array read with a single bounded look-ahead page request. API pagination returns `hasMore` instead of an expensive total count.
- Added a default three-block confirmation buffer before event publication.
- Persists canonical block checkpoints, detects a changed cursor hash, rolls back cached events to a recent common ancestor and rescans replacement blocks. If no retained ancestor exists, the event index is rebuilt from the deployment block.
- Checks the queried range's end-block hash before and after the log request so a range that changes during polling is retried instead of committed.

## Validation performed in the packaging environment

- 15 backend tests passed (upload validation, SQLite state/event storage, hashing and status semantics).
- Python source and test files passed `compileall`.
- 21 TypeScript/TSX source files passed TypeScript transpilation syntax checks.
- All JSON files parsed successfully.
- Frontend and backend ABI JSON files are identical.
- Contract address occurrences were checked; no occurrence of the malformed 41-character value remains.
- ZIP integrity was checked after packaging.

## Checks still required on the project computer

The packaging environment could not reach npm/PyPI registries, and Web3.py and frontend node modules were not available there. Therefore the two new Web3-dependent event-listener tests, the complete backend suite, ESLint, TypeScript project type-check, Next.js production build, Hardhat tests/compile and live MetaMask/Sepolia workflow must be run on the user's machine after dependencies are installed. Do not describe the full dApp as end-to-end verified until those checks pass.
