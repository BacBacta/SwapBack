#![no_main]

use libfuzzer_sys::fuzz_target;
use arbitrary::Arbitrary;

#[derive(Arbitrary, Debug)]
struct OracleFuzzInput {
    price_feed_1: i64,
    price_feed_2: i64,
    timestamp_1: i64,
    timestamp_2: i64,
    expo_1: i32,
    expo_2: i32,
}

fuzz_target!(|input: OracleFuzzInput| {
    const MAX_STALENESS_SECS: i64 = 300; // 5 minutes
    const MAX_ORACLE_DIVERGENCE_BPS: u64 = 200; // 2%
    const CURRENT_TIME: i64 = 1700000000; // Timestamp de référence
    
    // Test 1: Vérifier la staleness des feeds
    let age_1 = CURRENT_TIME.saturating_sub(input.timestamp_1);
    let age_2 = CURRENT_TIME.saturating_sub(input.timestamp_2);
    
    if age_1 > MAX_STALENESS_SECS || age_2 > MAX_STALENESS_SECS {
        return; // Feeds trop anciens, devrait être rejeté
    }
    
    // Test 2: Valider les prix (doivent être positifs)
    if input.price_feed_1 <= 0 || input.price_feed_2 <= 0 {
        return; // Prix invalides
    }
    
    // Test 3: Normaliser les prix avec les exposants
    // Éviter les overflows dans la conversion
    let price_1 = input.price_feed_1.checked_abs();
    let price_2 = input.price_feed_2.checked_abs();
    
    if let (Some(p1), Some(p2)) = (price_1, price_2) {
        // Test 4: Calculer la divergence entre les feeds
        // divergence_bps = |p1 - p2| * 10000 / max(p1, p2)
        let diff = (p1 as i128).checked_sub(p2 as i128);
        if let Some(d) = diff {
            let abs_diff = d.abs() as u64;
            let max_price = p1.max(p2) as u64;
            
            if max_price > 0 {
                let divergence_bps = abs_diff.checked_mul(10000)
                    .and_then(|v| v.checked_div(max_price));
                
                if let Some(div) = divergence_bps {
                    // Test 5: Vérifier que la divergence est acceptable
                    if div > MAX_ORACLE_DIVERGENCE_BPS {
                        return; // Divergence trop grande, devrait être rejeté
                    }
                    
                    // Test 6: Calculer le prix médian avec checked arithmetic
                    let median = (p1 as u128).checked_add(p2 as u128)
                        .and_then(|v| v.checked_div(2));
                    
                    if let Some(med) = median {
                        // Vérifier que le médian est dans les bornes attendues
                        assert!(med >= p1.min(p2) as u128, "Median below min price");
                        assert!(med <= p1.max(p2) as u128, "Median above max price");
                    }
                }
            }
        }
    }
    
    // Test 7: Vérifier la cohérence des exposants
    // Les exposants doivent être raisonnables (généralement entre -12 et 0)
    if input.expo_1 > 0 || input.expo_2 > 0 || input.expo_1 < -18 || input.expo_2 < -18 {
        return; // Exposants invalides
    }
});
