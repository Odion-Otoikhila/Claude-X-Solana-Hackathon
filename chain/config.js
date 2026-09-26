// SpaceLock / need-a-space — on-chain + backend settings.
// Everything you might need to change before the demo lives here.

export const CLUSTER = "devnet";
export const RPC_URL = "https://api.devnet.solana.com";

// Flask backend (backend/app.py runs on port 5000). If it's offline the
// on-chain flow still works; bookings just aren't recorded in the DB.
export const API_BASE = "http://127.0.0.1:5000/api";

// Read straight from the Anchor build output, so after the program is
// rebuilt (anchor build) the frontend picks up the new IDL automatically.
export const IDL_PATH = "./spacelock_escrow_export/target/idl/spacelock_escrow.json";

// Devnet wallet that receives rent for the six demo listings.
// Paste a teammate's Phantom (devnet) address here — not the renter's.
export const DEMO_HOST_WALLET = "PASTE_HOST_WALLET_ADDRESS_HERE";

// Used only if the program doesn't expose the window itself.
export const FALLBACK_DISPUTE_WINDOW_SECS = 60;

export const USDC_DECIMALS = 6;
