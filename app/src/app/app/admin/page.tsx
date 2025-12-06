"use client";

import dynamic from "next/dynamic";

// Import SimpleAdminPanel with SSR disabled for wallet compatibility
const SimpleAdminPanel = dynamic(() => import("@/components/SimpleAdminPanel"), { ssr: false });

export default function AdminPage() {
  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4">
      <SimpleAdminPanel />
    </div>
  );
}
