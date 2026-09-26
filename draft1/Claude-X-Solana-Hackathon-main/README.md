# NeedaSpace / SpaceLock

Hackathon marketplace for local storage/accommodation with Solana escrow.

## Architecture

- **Frontend:** static HTML/CSS/JS in this repository.
- **Off-chain API:** Flask + SQLite in `backend/`.
- **Wallet:** Phantom.
- **On-chain:** Anchor program in `spacelock_escrow_export/`.
- **Pricing target:** listings denominated in USDC; final design lets users pay/receive SOL while escrow holds test USDC.

## Local run

See [`LOCAL_TEST_GUIDE.md`](LOCAL_TEST_GUIDE.md).

For a quick local UI/API test, start `start_backend.bat`, then `start_frontend.bat`, and browse to http://127.0.0.1:8000.

## Current chain modes

`config.js` controls the chain adapter:

- `demo`: full frontend + Flask lifecycle, explicitly simulated blockchain leg.
- `native-sol-anchor`: compatibility funding call for the older native-SOL Anchor program in the uploaded repository.

The final USDC/mock-swap Anchor program still needs to replace the compatibility adapter in `chain.js` once the Rust work is ready.
