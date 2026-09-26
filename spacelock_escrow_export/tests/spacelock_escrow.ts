import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import IDL from "../target/idl/spacelock_escrow.json";

const PROGRAM_ID = new PublicKey(IDL.address);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findBookingPda(renter: PublicKey, bookingId: number) {
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64LE(BigInt(bookingId));
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("booking"), renter.toBuffer(), idBuf],
    PROGRAM_ID
  );
  return pda;
}

describe("spacelock_escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = new Program(IDL, provider);
  const connection = provider.connection;

  const renter = Keypair.generate();
  const host = Keypair.generate();
  const admin = Keypair.generate();

  const RENT_SOL = 0.2;
  const DEPOSIT_SOL = 0.1;
  const rentLamports = new BN(Math.round(RENT_SOL * LAMPORTS_PER_SOL));
  const depositLamports = new BN(Math.round(DEPOSIT_SOL * LAMPORTS_PER_SOL));

  before(async () => {
    console.log("RPC endpoint:", connection.rpcEndpoint);
    for (const kp of [renter, host, admin]) {
      const sig = await connection.requestAirdrop(kp.publicKey, 5 * LAMPORTS_PER_SOL);
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({ signature: sig, ...latestBlockhash }, "confirmed");
      const bal = await connection.getBalance(kp.publicKey);
      console.log(kp.publicKey.toBase58(), "balance:", bal);
    }
  });

  it("create_booking escrows rent + deposit", async () => {
    const bookingId = Date.now();
    const booking = findBookingPda(renter.publicKey, bookingId);

    await program.methods
      .createBooking(new BN(bookingId), host.publicKey, admin.publicKey, rentLamports, depositLamports, new BN(60))
      .accounts({
        renter: renter.publicKey,
        booking,
        systemProgram: SystemProgram.programId,
      })
      .signers([renter])
      .rpc();

    const bookingBalance = await connection.getBalance(booking);
    assert.isAtLeast(bookingBalance, rentLamports.add(depositLamports).toNumber());

    const account = await (program.account as any).booking.fetch(booking);
    assert.equal(account.status.created !== undefined, true);
  });

  it("confirm_move_in releases rent to host", async () => {
    const bookingId = Date.now() + 1;
    const booking = findBookingPda(renter.publicKey, bookingId);

    await program.methods
      .createBooking(new BN(bookingId), host.publicKey, admin.publicKey, rentLamports, depositLamports, new BN(60))
      .accounts({ renter: renter.publicKey, booking, systemProgram: SystemProgram.programId })
      .signers([renter])
      .rpc();

    const hostBalanceBefore = await connection.getBalance(host.publicKey);

    await program.methods
      .confirmMoveIn()
      .accounts({ renter: renter.publicKey, booking, host: host.publicKey })
      .signers([renter])
      .rpc();

    const hostBalanceAfter = await connection.getBalance(host.publicKey);
    assert.equal(hostBalanceAfter - hostBalanceBefore, rentLamports.toNumber());

    const account = await (program.account as any).booking.fetch(booking);
    assert.equal(account.status.movedIn !== undefined, true);
  });

  it("cancel_booking refunds renter in full and closes the account", async () => {
    const bookingId = Date.now() + 2;
    const booking = findBookingPda(renter.publicKey, bookingId);

    await program.methods
      .createBooking(new BN(bookingId), host.publicKey, admin.publicKey, rentLamports, depositLamports, new BN(60))
      .accounts({ renter: renter.publicKey, booking, systemProgram: SystemProgram.programId })
      .signers([renter])
      .rpc();

    // the account holds rent+deposit *plus* its own rent-exempt reserve
    // (paid by the renter at `init`); closing it refunds all of that.
    const escrowedTotal = await connection.getBalance(booking);
    const renterBalanceBefore = await connection.getBalance(renter.publicKey);

    // the tx fee payer is the Anchor provider wallet, not the renter, so
    // renter's balance change should equal the full escrowed amount.
    await program.methods
      .cancelBooking()
      .accounts({ renter: renter.publicKey, booking })
      .signers([renter])
      .rpc();

    const renterBalanceAfter = await connection.getBalance(renter.publicKey);
    assert.equal(renterBalanceAfter - renterBalanceBefore, escrowedTotal);

    const closedInfo = await connection.getAccountInfo(booking);
    assert.isNull(closedInfo);
  });

  it("full move-out -> dispute window -> permissionless release_deposit", async () => {
    const bookingId = Date.now() + 3;
    const booking = findBookingPda(renter.publicKey, bookingId);
    const disputeWindowSecs = 2;

    await program.methods
      .createBooking(
        new BN(bookingId),
        host.publicKey,
        admin.publicKey,
        rentLamports,
        depositLamports,
        new BN(disputeWindowSecs)
      )
      .accounts({ renter: renter.publicKey, booking, systemProgram: SystemProgram.programId })
      .signers([renter])
      .rpc();

    await program.methods
      .confirmMoveIn()
      .accounts({ renter: renter.publicKey, booking, host: host.publicKey })
      .signers([renter])
      .rpc();

    await program.methods
      .startMoveOut()
      .accounts({ renter: renter.publicKey, booking })
      .signers([renter])
      .rpc();

    let account = await (program.account as any).booking.fetch(booking);
    assert.equal(account.status.movedOut !== undefined, true);

    // release before the window closes must fail
    try {
      await program.methods
        .releaseDeposit()
        .accounts({ caller: renter.publicKey, booking, renter: renter.publicKey })
        .signers([renter])
        .rpc();
      assert.fail("expected release_deposit to fail before dispute window closes");
    } catch (e: any) {
      assert.include(e.toString(), "DisputeWindowActive");
    }

    await sleep((disputeWindowSecs + 1) * 1000);

    // after confirm_move_in, only deposit + the account's rent-exempt
    // reserve remain in the PDA; closing it refunds all of that to renter.
    const escrowedRemaining = await connection.getBalance(booking);
    const renterBalanceBefore = await connection.getBalance(renter.publicKey);

    // anyone (here: host) can permissionlessly trigger the release
    await program.methods
      .releaseDeposit()
      .accounts({ caller: host.publicKey, booking, renter: renter.publicKey })
      .signers([host])
      .rpc();

    const renterBalanceAfter = await connection.getBalance(renter.publicKey);
    assert.equal(renterBalanceAfter - renterBalanceBefore, escrowedRemaining);

    const closedInfo = await connection.getAccountInfo(booking);
    assert.isNull(closedInfo);
  });

  it("flag_dispute blocks auto-release and admin_resolve splits the deposit", async () => {
    const bookingId = Date.now() + 4;
    const booking = findBookingPda(renter.publicKey, bookingId);
    const disputeWindowSecs = 2;

    await program.methods
      .createBooking(
        new BN(bookingId),
        host.publicKey,
        admin.publicKey,
        rentLamports,
        depositLamports,
        new BN(disputeWindowSecs)
      )
      .accounts({ renter: renter.publicKey, booking, systemProgram: SystemProgram.programId })
      .signers([renter])
      .rpc();

    await program.methods
      .confirmMoveIn()
      .accounts({ renter: renter.publicKey, booking, host: host.publicKey })
      .signers([renter])
      .rpc();

    await program.methods
      .startMoveOut()
      .accounts({ renter: renter.publicKey, booking })
      .signers([renter])
      .rpc();

    await program.methods
      .flagDispute()
      .accounts({ host: host.publicKey, booking })
      .signers([host])
      .rpc();

    let account = await (program.account as any).booking.fetch(booking);
    assert.equal(account.status.disputed !== undefined, true);

    await sleep((disputeWindowSecs + 1) * 1000);

    // release_deposit should no longer be valid once disputed
    try {
      await program.methods
        .releaseDeposit()
        .accounts({ caller: renter.publicKey, booking, renter: renter.publicKey })
        .signers([renter])
        .rpc();
      assert.fail("expected release_deposit to fail once disputed");
    } catch (e: any) {
      assert.include(e.toString(), "NotMovedOut");
    }

    const renterAmount = new BN(Math.round(depositLamports.toNumber() * 0.6));
    const hostAmount = depositLamports.sub(renterAmount);

    const renterBalanceBefore = await connection.getBalance(renter.publicKey);
    const hostBalanceBefore = await connection.getBalance(host.publicKey);

    await program.methods
      .adminResolve(renterAmount)
      .accounts({
        admin: admin.publicKey,
        booking,
        renter: renter.publicKey,
        host: host.publicKey,
      })
      .signers([admin])
      .rpc();

    const renterBalanceAfter = await connection.getBalance(renter.publicKey);
    const hostBalanceAfter = await connection.getBalance(host.publicKey);

    assert.equal(renterBalanceAfter - renterBalanceBefore, renterAmount.toNumber());
    assert.equal(hostBalanceAfter - hostBalanceBefore, hostAmount.toNumber());

    account = await (program.account as any).booking.fetch(booking);
    assert.equal(account.status.completed !== undefined, true);
  });
});
