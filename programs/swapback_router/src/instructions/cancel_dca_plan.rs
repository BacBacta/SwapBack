use crate::state::DcaPlan;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CancelDcaPlan<'info> {
    #[account(
        mut,
        seeds = [b"dca_plan", user.key().as_ref(), &dca_plan.plan_id],
        bump = dca_plan.bump,
        has_one = user,
        close = user
    )]
    pub dca_plan: Account<'info, DcaPlan>,

    #[account(mut)]
    pub user: Signer<'info>,
}

pub fn handler(ctx: Context<CancelDcaPlan>) -> Result<()> {
    let dca_plan = &ctx.accounts.dca_plan;

    msg!("❌ DCA Plan cancelled and closed");
    msg!("Plan ID: {:?}", dca_plan.plan_id);
    msg!(
        "Swaps executed: {}/{}",
        dca_plan.executed_swaps,
        dca_plan.total_swaps
    );
    msg!("Total invested: {}", dca_plan.total_invested);
    msg!("Total received: {}", dca_plan.total_received);

    // Account will be closed automatically and rent refunded to user

    Ok(())
}
