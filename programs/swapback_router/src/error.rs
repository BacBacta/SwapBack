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

    // Jupiter CPI Errors
    #[msg("Missing Jupiter route / instruction data for CPI swap")]
    MissingJupiterRoute,
    #[msg("Jupiter CPI failed")]
    JupiterCpiFailed,
    #[msg("Jupiter CPI: input not spent (delta=0)")]
    JupiterNoInputSpent,
    #[msg("Jupiter CPI: spent input too high vs expected")]
    JupiterSpentTooHigh,
    #[msg("Slippage exceeded (amount_out < min_out)")]
    SlippageExceededCpi,
    #[msg("Invalid liquidity estimate (must be > 0)")]
    InvalidLiquidityEstimate,

    // Compute Budget Guard
    #[msg("Too many venues for one swap (compute guard)")]
    TooManyVenues,

    // Admin Errors
    #[msg("Protocol is currently paused")]
    ProtocolPaused,
    #[msg("No pending authority to accept")]
    NoPendingAuthority,
    #[msg("Caller is not the pending authority")]
    NotPendingAuthority,
    #[msg("Address is blacklisted")]
    AddressBlacklisted,
    #[msg("Invalid wallet address (zero address)")]
    InvalidWalletAddress,
    #[msg("Emergency withdraw amount exceeds vault balance")]
    EmergencyWithdrawExceedsBalance,
    #[msg("Cannot pause an already paused protocol")]
    AlreadyPausedProtocol,
    #[msg("Cannot unpause an already active protocol")]
    AlreadyUnpausedProtocol,
}
