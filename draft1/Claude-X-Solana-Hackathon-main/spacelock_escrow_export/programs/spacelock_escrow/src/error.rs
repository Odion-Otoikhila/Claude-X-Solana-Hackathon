use anchor_lang::prelude::*;

#[error_code]
pub enum EscrowError {
    #[msg("Booking must be in Created status")]
    NotCreated,
    #[msg("Booking must be in MovedIn status")]
    NotMovedIn,
    #[msg("Booking must be in MovedOut status")]
    NotMovedOut,
    #[msg("Booking must be in Disputed status")]
    NotDisputed,
    #[msg("The dispute window has already closed")]
    DisputeWindowClosed,
    #[msg("The dispute window has not closed yet")]
    DisputeWindowActive,
    #[msg("Renter split amount exceeds the escrowed deposit")]
    SplitExceedsDeposit,
}
