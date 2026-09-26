use anchor_lang::prelude::*;

use crate::{error::EscrowError, state::*};

#[derive(Accounts)]
pub struct StartMoveOut<'info> {
    pub renter: Signer<'info>,
    #[account(mut, has_one = renter)]
    pub booking: Account<'info, Booking>,
}

pub fn handle_start_move_out(ctx: Context<StartMoveOut>) -> Result<()> {
    let booking = &mut ctx.accounts.booking;
    require!(booking.status == BookingStatus::MovedIn, EscrowError::NotMovedIn);

    booking.status = BookingStatus::MovedOut;
    booking.move_out_ts = Clock::get()?.unix_timestamp;

    msg!(
        "Move-out started, dispute window of {} seconds begins now",
        booking.dispute_window_secs
    );
    Ok(())
}
