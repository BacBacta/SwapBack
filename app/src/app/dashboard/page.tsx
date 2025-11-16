import { Dashboard } from "@/components/Dashboard";
import { Breadcrumb } from "@/components/BackButton";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Breadcrumb 
            items={[
              { label: "Accueil", href: "/" },
              { label: "Dashboard", href: "/dashboard" }
            ]} 
          />
        </div>
        <Dashboard />
      </div>
    </div>
  );
}
