"use client";

import { DCA } from "@/components/DCA";
import { PageHeader } from "@/components/BackButton";

export default function DCAPage() {
  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          title="📊 Dollar Cost Averaging"
          description="Investissez automatiquement à intervalles réguliers pour lisser le prix d'achat"
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
