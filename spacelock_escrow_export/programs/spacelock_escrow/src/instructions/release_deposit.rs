use anchor_lang::prelude::*;

use crate::{error::EscrowError, state::*};

#[derive(Accounts)]
pub struct ReleaseDeposit<'info> {
    /// Anyone can call this once the dispute window has passed; they only pay the tx fee.
    pub caller: Signer<'info>,
    #[account(mut, has_one = renter, close = renter)]
    pub booking: Account<'info, Booking>,
    /// CHECK: refund destination, validated by has_one on booking
    #[account(mut)]
    pub renter: UncheckedAccount<'info>,
}

pub fn handle_release_deposit(ctx: Context<ReleaseDeposit>) -> Result<()> {
    let booking = &ctx.accounts.booking;
    require!(booking.status == BookingStatus::MovedOut, EscrowError::NotMovedOut);

    let now = Clock::get()?.unix_timestamp;
    let deadline = booking.move_out_ts + booking.dispute_window_secs;
    require!(now > deadline, EscrowError::DisputeWindowActive);

    msg!("Dispute window passed with no flag, deposit released to renter");
    Ok(())
}
