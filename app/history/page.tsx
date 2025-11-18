import OnChainHistory from "@/components/OnChainHistory";

export const metadata = {
  title: "Transaction History | SwapBack",
  description: "View your complete on-chain transaction history",
};

export default function HistoryPage() {
  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <OnChainHistory />
      </div>
    </div>
  );
}
