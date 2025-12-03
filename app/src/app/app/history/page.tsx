"use client";

import dynamic from "next/dynamic";

const OnChainHistoryWidget = dynamic(() => import("@/components/OnChainHistoryWidget"), { ssr: false });

export default function HistoryPage() {
  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4">
      <div className="mb-4 sm:mb-6 text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Transaction History</h1>
        <p className="text-gray-400 text-sm sm:text-base">View all your past transactions</p>
      </div>
      <OnChainHistoryWidget />
    </div>
  );
}
