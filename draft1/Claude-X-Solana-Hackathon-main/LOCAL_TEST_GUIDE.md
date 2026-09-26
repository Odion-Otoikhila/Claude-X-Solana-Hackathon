# NeedaSpace local integration test

This ZIP connects the static frontend to the Flask API and adds real Phantom wallet connection.

## What works immediately

- Flask creates/returns USDC-priced listings.
- Demo listings seed automatically on a fresh database.
- Frontend fetches listings from Flask instead of using hard-coded data.
- Phantom Connect Wallet button works when the extension is installed.
- Booking creation, funded status, evidence, renter/host confirmations, and completion are persisted in Flask.
- Host listing creation writes to Flask.
- The dashboard restores the latest booking after a refresh.
- `backend/smoke_test.py` exercises the full Flask state lifecycle.

## Important blockchain status

`config.js` defaults to `CHAIN_MODE: "demo"`. In this mode the application performs the full frontend + Flask workflow but **does not claim that funds moved on-chain**.

The uploaded Rust program is still the older native-SOL escrow. A compatibility funding adapter is included. After deploying that existing program to Devnet you can set:

```js
CHAIN_MODE: "native-sol-anchor"
```

That mode can call the current `create_booking` instruction from Phantom. It is **not** the final USDC escrow/mock-swap design.

The final SOL -> test USDC -> USDC vault -> payout conversion must be supplied by the Rust/Anchor work that is currently in progress. When that IDL/program is ready, update `chain.js`; `app.js` and Flask do not need to own conversion logic.

## First-time setup (Windows)

### Terminal 1 - backend

Double-click `start_backend.bat`, or run:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Backend: http://127.0.0.1:5000

If you previously used an older schema, stop Flask and delete `backend/instance/needaspace.db` once, then restart.

### Terminal 2 - frontend

Double-click `start_frontend.bat`, or run from the repo root:

```powershell
py -m http.server 8000
```

Open: http://127.0.0.1:8000

Do not double-click `index.html`; use the local HTTP server.

## Quick Flask-only test

With Flask running, open another terminal:

```powershell
cd backend
python smoke_test.py
```

The final line should be:

```text
PASS: Flask lifecycle works end-to-end
```

## Browser test

1. Open http://127.0.0.1:8000.
2. Confirm listings appear. If they do, React/static frontend -> Flask connectivity is working.
3. Click **Connect wallet** and approve Phantom.
4. Open a listing and click **Book with Phantom**.
5. In default demo chain mode, the booking becomes `FUNDED` in the real Flask database while the chain step is explicitly simulated.
6. Open the dashboard.
7. Add move-in/move-out evidence.
8. Confirm renter and host.
9. Status becomes `READY_TO_RELEASE`.
10. Click Release booking; status becomes `COMPLETED` in demo mode.

## Files changed/added

- `backend/app.py` - validated API, auto-seed, GET bookings, release signature persistence.
- `backend/requirements.txt` - Python packages.
- `backend/smoke_test.py` - backend lifecycle test.
- `app.js` - Flask integration, booking flow, dashboard actions, listing creation.
- `chain.js` - Phantom + chain adapter.
- `config.js` - local API/chain settings.
- `index.html` - loads Solana web3 + integration scripts; USDC wording.
- `styles.css` - small styles for integration controls.
- `.gitignore` - ignores DBs, virtualenvs and Solana keypairs.
- `start_backend.bat` / `start_frontend.bat` - Windows launch helpers.

## Security note

The uploaded repo contained `target/deploy/spacelock_escrow-keypair.json`. That deployment private key was removed from this ZIP and ignored by `.gitignore`. Do not commit program/wallet keypair JSON files to GitHub.
