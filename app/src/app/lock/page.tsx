'use client';

import dynamic from 'next/dynamic';

// Client-only Lock page component
const LockPageClientDynamic = dynamic(
  () => import('@/components/LockPageClient').then(mod => ({ default: mod.LockPageClient })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
          <p className="text-gray-400 terminal-text">Chargement Lock...</p>
        </div>
      </div>
    ),
  }
);

export default function LockPage() {
  return <LockPageClientDynamic />;
}
