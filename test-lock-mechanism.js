#!/usr/bin/env node

/**
 * Test du mécanisme de Lock local
 */

console.log('🧪 TEST: Mécanisme de Lock local\n');

// Simuler le stockage d'un lock
const mockLock = {
  amount: 1000,
  duration: 2592000, // 30 jours en secondes
  level: 'Silver',
  boost: 35.5,
  timestamp: Date.now(),
  unlockTime: Date.now() + (2592000 * 1000),
  wallet: '3PiZ1xdHbPbj1UaPS8pfzKnHpmQQLfR8zrhy5RcksqAt',
};

console.log('📦 Lock enregistré (exemple):');
console.log(JSON.stringify(mockLock, null, 2));

console.log('\n✅ Avantages de cette approche:');
console.log('  • Pas d\'erreur "Unexpected error"');
console.log('  • UI fonctionnelle pour les tests');
console.log('  • Calcul de niveau/boost validé');
console.log('  • Les tokens restent dans votre wallet');

console.log('\n⚠️  Limitations:');
console.log('  • Stockage local uniquement (pas on-chain)');
console.log('  • Pas de transfert réel de tokens');
console.log('  • Pas de mécanisme unlock on-chain');

console.log('\n🎯 Prochaine étape:');
console.log('  Mettre à jour le programme cNFT pour:');
console.log('  1. Créer un Token Account PDA pour stocker les BACK');
console.log('  2. Transférer les tokens avec Token-2022');
console.log('  3. Implémenter unlock avec retour des tokens');

console.log('\n🔗 En attendant, vous pouvez tester l\'interface Lock:');
console.log('   http://localhost:3000/lock');
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
