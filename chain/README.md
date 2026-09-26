# On-chain layer (Phantom + escrow program + Flask)

Files
- `config.js` – devnet RPC, Flask URL, IDL path, demo host wallet. Edit this first.
- `solana.js` – Phantom connect and every program call (pay, move in, move out, dispute, release, cash out).
- `api.js` – Flask calls (listings, bookings, photos, signatures).
- `flow.js` – hooks the existing buttons in `app.js` up to the above.
- `chain.css` – styles for the booking panel.

Run it
1. Put a teammate's devnet Phantom address in `DEMO_HOST_WALLET` (config.js). That wallet receives the rent.
2. Start the backend: `cd backend && python app.py` (optional, the on-chain flow works without it).
3. From the repo root: `python -m http.server 8000`, then open http://localhost:8000.
   Opening index.html directly (file://) won't work: Phantom and the IDL fetch need http.
4. Phantom: Settings > Developer Settings > Testnet Mode > Solana Devnet. Get SOL at faucet.solana.com.

Needs the USDC version of the program deployed (mock_swap_in/out + Config account) and
`scripts/setup-devnet.ts` run once. The IDL is read from
`spacelock_escrow_export/target/idl/spacelock_escrow.json`, so rebuild + commit it after program changes.
If the program is still the old SOL version, the wallet connects but paying shows a clear error.
