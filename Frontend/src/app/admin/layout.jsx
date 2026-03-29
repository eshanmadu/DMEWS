import { AdminSidebar } from "@/components/AdminSidebar";

export const metadata = {
  title: "Admin | DMEWS",
  description: "Admin dashboard for risk, shelters, users, and volunteers.",
};

export default function AdminLayout({ children }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-sky-50/80 via-white to-sky-100/50">
      <div className="flex min-h-[calc(100vh-4rem)]">
        <AdminSidebar />
        <div className="flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
