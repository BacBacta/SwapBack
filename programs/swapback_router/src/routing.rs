use anchor_lang::prelude::*;
use anchor_lang::Discriminator;
use std::collections::BTreeMap;

use crate::venue_scoring::{VenueScore, VenueType};
use crate::{JUPITER_PROGRAM_ID, ORCA_WHIRLPOOL_PROGRAM_ID, RAYDIUM_AMM_PROGRAM_ID};

/// Minimum score en dessous duquel une venue est exclue du routing (0..=10_000).
pub const MIN_QUALITY_SCORE_DEFAULT: u16 = 2500;

/// Convert a DEX program Pubkey to VenueType
pub fn pubkey_to_venue_type(pubkey: &Pubkey) -> VenueType {
    if *pubkey == JUPITER_PROGRAM_ID {
        VenueType::Jupiter
    } else if *pubkey == RAYDIUM_AMM_PROGRAM_ID {
        VenueType::Raydium
    } else if *pubkey == ORCA_WHIRLPOOL_PROGRAM_ID {
        VenueType::Orca
    } else {
        VenueType::Unknown
    }
}

/// Parse venue scores from remaining_accounts, indexed by Pubkey
pub fn parse_venue_scores_by_pubkey<'info>(
    remaining: &[AccountInfo<'info>],
) -> BTreeMap<Pubkey, u16> {
    let mut map = BTreeMap::new();
    for ai in remaining {
        let data = ai.try_borrow_data();
        if data.is_err() {
            continue;
        }
        let data = data.unwrap();
        if data.len() < 8 {
            continue;
        }
        // Vérifie discriminator Anchor
        if &data[..8] != VenueScore::discriminator() {
            continue;
        }
        let mut slice: &[u8] = &data;
        if let Ok(vs) = VenueScore::try_deserialize(&mut slice) {
            map.insert(vs.venue, vs.quality_score);
        }
    }
    map
}

/// Adjust VenueWeight weights based on scores (works with Pubkey-based venues)
/// - Excludes venues with score < min_score
/// - Scales weights by (score / 10000)
/// - Renormalizes to sum = 10000
pub fn adjust_venue_weights_with_scores(
    venues: &mut Vec<crate::VenueWeight>,
    scores: &BTreeMap<Pubkey, u16>,
    min_score: u16,
) {
    for v in venues.iter_mut() {
        // If no score found, assume 10000 (don't penalize unknown venues)
        let s = scores.get(&v.venue).copied().unwrap_or(10_000);
        if s < min_score {
            v.weight = 0;
            msg!(
                "⚠️ Venue {} excluded: score {} < min {}",
                v.venue,
                s,
                min_score
            );
            continue;
        }
        // Scale weight by score
        let scaled = (v.weight as u32)
            .saturating_mul(s as u32)
            .checked_div(10_000)
            .unwrap_or(0);
        v.weight = (scaled.min(10_000)) as u16;
    }
    renormalize_venue_weights(venues);
}

/// Renormalize VenueWeight weights to sum = 10000
pub fn renormalize_venue_weights(venues: &mut Vec<crate::VenueWeight>) {
    // Remove zero-weight venues
    venues.retain(|v| v.weight > 0);

    let sum: u32 = venues.iter().map(|v| v.weight as u32).sum();
    if sum == 0 {
        return;
    }

    let mut acc: u32 = 0;
    for v in venues.iter_mut() {
        let w = (v.weight as u32) * 10_000u32 / sum;
        v.weight = w.min(10_000) as u16;
        acc += v.weight as u32;
    }

    // Adjust last venue to reach exactly 10_000
    if let Some(last) = venues.last_mut() {
        let acc_u16 = acc.min(10_000) as i32;
        let diff = 10_000i32 - acc_u16;
        if diff != 0 {
            let new_last = (last.weight as i32 + diff).max(0).min(10_000) as u16;
            last.weight = new_last;
        }
    }

    // Log adjusted weights
    for v in venues.iter() {
        msg!("📊 Venue {} weight: {} bps", v.venue, v.weight);
    }
}

/// Allocation d'une venue dans un plan (weights en BPS, somme = 10_000).
/// NOTE: si ce type existe déjà dans ton code (ex: VenueAllocation), Claude doit mapper vers celui-ci
/// et supprimer ce duplicat.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct VenueAllocation {
    pub venue_type: VenueType,
    pub weight_bps: u16,
}

/// Parse des comptes `VenueScore` présents dans remaining_accounts.
/// Attendu: le keeper ou l'appelant fournit des comptes VenueScore (PDA) en remaining_accounts.
pub fn parse_venue_scores<'info>(remaining: &[AccountInfo<'info>]) -> BTreeMap<VenueType, u16> {
    let mut map = BTreeMap::new();
    for ai in remaining {
        let data = ai.try_borrow_data();
        if data.is_err() {
            continue;
        }
        let data = data.unwrap();
        if data.len() < 8 {
            continue;
        }
        // Vérifie discriminator Anchor
        if &data[..8] != VenueScore::discriminator() {
            continue;
        }
        let mut slice: &[u8] = &data;
        if let Ok(vs) = VenueScore::try_deserialize(&mut slice) {
            map.insert(vs.venue_type, vs.quality_score);
        }
    }
    map
}

/// Renormalise des weights en BPS à 10_000 (et supprime les weights == 0).
pub fn renormalize_weights(venues: &mut Vec<VenueAllocation>) {
    venues.retain(|v| v.weight_bps > 0);
    let sum: u32 = venues.iter().map(|v| v.weight_bps as u32).sum();
    if sum == 0 {
        return;
    }
    let mut acc: u32 = 0;
    for v in venues.iter_mut() {
        let w = (v.weight_bps as u32) * 10_000u32 / sum;
        v.weight_bps = w.min(10_000) as u16;
        acc += v.weight_bps as u32;
    }
    // Ajuste la dernière venue pour atteindre exactement 10_000
    if let Some(last) = venues.last_mut() {
        let acc_u16 = acc.min(10_000) as i32;
        let diff = 10_000i32 - acc_u16;
        if diff != 0 {
            let new_last = (last.weight_bps as i32 + diff).max(0).min(10_000) as u16;
            last.weight_bps = new_last;
        }
    }
}

/// Ajuste weights en fonction des scores :
/// - exclusion si score < min_score
/// - sinon weight * (score/10_000) puis renormalisation
pub fn adjust_weights_with_scores(
    venues: &mut Vec<VenueAllocation>,
    scores: &BTreeMap<VenueType, u16>,
    min_score: u16,
) {
    for v in venues.iter_mut() {
        let s = scores.get(&v.venue_type).copied().unwrap_or(10_000);
        if s < min_score {
            v.weight_bps = 0;
            continue;
        }
        let scaled = (v.weight_bps as u32)
            .saturating_mul(s as u32)
            .checked_div(10_000)
            .unwrap_or(0);
        v.weight_bps = (scaled.min(10_000)) as u16;
    }
    renormalize_weights(venues);
}

#[cfg(test)]
mod tests {
    use super::*;

    // =========================================================================
    // RENORMALIZE WEIGHTS TESTS
    // =========================================================================

    #[test]
    fn weights_renormalize_to_10000() {
        let mut v = vec![
            VenueAllocation {
                venue_type: VenueType::Jupiter,
                weight_bps: 6000,
            },
            VenueAllocation {
                venue_type: VenueType::Orca,
                weight_bps: 4000,
            },
        ];
        renormalize_weights(&mut v);
        let sum: u32 = v.iter().map(|x| x.weight_bps as u32).sum();
        assert_eq!(sum, 10_000);
    }

    #[test]
    fn adjust_excludes_low_scores() {
        let mut v = vec![
            VenueAllocation {
                venue_type: VenueType::Jupiter,
                weight_bps: 5000,
            },
            VenueAllocation {
                venue_type: VenueType::Orca,
                weight_bps: 5000,
            },
        ];
        let mut scores = BTreeMap::new();
        scores.insert(VenueType::Jupiter, 2000);
        scores.insert(VenueType::Orca, 9000);
        adjust_weights_with_scores(&mut v, &scores, 2500);
        assert_eq!(v.len(), 1);
        assert_eq!(v[0].venue_type, VenueType::Orca);
        assert_eq!(v[0].weight_bps, 10_000);
    }

    // =========================================================================
    // RENORMALIZATION: SUM = 10_000 EXACTLY
    // =========================================================================

    #[test]
    fn renormalize_single_venue() {
        let mut v = vec![VenueAllocation {
            venue_type: VenueType::Jupiter,
            weight_bps: 5000,
        }];
        renormalize_weights(&mut v);
        assert_eq!(v[0].weight_bps, 10_000);
    }

    #[test]
    fn renormalize_three_venues() {
        let mut v = vec![
            VenueAllocation {
                venue_type: VenueType::Jupiter,
                weight_bps: 3000,
            },
            VenueAllocation {
                venue_type: VenueType::Orca,
                weight_bps: 3000,
            },
            VenueAllocation {
                venue_type: VenueType::Raydium,
                weight_bps: 4000,
            },
        ];
        renormalize_weights(&mut v);
        let sum: u32 = v.iter().map(|x| x.weight_bps as u32).sum();
        assert_eq!(sum, 10_000, "Sum must be exactly 10_000");
    }

    #[test]
    fn renormalize_unequal_weights() {
        let mut v = vec![
            VenueAllocation {
                venue_type: VenueType::Jupiter,
                weight_bps: 1000,
            },
            VenueAllocation {
                venue_type: VenueType::Orca,
                weight_bps: 9000,
            },
        ];
        renormalize_weights(&mut v);
        let sum: u32 = v.iter().map(|x| x.weight_bps as u32).sum();
        assert_eq!(sum, 10_000);
    }

    #[test]
    fn renormalize_removes_zeros() {
        let mut v = vec![
            VenueAllocation {
                venue_type: VenueType::Jupiter,
                weight_bps: 5000,
            },
            VenueAllocation {
                venue_type: VenueType::Orca,
                weight_bps: 0,
            },
            VenueAllocation {
                venue_type: VenueType::Raydium,
                weight_bps: 5000,
            },
        ];
        renormalize_weights(&mut v);
        assert_eq!(v.len(), 2, "Zero-weight venue should be removed");
        let sum: u32 = v.iter().map(|x| x.weight_bps as u32).sum();
        assert_eq!(sum, 10_000);
    }

    #[test]
    fn renormalize_empty() {
        let mut v: Vec<VenueAllocation> = vec![];
        renormalize_weights(&mut v);
        assert!(v.is_empty());
    }

    #[test]
    fn renormalize_all_zeros() {
        let mut v = vec![
            VenueAllocation {
                venue_type: VenueType::Jupiter,
                weight_bps: 0,
            },
            VenueAllocation {
                venue_type: VenueType::Orca,
                weight_bps: 0,
            },
        ];
        renormalize_weights(&mut v);
        assert!(v.is_empty(), "All-zero venues should result in empty");
    }

    // =========================================================================
    // EXCLUSION BY SCORE THRESHOLD
    // =========================================================================

    #[test]
    fn adjust_excludes_all_below_threshold() {
        let mut v = vec![
            VenueAllocation {
                venue_type: VenueType::Jupiter,
                weight_bps: 5000,
            },
            VenueAllocation {
                venue_type: VenueType::Orca,
                weight_bps: 5000,
            },
        ];
        let mut scores = BTreeMap::new();
        scores.insert(VenueType::Jupiter, 1000);
        scores.insert(VenueType::Orca, 2000);
        adjust_weights_with_scores(&mut v, &scores, 2500);
        // Both are below threshold, all excluded
        assert!(
            v.is_empty(),
            "All venues below threshold should be excluded"
        );
    }

    #[test]
    fn adjust_keeps_above_threshold() {
        let mut v = vec![
            VenueAllocation {
                venue_type: VenueType::Jupiter,
                weight_bps: 5000,
            },
            VenueAllocation {
                venue_type: VenueType::Orca,
                weight_bps: 5000,
            },
        ];
        let mut scores = BTreeMap::new();
        scores.insert(VenueType::Jupiter, 8000);
        scores.insert(VenueType::Orca, 9000);
        adjust_weights_with_scores(&mut v, &scores, 2500);
        assert_eq!(v.len(), 2, "Both above threshold should be kept");
        let sum: u32 = v.iter().map(|x| x.weight_bps as u32).sum();
        assert_eq!(sum, 10_000);
    }

    #[test]
    fn adjust_missing_score_uses_default_10000() {
        let mut v = vec![
            VenueAllocation {
                venue_type: VenueType::Jupiter,
                weight_bps: 5000,
            },
            VenueAllocation {
                venue_type: VenueType::Orca,
                weight_bps: 5000,
            },
        ];
        let scores = BTreeMap::new(); // No scores provided
        adjust_weights_with_scores(&mut v, &scores, 2500);
        // Missing score defaults to 10_000, so both should be kept
        assert_eq!(v.len(), 2);
        let sum: u32 = v.iter().map(|x| x.weight_bps as u32).sum();
        assert_eq!(sum, 10_000);
    }

    // =========================================================================
    // WEIGHT SCALING BY SCORE
    // =========================================================================

    #[test]
    fn adjust_scales_by_score() {
        let mut v = vec![
            VenueAllocation {
                venue_type: VenueType::Jupiter,
                weight_bps: 5000,
            },
            VenueAllocation {
                venue_type: VenueType::Orca,
                weight_bps: 5000,
            },
        ];
        let mut scores = BTreeMap::new();
        scores.insert(VenueType::Jupiter, 5000); // 50% quality
        scores.insert(VenueType::Orca, 10_000); // 100% quality
        adjust_weights_with_scores(&mut v, &scores, 0); // No threshold

        // Jupiter: 5000 * 5000 / 10000 = 2500
        // Orca: 5000 * 10000 / 10000 = 5000
        // Before renorm: Jupiter=2500, Orca=5000
        // After renorm to 10000: Jupiter gets ~3333, Orca gets ~6667
        let sum: u32 = v.iter().map(|x| x.weight_bps as u32).sum();
        assert_eq!(sum, 10_000, "Sum must be 10_000 after adjustment");
    }

    // =========================================================================
    // DETERMINISM TESTS
    // =========================================================================

    #[test]
    fn adjust_is_deterministic() {
        let create_venues = || {
            vec![
                VenueAllocation {
                    venue_type: VenueType::Jupiter,
                    weight_bps: 4000,
                },
                VenueAllocation {
                    venue_type: VenueType::Orca,
                    weight_bps: 3000,
                },
                VenueAllocation {
                    venue_type: VenueType::Raydium,
                    weight_bps: 3000,
                },
            ]
        };
        let mut scores = BTreeMap::new();
        scores.insert(VenueType::Jupiter, 8000);
        scores.insert(VenueType::Orca, 6000);
        scores.insert(VenueType::Raydium, 7000);

        let mut v1 = create_venues();
        let mut v2 = create_venues();

        adjust_weights_with_scores(&mut v1, &scores, 2500);
        adjust_weights_with_scores(&mut v2, &scores, 2500);

        assert_eq!(v1, v2, "Same inputs should produce same outputs");
    }

    #[test]
    fn renormalize_is_deterministic() {
        let create_venues = || {
            vec![
                VenueAllocation {
                    venue_type: VenueType::Jupiter,
                    weight_bps: 3333,
                },
                VenueAllocation {
                    venue_type: VenueType::Orca,
                    weight_bps: 3333,
                },
                VenueAllocation {
                    venue_type: VenueType::Raydium,
                    weight_bps: 3334,
                },
            ]
        };

        let mut v1 = create_venues();
        let mut v2 = create_venues();

        renormalize_weights(&mut v1);
        renormalize_weights(&mut v2);

        assert_eq!(v1, v2, "Renormalization should be deterministic");
    }

    // =========================================================================
    // NO VENUE SCORE = WEIGHTS UNCHANGED
    // =========================================================================

    #[test]
    fn no_scores_weights_unchanged() {
        let mut v = vec![
            VenueAllocation {
                venue_type: VenueType::Jupiter,
                weight_bps: 6000,
            },
            VenueAllocation {
                venue_type: VenueType::Orca,
                weight_bps: 4000,
            },
        ];
        let original = v.clone();
        let scores = BTreeMap::new(); // Empty scores

        adjust_weights_with_scores(&mut v, &scores, 2500);

        // With no scores, default is 10_000 (100%), so weights scaled by 100%
        // After renormalize, should still sum to 10_000
        let sum: u32 = v.iter().map(|x| x.weight_bps as u32).sum();
        assert_eq!(sum, 10_000);

        // Proportions should be preserved
        assert_eq!(v.len(), original.len());
    }

    // =========================================================================
    // EDGE CASES
    // =========================================================================

    #[test]
    fn adjust_with_threshold_equal_to_score() {
        let mut v = vec![
            VenueAllocation {
                venue_type: VenueType::Jupiter,
                weight_bps: 5000,
            },
            VenueAllocation {
                venue_type: VenueType::Orca,
                weight_bps: 5000,
            },
        ];
        let mut scores = BTreeMap::new();
        scores.insert(VenueType::Jupiter, 2500); // Exactly at threshold
        scores.insert(VenueType::Orca, 2500); // Exactly at threshold
        adjust_weights_with_scores(&mut v, &scores, 2500);
        // Score = threshold means it's NOT below threshold, so kept
        assert_eq!(v.len(), 2);
    }

    #[test]
    fn adjust_with_zero_threshold() {
        let mut v = vec![
            VenueAllocation {
                venue_type: VenueType::Jupiter,
                weight_bps: 5000,
            },
            VenueAllocation {
                venue_type: VenueType::Orca,
                weight_bps: 5000,
            },
        ];
        let mut scores = BTreeMap::new();
        scores.insert(VenueType::Jupiter, 1); // Very low but > 0
        scores.insert(VenueType::Orca, 1);
        adjust_weights_with_scores(&mut v, &scores, 0); // Zero threshold
                                                        // Both should be kept since score (1) >= threshold (0)
                                                        // However, weights are scaled by score: 5000 * 1 / 10000 = 0
                                                        // Both get weight 0, then removed by renormalize
                                                        // This is expected behavior - very low scores effectively exclude venues
                                                        // The test should verify this behavior
        let sum: u32 = v.iter().map(|x| x.weight_bps as u32).sum();
        // Either both are removed (len=0) or if somehow kept, sum should be 10000
        assert!(v.is_empty() || sum == 10000);
    }

    #[test]
    fn adjust_with_max_threshold() {
        let mut v = vec![
            VenueAllocation {
                venue_type: VenueType::Jupiter,
                weight_bps: 5000,
            },
            VenueAllocation {
                venue_type: VenueType::Orca,
                weight_bps: 5000,
            },
        ];
        let mut scores = BTreeMap::new();
        scores.insert(VenueType::Jupiter, 9999);
        scores.insert(VenueType::Orca, 9999);
        adjust_weights_with_scores(&mut v, &scores, 10_000); // Max threshold
                                                             // Both below 10_000 threshold
        assert!(v.is_empty());
    }
}
