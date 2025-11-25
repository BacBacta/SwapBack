#![no_main]

use libfuzzer_sys::fuzz_target;
use arbitrary::Arbitrary;

#[derive(Arbitrary, Debug)]
struct BuybackFuzzInput {
    usdc_amount: u64,
    back_amount_out: u64,
    min_back_expected: u64,
    slippage_bps: u16,
    burn_ratio_bps: u16,
}

fuzz_target!(|input: BuybackFuzzInput| {
    const MAX_SLIPPAGE_BPS: u16 = 5000; // 50%
    const EXPECTED_BURN_RATIO: u16 = 10000; // 100% burn model
    
    // Test 1: Validation du slippage
    if input.slippage_bps > MAX_SLIPPAGE_BPS {
        return; // Devrait être rejeté
    }
    
    // Test 2: Vérifier que le burn_ratio est correct (100%)
    if input.burn_ratio_bps != EXPECTED_BURN_RATIO {
        return; // Le programme n'accepte que 100% burn
    }
    
    // Test 3: Calculer le min_back_expected à partir du slippage
    if input.usdc_amount > 0 {
        let expected_min = input.usdc_amount
            .checked_mul((10000 - input.slippage_bps) as u64)
            .and_then(|v| v.checked_div(10000));
        
        if let Some(min_expected) = expected_min {
            // Test 4: Vérifier que back_amount_out respecte le minimum
            if input.back_amount_out < input.min_back_expected {
                return; // Devrait échouer avec InvalidBackReceived
            }
            
            // Test 5: Calculer les montants après burn
            // Dans le modèle 100% burn, tous les tokens vont au burn
            let burn_amount = input.back_amount_out
                .checked_mul(EXPECTED_BURN_RATIO as u64)
                .and_then(|v| v.checked_div(10000));
            
            if let Some(burned) = burn_amount {
                // Test 6: Vérifier que le burn ne dépasse pas le montant reçu
                assert!(burned <= input.back_amount_out, 
                    "Burn amount {} exceeds back received {}", burned, input.back_amount_out);
                
                // Test 7: Dans le modèle 100%, tout devrait être brûlé
                assert_eq!(burned, input.back_amount_out,
                    "100% burn model: burned {} != received {}", burned, input.back_amount_out);
            }
        }
    }
    
    // Test 8: Vérifier les invariants de montants
    if input.back_amount_out > 0 {
        // Le montant USDC dépensé devrait être raisonnable par rapport au BACK reçu
        // (dans un vrai swap, on s'attend à une certaine fourchette de prix)
        // Pour ce test, on vérifie juste qu'il n'y a pas d'overflow
        let ratio = input.back_amount_out.checked_div(input.usdc_amount.max(1));
        if let Some(r) = ratio {
            // Le ratio ne devrait pas être astronomique (protection contre les bugs)
            assert!(r < 1_000_000, "Suspicious price ratio: {}", r);
        }
    }
    
    // Test 9: Vérifier la cohérence du slippage avec les montants
    if input.min_back_expected > 0 && input.back_amount_out > 0 {
        // Le montant reçu devrait être >= au minimum attendu
        if input.back_amount_out >= input.min_back_expected {
            // Calculer le slippage effectif
            let diff = input.back_amount_out.saturating_sub(input.min_back_expected);
            let effective_slippage_bps = diff.checked_mul(10000)
                .and_then(|v| v.checked_div(input.back_amount_out));
            
            if let Some(eff_slip) = effective_slippage_bps {
                // Le slippage effectif ne devrait pas dépasser le slippage configuré
                assert!(eff_slip <= input.slippage_bps as u64,
                    "Effective slippage {} > configured {}", eff_slip, input.slippage_bps);
            }
        }
    }
});
