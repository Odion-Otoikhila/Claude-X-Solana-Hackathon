use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::{constants::*, state::*};

#[derive(Accounts)]
#[instruction(booking_id: u64)]
pub struct CreateBooking<'info> {
    #[account(mut)]
    pub renter: Signer<'info>,
    #[account(
        init,
        payer = renter,
        space = 8 + Booking::INIT_SPACE,
        seeds = [BOOKING_SEED, renter.key().as_ref(), &booking_id.to_le_bytes()],
        bump
    )]
    pub booking: Account<'info, Booking>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_booking(
    ctx: Context<CreateBooking>,
    booking_id: u64,
    host: Pubkey,
    admin: Pubkey,
    rent_amount: u64,
    deposit_amount: u64,
    dispute_window_secs: i64,
) -> Result<()> {
    let booking = &mut ctx.accounts.booking;
    booking.renter = ctx.accounts.renter.key();
    booking.host = host;
    booking.admin = admin;
    booking.booking_id = booking_id;
    booking.rent_amount = rent_amount;
    booking.deposit_amount = deposit_amount;
    booking.status = BookingStatus::Created;
    booking.move_out_ts = 0;
    booking.dispute_window_secs = dispute_window_secs;
    booking.bump = ctx.bumps.booking;

    let cpi_accounts = Transfer {
        from: ctx.accounts.renter.to_account_info(),
        to: booking.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.system_program.key(), cpi_accounts);
    transfer(cpi_ctx, rent_amount + deposit_amount)?;

    msg!(
        "Booking {} created: rent {} deposit {} lamports locked in escrow",
        booking_id,
        rent_amount,
        deposit_amount
    );
    Ok(())
}
