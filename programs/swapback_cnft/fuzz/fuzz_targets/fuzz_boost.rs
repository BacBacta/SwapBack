use honggfuzz::fuzz;
use arbitrary::Arbitrary;

#[derive(Debug, Arbitrary)]
struct FuzzBoostInput {
    amount_locked: u64,
    lock_duration: i64, // En secondes
}

const MIN_LOCK_DURATION: i64 = 7 * 86400;  // 7 jours
const MAX_LOCK_DURATION: i64 = 1095 * 86400; // 3 ans
const MIN_LOCK_AMOUNT: u64 = 100 * 1_000_000_000; // 100 BACK
const BONUS_THRESHOLD: u64 = 1000 * 1_000_000_000; // 1000 BACK

fn main() {
    loop {
        fuzz!(|data: FuzzBoostInput| {
            // Test que le calcul de boost ne panic jamais
            
            // Validation durée
            if data.lock_duration < MIN_LOCK_DURATION || data.lock_duration > MAX_LOCK_DURATION {
                // Devrait être rejeté
                assert!(validate_lock_duration(data.lock_duration).is_err());
                return;
            }
            
            // Validation montant
            if data.amount_locked < MIN_LOCK_AMOUNT {
                assert!(validate_lock_amount(data.amount_locked).is_err());
                return;
            }
            
            // Test calcul de boost_multiplier
            let boost_result = calculate_boost_multiplier(data.amount_locked, data.lock_duration);
            assert!(boost_result.is_some(), "Boost calculation panicked!");
            
            let boost_multiplier = boost_result.unwrap();
            
            // Invariant 1: Boost doit être >= 100 (1.0x)
            assert!(boost_multiplier >= 100, "Boost < 1.0x!");
            
            // Invariant 2: Boost max théorique = 270 (2.7x)
            // Base 100 + Time max 150 (3 ans * 0.5) + Amount 20 (>= 1000 BACK)
            assert!(boost_multiplier <= 270, "Boost > 2.7x!");
            
            // Invariant 3: Plus longue durée = plus grand boost
            if data.lock_duration == MAX_LOCK_DURATION {
                let max_time_boost = calculate_time_boost(MAX_LOCK_DURATION).unwrap();
                assert!(max_time_boost == 150, "Max time boost incorrect!");
            }
            
            // Invariant 4: Montant >= 1000 BACK donne bonus de 20
            if data.amount_locked >= BONUS_THRESHOLD {
                let amount_bonus = calculate_amount_bonus(data.amount_locked);
                assert!(amount_bonus == 20, "Amount bonus incorrect!");
            }
            
            // Invariant 5: Boost doit être monotone avec durée
            if data.lock_duration < MAX_LOCK_DURATION {
                let longer_duration = (data.lock_duration + 86400).min(MAX_LOCK_DURATION);
                let longer_boost = calculate_boost_multiplier(data.amount_locked, longer_duration);
                
                if let Some(lb) = longer_boost {
                    assert!(lb >= boost_multiplier, "Boost not monotone with duration!");
                }
            }
        });
    }
}

fn validate_lock_duration(duration: i64) -> Result<(), String> {
    if duration < MIN_LOCK_DURATION || duration > MAX_LOCK_DURATION {
        return Err("InvalidLockDuration".to_string());
    }
    Ok(())
}

fn validate_lock_amount(amount: u64) -> Result<(), String> {
    if amount < MIN_LOCK_AMOUNT {
        return Err("InsufficientLockAmount".to_string());
    }
    Ok(())
}

fn calculate_time_boost(duration: i64) -> Option<u16> {
    // time_boost = (duration_days / 365) * 50
    let days = duration / 86400;
    let time_boost = days.checked_mul(50)?.checked_div(365)?;
    
    // Max 150 (3 years * 50)
    Some(time_boost.min(150) as u16)
}

fn calculate_amount_bonus(amount: u64) -> u16 {
    if amount >= BONUS_THRESHOLD {
        20
    } else {
        0
    }
}

fn calculate_boost_multiplier(amount: u64, duration: i64) -> Option<u16> {
    if amount < MIN_LOCK_AMOUNT {
        return None;
    }
    
    if duration < MIN_LOCK_DURATION || duration > MAX_LOCK_DURATION {
        return None;
    }
    
    let time_boost = calculate_time_boost(duration)?;
    let amount_bonus = calculate_amount_bonus(amount);
    
    let total_boost = 100u16
        .checked_add(time_boost)?
        .checked_add(amount_bonus)?;
    
    Some(total_boost)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_min_boost() {
        // 100 BACK, 7 jours
        let boost = calculate_boost_multiplier(MIN_LOCK_AMOUNT, MIN_LOCK_DURATION).unwrap();
        assert!(boost >= 100); // Au moins 1.0x
    }

    #[test]
    fn test_max_boost() {
        // 1000+ BACK, 3 ans
        let boost = calculate_boost_multiplier(BONUS_THRESHOLD, MAX_LOCK_DURATION).unwrap();
        assert_eq!(boost, 270); // 100 + 150 + 20
    }

    #[test]
    fn test_amount_bonus() {
        assert_eq!(calculate_amount_bonus(100 * 1_000_000_000), 0);
        assert_eq!(calculate_amount_bonus(999 * 1_000_000_000), 0);
        assert_eq!(calculate_amount_bonus(1000 * 1_000_000_000), 20);
        assert_eq!(calculate_amount_bonus(10000 * 1_000_000_000), 20);
    }

    #[test]
    fn test_time_boost() {
        assert_eq!(calculate_time_boost(7 * 86400).unwrap(), 0); // ~0 days
        assert_eq!(calculate_time_boost(365 * 86400).unwrap(), 50); // 1 year
        assert_eq!(calculate_time_boost(730 * 86400).unwrap(), 100); // 2 years
        assert_eq!(calculate_time_boost(1095 * 86400).unwrap(), 150); // 3 years
    }

    #[test]
    fn test_monotonicity() {
        let amount = 500 * 1_000_000_000;
        
        let boost_1m = calculate_boost_multiplier(amount, 30 * 86400).unwrap();
        let boost_6m = calculate_boost_multiplier(amount, 180 * 86400).unwrap();
        let boost_1y = calculate_boost_multiplier(amount, 365 * 86400).unwrap();
        
        assert!(boost_6m > boost_1m);
        assert!(boost_1y > boost_6m);
    }
}
