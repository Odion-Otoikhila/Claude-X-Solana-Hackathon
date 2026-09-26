use anchor_lang::prelude::*;

use crate::{error::EscrowError, state::*};

#[derive(Accounts)]
pub struct ConfirmMoveIn<'info> {
    pub renter: Signer<'info>,
    #[account(mut, has_one = renter, has_one = host)]
    pub booking: Account<'info, Booking>,
    /// CHECK: destination for the rent payout, validated by has_one on booking
    #[account(mut)]
    pub host: UncheckedAccount<'info>,
}

pub fn handle_confirm_move_in(ctx: Context<ConfirmMoveIn>) -> Result<()> {
    let booking = &mut ctx.accounts.booking;
    require!(booking.status == BookingStatus::Created, EscrowError::NotCreated);

    let rent_amount = booking.rent_amount;
    **booking.to_account_info().try_borrow_mut_lamports()? -= rent_amount;
    **ctx.accounts.host.to_account_info().try_borrow_mut_lamports()? += rent_amount;

    booking.status = BookingStatus::MovedIn;

    msg!("Move-in confirmed, {} lamports rent released to host", rent_amount);
    Ok(())
}
