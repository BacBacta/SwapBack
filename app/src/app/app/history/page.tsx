import dynamic from "next/dynamic";

const OnChainHistoryWidget = dynamic(() => import("@/components/OnChainHistoryWidget"), { ssr: false });

export const dynamic = "force-dynamic";

export default function HistoryPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Transaction History</h1>
        <p className="text-gray-400">View all your past transactions</p>
      </div>
      <OnChainHistoryWidget />
    </div>
  );
}
