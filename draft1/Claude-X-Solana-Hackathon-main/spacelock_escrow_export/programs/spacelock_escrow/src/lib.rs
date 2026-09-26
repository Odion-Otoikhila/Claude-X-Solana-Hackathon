pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("D2viXu3qRxX8vaUQcEC92rEXxfkYES7ZyWQXzRAoU47u");

#[program]
pub mod spacelock_escrow {
    use super::*;

    pub fn create_booking(
        ctx: Context<CreateBooking>,
        booking_id: u64,
        host: Pubkey,
        admin: Pubkey,
        rent_amount: u64,
        deposit_amount: u64,
        dispute_window_secs: i64,
    ) -> Result<()> {
        instructions::create_booking::handle_create_booking(
            ctx,
            booking_id,
            host,
            admin,
            rent_amount,
            deposit_amount,
            dispute_window_secs,
        )
    }

    pub fn confirm_move_in(ctx: Context<ConfirmMoveIn>) -> Result<()> {
        instructions::confirm_move_in::handle_confirm_move_in(ctx)
    }

    pub fn cancel_booking(ctx: Context<CancelBooking>) -> Result<()> {
        instructions::cancel_booking::handle_cancel_booking(ctx)
    }

    pub fn start_move_out(ctx: Context<StartMoveOut>) -> Result<()> {
        instructions::start_move_out::handle_start_move_out(ctx)
    }

    pub fn flag_dispute(ctx: Context<FlagDispute>) -> Result<()> {
        instructions::flag_dispute::handle_flag_dispute(ctx)
    }

    pub fn release_deposit(ctx: Context<ReleaseDeposit>) -> Result<()> {
        instructions::release_deposit::handle_release_deposit(ctx)
    }

    pub fn admin_resolve(ctx: Context<AdminResolve>, renter_amount: u64) -> Result<()> {
        instructions::admin_resolve::handle_admin_resolve(ctx, renter_amount)
    }
}
