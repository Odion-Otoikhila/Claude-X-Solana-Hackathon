// Wires the existing app.js UI to Phantom, the escrow program and the Flask backend.
// Uses the globals app.js defines: listings, openModal, closeModal, showToast.

import * as chain from "./solana.js";
import * as api from "./api.js";
import { DEMO_HOST_WALLET } from "./config.js";

const STORAGE_KEY = "spacelock-active-booking";
const walletLabel = document.querySelector("[data-wallet-label]");
let backendOnline = false;
let countdownTimer = null;

// ---------- helpers ----------

const short = addr => `${addr.slice(0, 4)}…${addr.slice(-4)}`;
const eur = n => `€${Number(n).toFixed(2)}`;

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}
function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}
function clearState() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}
function addTx(state, label, sig) {
  state.txs = [...(state.txs || []), { label, sig }];
  saveState(state);
}

function setWalletLabel() {
  const addr = chain.walletAddress();
  walletLabel.textContent = addr ? short(addr) : "Connect wallet";
}

function validAddress(addr) {
  try { new chain.PublicKey(addr); return true; } catch { return false; }
}

// Disable a button while a transaction runs, show errors as a toast.
async function run(button, busyText, task) {
  const original = button.innerHTML;
  button.disabled = true;
  button.textContent = busyText;
  try {
    return await task();
  } catch (err) {
    console.error("[spacelock]", err);
    showToast(err.message || "Something went wrong.");
    button.disabled = false;
    button.innerHTML = original;
    return undefined;
  }
}

function compressImage(file, max = 480) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => reject(new Error("That file isn't an image. Pick a JPG or PNG."));
    img.src = url;
  });
}

async function backend(task, needsId) {
  if (!backendOnline || needsId === null) return null;
  try {
    return await task();
  } catch (err) {
    console.warn("[spacelock] backend call failed:", err.message);
    return null;
  }
}

async function ensureConnected() {
  if (chain.walletAddress()) return true;
  try {
    await chain.connectWallet();
    setWalletLabel();
    return true;
  } catch (err) {
    showToast(err.message);
    return false;
  }
}

// ---------- wallet ----------

async function walletClick() {
  if (!chain.walletAddress()) {
    if (await ensureConnected()) showToast("Wallet connected");
    return;
  }
  const addr = chain.walletAddress();
  openModal(`<div class="escrow-modal"><h2>Your wallet</h2>
    <p><a class="chain-link" href="${chain.explorerAddress(addr)}" target="_blank" rel="noopener">${short(addr)} on Solana Explorer ↗</a></p>
    <div class="escrow-visual" data-balances><p class="chain-note">Loading balances…</p></div>
    <div class="chain-actions">
      ${loadState() ? '<button class="modal-submit" data-open-booking>Open my booking</button>' : ""}
      <button class="outline-button" data-disconnect>Disconnect</button>
    </div></div>`);

  document.querySelector("[data-open-booking]")?.addEventListener("click", openBooking);
  document.querySelector("[data-disconnect]").addEventListener("click", async () => {
    await chain.disconnectWallet();
    setWalletLabel();
    closeModal();
    showToast("Wallet disconnected");
  });

  const box = document.querySelector("[data-balances]");
  try {
    const bal = await chain.balances();
    const lowSol = Number(chain.formatSol(bal.sol)) < 0.5;
    box.innerHTML = `
      <div class="chain-rows">
        <span>SOL</span><strong>${chain.formatSol(bal.sol)}</strong>
        <span>USDC (test)</span><strong>${chain.formatUsdc(bal.usdc)}</strong>
      </div>
      ${lowSol ? '<p class="chain-note">Low on devnet SOL? Get more at <a class="chain-link" href="https://faucet.solana.com" target="_blank" rel="noopener">faucet.solana.com</a>.</p>' : ""}
      ${bal.usdc.isZero() ? "" : `<button class="modal-submit" data-cash-out>Convert ${chain.formatUsdc(bal.usdc)} USDC to SOL</button>`}`;
    box.querySelector("[data-cash-out]")?.addEventListener("click", event =>
      run(event.currentTarget, "Confirm in Phantom…", async () => {
        const sig = await chain.cashOutToSol();
        showToast("Converted to SOL");
        walletClick();
        return sig;
      }));
  } catch (err) {
    box.innerHTML = `<p class="chain-note">${err.message}</p>`;
  }
}

// ---------- paying for a booking ----------

async function hostFor(item) {
  const listing = await backend(() => api.ensureListing(item, DEMO_HOST_WALLET));
  const host = [item.hostWallet, listing?.host_wallet, DEMO_HOST_WALLET].find(validAddress);
  if (!host) throw new Error("No host wallet for this space. Paste a devnet address into DEMO_HOST_WALLET in chain/config.js.");
  return { host, listing };
}

async function startBooking(index) {
  const existing = loadState();
  if (existing) {
    showToast("Finish your current booking first");
    openBooking();
    return;
  }
  if (!(await ensureConnected())) return;

  const item = listings[index];
  const rentUsdc = item.usdcPrice ?? item.price;
  const depositUsdc = item.usdcDeposit ?? item.deposit;
  const total = rentUsdc + depositUsdc;
  let q;
  try {
    q = await chain.quote(total);
  } catch (err) {
    showToast(err.message);
    return;
  }
  const rate = chain.formatUsdc(q.rate);
  const sol = chain.formatSol(q.lamports);

  openModal(`<div class="escrow-modal"><h2>Pay for ${item.title}</h2>
    <p>You pay in SOL. It's converted to USDC and locked in escrow, so it keeps its value. The host gets the rent when you confirm move-in, and your deposit comes back after move-out.</p>
    <div class="escrow-visual">
      <div class="escrow-amount">${sol} SOL <small>for ${eur(total)} in USDC</small></div>
      <div class="chain-rows">
        <span>First month's rent</span><strong>${eur(rentUsdc)}</strong>
        <span>Security deposit</span><strong>${eur(depositUsdc)}</strong>
        <span>Demo rate</span><strong>1 SOL = ${rate} USDC</strong>
      </div>
    </div>
    <p class="chain-note">Devnet demo: the SOL to USDC conversion is simulated at a fixed rate. On mainnet it's a Jupiter swap.</p>
    <button class="modal-submit" data-pay>Pay ${sol} SOL</button></div>`);

  document.querySelector("[data-pay]").addEventListener("click", event =>
    run(event.currentTarget, "Confirm in Phantom…", async () => {
      const { host, listing } = await hostFor(item);
      const renter = chain.walletAddress();
      const backendBooking = listing ? await backend(() => api.createBooking(listing.id, renter)) : null;

      const res = await chain.payAndBook({
        bookingId: Date.now(),
        host,
        rentUsdc,
        depositUsdc,
      });

      const state = {
        booking: res.booking,
        listingIndex: index,
        title: item.title,
        rentUsdc,
        depositUsdc,
        backendId: backendBooking?.id ?? null,
        photos: {},
        txs: [],
      };
      addTx(state, "Paid in SOL, locked as USDC", res.sig);
      await backend(() => api.markFunded(state.backendId, res.booking, res.sig), state.backendId);

      showToast("Payment locked in escrow");
      openBooking();
    }));
}

// ---------- live booking panel ----------

const STEPS = ["Locked in escrow", "Moved in", "Moved out", "Deposit returned"];
const STEP_INDEX = { created: 0, movedin: 1, movedout: 2, disputed: 2, completed: 3, closed: 3 };

function trackHtml(status) {
  const done = STEP_INDEX[status];
  const nodes = STEPS.map((_, i) => {
    const pending = i > done ? " pending" : "";
    const node = `<span class="escrow-node${pending}">${i <= done ? "✓" : i + 1}</span>`;
    const line = i < STEPS.length - 1 ? `<span class="escrow-connector${i >= done ? " pending" : ""}"></span>` : "";
    return node + line;
  }).join("");
  const labels = STEPS.map((label, i) =>
    `<span>${status === "disputed" && i === 3 ? "Under review" : label}</span>`).join("");
  return `<div class="escrow-track">${nodes}</div><div class="escrow-labels">${labels}</div>`;
}

function photoField(name, label) {
  return `<label class="chain-file"><span>${label}</span><input type="file" accept="image/*" data-photo="${name}" /></label>`;
}

function formatCountdown(secs) {
  const s = Math.max(0, Math.ceil(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

async function openBooking() {
  const state = loadState();
  if (!state) {
    showToast("No active booking yet");
    return;
  }
  if (!(await ensureConnected())) return;
  clearInterval(countdownTimer);

  openModal(`<div class="escrow-modal"><h2>${state.title}</h2><p class="chain-note">Loading escrow status…</p></div>`);

  let booking;
  try {
    booking = await chain.getBooking(state.booking);
  } catch (err) {
    openModal(`<div class="escrow-modal"><h2>${state.title}</h2><p>${err.message}</p></div>`);
    return;
  }

  const me = chain.walletAddress();
  const status = booking ? booking.status : "closed";
  const isRenter = booking ? booking.renter.toBase58() === me : true;
  const isHost = booking ? booking.host.toBase58() === me : false;
  const now = Date.now() / 1000;

  let body = "";
  if (status === "created" && isRenter) {
    body = `<p>When you've dropped your things off, add a photo and confirm. This pays the rent to the host.</p>
      ${photoField("move_in_photo", "Move-in photo")}
      <button class="modal-submit" data-action="move-in" disabled>Confirm move-in</button>
      <button class="text-button chain-secondary" data-action="cancel">Cancel and get a full refund</button>`;
  } else if (status === "movedin" && isRenter) {
    body = `<p>When you've collected your things, add a photo of the empty space. The host then has ${booking.windowSecs} seconds to report a problem before your deposit can be returned.</p>
      ${photoField("move_out_photo", "Move-out photo")}
      <button class="modal-submit" data-action="move-out" disabled>Start move-out</button>`;
  } else if (status === "movedout") {
    const waiting = booking.releaseAt > now;
    body = waiting
      ? `<p>The host can report a problem until the timer runs out. After that, anyone can return the deposit.</p>
         <button class="modal-submit" disabled data-countdown>Deposit can be returned in ${formatCountdown(booking.releaseAt - now)}</button>`
      : `<p>No problem was reported. The deposit can go back to the renter now.</p>
         ${isRenter ? '<label class="chain-check"><input type="checkbox" data-receive-sol checked /> Receive it as SOL</label>' : ""}
         <button class="modal-submit" data-action="release">Return deposit</button>`;
    if (isHost && waiting) body += `<button class="text-button chain-secondary" data-action="dispute">Report damage</button>`;
  } else if (status === "disputed") {
    body = `<p>The host reported a problem. The deposit stays locked until the admin splits it between renter and host.</p>`;
  } else if (status === "closed" || status === "completed") {
    body = `<p>This booking is complete. The escrow account is closed and the money has been paid out.</p>
      <button class="modal-submit" data-action="finish">Close booking</button>`;
  } else {
    body = `<p>Waiting for the renter to ${status === "created" ? "confirm move-in" : "start move-out"}.</p>`;
  }

  const photos = Object.entries(state.photos || {})
    .map(([key, src]) => `<figure><img src="${src}" alt="${key === "move_in_photo" ? "Move-in" : "Move-out"} photo" /><figcaption>${key === "move_in_photo" ? "Move-in" : "Move-out"}</figcaption></figure>`)
    .join("");
  const txs = (state.txs || [])
    .map(tx => `<li><a class="chain-link" href="${chain.explorerTx(tx.sig)}" target="_blank" rel="noopener">${tx.label} ↗</a></li>`)
    .join("");

  openModal(`<div class="escrow-modal"><h2>${state.title}</h2>
    <div class="escrow-visual">
      <div class="escrow-amount">${eur(state.depositUsdc)} <small>deposit held as USDC</small></div>
      ${trackHtml(status)}
    </div>
    <div class="modal-form">${body}</div>
    ${photos ? `<div class="chain-photos">${photos}</div>` : ""}
    <ul class="chain-txs">${txs}<li><a class="chain-link" href="${chain.explorerAddress(state.booking)}" target="_blank" rel="noopener">Escrow account ↗</a></li></ul>
  </div>`);

  wirePanel(state, booking);
}

function wirePanel(state, booking) {
  // Photo inputs enable their action button once a photo is picked.
  document.querySelectorAll("[data-photo]").forEach(input => {
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        state.photos = { ...state.photos, [input.dataset.photo]: await compressImage(file) };
        saveState(state);
        document.querySelector("[data-action]").disabled = false;
      } catch (err) {
        showToast(err.message);
      }
    });
  });

  const act = (name, busy, task) => {
    document.querySelector(`[data-action="${name}"]`)?.addEventListener("click", event =>
      run(event.currentTarget, busy, async () => { await task(); openBooking(); }));
  };

  act("move-in", "Confirm in Phantom…", async () => {
    await backend(() => api.addEvidence(state.backendId, { move_in_photo: state.photos.move_in_photo }), state.backendId);
    const sig = await chain.confirmMoveIn(state.booking);
    addTx(state, "Move-in confirmed, rent paid to host", sig);
    showToast("Rent paid to the host");
  });

  act("move-out", "Confirm in Phantom…", async () => {
    await backend(() => api.addEvidence(state.backendId, { move_out_photo: state.photos.move_out_photo }), state.backendId);
    const sig = await chain.startMoveOut(state.booking);
    addTx(state, "Move-out started", sig);
    await backend(() => api.confirm(state.backendId, "renter"), state.backendId);
    showToast("Move-out started");
  });

  act("dispute", "Confirm in Phantom…", async () => {
    const sig = await chain.flagDispute(state.booking);
    addTx(state, "Damage reported", sig);
    showToast("Deposit held for review");
  });

  act("release", "Confirm in Phantom…", async () => {
    const receiveSol = document.querySelector("[data-receive-sol]")?.checked ?? false;
    const sig = await chain.releaseDeposit(state.booking, { receiveSol });
    addTx(state, receiveSol ? "Deposit returned as SOL" : "Deposit returned as USDC", sig);
    await backend(() => api.markReleased(state.backendId, sig), state.backendId);
    showToast("Deposit returned");
  });

  act("cancel", "Confirm in Phantom…", async () => {
    const sig = await chain.cancelBooking(state.booking);
    addTx(state, "Booking cancelled, refunded", sig);
    showToast("Booking cancelled");
  });

  document.querySelector('[data-action="finish"]')?.addEventListener("click", () => {
    clearState();
    closeModal();
    showToast("Booking closed");
  });

  // Countdown while the dispute window is open, then re-render.
  const countdown = document.querySelector("[data-countdown]");
  if (countdown && booking) {
    countdownTimer = setInterval(() => {
      const el = document.querySelector("[data-countdown]");
      if (!el) return clearInterval(countdownTimer);
      const left = booking.releaseAt - Date.now() / 1000;
      if (left <= 0) {
        clearInterval(countdownTimer);
        openBooking();
      } else {
        el.textContent = `Deposit can be returned in ${formatCountdown(left)}`;
      }
    }, 1000);
  }
}

// ---------- start ----------

window.SpaceLock = {
  walletClick,
  startBooking,
  openBooking,
  hasBooking: () => Boolean(loadState()),
};

(async () => {
  backendOnline = await api.isOnline();
  if (!backendOnline) console.info("[spacelock] Flask backend offline, running on-chain only.");
  try {
    await chain.connectWallet({ silent: true });
  } catch (err) {
    console.warn("[spacelock]", err.message);
  }
  setWalletLabel();
  if (chain.walletAddress()) {
    const missing = chain.missingInstructions();
    if (missing.length) console.warn("[spacelock] Program IDL is missing:", missing.join(", "));
  }
})();
