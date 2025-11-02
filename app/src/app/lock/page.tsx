'use client';

import dynamic from 'next/dynamic';

// Helper to safely load LockPageClient with defensive error handling
async function loadLockPageClient() {
  const module = await import('@/components/LockPageClient');

  // Prefer named export, fallback to default export
  const LockPageClient = module.LockPageClient || module.default;

  if (!LockPageClient) {
    throw new Error(
      'LockPageClient component not found. Expected named export "LockPageClient" or default export in @/components/LockPageClient'
    );
  }

  return { default: LockPageClient };
}

// Client-only Lock page component with SSR disabled
const LockPageClientDynamic = dynamic(loadLockPageClient, {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
        <p className="text-gray-400 terminal-text">Chargement Lock...</p>
      </div>
    </div>
  ),
});

export default function LockPage() {
  return <LockPageClientDynamic />;
}
