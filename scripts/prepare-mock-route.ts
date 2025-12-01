#!/usr/bin/env tsx
/**
 * prepare-mock-route.ts
 *
 * Generates a mock keeper route JSON using SPL token transfer instruction.
 * This simulates Jupiter swap instruction data for offline testing.
 *
 * Usage:
 *   npx tsx scripts/prepare-mock-route.ts --from <pubkey> --to <pubkey> --authority <pubkey> --amount <u64>
 *
 * Output: JSON to stdout (and optionally to tmp/keeper_route.json)
 */

import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import Ajv from "ajv";

// Parse CLI arguments
function parseArgs(): {
  from: string;
  to: string;
  authority: string;
  amount: bigint;
  output?: string;
} {
  const args = process.argv.slice(2);
  let from = "";
  let to = "";
  let authority = "";
  let amount = BigInt(0);
  let output: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--from":
        from = args[++i];
        break;
      case "--to":
        to = args[++i];
        break;
      case "--authority":
        authority = args[++i];
        break;
      case "--amount":
        amount = BigInt(args[++i]);
        break;
      case "--output":
        output = args[++i];
        break;
    }
  }

  // Defaults for testing
  if (!from) from = "7nYUqxrLEDYjBxAUjKpVQ8Dwn4wGxPjPHhMGvMPKPxKP";
  if (!to) to = "8xYUqxrLEDYjBxAUjKpVQ8Dwn4wGxPjPHhMGvMPKPxKQ";
  if (!authority) authority = "9aYUqxrLEDYjBxAUjKpVQ8Dwn4wGxPjPHhMGvMPKPxKR";
  if (amount === BigInt(0)) amount = BigInt(1000000000);

  return { from, to, authority, amount, output };
}

// Create SPL Token transfer instruction data (mock swap)
function createTransferInstructionData(amount: bigint): Buffer {
  // SPL Token Transfer instruction layout:
  // - instruction index: 3 (transfer)
  // - amount: u64 (8 bytes, little-endian)
  const buffer = Buffer.alloc(9);
  buffer.writeUInt8(3, 0); // Transfer instruction = 3
  buffer.writeBigUInt64LE(amount, 1);
  return buffer;
}

interface AccountMeta {
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
}

interface KeeperRoute {
  program_id: string;
  ix_data: string;
  remaining_accounts: AccountMeta[];
}

function main() {
  const { from, to, authority, amount, output } = parseArgs();

  // Validate pubkeys
  try {
    new PublicKey(from);
    new PublicKey(to);
    new PublicKey(authority);
  } catch {
    console.error("❌ Invalid public key format");
    process.exit(1);
  }

  // Create instruction data
  const ixData = createTransferInstructionData(amount);
  const ixDataBase64 = ixData.toString("base64");

  // Build remaining_accounts in correct order for SPL Token transfer:
  // [0] Token Program (program to invoke)
  // [1] Source ATA (writable)
  // [2] Destination ATA (writable)
  // [3] Authority (signer)
  const remainingAccounts: AccountMeta[] = [
    { pubkey: TOKEN_PROGRAM_ID.toBase58(), isSigner: false, isWritable: false },
    { pubkey: from, isSigner: false, isWritable: true },
    { pubkey: to, isSigner: false, isWritable: true },
    { pubkey: authority, isSigner: true, isWritable: false },
  ];

  const result: KeeperRoute = {
    program_id: TOKEN_PROGRAM_ID.toBase58(),
    ix_data: ixDataBase64,
    remaining_accounts: remainingAccounts,
  };

  // Load and validate against schema
  const schemaPath = path.join(__dirname, "..", "schemas", "keeper_route.schema.json");
  if (fs.existsSync(schemaPath)) {
    const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
    const ajv = new Ajv();
    const validate = ajv.compile(schema);
    if (!validate(result)) {
      console.error("❌ Schema validation failed:", validate.errors);
      process.exit(1);
    }
  }

  // Output
  const jsonOutput = JSON.stringify(result, null, 2);

  // Write to file if output specified or default to tmp/
  const outputPath = output || path.join(__dirname, "..", "tmp", "keeper_route.json");
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, jsonOutput);

  // Also print to stdout
  console.log(jsonOutput);
}

main();
