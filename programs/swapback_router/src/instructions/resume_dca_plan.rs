use anchor_lang::prelude::*;
use crate::state::DcaPlan;
use crate::error::SwapbackError;

#[derive(Accounts)]
pub struct ResumeDcaPlan<'info> {
    #[account(
        mut,
        seeds = [b"dca_plan", user.key().as_ref(), &dca_plan.plan_id],
        bump = dca_plan.bump,
        has_one = user
    )]
    pub dca_plan: Account<'info, DcaPlan>,
    
    pub user: Signer<'info>,
}

pub fn handler(ctx: Context<ResumeDcaPlan>) -> Result<()> {
    let dca_plan = &mut ctx.accounts.dca_plan;
    let clock = Clock::get()?;
    
    require!(!dca_plan.is_active, SwapbackError::AlreadyActive);
    require!(!dca_plan.is_completed(), SwapbackError::PlanCompleted);
    require!(!dca_plan.is_expired(clock.unix_timestamp), SwapbackError::PlanExpired);
    
    dca_plan.is_active = true;
    
    // Update next execution to avoid immediate execution after resume
    if dca_plan.next_execution < clock.unix_timestamp {
        dca_plan.next_execution = clock.unix_timestamp + dca_plan.interval_seconds;
    }
    
    msg!("▶️  DCA Plan resumed");
    msg!("Plan ID: {:?}", dca_plan.plan_id);
    msg!("Next execution: {}", dca_plan.next_execution);
    
    Ok(())
}
