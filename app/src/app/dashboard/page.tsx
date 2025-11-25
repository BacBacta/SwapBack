import { Dashboard } from "@/components/Dashboard";
import { Breadcrumb } from "@/components/BackButton";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl 3xl:max-w-10xl 4xl:max-w-11xl mx-auto">
        <div className="mb-6">
          <Breadcrumb 
            items={[
              { label: "Home", href: "/" },
              { label: "Dashboard", href: "/dashboard" }
            ]} 
          />
        </div>
        <Dashboard />
      </div>
    </div>
  );
}
