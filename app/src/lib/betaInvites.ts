/**
 * Beta Invite System
 * 
 * Manages beta invite codes and user activation
 */

// Valid beta invite codes (50 users)
// In production, store these in a database
export const BETA_INVITE_CODES = [
  'SWAP-ALPHA-001', 'SWAP-ALPHA-002', 'SWAP-ALPHA-003', 'SWAP-ALPHA-004', 'SWAP-ALPHA-005',
  'SWAP-ALPHA-006', 'SWAP-ALPHA-007', 'SWAP-ALPHA-008', 'SWAP-ALPHA-009', 'SWAP-ALPHA-010',
  'SWAP-BETA-011', 'SWAP-BETA-012', 'SWAP-BETA-013', 'SWAP-BETA-014', 'SWAP-BETA-015',
  'SWAP-BETA-016', 'SWAP-BETA-017', 'SWAP-BETA-018', 'SWAP-BETA-019', 'SWAP-BETA-020',
  'SWAP-GAMMA-021', 'SWAP-GAMMA-022', 'SWAP-GAMMA-023', 'SWAP-GAMMA-024', 'SWAP-GAMMA-025',
  'SWAP-GAMMA-026', 'SWAP-GAMMA-027', 'SWAP-GAMMA-028', 'SWAP-GAMMA-029', 'SWAP-GAMMA-030',
  'SWAP-DELTA-031', 'SWAP-DELTA-032', 'SWAP-DELTA-033', 'SWAP-DELTA-034', 'SWAP-DELTA-035',
  'SWAP-DELTA-036', 'SWAP-DELTA-037', 'SWAP-DELTA-038', 'SWAP-DELTA-039', 'SWAP-DELTA-040',
  'SWAP-OMEGA-041', 'SWAP-OMEGA-042', 'SWAP-OMEGA-043', 'SWAP-OMEGA-044', 'SWAP-OMEGA-045',
  'SWAP-OMEGA-046', 'SWAP-OMEGA-047', 'SWAP-OMEGA-048', 'SWAP-OMEGA-049', 'SWAP-OMEGA-050',
];

// Track used invite codes (in production, store in database)
const usedInviteCodes = new Set<string>();

/**
 * Validate beta invite code
 */
export function validateInviteCode(code: string): {
  valid: boolean;
  message: string;
  tier?: 'alpha' | 'beta' | 'gamma' | 'delta' | 'omega';
} {
  const normalizedCode = code.toUpperCase().trim();

  // Check if code exists
  if (!BETA_INVITE_CODES.includes(normalizedCode)) {
    return {
      valid: false,
      message: 'Invalid invite code. Please check and try again.',
    };
  }

  // Check if code already used
  if (usedInviteCodes.has(normalizedCode)) {
    return {
      valid: false,
      message: 'This invite code has already been used.',
    };
  }

  // Determine tier
  let tier: 'alpha' | 'beta' | 'gamma' | 'delta' | 'omega' = 'omega';
  if (normalizedCode.includes('ALPHA')) tier = 'alpha';
  else if (normalizedCode.includes('BETA')) tier = 'beta';
  else if (normalizedCode.includes('GAMMA')) tier = 'gamma';
  else if (normalizedCode.includes('DELTA')) tier = 'delta';

  return {
    valid: true,
    message: 'Valid invite code! Welcome to SwapBack Beta!',
    tier,
  };
}

/**
 * Mark invite code as used
 */
export function markInviteCodeUsed(code: string): void {
  usedInviteCodes.add(code.toUpperCase().trim());
}

/**
 * Get tier benefits
 */
export function getTierBenefits(tier: 'alpha' | 'beta' | 'gamma' | 'delta' | 'omega'): {
  name: string;
  emoji: string;
  benefits: string[];
  backReward: number;
} {
  const tiers = {
    alpha: {
      name: 'Alpha Tester',
      emoji: '👑',
      benefits: [
        '🎁 5,000 $BACK tokens airdrop',
        '🔥 Exclusive Alpha Tester NFT',
        '💎 Lifetime 50% fee discount',
        '📢 Early access to all features',
        '🗣️ Direct line to team',
      ],
      backReward: 5000,
    },
    beta: {
      name: 'Beta Tester',
      emoji: '💎',
      benefits: [
        '🎁 3,000 $BACK tokens airdrop',
        '🏅 Beta Tester Badge',
        '💰 Lifetime 30% fee discount',
        '⚡ Priority feature requests',
      ],
      backReward: 3000,
    },
    gamma: {
      name: 'Gamma Tester',
      emoji: '⭐',
      benefits: [
        '🎁 2,000 $BACK tokens airdrop',
        '🎖️ Early Adopter Badge',
        '💸 Lifetime 20% fee discount',
      ],
      backReward: 2000,
    },
    delta: {
      name: 'Delta Tester',
      emoji: '🔰',
      benefits: [
        '🎁 1,000 $BACK tokens airdrop',
        '🏷️ Beta Participant Badge',
        '💵 Lifetime 10% fee discount',
      ],
      backReward: 1000,
    },
    omega: {
      name: 'Omega Tester',
      emoji: '🌟',
      benefits: [
        '🎁 500 $BACK tokens airdrop',
        '🎫 Community Member Badge',
        '💳 Lifetime 5% fee discount',
      ],
      backReward: 500,
    },
  };

  return tiers[tier];
}

/**
 * Get available invite codes count
 */
export function getAvailableCodesCount(): number {
  return BETA_INVITE_CODES.length - usedInviteCodes.size;
}

/**
 * Generate beta invite report
 */
export function generateInviteReport(): {
  total: number;
  used: number;
  available: number;
  byTier: Record<string, { total: number; used: number }>;
} {
  const byTier: Record<string, { total: number; used: number }> = {
    alpha: { total: 0, used: 0 },
    beta: { total: 0, used: 0 },
    gamma: { total: 0, used: 0 },
    delta: { total: 0, used: 0 },
    omega: { total: 0, used: 0 },
  };

  BETA_INVITE_CODES.forEach((code) => {
    let tier = 'omega';
    if (code.includes('ALPHA')) tier = 'alpha';
    else if (code.includes('BETA')) tier = 'beta';
    else if (code.includes('GAMMA')) tier = 'gamma';
    else if (code.includes('DELTA')) tier = 'delta';

    byTier[tier].total++;
    if (usedInviteCodes.has(code)) {
      byTier[tier].used++;
    }
  });

  return {
    total: BETA_INVITE_CODES.length,
    used: usedInviteCodes.size,
    available: BETA_INVITE_CODES.length - usedInviteCodes.size,
    byTier,
  };
}
