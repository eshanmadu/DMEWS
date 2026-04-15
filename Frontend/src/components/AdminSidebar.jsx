"use client";

import { useEffect, useState } from "react";
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
  FileBarChart,
} from "lucide-react";
import clsx from "clsx";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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
  { href: "/admin/reports", label: "Reports", icon: FileBarChart },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [hasSosNotification, setHasSosNotification] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkSos() {
      if (typeof window === "undefined") return;
      const token = window.localStorage.getItem("dmews_token");
      if (!token) {
        if (!cancelled) setHasSosNotification(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/sos/admin/list`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = await res.json().catch(() => []);
        if (!res.ok || cancelled) return;
        const rows = Array.isArray(data) ? data : [];
        // Highlight when there is at least one unresolved SOS.
        const hasUnresolved = rows.some((r) => r?.status !== "resolved");
        setHasSosNotification(hasUnresolved);
      } catch {
        if (!cancelled) setHasSosNotification(false);
      }
    }

    checkSos();
    const id = window.setInterval(checkSos, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

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
                <span className="flex flex-1 items-center gap-2">
                  <span>{item.label}</span>
                  {item.href === "/admin/emergencies" && hasSosNotification && (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-white/30"
                      aria-label="New SOS notifications"
                      title="New SOS notifications"
                    />
                  )}
                </span>
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