#!/usr/bin/env tsx
/**
 * prepare-slippage-inputs.ts
 *
 * Generates slippage calculation inputs JSON.
 *
 * Usage:
 *   npx tsx scripts/prepare-slippage-inputs.ts \
 *     --liquidity 1000000000 \
 *     --volatility-bps 125 \
 *     --base-bps 50 \
 *     --min-bps 30 \
 *     --max-bps 500
 *
 * Output: JSON to stdout and tmp/slippage.json
 */

import * as fs from "fs";
import * as path from "path";
import Ajv from "ajv";

interface SlippageInputs {
  liquidity_estimate: number;
  volatility_bps: number;
  base_slippage_bps: number;
  min_slippage_bps: number;
  max_slippage_bps: number;
}

function parseArgs(): SlippageInputs & { output?: string } {
  const args = process.argv.slice(2);

  // Defaults
  let liquidity_estimate = 1000000000;
  let volatility_bps = 100;
  let base_slippage_bps = 50;
  let min_slippage_bps = 30;
  let max_slippage_bps = 500;
  let output: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--liquidity":
        liquidity_estimate = parseInt(args[++i], 10);
        break;
      case "--volatility-bps":
        volatility_bps = parseInt(args[++i], 10);
        break;
      case "--base-bps":
        base_slippage_bps = parseInt(args[++i], 10);
        break;
      case "--min-bps":
        min_slippage_bps = parseInt(args[++i], 10);
        break;
      case "--max-bps":
        max_slippage_bps = parseInt(args[++i], 10);
        break;
      case "--output":
        output = args[++i];
        break;
    }
  }

  return {
    liquidity_estimate,
    volatility_bps,
    base_slippage_bps,
    min_slippage_bps,
    max_slippage_bps,
    output,
  };
}

function main() {
  const {
    liquidity_estimate,
    volatility_bps,
    base_slippage_bps,
    min_slippage_bps,
    max_slippage_bps,
    output,
  } = parseArgs();

  // Validate ranges
  if (liquidity_estimate < 1) {
    console.error("❌ liquidity_estimate must be >= 1");
    process.exit(1);
  }

  if (volatility_bps < 0 || volatility_bps > 5000) {
    console.error("❌ volatility_bps must be in range [0, 5000]");
    process.exit(1);
  }

  if (base_slippage_bps < 0 || base_slippage_bps > 10000) {
    console.error("❌ base_slippage_bps must be in range [0, 10000]");
    process.exit(1);
  }

  if (min_slippage_bps < 0 || min_slippage_bps > 10000) {
    console.error("❌ min_slippage_bps must be in range [0, 10000]");
    process.exit(1);
  }

  if (max_slippage_bps < 0 || max_slippage_bps > 10000) {
    console.error("❌ max_slippage_bps must be in range [0, 10000]");
    process.exit(1);
  }

  if (min_slippage_bps > max_slippage_bps) {
    console.error("❌ min_slippage_bps must be <= max_slippage_bps");
    process.exit(1);
  }

  const result: SlippageInputs = {
    liquidity_estimate,
    volatility_bps,
    base_slippage_bps,
    min_slippage_bps,
    max_slippage_bps,
  };

  // Validate against schema
  const schemaPath = path.join(__dirname, "..", "schemas", "slippage_inputs.schema.json");
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

  const outputPath = output || path.join(__dirname, "..", "tmp", "slippage.json");
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, jsonOutput);

  console.log(jsonOutput);
}

main();
