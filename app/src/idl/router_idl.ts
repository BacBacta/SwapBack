import { Idl } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

export const ROUTER_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID || "GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt"
);

// IDL complet avec instructions DCA
export const ROUTER_IDL = {
  address: ROUTER_PROGRAM_ID.toString(),
  metadata: {
    name: "swapback_router",
    version: "0.1.0",
    spec: "0.1.0",
  },
  version: "0.1.0",
  name: "swapback_router",
  instructions: [
    {
      name: "createDcaPlan",
      accounts: [
        { name: "dcaPlan", isMut: true, isSigner: false },
        { name: "state", isMut: false, isSigner: false },
        { name: "user", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "planId", type: { array: ["u8", 32] } },
        { name: "args", type: {
          defined: {
            name: "CreateDcaPlanArgs"
          }
        }},
      ],
    },
    {
      name: "executeDcaSwap",
      accounts: [
        { name: "dcaPlan", isMut: true, isSigner: false },
        { name: "state", isMut: true, isSigner: false },
        { name: "userTokenIn", isMut: true, isSigner: false },
        { name: "userTokenOut", isMut: true, isSigner: false },
        { name: "user", isMut: false, isSigner: false },
        { name: "executor", isMut: false, isSigner: true },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [],
    },
    {
      name: "pauseDcaPlan",
      accounts: [
        { name: "dcaPlan", isMut: true, isSigner: false },
        { name: "user", isMut: false, isSigner: true },
      ],
      args: [],
    },
    {
      name: "resumeDcaPlan",
      accounts: [
        { name: "dcaPlan", isMut: true, isSigner: false },
        { name: "user", isMut: false, isSigner: true },
      ],
      args: [],
    },
    {
      name: "cancelDcaPlan",
      accounts: [
        { name: "dcaPlan", isMut: true, isSigner: false },
        { name: "user", isMut: true, isSigner: true },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "DcaPlan",
      type: {
        kind: "struct",
        fields: [
          { name: "planId", type: { array: ["u8", 32] } },
          { name: "user", type: "publicKey" },
          { name: "tokenIn", type: "publicKey" },
          { name: "tokenOut", type: "publicKey" },
          { name: "amountPerSwap", type: "u64" },
          { name: "totalSwaps", type: "u32" },
          { name: "executedSwaps", type: "u32" },
          { name: "intervalSeconds", type: "i64" },
          { name: "nextExecution", type: "i64" },
          { name: "minOutPerSwap", type: "u64" },
          { name: "createdAt", type: "i64" },
          { name: "expiresAt", type: "i64" },
          { name: "isActive", type: "bool" },
          { name: "totalInvested", type: "u64" },
          { name: "totalReceived", type: "u64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "RouterState",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "publicKey" },
          { name: "rebatePercentage", type: "u16" },
          { name: "buybackPercentage", type: "u16" },
          { name: "protocolPercentage", type: "u16" },
          { name: "totalVolume", type: "u64" },
          { name: "totalRebatesPaid", type: "u64" },
          { name: "totalBuybackFromNpi", type: "u64" },
          { name: "totalProtocolRevenue", type: "u64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "UserRebate",
      type: {
        kind: "struct",
        fields: [
          { name: "user", type: "publicKey" },
          { name: "unclaimedRebate", type: "u64" },
          { name: "totalClaimed", type: "u64" },
          { name: "totalSwaps", type: "u64" },
          { name: "lastSwapTimestamp", type: "i64" },
          { name: "lastClaimTimestamp", type: "i64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
  ],
  types: [
    {
      name: "CreateDcaPlanArgs",
      type: {
        kind: "struct",
        fields: [
          { name: "tokenIn", type: "publicKey" },
          { name: "tokenOut", type: "publicKey" },
          { name: "amountPerSwap", type: "u64" },
          { name: "totalSwaps", type: "u32" },
          { name: "intervalSeconds", type: "i64" },
          { name: "minOutPerSwap", type: "u64" },
          { name: "expiresAt", type: "i64" },
        ],
      },
    },
  ],
  errors: [
    {
      code: 6000,
      name: "InvalidAmount",
      msg: "Amount per swap must be greater than 0",
    },
    {
      code: 6001,
      name: "InvalidSwapCount",
      msg: "Total swaps must be greater than 0",
    },
    {
      code: 6002,
      name: "TooManySwaps",
      msg: "Too many swaps (max 10,000)",
    },
    {
      code: 6003,
      name: "IntervalTooShort",
      msg: "Interval too short (min 1 hour)",
    },
    {
      code: 6004,
      name: "IntervalTooLong",
      msg: "Interval too long (max 1 year)",
    },
    {
      code: 6005,
      name: "InvalidExpiry",
      msg: "Expiry must be in the future",
    },
    {
      code: 6006,
      name: "PlanNotActive",
      msg: "DCA plan is not active",
    },
    {
      code: 6007,
      name: "PlanCompleted",
      msg: "DCA plan is already completed",
    },
    {
      code: 6008,
      name: "PlanExpired",
      msg: "DCA plan has expired",
    },
    {
      code: 6009,
      name: "NotReadyForExecution",
      msg: "Not ready for execution yet",
    },
    {
      code: 6010,
      name: "InsufficientBalance",
      msg: "Insufficient user balance",
    },
    {
      code: 6011,
      name: "SlippageExceeded",
      msg: "Slippage tolerance exceeded",
    },
    {
      code: 6012,
      name: "AlreadyPaused",
      msg: "DCA plan is already paused",
    },
    {
      code: 6013,
      name: "AlreadyActive",
      msg: "DCA plan is already active",
    },
  ],
} as Idl;
