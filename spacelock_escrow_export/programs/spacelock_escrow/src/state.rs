use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum BookingStatus {
    Created,
    MovedIn,
    MovedOut,
    Disputed,
    Completed,
}

#[account]
#[derive(InitSpace)]
pub struct Booking {
    pub renter: Pubkey,
    pub host: Pubkey,
    pub admin: Pubkey,
    pub booking_id: u64,
    pub rent_amount: u64,
    pub deposit_amount: u64,
    pub status: BookingStatus,
    pub move_out_ts: i64,
    pub dispute_window_secs: i64,
    pub bump: u8,
}
