/* global solanaWeb3 */

(() => {
  const cfg = window.NEEDASPACE_CONFIG;
  let provider = null;
  let walletPublicKey = null;

  const CREATE_BOOKING_DISCRIMINATOR = Uint8Array.from([19, 223, 181, 90, 124, 206, 73, 169]);

  function bytesU64(value) {
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setBigUint64(0, BigInt(value), true);
    return bytes;
  }

  function bytesI64(value) {
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setBigInt64(0, BigInt(value), true);
    return bytes;
  }

  function concatBytes(...parts) {
    const length = parts.reduce((total, part) => total + part.length, 0);
    const result = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) {
      result.set(part, offset);
      offset += part.length;
    }
    return result;
  }

  function requireWeb3() {
    if (!window.solanaWeb3) {
      throw new Error("Solana web3.js did not load. Check your internet connection.");
    }
    return window.solanaWeb3;
  }

  function explorerUrl(signature) {
    if (!signature || signature.startsWith("DEMO_")) return null;
    return `https://explorer.solana.com/tx/${signature}?cluster=${cfg.SOLANA_CLUSTER}`;
  }

  async function connectWallet() {
    const phantom = window.solana;
    if (!phantom?.isPhantom) {
      throw new Error("Phantom was not found. Install/unlock Phantom and refresh the page.");
    }

    const response = await phantom.connect();
    provider = phantom;
    walletPublicKey = response.publicKey;
    return walletPublicKey.toString();
  }

  function currentWallet() {
    return walletPublicKey?.toString() || null;
  }

  async function ensureConnected() {
    if (!walletPublicKey) await connectWallet();
    return walletPublicKey;
  }

  async function demoFundBooking(booking) {
    await ensureConnected();
    return {
      escrowAddress: `DEMO_ESCROW_${booking.id}`,
      transactionSignature: `DEMO_FUND_${booking.id}_${Date.now()}`,
      explorerUrl: null,
      mode: "demo",
    };
  }

  async function nativeSolAnchorFundBooking({ booking, listing }) {
    const web3 = requireWeb3();
    const renter = await ensureConnected();

    if (!listing.host_wallet || listing.host_wallet === "DEMO_HOST_WALLET") {
      throw new Error("This demo listing has no real host wallet. Create a listing with a real host wallet first.");
    }

    const programId = new web3.PublicKey(cfg.PROGRAM_ID);
    const host = new web3.PublicKey(listing.host_wallet);
    // For the current demo contract we reuse host as admin. Replace this with a
    // dedicated admin public key if you use the dispute path.
    const admin = host;
    const bookingId = BigInt(booking.id);

    const bookingSeed = bytesU64(bookingId);
    const [bookingPda] = web3.PublicKey.findProgramAddressSync(
      [new TextEncoder().encode("booking"), renter.toBytes(), bookingSeed],
      programId,
    );

    // Compatibility path for the CURRENT native-SOL contract only.
    // The final USDC program should replace this adapter, not app.js.
    const totalRate = Number(cfg.DEMO_USDC_PER_SOL || 150);
    const rentLamports = BigInt(Math.round((Number(listing.price_usdc) / totalRate) * web3.LAMPORTS_PER_SOL));
    const depositLamports = BigInt(Math.round((Number(listing.deposit_usdc) / totalRate) * web3.LAMPORTS_PER_SOL));

    if (rentLamports <= 0n || depositLamports < 0n) {
      throw new Error("Invalid listing amounts.");
    }

    const data = concatBytes(
      CREATE_BOOKING_DISCRIMINATOR,
      bytesU64(bookingId),
      host.toBytes(),
      admin.toBytes(),
      bytesU64(rentLamports),
      bytesU64(depositLamports),
      bytesI64(BigInt(cfg.DISPUTE_WINDOW_SECS || 5)),
    );

    const instruction = new web3.TransactionInstruction({
      programId,
      keys: [
        { pubkey: renter, isSigner: true, isWritable: true },
        { pubkey: bookingPda, isSigner: false, isWritable: true },
        { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });

    const connection = new web3.Connection(cfg.SOLANA_RPC, "confirmed");
    const transaction = new web3.Transaction().add(instruction);
    transaction.feePayer = renter;
    const latest = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = latest.blockhash;

    const result = await provider.signAndSendTransaction(transaction);
    const signature = typeof result === "string" ? result : result.signature;
    await connection.confirmTransaction({ signature, ...latest }, "confirmed");

    return {
      escrowAddress: bookingPda.toString(),
      transactionSignature: signature,
      explorerUrl: explorerUrl(signature),
      mode: "native-sol-anchor",
    };
  }

  async function fundBooking(payload) {
    if (cfg.CHAIN_MODE === "native-sol-anchor") {
      return nativeSolAnchorFundBooking(payload);
    }
    return demoFundBooking(payload.booking);
  }

  async function releaseBooking(booking) {
    await ensureConnected();

    // The uploaded Rust program's lifecycle does not match the new USDC + both-party
    // confirmation design. Demo mode is deliberately explicit so local integration can
    // be tested without pretending money moved on-chain.
    if (cfg.CHAIN_MODE !== "demo") {
      throw new Error("Release adapter is waiting for the final USDC Anchor program. Use demo mode for local end-to-end UI testing.");
    }

    return {
      releaseSignature: `DEMO_RELEASE_${booking.id}_${Date.now()}`,
      explorerUrl: null,
      mode: "demo",
    };
  }

  window.NeedASpaceChain = {
    connectWallet,
    currentWallet,
    explorerUrl,
    fundBooking,
    releaseBooking,
  };
})();
