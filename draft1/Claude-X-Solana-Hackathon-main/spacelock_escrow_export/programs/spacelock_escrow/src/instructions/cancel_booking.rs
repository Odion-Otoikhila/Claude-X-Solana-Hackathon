use anchor_lang::prelude::*;

use crate::{error::EscrowError, state::*};

#[derive(Accounts)]
pub struct CancelBooking<'info> {
    #[account(mut)]
    pub renter: Signer<'info>,
    #[account(mut, has_one = renter, close = renter)]
    pub booking: Account<'info, Booking>,
}

pub fn handle_cancel_booking(ctx: Context<CancelBooking>) -> Result<()> {
    require!(
        ctx.accounts.booking.status == BookingStatus::Created,
        EscrowError::NotCreated
    );
    msg!("Booking cancelled, full refund returned to renter");
    Ok(())
}
