"use client";

import dynamic from "next/dynamic";

const DCAClient = dynamic(() => import("@/components/DCAClient"), { ssr: false });

export default function DCAPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">DCA (Dollar-Cost Averaging)</h1>
        <p className="text-gray-400">Automate your token purchases over time</p>
      </div>
      <DCAClient />
    </div>
  );
}
