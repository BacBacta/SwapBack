"use client";

import dynamic from "next/dynamic";

// Import SimpleLockCard with SSR disabled for wallet compatibility
const SimpleLockCard = dynamic(() => import("@/components/SimpleLockCard"), { ssr: false });

export default function LockPage() {
  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4">
      <SimpleLockCard />
    </div>
  );
}
