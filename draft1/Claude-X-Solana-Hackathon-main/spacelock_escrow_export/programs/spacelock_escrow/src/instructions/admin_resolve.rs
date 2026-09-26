use anchor_lang::prelude::*;

use crate::{error::EscrowError, state::*};

#[derive(Accounts)]
pub struct AdminResolve<'info> {
    pub admin: Signer<'info>,
    #[account(mut, has_one = admin, has_one = renter, has_one = host)]
    pub booking: Account<'info, Booking>,
    /// CHECK: refund destination, validated by has_one on booking
    #[account(mut)]
    pub renter: UncheckedAccount<'info>,
    /// CHECK: payout destination, validated by has_one on booking
    #[account(mut)]
    pub host: UncheckedAccount<'info>,
}

/// Demo stand-in for proper dispute arbitration: the admin key manually
/// splits the escrowed deposit between renter and host.
pub fn handle_admin_resolve(ctx: Context<AdminResolve>, renter_amount: u64) -> Result<()> {
    let booking = &mut ctx.accounts.booking;
    require!(booking.status == BookingStatus::Disputed, EscrowError::NotDisputed);
    require!(renter_amount <= booking.deposit_amount, EscrowError::SplitExceedsDeposit);

    let host_amount = booking.deposit_amount - renter_amount;

    if renter_amount > 0 {
        **booking.to_account_info().try_borrow_mut_lamports()? -= renter_amount;
        **ctx.accounts.renter.to_account_info().try_borrow_mut_lamports()? += renter_amount;
    }
    if host_amount > 0 {
        **booking.to_account_info().try_borrow_mut_lamports()? -= host_amount;
        **ctx.accounts.host.to_account_info().try_borrow_mut_lamports()? += host_amount;
    }

    booking.status = BookingStatus::Completed;

    msg!(
        "Admin resolved dispute: {} lamports to renter, {} lamports to host",
        renter_amount,
        host_amount
    );
    Ok(())
}
