"use client";

import dynamic from "next/dynamic";

// Import AdminConfigPanel with SSR disabled for wallet compatibility
const AdminConfigPanel = dynamic(() => import("@/components/AdminConfigPanel"), { ssr: false });

export default function ConfigPage() {
  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4">
      <AdminConfigPanel />
    </div>
  );
}
