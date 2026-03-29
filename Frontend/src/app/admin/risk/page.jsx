import { AdminRiskManagement } from "@/components/AdminRiskManagement";

export const metadata = {
  title: "Risk management | Admin | DMEWS",
};

export default function AdminRiskPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Risk management
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          View last 3 days rainfall and set district risk levels. Changes apply
          to the public map and alerts.
        </p>
      </div>
      <AdminRiskManagement />
    </div>
  );
}

