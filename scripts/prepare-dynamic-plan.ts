#!/usr/bin/env tsx
/**
 * prepare-dynamic-plan.ts
 *
 * Generates a dynamic venue routing plan JSON.
 *
 * Usage:
 *   npx tsx scripts/prepare-dynamic-plan.ts --venues Jupiter:7000 Orca:3000 [--mode fail|renormalize]
 *
 * Options:
 *   --venues: Space-separated list of Venue:Weight pairs (weight in BPS)
 *   --mode: "fail" to error if sum != 10000, "renormalize" to adjust (default)
 *   --output: Output file path (default: tmp/dynamic_plan.json)
 */

import * as fs from "fs";
import * as path from "path";
import Ajv from "ajv";

const VALID_VENUES = ["Jupiter", "Orca", "Raydium", "Meteora", "Phoenix", "Lifinity", "OpenBook"];

function parseArgs(): {
  venues: Array<{ venue_type: string; weight_bps: number }>;
  mode: "fail" | "renormalize";
  output?: string;
} {
  const args = process.argv.slice(2);
  const venues: Array<{ venue_type: string; weight_bps: number }> = [];
  let mode: "fail" | "renormalize" = "renormalize";
  let output: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--venues":
        // Consume all venue:weight pairs until next flag
        i++;
        while (i < args.length && !args[i].startsWith("--")) {
          const [venue, weightStr] = args[i].split(":");
          if (venue && weightStr) {
            venues.push({
              venue_type: venue,
              weight_bps: parseInt(weightStr, 10),
            });
          }
          i++;
        }
        i--; // Back up one since loop will increment
        break;
      case "--mode":
        mode = args[++i] as "fail" | "renormalize";
        break;
      case "--output":
        output = args[++i];
        break;
    }
  }

  // Defaults for testing
  if (venues.length === 0) {
    venues.push({ venue_type: "Jupiter", weight_bps: 7000 });
    venues.push({ venue_type: "Orca", weight_bps: 3000 });
  }

  return { venues, mode, output };
}

function renormalizeWeights(
  venues: Array<{ venue_type: string; weight_bps: number }>
): Array<{ venue_type: string; weight_bps: number }> {
  // Filter out zero weights
  const filtered = venues.filter((v) => v.weight_bps > 0);
  if (filtered.length === 0) return [];

  const sum = filtered.reduce((acc, v) => acc + v.weight_bps, 0);
  if (sum === 0) return [];

  // Scale weights to sum to 10000
  let acc = 0;
  const result: Array<{ venue_type: string; weight_bps: number }> = [];

  for (let i = 0; i < filtered.length; i++) {
    if (i === filtered.length - 1) {
      // Last entry gets remainder
      result.push({
        venue_type: filtered[i].venue_type,
        weight_bps: 10000 - acc,
      });
    } else {
      const scaled = Math.floor((filtered[i].weight_bps * 10000) / sum);
      result.push({
        venue_type: filtered[i].venue_type,
        weight_bps: scaled,
      });
      acc += scaled;
    }
  }

  return result;
}

interface DynamicPlan {
  venues: Array<{ venue_type: string; weight_bps: number }>;
  total_weight_bps: number;
}

function main() {
  const { venues, mode, output } = parseArgs();

  // Validate venue types
  for (const v of venues) {
    if (!VALID_VENUES.includes(v.venue_type)) {
      console.error(`❌ Invalid venue type: ${v.venue_type}`);
      console.error(`   Valid venues: ${VALID_VENUES.join(", ")}`);
      process.exit(1);
    }
    if (v.weight_bps < 0 || v.weight_bps > 10000) {
      console.error(`❌ Invalid weight for ${v.venue_type}: ${v.weight_bps} (must be 0-10000)`);
      process.exit(1);
    }
  }

  // Check sum
  const sum = venues.reduce((acc, v) => acc + v.weight_bps, 0);

  let finalVenues = venues;
  if (sum !== 10000) {
    if (mode === "fail") {
      console.error(`❌ Weight sum is ${sum}, expected 10000`);
      process.exit(1);
    } else {
      // Renormalize
      console.warn(`⚠️  Weight sum is ${sum}, renormalizing to 10000`);
      finalVenues = renormalizeWeights(venues);
    }
  }

  const result: DynamicPlan = {
    venues: finalVenues,
    total_weight_bps: finalVenues.reduce((acc, v) => acc + v.weight_bps, 0),
  };

  // Validate against schema
  const schemaPath = path.join(__dirname, "..", "schemas", "dynamic_plan.schema.json");
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

  const outputPath = output || path.join(__dirname, "..", "tmp", "dynamic_plan.json");
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, jsonOutput);

  console.log(jsonOutput);
}

main();
