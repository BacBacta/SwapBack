#![no_std]
#![no_main]

use std::mem;

// Déclarer le program ID (sera changé durant le build)
solana_program::declare_id!("c5aEUgYctZv5Yh7fiTWN18jr6seP7KThJsRPmxs2kKR");

// Fonction d'entrée principale pour Solana
#[cfg(not(feature = "no-entrypoint"))]
pub mod entrypoint {
    use solana_program::{
        account_info::AccountInfo,
        entrypoint,
        entrypoint::ProgramResult,
        pubkey::Pubkey,
    };

    #[entrypoint]
    pub fn process_instruction(
        _program_id: &Pubkey,
        _accounts: &[AccountInfo],
        _instruction_data: &[u8],
    ) -> ProgramResult {
        // Pour maintenant, retourner OK
        // Les vraies instructions seront implémentées
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        assert_eq!(2 + 2, 4);
    }
}
