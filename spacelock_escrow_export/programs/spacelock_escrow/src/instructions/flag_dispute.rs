use anchor_lang::prelude::*;

use crate::{error::EscrowError, state::*};

#[derive(Accounts)]
pub struct FlagDispute<'info> {
    pub host: Signer<'info>,
    #[account(mut, has_one = host)]
    pub booking: Account<'info, Booking>,
}

pub fn handle_flag_dispute(ctx: Context<FlagDispute>) -> Result<()> {
    let booking = &mut ctx.accounts.booking;
    require!(booking.status == BookingStatus::MovedOut, EscrowError::NotMovedOut);

    let now = Clock::get()?.unix_timestamp;
    let deadline = booking.move_out_ts + booking.dispute_window_secs;
    require!(now <= deadline, EscrowError::DisputeWindowClosed);

    booking.status = BookingStatus::Disputed;

    msg!("Dispute flagged by host, awaiting admin resolution");
    Ok(())
}
