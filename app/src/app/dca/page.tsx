"use client";

import { DCA } from "@/components/DCA";
import { PageHeader } from "@/components/BackButton";

export default function DCAPage() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 max-w-7xl 3xl:max-w-10xl 4xl:max-w-11xl mx-auto">
      <div className="mx-auto">
        <div className="mb-8">
          <PageHeader
            title="📊 Dollar Cost Averaging"
            description="Invest automatically at regular intervals to smooth out the purchase price"
            breadcrumbItems={[
              { label: "Home", href: "/" },
              { label: "DCA", href: "/dca" }
            ]}
            showBackButton={true}
          />
        </div>
        <div className="backdrop-blur-xl bg-[#10B981]/5 border-2 border-[#10B981]/30 rounded-2xl p-8 shadow-[0_0_30px_rgba(0,255,0,0.2)] transition-all hover:border-[#10B981]/50">
          <DCA />
        </div>
      </div>
    </div>
  );
}
