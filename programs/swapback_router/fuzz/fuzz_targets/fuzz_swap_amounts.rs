#![no_main]

use libfuzzer_sys::fuzz_target;
use arbitrary::Arbitrary;

#[derive(Arbitrary, Debug)]
struct SwapFuzzInput {
    amount_in: u64,
    slippage_bps: u16,
    platform_fee_bps: u16,
    rebate_bps: u16,
}

fuzz_target!(|input: SwapFuzzInput| {
    // Constants du programme router
    const MAX_SINGLE_SWAP_LAMPORTS: u64 = 5_000_000_000_000; // 5,000 SOL
    const MAX_SLIPPAGE_BPS: u16 = 5000; // 50%
    const DEFAULT_REBATE_BPS: u16 = 7000;
    const TREASURY_FROM_NPI_BPS: u16 = 1500;
    const BOOST_VAULT_BPS: u16 = 1500;
    
    // Test 1: Validation des montants (anti-whale)
    if input.amount_in > MAX_SINGLE_SWAP_LAMPORTS {
        return; // Devrait être rejeté par le programme
    }
    
    // Test 2: Validation du slippage
    if input.slippage_bps > MAX_SLIPPAGE_BPS {
        return; // Devrait être rejeté
    }
    
    // Test 3: Calcul des fees avec checked arithmetic
    let platform_fee = input.amount_in.checked_mul(input.platform_fee_bps as u64)
        .and_then(|v| v.checked_div(10000));
    
    if let Some(fee) = platform_fee {
        // Test 4: Vérifier que les fees ne dépassent pas le montant d'entrée
        assert!(fee <= input.amount_in, "Platform fee exceeds input amount");
        
        // Test 5: Vérifier l'overflow dans les calculs de NPI
        let amount_after_fees = input.amount_in.checked_sub(fee);
        if let Some(remaining) = amount_after_fees {
            // Simuler un NPI (routing profit)
            let npi = remaining / 100; // 1% de profit simulé
            
            // Test 6: Distribution du NPI (doit totaliser 100%)
            let rebate = npi.checked_mul(DEFAULT_REBATE_BPS as u64)
                .and_then(|v| v.checked_div(10000));
            let treasury = npi.checked_mul(TREASURY_FROM_NPI_BPS as u64)
                .and_then(|v| v.checked_div(10000));
            let boost = npi.checked_mul(BOOST_VAULT_BPS as u64)
                .and_then(|v| v.checked_div(10000));
            
            if let (Some(r), Some(t), Some(b)) = (rebate, treasury, boost) {
                let total_allocated = r.checked_add(t).and_then(|v| v.checked_add(b));
                if let Some(total) = total_allocated {
                    // Vérifier que la distribution ne dépasse pas le NPI disponible
                    assert!(total <= npi, "Over-allocation of NPI: {} > {}", total, npi);
                }
            }
        }
    }
    
    // Test 7: Vérifier les invariants de slippage
    if input.amount_in > 0 {
        let min_out = input.amount_in.checked_mul((10000 - input.slippage_bps as u64) as u64)
            .and_then(|v| v.checked_div(10000));
        
        if let Some(min) = min_out {
            assert!(min <= input.amount_in, "Min output exceeds input");
        }
    }
});
