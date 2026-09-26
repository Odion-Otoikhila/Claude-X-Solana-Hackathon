// Local development configuration.
//
// CHAIN_MODE options:
//   "demo"              - lets you test the full UI + Flask flow without moving money.
//   "native-sol-anchor" - calls the CURRENT Rust program in this repo (native SOL escrow).
//
// IMPORTANT: the Rust teammate's USDC + SOL conversion program is not in the uploaded
// repo yet. Once that program is ready, keep the app.js API and replace the adapter
// implementation in chain.js.
window.NEEDASPACE_CONFIG = {
  // Backend runs on 5055 locally (port 5000 is taken by macOS AirPlay Receiver).
  API_BASE: "http://127.0.0.1:5055",
  // Real on-chain funding: signs create_booking against the local validator via Phantom.
  CHAIN_MODE: "native-sol-anchor",
  // Local validator (Phantom must be on its built-in "Solana Localnet").
  SOLANA_CLUSTER: "custom",
  SOLANA_RPC: "http://127.0.0.1:8899",
  PROGRAM_ID: "D2viXu3qRxX8vaUQcEC92rEXxfkYES7ZyWQXzRAoU47u",
  DEMO_USDC_PER_SOL: 150,
  DISPUTE_WINDOW_SECS: 5,
};
