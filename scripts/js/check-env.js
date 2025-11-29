#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Lire .env.local
const envPath = path.join(__dirname, 'app', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

console.log('\n📋 Variables d\'environnement dans .env.local:\n');

const backMintMatch = envContent.match(/NEXT_PUBLIC_BACK_MINT=(.+)/);
const usdcMintMatch = envContent.match(/NEXT_PUBLIC_USDC_MINT=(.+)/);

if (backMintMatch) {
  console.log('✅ NEXT_PUBLIC_BACK_MINT:', backMintMatch[1]);
} else {
  console.log('❌ NEXT_PUBLIC_BACK_MINT: NON TROUVÉ');
}

if (usdcMintMatch) {
  console.log('✅ NEXT_PUBLIC_USDC_MINT:', usdcMintMatch[1]);
} else {
  console.log('❌ NEXT_PUBLIC_USDC_MINT: NON TROUVÉ');
}

console.log('\n🔍 Vérification des adresses:');
console.log('BACK devrait être: 5UpRMH1xbHYsZdrYwjVab8cVN3QXJpFubCB5WXeB8i27');
console.log('USDC devrait être: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

if (backMintMatch && backMintMatch[1] === '5UpRMH1xbHYsZdrYwjVab8cVN3QXJpFubCB5WXeB8i27') {
  console.log('✅ BACK_MINT est correct');
} else {
  console.log('❌ BACK_MINT est incorrect ou manquant');
}

if (usdcMintMatch && usdcMintMatch[1] === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') {
  console.log('✅ USDC_MINT est correct');
} else {
  console.log('❌ USDC_MINT est incorrect ou manquant');
}

console.log('\n');
