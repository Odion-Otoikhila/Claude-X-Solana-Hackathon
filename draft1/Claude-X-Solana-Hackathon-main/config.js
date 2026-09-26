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
  API_BASE: "http://127.0.0.1:5000",
  CHAIN_MODE: "demo",
  SOLANA_CLUSTER: "devnet",
  SOLANA_RPC: "https://api.devnet.solana.com",
  PROGRAM_ID: "D2viXu3qRxX8vaUQcEC92rEXxfkYES7ZyWQXzRAoU47u",
  DEMO_USDC_PER_SOL: 150,
  DISPUTE_WINDOW_SECS: 5,
};
