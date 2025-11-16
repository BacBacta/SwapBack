"use client";

import dynamic from "next/dynamic";

// Helper to safely load DCAClient with defensive error handling
async function loadDCAClient() {
  const module = await import("@/components/DCAClient");

  // Prefer named export, fallback to default export
  const DCAClient = module.DCAClient || module.default;

  if (!DCAClient) {
    throw new Error(
      'DCAClient component not found. Expected named export "DCAClient" or default export in @/components/DCAClient'
    );
  }

  return { default: DCAClient };
}

// Client-only DCA component with SSR disabled
const DCAClient = dynamic(loadDCAClient, {
  ssr: false,
  loading: () => (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
        <p className="text-gray-400 terminal-text">Loading DCA...</p>
      </div>
    </div>
  ),
});

export const DCA = () => {
  return <DCAClient />;
};
