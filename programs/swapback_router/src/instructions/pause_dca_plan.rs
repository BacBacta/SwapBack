use anchor_lang::prelude::*;
use crate::state::DcaPlan;
use crate::error::SwapbackError;

#[derive(Accounts)]
pub struct PauseDcaPlan<'info> {
    #[account(
        mut,
        seeds = [b"dca_plan", user.key().as_ref(), &dca_plan.plan_id],
        bump = dca_plan.bump,
        has_one = user
    )]
    pub dca_plan: Account<'info, DcaPlan>,
    
    pub user: Signer<'info>,
}

pub fn handler(ctx: Context<PauseDcaPlan>) -> Result<()> {
    let dca_plan = &mut ctx.accounts.dca_plan;
    
    require!(dca_plan.is_active, SwapbackError::AlreadyPaused);
    require!(!dca_plan.is_completed(), SwapbackError::PlanCompleted);
    
    dca_plan.is_active = false;
    
    msg!("⏸️  DCA Plan paused");
    msg!("Plan ID: {:?}", dca_plan.plan_id);
    
    Ok(())
}
