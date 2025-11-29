#!/usr/bin/env node
/**
 * Test simple pour vérifier que l'IDL CNFT a les instructions lock_tokens et unlock_tokens
 */

const fs = require('fs');
const path = require('path');

const idlPath = path.join(__dirname, 'app/src/idl/swapback_cnft.json');
const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

console.log('🔍 Checking IDL instructions...');
console.log(`\n📋 Total instructions: ${idl.instructions.length}\n`);

// List all instructions
idl.instructions.forEach((instr, idx) => {
  console.log(`${idx + 1}. ${instr.name}`);
});

// Check for lock_tokens
const lockTokensInstruction = idl.instructions.find(i => i.name === 'lock_tokens');
if (lockTokensInstruction) {
  console.log('\n✅ FOUND: lock_tokens instruction');
  console.log(`   Args: ${lockTokensInstruction.args.map(a => a.name).join(', ')}`);
  console.log(`   Accounts: ${lockTokensInstruction.accounts.map(a => a.name).join(', ')}`);
} else {
  console.log('\n❌ NOT FOUND: lock_tokens instruction');
  process.exit(1);
}

// Check for unlock_tokens
const unlockTokensInstruction = idl.instructions.find(i => i.name === 'unlock_tokens');
if (unlockTokensInstruction) {
  console.log('\n✅ FOUND: unlock_tokens instruction');
  console.log(`   Args: ${unlockTokensInstruction.args.map(a => a.name).join(', ') || '(none)'}`);
  console.log(`   Accounts: ${unlockTokensInstruction.accounts.map(a => a.name).join(', ')}`);
} else {
  console.log('\n❌ NOT FOUND: unlock_tokens instruction');
  process.exit(1);
}

console.log('\n✅ All required instructions are present in the IDL!');
