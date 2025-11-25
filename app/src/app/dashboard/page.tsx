import { Dashboard } from "@/components/Dashboard";
import { Breadcrumb } from "@/components/BackButton";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl 3xl:max-w-10xl 4xl:max-w-11xl mx-auto">
        <div className="mb-8">
          <Breadcrumb 
            items={[
              { label: "Home", href: "/" },
              { label: "Dashboard", href: "/dashboard" }
            ]} 
          />
        </div>
        <div className="backdrop-blur-xl bg-[#00FF00]/5 border-2 border-[#00FF00]/30 rounded-2xl p-8 shadow-[0_0_30px_rgba(0,255,0,0.2)] transition-all hover:border-[#00FF00]/50">
          <Dashboard />
        </div>
      </div>
    </div>
  );
}
