use anchor_lang::prelude::*;
use anchor_lang::Discriminator;
use std::collections::BTreeMap;

use crate::venue_scoring::{VenueScore, VenueType};

/// Minimum score en dessous duquel une venue est exclue du routing (0..=10_000).
pub const MIN_QUALITY_SCORE_DEFAULT: u16 = 2500;

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
pub fn parse_venue_scores<'info>(
    remaining: &[AccountInfo<'info>],
) -> BTreeMap<VenueType, u16> {
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

    #[test]
    fn weights_renormalize_to_10000() {
        let mut v = vec![
            VenueAllocation { venue_type: VenueType::Jupiter, weight_bps: 6000 },
            VenueAllocation { venue_type: VenueType::Orca, weight_bps: 4000 },
        ];
        renormalize_weights(&mut v);
        let sum: u32 = v.iter().map(|x| x.weight_bps as u32).sum();
        assert_eq!(sum, 10_000);
    }

    #[test]
    fn adjust_excludes_low_scores() {
        let mut v = vec![
            VenueAllocation { venue_type: VenueType::Jupiter, weight_bps: 5000 },
            VenueAllocation { venue_type: VenueType::Orca, weight_bps: 5000 },
        ];
        let mut scores = BTreeMap::new();
        scores.insert(VenueType::Jupiter, 2000);
        scores.insert(VenueType::Orca, 9000);
        adjust_weights_with_scores(&mut v, &scores, 2500);
        assert_eq!(v.len(), 1);
        assert_eq!(v[0].venue_type, VenueType::Orca);
        assert_eq!(v[0].weight_bps, 10_000);
    }
}
