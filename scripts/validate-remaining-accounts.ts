#!/usr/bin/env tsx
/**
 * validate-remaining-accounts.ts
 *
 * Validates a keeper route JSON file against the schema.
 * Checks structure, pubkey format, and account ordering.
 *
 * Usage:
 *   npx tsx scripts/validate-remaining-accounts.ts --file <path>
 *
 * Exit codes:
 *   0 = valid
 *   1 = invalid
 */

import * as fs from "fs";
import * as path from "path";
import { PublicKey } from "@solana/web3.js";
import Ajv from "ajv";

function parseArgs(): { file: string } {
  const args = process.argv.slice(2);
  let file = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file") {
      file = args[++i];
    }
  }

  if (!file) {
    file = path.join(__dirname, "..", "tmp", "keeper_route.json");
  }

  return { file };
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

function validatePubkey(pubkey: string): boolean {
  try {
    new PublicKey(pubkey);
    return true;
  } catch {
    return false;
  }
}

function main() {
  const { file } = parseArgs();

  // Check file exists
  if (!fs.existsSync(file)) {
    console.error(`❌ File not found: ${file}`);
    process.exit(1);
  }

  // Parse JSON
  let data: KeeperRoute;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (e) {
    console.error(`❌ Invalid JSON: ${e}`);
    process.exit(1);
  }

  // Load schema
  const schemaPath = path.join(__dirname, "..", "schemas", "keeper_route.schema.json");
  if (!fs.existsSync(schemaPath)) {
    console.error(`❌ Schema not found: ${schemaPath}`);
    process.exit(1);
  }

  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
  const ajv = new Ajv();
  const validate = ajv.compile(schema);

  if (!validate(data)) {
    console.error("❌ Schema validation failed:");
    for (const err of validate.errors || []) {
      console.error(`  - ${err.instancePath}: ${err.message}`);
    }
    process.exit(1);
  }

  // Additional semantic validations

  // 1. Validate program_id is valid pubkey
  if (!validatePubkey(data.program_id)) {
    console.error(`❌ Invalid program_id: ${data.program_id}`);
    process.exit(1);
  }

  // 2. Validate all pubkeys in remaining_accounts
  for (let i = 0; i < data.remaining_accounts.length; i++) {
    const acc = data.remaining_accounts[i];
    if (!validatePubkey(acc.pubkey)) {
      console.error(`❌ Invalid pubkey at remaining_accounts[${i}]: ${acc.pubkey}`);
      process.exit(1);
    }
  }

  // 3. Validate ix_data is valid base64
  try {
    const decoded = Buffer.from(data.ix_data, "base64");
    if (decoded.length === 0) {
      console.error("❌ ix_data decodes to empty buffer");
      process.exit(1);
    }
  } catch (e) {
    console.error(`❌ Invalid base64 ix_data: ${e}`);
    process.exit(1);
  }

  // 4. Check that first account matches program_id (convention)
  if (data.remaining_accounts.length > 0) {
    const firstAccount = data.remaining_accounts[0];
    if (firstAccount.pubkey === data.program_id && firstAccount.isWritable) {
      console.warn("⚠️  Warning: program account should not be writable");
    }
  }

  // 5. Check at least one writable account exists (required for transfers)
  const hasWritable = data.remaining_accounts.some((a) => a.isWritable);
  if (!hasWritable) {
    console.warn("⚠️  Warning: no writable accounts in remaining_accounts");
  }

  console.log(`✅ Validation passed: ${file}`);
  process.exit(0);
}

main();
