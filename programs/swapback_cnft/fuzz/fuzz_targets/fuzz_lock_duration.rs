use honggfuzz::fuzz;
use arbitrary::Arbitrary;

#[derive(Debug, Arbitrary)]
struct FuzzLockInput {
    lock_start: i64,
    lock_duration: i64,
    current_time: i64,
}

const MIN_LOCK_DURATION: i64 = 7 * 86400;  // 7 jours
const MAX_LOCK_DURATION: i64 = 1095 * 86400; // 3 ans

fn main() {
    loop {
        fuzz!(|data: FuzzLockInput| {
            // Test validation de lock duration et unlock logic
            
            // Test 1: Durée doit être dans les limites
            if data.lock_duration < MIN_LOCK_DURATION || data.lock_duration > MAX_LOCK_DURATION {
                assert!(validate_lock_duration(data.lock_duration).is_err());
                return;
            }
            
            // Test 2: Calcul lock_end ne doit pas overflow
            let lock_end = calculate_lock_end(data.lock_start, data.lock_duration);
            assert!(lock_end.is_some(), "Lock end calculation overflowed!");
            
            let lock_end_time = lock_end.unwrap();
            
            // Invariant: lock_end > lock_start
            assert!(lock_end_time > data.lock_start, "Lock end before start!");
            
            // Test 3: can_unlock logic
            let can_unlock = check_can_unlock(lock_end_time, data.current_time);
            
            if data.current_time >= lock_end_time {
                assert!(can_unlock, "Should be able to unlock after expiration!");
            } else {
                assert!(!can_unlock, "Should NOT be able to unlock before expiration!");
            }
            
            // Test 4: Temps restant
            if data.current_time < lock_end_time {
                let time_remaining = calculate_time_remaining(lock_end_time, data.current_time);
                assert!(time_remaining.is_some(), "Time remaining calculation failed!");
                
                let remaining = time_remaining.unwrap();
                assert!(remaining > 0, "Time remaining should be positive!");
                assert!(remaining <= data.lock_duration, "Time remaining > original duration!");
            }
            
            // Test 5: Penalty calculation (si unlock early)
            if data.current_time < lock_end_time && data.current_time > data.lock_start {
                let penalty = calculate_early_unlock_penalty(
                    data.lock_start,
                    lock_end_time,
                    data.current_time
                );
                
                assert!(penalty.is_some(), "Penalty calculation failed!");
                
                let penalty_percent = penalty.unwrap();
                
                // Penalty doit être entre 0 et 50%
                assert!(penalty_percent <= 50, "Penalty > 50%!");
                
                // Plus on est proche de la fin, moins de penalty
                let progress = ((data.current_time - data.lock_start) as f64)
                    / (data.lock_duration as f64);
                
                if progress >= 0.5 {
                    assert!(penalty_percent <= 25, "Penalty too high after 50% duration!");
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

fn calculate_lock_end(start: i64, duration: i64) -> Option<i64> {
    start.checked_add(duration)
}

fn check_can_unlock(lock_end: i64, current_time: i64) -> bool {
    current_time >= lock_end
}

fn calculate_time_remaining(lock_end: i64, current_time: i64) -> Option<i64> {
    if current_time >= lock_end {
        return Some(0);
    }
    lock_end.checked_sub(current_time)
}

fn calculate_early_unlock_penalty(lock_start: i64, lock_end: i64, current_time: i64) -> Option<u8> {
    if current_time >= lock_end {
        return Some(0);
    }
    
    if current_time <= lock_start {
        return Some(50); // Max penalty
    }
    
    let total_duration = lock_end.checked_sub(lock_start)?;
    let elapsed = current_time.checked_sub(lock_start)?;
    
    // Progress: 0.0 -> 1.0
    let progress = (elapsed as f64) / (total_duration as f64);
    
    // Penalty: 50% au début -> 0% à la fin
    let penalty = 50.0 * (1.0 - progress);
    
    Some(penalty as u8)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_lock_end() {
        let start = 1000;
        let duration = 7 * 86400; // 7 days
        let end = calculate_lock_end(start, duration).unwrap();
        assert_eq!(end, 1000 + 7 * 86400);
    }

    #[test]
    fn test_can_unlock() {
        let lock_end = 1000;
        assert!(!check_can_unlock(lock_end, 999));
        assert!(check_can_unlock(lock_end, 1000));
        assert!(check_can_unlock(lock_end, 1001));
    }

    #[test]
    fn test_time_remaining() {
        let lock_end = 1000;
        assert_eq!(calculate_time_remaining(lock_end, 900).unwrap(), 100);
        assert_eq!(calculate_time_remaining(lock_end, 1000).unwrap(), 0);
        assert_eq!(calculate_time_remaining(lock_end, 1100).unwrap(), 0);
    }

    #[test]
    fn test_early_unlock_penalty() {
        let start = 0;
        let end = 100;
        
        // Au début: 50% penalty
        assert_eq!(calculate_early_unlock_penalty(start, end, 0).unwrap(), 50);
        
        // Mi-chemin: ~25% penalty
        let mid_penalty = calculate_early_unlock_penalty(start, end, 50).unwrap();
        assert!(mid_penalty >= 24 && mid_penalty <= 26);
        
        // À la fin: 0% penalty
        assert_eq!(calculate_early_unlock_penalty(start, end, 100).unwrap(), 0);
        
        // Après expiration: 0% penalty
        assert_eq!(calculate_early_unlock_penalty(start, end, 150).unwrap(), 0);
    }

    #[test]
    fn test_penalty_monotonicity() {
        let start = 0;
        let end = 1000;
        
        let penalty_10 = calculate_early_unlock_penalty(start, end, 100).unwrap();
        let penalty_50 = calculate_early_unlock_penalty(start, end, 500).unwrap();
        let penalty_90 = calculate_early_unlock_penalty(start, end, 900).unwrap();
        
        // Penalty décroît avec le temps
        assert!(penalty_50 < penalty_10);
        assert!(penalty_90 < penalty_50);
    }
}
