import { Users } from "lucide-react";

export const metadata = {
  title: "Users | Admin | DMEWS",
};

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Users
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage user accounts, roles, and permissions.
        </p>
      </div>
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center">
        <Users className="mb-4 h-12 w-12 text-slate-400" />
        <h2 className="text-lg font-semibold text-slate-700">Coming soon</h2>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          User management will be available here. You will be able to view, edit, and manage registered users.
        </p>
      </div>
    </div>
  );
}
