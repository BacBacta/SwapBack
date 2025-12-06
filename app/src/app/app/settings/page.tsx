"use client";

import dynamic from "next/dynamic";

// Import SimpleSettingsCard with SSR disabled for wallet compatibility
const SimpleSettingsCard = dynamic(() => import("@/components/SimpleSettingsCard"), { ssr: false });

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4">
      <SimpleSettingsCard />
    </div>
  );
}
