"use client";

import { DCA } from "@/components/DCA";
import { PageHeader } from "@/components/BackButton";

export default function DCAPage() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 max-w-7xl 3xl:max-w-9xl mx-auto">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          title="📊 Dollar Cost Averaging"
          description="Invest automatically at regular intervals to smooth out the purchase price"
          breadcrumbItems={[
            { label: "Home", href: "/" },
            { label: "DCA", href: "/dca" }
          ]}
          showBackButton={true}
        />
        <DCA />
      </div>
    </div>
  );
}
