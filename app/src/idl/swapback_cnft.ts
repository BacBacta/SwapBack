/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `swapback_cnft.json`.
 */
export type SwapbackCnft = {
  "address": "26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru",
  "metadata": {
    "name": "swapbackCnft",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Programme de gestion des compressed NFTs pour les niveaux SwapBack"
  },
  "instructions": [
    {
      "name": "initializeCollection",
      "discriminator": [
        112,
        62,
        53,
        139,
        173,
        152,
        98,
        93
      ],
      "accounts": [
        {
          "name": "collectionConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  101,
                  99,
                  116,
                  105,
                  111,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeGlobalState",
      "discriminator": [
        232,
        254,
        209,
        244,
        123,
        89,
        154,
        207
      ],
      "accounts": [
        {
          "name": "globalState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "mintLevelNft",
      "discriminator": [
        101,
        210,
        207,
        137,
        3,
        113,
        177,
        171
      ],
      "accounts": [
        {
          "name": "collectionConfig",
          "writable": true
        },
        {
          "name": "globalState",
          "writable": true
        },
        {
          "name": "userNft",
          "writable": true
        },
        {
          "name": "userTokenAccount",
          "writable": true
        },
        {
          "name": "vaultTokenAccount",
          "writable": true
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "backMint"
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amountLocked",
          "type": "u64"
        },
        {
          "name": "lockDuration",
          "type": "i64"
        }
      ]
    },
    {
      "name": "updateNftStatus",
      "discriminator": [
        231,
        58,
        220,
        50,
        152,
        42,
        231,
        232
      ],
      "accounts": [
        {
          "name": "userNft",
          "writable": true
        },
        {
          "name": "globalState",
          "writable": true
        },
        {
          "name": "userTokenAccount",
          "writable": true
        },
        {
          "name": "vaultTokenAccount",
          "writable": true
        },
        {
          "name": "vaultAuthority"
        },
        {
          "name": "backMint"
        },
        {
          "name": "user",
          "signer": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "collectionConfig",
      "discriminator": [
        143,
        119,
        195,
        147,
        78,
        50,
        81,
        6
      ]
    },
    {
      "name": "globalState",
      "discriminator": [
        77,
        149,
        19,
        53,
        70,
        111,
        0,
        78
      ]
    },
    {
      "name": "userNft",
      "discriminator": [
        52,
        223,
        203,
        213,
        65,
        63,
        136,
        235
      ]
    }
  ],
  "types": [
    {
      "name": "collectionConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "totalNftsMinted",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "globalState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "totalValueLocked",
            "type": "u64"
          },
          {
            "name": "activeLocksCount",
            "type": "u64"
          },
          {
            "name": "totalRewardsDistributed",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "lockLevel",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "bronze"
          },
          {
            "name": "silver"
          },
          {
            "name": "gold"
          },
          {
            "name": "platinum"
          },
          {
            "name": "diamond"
          }
        ]
      }
    },
    {
      "name": "userNft",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "level",
            "type": {
              "defined": {
                "name": "lockLevel"
              }
            }
          },
          {
            "name": "amountLocked",
            "type": "u64"
          },
          {
            "name": "lockTimestamp",
            "type": "i64"
          },
          {
            "name": "unlockTimestamp",
            "type": "i64"
          },
          {
            "name": "isActive",
            "type": "bool"
          }
        ]
      }
    }
  ]
};

export const IDL: SwapbackCnft = {
  "address": "26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru",
  "metadata": {
    "name": "swapbackCnft",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Programme de gestion des compressed NFTs pour les niveaux SwapBack"
  },
  "instructions": [
    {
      "name": "initializeCollection",
      "discriminator": [
        112,
        62,
        53,
        139,
        173,
        152,
        98,
        93
      ],
      "accounts": [
        {
          "name": "collectionConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  101,
                  99,
                  116,
                  105,
                  111,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeGlobalState",
      "discriminator": [
        232,
        254,
        209,
        244,
        123,
        89,
        154,
        207
      ],
      "accounts": [
        {
          "name": "globalState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "mintLevelNft",
      "discriminator": [
        101,
        210,
        207,
        137,
        3,
        113,
        177,
        171
      ],
      "accounts": [
        {
          "name": "collectionConfig",
          "writable": true
        },
        {
          "name": "globalState",
          "writable": true
        },
        {
          "name": "userNft",
          "writable": true
        },
        {
          "name": "userTokenAccount",
          "writable": true
        },
        {
          "name": "vaultTokenAccount",
          "writable": true
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "backMint"
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amountLocked",
          "type": "u64"
        },
        {
          "name": "lockDuration",
          "type": "i64"
        }
      ]
    },
    {
      "name": "updateNftStatus",
      "discriminator": [
        231,
        58,
        220,
        50,
        152,
        42,
        231,
        232
      ],
      "accounts": [
        {
          "name": "userNft",
          "writable": true
        },
        {
          "name": "globalState",
          "writable": true
        },
        {
          "name": "userTokenAccount",
          "writable": true
        },
        {
          "name": "vaultTokenAccount",
          "writable": true
        },
        {
          "name": "vaultAuthority"
        },
        {
          "name": "backMint"
        },
        {
          "name": "user",
          "signer": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "collectionConfig",
      "discriminator": [
        143,
        119,
        195,
        147,
        78,
        50,
        81,
        6
      ]
    },
    {
      "name": "globalState",
      "discriminator": [
        77,
        149,
        19,
        53,
        70,
        111,
        0,
        78
      ]
    },
    {
      "name": "userNft",
      "discriminator": [
        52,
        223,
        203,
        213,
        65,
        63,
        136,
        235
      ]
    }
  ],
  "types": [
    {
      "name": "collectionConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "totalNftsMinted",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "globalState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "totalValueLocked",
            "type": "u64"
          },
          {
            "name": "activeLocksCount",
            "type": "u64"
          },
          {
            "name": "totalRewardsDistributed",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "lockLevel",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "bronze"
          },
          {
            "name": "silver"
          },
          {
            "name": "gold"
          },
          {
            "name": "platinum"
          },
          {
            "name": "diamond"
          }
        ]
      }
    },
    {
      "name": "userNft",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "level",
            "type": {
              "defined": {
                "name": "lockLevel"
              }
            }
          },
          {
            "name": "amountLocked",
            "type": "u64"
          },
          {
            "name": "lockTimestamp",
            "type": "i64"
          },
          {
            "name": "unlockTimestamp",
            "type": "i64"
          },
          {
            "name": "isActive",
            "type": "bool"
          }
        ]
      }
    }
  ]
};
