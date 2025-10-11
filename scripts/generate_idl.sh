#!/bin/bash

# Script pour générer les IDL des programmes SwapBack

set -e

echo "🔧 Génération des IDL pour SwapBack"
echo "==================================="

# Générer IDL basique pour swapback_router
cat > sdk/src/idl/swapback_router.json << 'EOF'
{
  "version": "0.1.0",
  "name": "swapback_router",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        {"name": "authority", "isMut": false, "isSigner": true},
        {"name": "global_state", "isMut": true, "isSigner": false},
        {"name": "treasury", "isMut": false, "isSigner": false},
        {"name": "system_program", "isMut": false, "isSigner": false}
      ],
      "args": [
        {"name": "rebate_percentage", "type": "u8"},
        {"name": "burn_percentage", "type": "u8"},
        {"name": "npi_threshold", "type": "u64"}
      ]
    },
    {
      "name": "simulate_route",
      "accounts": [
        {"name": "global_state", "isMut": false, "isSigner": false}
      ],
      "args": [
        {"name": "input_amount", "type": "u64"},
        {"name": "minimum_output_amount", "type": "u64"},
        {"name": "route_type", "type": {"defined": "RouteType"}}
      ]
    },
    {
      "name": "execute_swap",
      "accounts": [
        {"name": "global_state", "isMut": true, "isSigner": false},
        {"name": "user_rebate", "isMut": true, "isSigner": false},
        {"name": "user_authority", "isMut": false, "isSigner": true},
        {"name": "system_program", "isMut": false, "isSigner": false}
      ],
      "args": [
        {"name": "input_amount", "type": "u64"},
        {"name": "minimum_output_amount", "type": "u64"},
        {"name": "npi_amount", "type": "u64"}
      ]
    }
  ],
  "accounts": [
    {
      "name": "GlobalState",
      "type": {
        "kind": "struct",
        "fields": [
          {"name": "authority", "type": "publicKey"},
          {"name": "rebate_percentage", "type": "u8"},
          {"name": "burn_percentage", "type": "u8"},
          {"name": "npi_threshold", "type": "u64"},
          {"name": "treasury", "type": "publicKey"},
          {"name": "total_volume", "type": "u64"},
          {"name": "total_npi", "type": "u64"},
          {"name": "total_rebates", "type": "u64"},
          {"name": "bump", "type": "u8"}
        ]
      }
    }
  ],
  "types": [
    {
      "name": "RouteType",
      "type": {
        "kind": "enum",
        "variants": [
          {"name": "Direct"},
          {"name": "Aggregator"},
          {"name": "RFQ"},
          {"name": "Bundle"}
        ]
      }
    }
  ],
  "events": [
    {
      "name": "SwapExecuted",
      "fields": [
        {"name": "user", "type": "publicKey", "index": false},
        {"name": "input_amount", "type": "u64", "index": false},
        {"name": "output_amount", "type": "u64", "index": false},
        {"name": "npi_amount", "type": "u64", "index": false},
        {"name": "rebate_amount", "type": "u64", "index": false},
        {"name": "burn_amount", "type": "u64", "index": false},
        {"name": "timestamp", "type": "i64", "index": false}
      ]
    }
  ],
  "errors": [
    {"code": 6000, "name": "InvalidPercentages", "msg": "Les pourcentages doivent totaliser max 100%"},
    {"code": 6001, "name": "InvalidAmount", "msg": "Montant invalide"},
    {"code": 6002, "name": "Unauthorized", "msg": "Non autorisé"}
  ],
  "metadata": {
    "address": "8hKbg2aSxKRDAJnJdY8G1TNHQ8c7L9bXH7mQFgqX9cY"
  }
}
EOF

# Générer IDL basique pour swapback_buyback
cat > sdk/src/idl/swapback_buyback.json << 'EOF'
{
  "version": "0.1.0",
  "name": "swapback_buyback",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        {"name": "buyback_state", "isMut": true, "isSigner": false},
        {"name": "back_mint", "isMut": false, "isSigner": false},
        {"name": "usdc_vault", "isMut": true, "isSigner": false},
        {"name": "usdc_mint", "isMut": false, "isSigner": false},
        {"name": "authority", "isMut": true, "isSigner": true},
        {"name": "token_program", "isMut": false, "isSigner": false},
        {"name": "system_program", "isMut": false, "isSigner": false},
        {"name": "rent", "isMut": false, "isSigner": false}
      ],
      "args": [
        {"name": "min_buyback_amount", "type": "u64"}
      ]
    },
    {
      "name": "deposit_usdc",
      "accounts": [
        {"name": "buyback_state", "isMut": false, "isSigner": false},
        {"name": "source_usdc", "isMut": true, "isSigner": false},
        {"name": "usdc_vault", "isMut": true, "isSigner": false},
        {"name": "depositor", "isMut": false, "isSigner": true},
        {"name": "token_program", "isMut": false, "isSigner": false}
      ],
      "args": [
        {"name": "amount", "type": "u64"}
      ]
    },
    {
      "name": "execute_buyback",
      "accounts": [
        {"name": "buyback_state", "isMut": true, "isSigner": false},
        {"name": "usdc_vault", "isMut": true, "isSigner": false},
        {"name": "back_vault", "isMut": true, "isSigner": false},
        {"name": "authority", "isMut": false, "isSigner": true},
        {"name": "token_program", "isMut": false, "isSigner": false}
      ],
      "args": [
        {"name": "max_usdc_amount", "type": "u64"},
        {"name": "min_back_amount", "type": "u64"}
      ]
    }
  ],
  "accounts": [
    {
      "name": "BuybackState",
      "type": {
        "kind": "struct",
        "fields": [
          {"name": "authority", "type": "publicKey"},
          {"name": "back_mint", "type": "publicKey"},
          {"name": "usdc_vault", "type": "publicKey"},
          {"name": "min_buyback_amount", "type": "u64"},
          {"name": "total_usdc_spent", "type": "u64"},
          {"name": "total_back_burned", "type": "u64"},
          {"name": "buyback_count", "type": "u64"},
          {"name": "bump", "type": "u8"}
        ]
      }
    }
  ],
  "events": [
    {
      "name": "USDCDeposited",
      "fields": [
        {"name": "depositor", "type": "publicKey", "index": false},
        {"name": "amount", "type": "u64", "index": false},
        {"name": "timestamp", "type": "i64", "index": false}
      ]
    },
    {
      "name": "BuybackExecuted",
      "fields": [
        {"name": "usdc_amount", "type": "u64", "index": false},
        {"name": "back_amount", "type": "u64", "index": false},
        {"name": "timestamp", "type": "i64", "index": false}
      ]
    }
  ],
  "errors": [
    {"code": 7000, "name": "InvalidAmount", "msg": "Montant invalide"},
    {"code": 7001, "name": "InsufficientFunds", "msg": "Fonds insuffisants"},
    {"code": 7002, "name": "Unauthorized", "msg": "Non autorisé"}
  ],
  "metadata": {
    "address": "9hKbg2aSxKRDAJnJdY8G1TNHQ8c7L9bXH7mQFgqX9cZ"
  }
}
EOF

echo "✅ IDL générés avec succès"
echo "Fichiers créés:"
ls -lh sdk/src/idl/*.json