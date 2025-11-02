"use client";

import dynamic from "next/dynamic";

// Client-only DCA component with SSR disabled
const DCAClient = dynamic(() => import("@/components/DCAClient"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
        <p className="text-gray-400 terminal-text">Chargement DCA...</p>
      </div>
    </div>
  ),
});

export const DCA = () => {
  return <DCAClient />;
};
