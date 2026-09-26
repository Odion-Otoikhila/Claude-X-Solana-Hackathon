// Talks to Phantom and the spacelock_escrow program on devnet.
// Built for the USDC version of the program (escrow holds USDC, mock_swap_in/out
// convert SOL <-> test USDC). Account and argument names are read from the IDL,
// and PDAs / token accounts are resolved by Anchor from the IDL seeds, so small
// naming differences in the program don't break this file.

import { Connection, PublicKey, Transaction, LAMPORTS_PER_SOL } from "https://esm.sh/@solana/web3.js@1.98.0";
import { AnchorProvider, Program, BN } from "https://esm.sh/@coral-xyz/anchor@0.32.1?deps=@solana/web3.js@1.98.0";
import { CLUSTER, RPC_URL, IDL_PATH, USDC_DECIMALS, FALLBACK_DISPUTE_WINDOW_SECS } from "./config.js";

export { BN, PublicKey };

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const USDC_UNIT = 10 ** USDC_DECIMALS;
const LAMPORTS = new BN(LAMPORTS_PER_SOL);

const REQUIRED_IX = [
  "mock_swap_in", "mock_swap_out", "create_booking", "confirm_move_in",
  "start_move_out", "flag_dispute", "release_deposit", "cancel_booking",
];

export const connection = new Connection(RPC_URL, "confirmed");

let idl = null;
let program = null;
let phantom = null;
let me = null;
let cachedConfig = null;

const camel = s => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

// ---------- IDL ----------

export async function loadIdl() {
  if (idl) return idl;
  const res = await fetch(IDL_PATH, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Couldn't load the program IDL (${IDL_PATH}). Serve the repo root with "python -m http.server" and open localhost:8000.`);
  }
  idl = await res.json();
  return idl;
}

export function missingInstructions() {
  const names = new Set((idl?.instructions || []).map(ix => ix.name));
  return REQUIRED_IX.filter(name => !names.has(name));
}

function idlIx(name) {
  const ix = idl.instructions.find(i => i.name === name);
  if (!ix) throw new Error(`The deployed program has no "${name}" instruction yet. Rebuild the program and reload.`);
  return ix;
}

// Keep only the accounts this instruction actually declares; Anchor fills in the rest.
function pickAccounts(name, candidates) {
  const out = {};
  for (const acc of idlIx(name).accounts) {
    const key = camel(acc.name);
    if (candidates[key] !== undefined && candidates[key] !== null) out[key] = candidates[key];
  }
  return out;
}

// Order arguments the way the IDL declares them.
function argsFor(name, values) {
  return idlIx(name).args.map(arg => {
    if (!(arg.name in values)) {
      throw new Error(`The program expects "${arg.name}" for ${name}, which the frontend doesn't send. Check the instruction signature.`);
    }
    return values[arg.name];
  });
}

function builder(name, values, accounts) {
  const method = program.methods[camel(name)];
  if (!method) idlIx(name);
  return method(...argsFor(name, values)).accountsPartial(pickAccounts(name, accounts));
}

function disputeWindowFromIdl() {
  const c = (idl?.constants || []).find(k => k.name === "DISPUTE_WINDOW_SECS");
  return c ? Number(c.value) : FALLBACK_DISPUTE_WINDOW_SECS;
}

// ---------- Wallet ----------

export function hasPhantom() {
  return Boolean(window.phantom?.solana?.isPhantom);
}

export function walletAddress() {
  return me ? me.toBase58() : null;
}

export async function connectWallet({ silent = false } = {}) {
  phantom = window.phantom?.solana;
  if (!phantom?.isPhantom) {
    if (silent) return null;
    throw new Error("Phantom isn't installed. Install it from phantom.com, switch it to devnet, then reload this page.");
  }
  const res = silent
    ? await phantom.connect({ onlyIfTrusted: true }).catch(() => null)
    : await phantom.connect();
  if (!res) return null;

  me = new PublicKey(res.publicKey.toString());
  await loadIdl();
  const wallet = {
    get publicKey() { return me; },
    signTransaction: tx => phantom.signTransaction(tx),
    signAllTransactions: txs => phantom.signAllTransactions(txs),
  };
  program = new Program(idl, new AnchorProvider(connection, wallet, { commitment: "confirmed" }));
  cachedConfig = null;
  phantom.on?.("accountChanged", () => window.location.reload());
  return me.toBase58();
}

export async function disconnectWallet() {
  try { await phantom?.disconnect(); } catch {}
  me = null;
  program = null;
  cachedConfig = null;
}

function requireReady() {
  if (!me || !program) throw new Error("Connect your Phantom wallet first.");
  const missing = missingInstructions();
  if (missing.length) {
    throw new Error(`The escrow program is still the old SOL version (missing: ${missing.join(", ")}). Deploy the USDC version, then reload.`);
  }
}

// ---------- Config (test USDC mint + demo rate) ----------

export async function getConfig(force = false) {
  requireReady();
  if (cachedConfig && !force) return cachedConfig;
  if (!program.account.config) throw new Error("The program has no Config account. Deploy the USDC version, then reload.");
  const all = await program.account.config.all();
  if (!all.length) throw new Error("Config isn't set up on devnet yet. Run scripts/setup-devnet.ts, then try again.");
  const { publicKey, account } = all[0];
  const mint = account.usdcMint ?? account.mint;
  const rate = account.usdcPerSol ?? account.rate;
  if (!mint || !rate) throw new Error("Config account is missing usdc_mint or usdc_per_sol.");
  cachedConfig = { address: publicKey, mint, rate: new BN(rate.toString()), admin: account.admin };
  return cachedConfig;
}

// ---------- Amounts ----------

export function usdcToBase(amount) {
  return new BN(Math.round(Number(amount) * USDC_UNIT));
}

export function formatUsdc(base) {
  return (Number(base.toString()) / USDC_UNIT).toFixed(2);
}

export function formatSol(lamports) {
  return (Number(lamports.toString()) / LAMPORTS_PER_SOL).toFixed(3);
}

// SOL (in lamports) needed to mint `usdcBase` test USDC, rounded up.
export function lamportsFor(usdcBase, rate) {
  return usdcBase.mul(LAMPORTS).add(rate.subn(1)).div(rate);
}

export async function quote(totalUsdc) {
  const cfg = await getConfig();
  const base = usdcToBase(totalUsdc);
  return { usdcBase: base, lamports: lamportsFor(base, cfg.rate), rate: cfg.rate };
}

function ata(owner, mint) {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ATA_PROGRAM_ID,
  )[0];
}

export async function balances() {
  if (!me) return null;
  const sol = new BN(await connection.getBalance(me));
  let usdc = new BN(0);
  try {
    const cfg = await getConfig();
    const res = await connection.getTokenAccountBalance(ata(me, cfg.mint));
    usdc = new BN(res.value.amount);
  } catch {}
  return { sol, usdc };
}

// ---------- Sending ----------

function friendlyError(err) {
  const logs = (err?.logs || err?.transactionLogs || []).join("\n");
  const text = `${err?.error?.errorMessage || ""} ${err?.message || ""} ${logs}`;
  const programMsg = text.match(/Error Message: ([^.\n]+)/);
  if (err?.code === 4001 || /user rejected|rejected the request/i.test(text)) return new Error("You cancelled the transaction in Phantom.");
  if (/no record of a prior credit|insufficient lamports|insufficient funds/i.test(text)) return new Error("Not enough devnet SOL. Top up at faucet.solana.com and try again.");
  if (/blockhash|block height exceeded|timed out/i.test(text)) return new Error("Devnet didn't confirm in time. Try again.");
  if (programMsg) return new Error(programMsg[1]);
  return new Error(err?.error?.errorMessage || err?.message || "Transaction failed.");
}

async function send(instructions) {
  const tx = new Transaction().add(...instructions);
  try {
    return await program.provider.sendAndConfirm(tx, [], { commitment: "confirmed" });
  } catch (err) {
    console.error("[spacelock] transaction failed", err);
    throw friendlyError(err);
  }
}

export function explorerTx(sig) {
  return `https://explorer.solana.com/tx/${sig}?cluster=${CLUSTER}`;
}

export function explorerAddress(address) {
  return `https://explorer.solana.com/address/${address}?cluster=${CLUSTER}`;
}

// ---------- Bookings ----------

function baseAccounts(extra = {}) {
  const cfg = cachedConfig;
  return {
    user: me,
    caller: me,
    renter: me,
    config: cfg?.address,
    usdcMint: cfg?.mint,
    mint: cfg?.mint,
    ...extra,
  };
}

function normalizeBooking(b) {
  const status = Object.keys(b.status)[0].toLowerCase(); // created | movedin | movedout | disputed | completed
  const windowSecs = b.disputeWindowSecs != null ? Number(b.disputeWindowSecs.toString()) : disputeWindowFromIdl();
  const moveOutTs = b.moveOutTs != null ? Number(b.moveOutTs.toString()) : 0;
  return {
    renter: b.renter,
    host: b.host,
    rentBase: b.rentAmount,
    depositBase: b.depositAmount,
    status,
    moveOutTs,
    releaseAt: moveOutTs ? moveOutTs + windowSecs : 0,
    windowSecs,
  };
}

// Returns null once the booking account has been closed (deposit returned / cancelled).
export async function getBooking(address) {
  requireReady();
  try {
    return normalizeBooking(await program.account.booking.fetch(new PublicKey(address)));
  } catch (err) {
    if (/does not exist|could not find/i.test(err?.message || "")) return null;
    throw err;
  }
}

async function mustBooking(address) {
  const booking = await getBooking(address);
  if (!booking) throw new Error("This booking is already closed on-chain.");
  return booking;
}

// Pay in SOL: mock_swap_in (SOL -> test USDC) + create_booking (USDC -> vault), one transaction.
export async function payAndBook({ bookingId, host, rentUsdc, depositUsdc }) {
  requireReady();
  const cfg = await getConfig();
  const rent = usdcToBase(rentUsdc);
  const deposit = usdcToBase(depositUsdc);
  const total = rent.add(deposit);

  const current = (await balances())?.usdc || new BN(0);
  const shortfall = total.gt(current) ? total.sub(current) : new BN(0);

  const instructions = [];
  let lamports = new BN(0);
  if (!shortfall.isZero()) {
    lamports = lamportsFor(shortfall, cfg.rate);
    instructions.push(await builder(
      "mock_swap_in",
      { lamports, sol_amount: lamports, amount: lamports },
      baseAccounts(),
    ).instruction());
  }

  const create = builder(
    "create_booking",
    { booking_id: new BN(bookingId), host: new PublicKey(host), rent_amount: rent, deposit_amount: deposit },
    baseAccounts({ host: new PublicKey(host) }),
  );
  const keys = await create.pubkeys();
  instructions.push(await create.instruction());

  const bookingKey = keys.booking ?? Object.entries(keys).find(([k]) => /booking/i.test(k))?.[1];
  if (!bookingKey) throw new Error("Couldn't work out the booking address from the IDL.");

  const sig = await send(instructions);
  return { sig, booking: bookingKey.toBase58(), lamports };
}

async function simpleAction(name, address) {
  requireReady();
  await getConfig();
  const b = await mustBooking(address);
  const ix = await builder(name, {}, baseAccounts({
    booking: new PublicKey(address),
    renter: b.renter,
    host: b.host,
    admin: cachedConfig.admin,
  })).instruction();
  return send([ix]);
}

export const confirmMoveIn = address => simpleAction("confirm_move_in", address);
export const startMoveOut = address => simpleAction("start_move_out", address);
export const flagDispute = address => simpleAction("flag_dispute", address);
export const cancelBooking = address => simpleAction("cancel_booking", address);

// Release the deposit after the dispute window. If the renter is the one
// releasing and wants SOL, the swap back happens in the same transaction.
export async function releaseDeposit(address, { receiveSol = true } = {}) {
  requireReady();
  await getConfig();
  const b = await mustBooking(address);
  const instructions = [await builder("release_deposit", {}, baseAccounts({
    booking: new PublicKey(address),
    renter: b.renter,
    host: b.host,
  })).instruction()];

  if (receiveSol && me.equals(b.renter)) {
    instructions.push(await builder(
      "mock_swap_out",
      { usdc_amount: b.depositBase, amount: b.depositBase },
      baseAccounts(),
    ).instruction());
  }
  return send(instructions);
}

// Convert the connected wallet's whole test-USDC balance back to SOL (e.g. host cashing out rent).
export async function cashOutToSol() {
  requireReady();
  const bal = await balances();
  if (!bal || bal.usdc.isZero()) throw new Error("No USDC to convert.");
  const ix = await builder(
    "mock_swap_out",
    { usdc_amount: bal.usdc, amount: bal.usdc },
    baseAccounts(),
  ).instruction();
  return send([ix]);
}
