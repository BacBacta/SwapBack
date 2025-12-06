"use client";

import dynamic from "next/dynamic";

// Import SimpleRebatesCard with SSR disabled for wallet compatibility
const SimpleRebatesCard = dynamic(() => import("@/components/SimpleRebatesCard"), { ssr: false });

export default function MyRebatesPage() {
  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4">
      <SimpleRebatesCard />
    </div>
  );
}
