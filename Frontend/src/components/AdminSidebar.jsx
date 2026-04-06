"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldAlert,
  Building2,
  Users,
  Heart,
  LayoutDashboard,
  ChevronRight,
  Siren,
  TriangleAlert,
  FileText,
  Boxes,
  UserSearch,
} from "lucide-react";
import clsx from "clsx";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/emergencies", label: "Emergencies", icon: Siren },
  { href: "/admin/create", label: "Create Alert", icon: TriangleAlert },
  { href: "/admin/list", label: "Alert List", icon: FileText },
  { href: "/admin/risk", label: "Risk management", icon: ShieldAlert },
  { href: "/admin/shelters", label: "Shelters", icon: Building2 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/volunteers", label: "Volunteers", icon: Heart },
  { href: "/admin/missions", label: "Missions", icon: Boxes },
  { href: "/admin/missing-persons", label: "Missing Persons", icon: UserSearch },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-full flex-col border-r border-sky-200/80 bg-gradient-to-b from-sky-700 via-sky-600 to-sky-700 text-sky-50 shadow-lg lg:w-56 lg:flex-shrink-0">
      <div className="p-4 lg:sticky lg:top-4">
        <Link
          href="/admin"
          className="mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          <LayoutDashboard className="h-5 w-5 text-sky-100" />
          Admin
        </Link>
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  isActive
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-sky-100/90 hover:bg-sky-500/40 hover:text-white"
                )}
              >
                <item.icon
                  className={clsx(
                    "h-4 w-4 flex-shrink-0",
                    isActive ? "text-white" : "text-sky-200"
                  )}
                />
                <span className="flex-1">{item.label}</span>
                <ChevronRight
                  className={clsx(
                    "h-4 w-4 flex-shrink-0",
                    isActive ? "text-white" : "text-sky-300/80"
                  )}
                />
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
