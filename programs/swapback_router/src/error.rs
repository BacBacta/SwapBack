use anchor_lang::prelude::*;

#[error_code]
pub enum SwapbackError {
    // DCA Plan Creation Errors
    #[msg("Amount per swap must be greater than 0")]
    InvalidAmount,
    #[msg("Total swaps must be greater than 0")]
    InvalidSwapCount,
    #[msg("Too many swaps (max 10,000)")]
    TooManySwaps,
    #[msg("Interval too short (min 1 hour)")]
    IntervalTooShort,
    #[msg("Interval too long (max 1 year)")]
    IntervalTooLong,
    #[msg("Expiry must be in the future")]
    InvalidExpiry,
    #[msg("Input and output mints must differ")]
    IdenticalMints,
    #[msg("Per-swap amount exceeds router limits")]
    AmountExceedsLimit,
    #[msg("Minimum output must be greater than 0")]
    InvalidMinOutput,

    // DCA Execution Errors
    #[msg("DCA plan is not active")]
    PlanNotActive,
    #[msg("DCA plan is already completed")]
    PlanCompleted,
    #[msg("DCA plan has expired")]
    PlanExpired,
    #[msg("Not ready for execution yet")]
    NotReadyForExecution,
    #[msg("Insufficient user balance")]
    InsufficientBalance,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,

    // DCA Management Errors
    #[msg("DCA plan is already paused")]
    AlreadyPaused,
    #[msg("DCA plan is already active")]
    AlreadyActive,

    // Swap Execution Errors
    #[msg("Swap execution failed")]
    SwapExecutionFailed,
    #[msg("Invalid token account")]
    InvalidTokenAccount,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Math overflow")]
    MathOverflow,
}
