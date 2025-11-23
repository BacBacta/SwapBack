#!/usr/bin/env tsx

import '../app/src/lib/patchBN';
import { BN as AnchorBN } from '@coral-xyz/anchor';
import BNjs from 'bn.js';

type BNConstructor = typeof AnchorBN;

type TestCase = {
  label: string;
  ctor: BNConstructor;
};

const cases: TestCase[] = [
  { label: 'anchor re-export', ctor: AnchorBN },
  { label: 'direct bn.js import', ctor: BNjs },
];

const payloads = [
  { label: 'Buffer.alloc(0)', value: Buffer.alloc(0) },
  { label: 'new Uint8Array(0)', value: new Uint8Array(0) },
];

const verbose = process.argv.includes('--verbose');
let failures = 0;

console.log('\n[BNGuard] Replaying empty-buffer inputs to capture potential regressions');

for (const { label, ctor } of cases) {
  for (const { label: payloadLabel, value } of payloads) {
    const description = `${label} :: ${payloadLabel}`;
    process.stdout.write(` - ${description} ... `);
    try {
      const instance = new ctor(value as unknown as number[] | Buffer, 10, 'be');
      console.log(`ok (value=${instance.toString()} )`);
    } catch (error) {
      failures += 1;
      console.error('FAILED');
      if (verbose && error instanceof Error) {
        console.error(error.stack ?? error.message);
      }
    }
  }
}

if (failures > 0) {
  console.error(`\n[BNGuard] ${failures} scenario(s) failed. Capture complete.`);
  process.exitCode = 1;
} else {
  console.log('\n[BNGuard] All scenarios passed. Guard is active in both contexts.');
}
