import dynamic from "next/dynamic";
import Link from "next/link";
import { fetchAlerts, fetchIncidents, fetchPersonReports, fetchRiskLevels } from "@/lib/api";
import {
  AlertTriangle,
  Activity,
  Building2,
  UserSearch,
  ShieldAlert,
  TrendingUp,
  MapPin,
  Clock,
  Bell,
  Flame,
  Zap,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const AdminSosSummary = dynamic(
  () =>
    import("@/components/AdminSosSummary").then((m) => ({
      default: m.AdminSosSummary,
    })),
  { ssr: false, loading: () => null }
);

export const metadata = {
  title: "Admin Dashboard | Admin | DMEWS",
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const ALL_DISTRICTS = [
  "Colombo",
  "Gampaha",
  "Kalutara",
  "Kandy",
  "Matale",
  "Nuwara Eliya",
  "Galle",
  "Matara",
  "Hambantota",
  "Jaffna",
  "Kilinochchi",
  "Mannar",
  "Vavuniya",
  "Mullaitivu",
  "Batticaloa",
  "Ampara",
  "Trincomalee",
  "Kurunegala",
  "Puttalam",
  "Anuradhapura",
  "Polonnaruwa",
  "Badulla",
  "Monaragala",
  "Ratnapura",
  "Kegalle",
];

async function fetchShelters() {
  try {
    const res = await fetch(`${API_BASE}/shelters`, { cache: "no-store" });
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function SeverityBadge({ severity }) {
  const c =
    severity === "critical"
      ? "badge-critical"
      : severity === "warning"
        ? "badge-warning"
        : severity === "watch"
          ? "badge-info"
          : "badge-success";
  return <span className={`badge ${c} !rounded-full !px-3 !py-1 !text-xs !font-medium shadow-sm`}>{severity}</span>;
}

function StatusBadge({ status }) {
  const c =
    status === "resolved"
      ? "badge-success"
      : status === "responding"
        ? "badge-info"
        : status === "assessing"
          ? "badge-warning"
          : "badge-critical";
  return <span className={`badge ${c} !rounded-full !px-3 !py-1 !text-xs !font-medium shadow-sm`}>{status}</span>;
}

function safeRelativeTime(isoLike) {
  try {
    const d = new Date(isoLike);
    if (Number.isNaN(d.getTime())) return null;
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return null;
  }
}

function RiskBar({ label, value, total, color, gradient }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="font-mono text-xs font-medium text-slate-500">
          {value} ({pct}%)
        </span>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner">
        <div
          className={`h-full ${color} ${gradient} transition-all duration-500 ease-out`}
          style={{ width: `${pct}%` }}
          aria-label={`${label} risk distribution ${pct}%`}
        />
      </div>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const [alerts, incidents, personReports, riskLevels, shelters] = await Promise.all([
    fetchAlerts(),
    fetchIncidents(),
    fetchPersonReports(),
    fetchRiskLevels(),
    fetchShelters(),
  ]);

  const activeCriticalAlerts = alerts.filter((a) => a.severity === "critical").length;
  const activeWarningAlerts =
    alerts.filter((a) => a.severity === "warning" || a.severity === "watch").length;

  const openIncidents = incidents.filter((i) => i.status !== "resolved");
  const openIncidentsCount = openIncidents.length;

  const riskByLevel = {
    safe: 0,
    low: 0,
    medium: 0,
    high: 0,
  };
  const districtLevelMap = new Map();
  (riskLevels || []).forEach((r) => {
    if (r?.district && r?.level) districtLevelMap.set(r.district, r.level);
  });
  ALL_DISTRICTS.forEach((district) => {
    const lvl = districtLevelMap.get(district) || "safe";
    if (lvl in riskByLevel) riskByLevel[lvl] += 1;
  });
  const riskTotal = ALL_DISTRICTS.length;

  const highRiskDistricts = ALL_DISTRICTS
    .filter((district) => (districtLevelMap.get(district) || "safe") === "high")
    .slice(0, 6);

  const missingCasesCount = Array.isArray(personReports?.missing) ? personReports.missing.length : 0;
  const foundCasesCount = Array.isArray(personReports?.found) ? personReports.found.length : 0;

  const recentAlerts = [...(alerts || [])]
    .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())
    .slice(0, 1);

  const recentIncidents = [...(incidents || [])]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    .slice(0, 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100/40">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {/* Header Section with gradient accent */}
        <div className="flex flex-col gap-4 rounded-2xl bg-white/50 p-6 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h1 className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
              Admin Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Real-time overview of alerts, incidents, missing cases, and risk metrics
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/risk"
              className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <ShieldAlert className="h-4 w-4 transition-transform group-hover:rotate-3" />
              Risk management
              <span className="absolute inset-0 -z-10 bg-gradient-to-r from-indigo-500 to-indigo-600 opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
            <Link
              href="/admin/risk-prediction"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
            >
              <Sparkles className="h-4 w-4" />
              Risk prediction
            </Link>
            <Link
              href="/admin/shelters"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-300"
            >
              <Building2 className="h-4 w-4 text-sky-600" />
              Shelters
            </Link>
          </div>
        </div>

        <AdminSosSummary />

        {/* KPI Cards - Modern gradient & glass morphism */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          <div className="group relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-white to-red-50/50 p-5 shadow-md transition-all duration-300 hover:shadow-xl">
            <div className="absolute -right-12 -top-12 h-24 w-24 rounded-full bg-red-100/60 blur-2xl transition-all group-hover:bg-red-200/70" />
            <div className="flex items-start justify-between">
              <div className="rounded-xl bg-gradient-to-br from-red-500 to-red-600 p-2.5 shadow-md">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700 backdrop-blur-sm">Critical</span>
            </div>
            <div className="mt-4">
              <div className="text-4xl font-extrabold tracking-tight text-slate-800">
                {activeCriticalAlerts}
              </div>
              <div className="mt-1 text-sm font-medium text-slate-500">Active critical alerts</div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-white to-amber-50/50 p-5 shadow-md transition-all duration-300 hover:shadow-xl">
            <div className="absolute -right-12 -top-12 h-24 w-24 rounded-full bg-amber-100/60 blur-2xl transition-all group-hover:bg-amber-200/70" />
            <div className="flex items-start justify-between">
              <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 p-2.5 shadow-md">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700 backdrop-blur-sm">Warning</span>
            </div>
            <div className="mt-4">
              <div className="text-4xl font-extrabold tracking-tight text-slate-800">
                {activeWarningAlerts}
              </div>
              <div className="mt-1 text-sm font-medium text-slate-500">Warning + Watch alerts</div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-white to-sky-50/50 p-5 shadow-md transition-all duration-300 hover:shadow-xl">
            <div className="absolute -right-12 -top-12 h-24 w-24 rounded-full bg-sky-100/60 blur-2xl transition-all group-hover:bg-sky-200/70" />
            <div className="flex items-start justify-between">
              <div className="rounded-xl bg-gradient-to-br from-sky-500 to-blue-500 p-2.5 shadow-md">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-700 backdrop-blur-sm">Open</span>
            </div>
            <div className="mt-4">
              <div className="text-4xl font-extrabold tracking-tight text-slate-800">
                {openIncidentsCount}
              </div>
              <div className="mt-1 text-sm font-medium text-slate-500">Recent Incidents</div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-white to-emerald-50/50 p-5 shadow-md transition-all duration-300 hover:shadow-xl">
            <div className="absolute -right-12 -top-12 h-24 w-24 rounded-full bg-emerald-100/60 blur-2xl transition-all group-hover:bg-emerald-200/70" />
            <div className="flex items-start justify-between">
              <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 p-2.5 shadow-md">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 backdrop-blur-sm">Shelters</span>
            </div>
            <div className="mt-4">
              <div className="text-4xl font-extrabold tracking-tight text-slate-800">
                {shelters.length}
              </div>
              <div className="mt-1 text-sm font-medium text-slate-500">Registered evacuation shelters</div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-white to-violet-50/80 p-5 shadow-md transition-all duration-300 hover:shadow-xl">
            <div className="absolute -right-12 -top-12 h-24 w-24 rounded-full bg-violet-200/60 blur-2xl transition-all group-hover:bg-violet-300/70" />
            <div className="flex items-start justify-between">
              <div className="rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 p-2.5 shadow-md">
                <UserSearch className="h-5 w-5 text-white" />
              </div>
              <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700 backdrop-blur-sm">Cases</span>
            </div>
            <div className="mt-4">
              <div className="text-4xl font-extrabold tracking-tight text-slate-800">
                {missingCasesCount}
              </div>
              <div className="mt-1 text-sm font-medium text-slate-500">
                Missing cases · {foundCasesCount} found reports
              </div>
            </div>
          </div>
        </div>

        {/* Risk distribution + high-risk list */}
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <div className="h-full rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-sm transition-all hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Risk level distribution</h2>
                  <p className="mt-1 text-sm text-slate-500">Admin-set district risk levels overview</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Total districts: {riskTotal || 0}
                </span>
              </div>

              <div className="mt-6 space-y-5">
                <RiskBar
                  label="Safe"
                  value={riskByLevel.safe}
                  total={riskTotal}
                  color="bg-emerald-500"
                  gradient="bg-gradient-to-r from-emerald-400 to-emerald-500"
                />
                <RiskBar
                  label="Low"
                  value={riskByLevel.low}
                  total={riskTotal}
                  color="bg-amber-400"
                  gradient="bg-gradient-to-r from-amber-300 to-amber-400"
                />
                <RiskBar
                  label="Medium"
                  value={riskByLevel.medium}
                  total={riskTotal}
                  color="bg-orange-500"
                  gradient="bg-gradient-to-r from-orange-400 to-orange-500"
                />
                <RiskBar
                  label="High"
                  value={riskByLevel.high}
                  total={riskTotal}
                  color="bg-red-500"
                  gradient="bg-gradient-to-r from-red-500 to-rose-500"
                />
              </div>
            </div>
          </section>

          <section>
            <div className="h-full rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-sm transition-all hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">High risk focus</h2>
                  <p className="mt-1 text-sm text-slate-500">Top high-risk districts</p>
                </div>
                <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                  {riskByLevel.high}
                </span>
              </div>

              <div className="mt-5 space-y-2.5">
                {highRiskDistricts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                    <ShieldAlert className="mb-2 h-8 w-8 text-slate-300" />
                    <span className="text-sm text-slate-400">No high-risk districts currently set</span>
                  </div>
                ) : (
                  highRiskDistricts.map((d) => (
                    <div
                      key={d}
                      className="group flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3 transition-all hover:border-red-200 hover:bg-red-50/30 hover:shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-red-400" />
                        <span className="font-medium text-slate-700">{d}</span>
                      </div>
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700 shadow-sm">
                        High
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Recent alerts & incidents */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-sm transition-all hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Recent alerts</h2>
                  <p className="mt-1 text-sm text-slate-500">Latest issued early warnings</p>
                </div>
                <Link
                  href="/alerts"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 transition-all hover:gap-2 hover:text-indigo-700"
                >
                  View all
                  <Bell className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="mt-5 space-y-3">
                {recentAlerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                    <Zap className="mb-2 h-8 w-8 text-slate-300" />
                    <span className="text-sm text-slate-400">No alerts found</span>
                  </div>
                ) : (
                  recentAlerts.map((a) => (
                    <article
                      key={a.id}
                      className="group rounded-xl border border-slate-100 bg-white p-4 transition-all duration-200 hover:border-indigo-100 hover:bg-indigo-50/20 hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <SeverityBadge severity={a.severity} />
                            <span className="text-xs font-semibold text-slate-400">
                              {a.area || "—"}
                            </span>
                          </div>
                          <h3 className="mt-2 text-sm font-semibold text-slate-800 line-clamp-1">
                            {a.title || a.type || "Untitled"}
                          </h3>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                            {a.description || "No description provided"}
                          </p>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-1 text-[11px] text-slate-400">
                          <Clock className="h-3 w-3" />
                          {safeRelativeTime(a.issuedAt) || "—"}
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
              {alerts.length > 1 ? (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <Link
                    href="/alerts"
                    className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    See more ({alerts.length - 1} more)
                  </Link>
                </div>
              ) : null}
            </div>
          </section>

          <section>
            <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-sm transition-all hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Recent incidents</h2>
                  <p className="mt-1 text-sm text-slate-500">Response progress and status</p>
                </div>
                <Link
                  href="/incidents"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 transition-all hover:gap-2 hover:text-indigo-700"
                >
                  View all
                  <Flame className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="mt-5 space-y-3">
                {recentIncidents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                    <Activity className="mb-2 h-8 w-8 text-slate-300" />
                    <span className="text-sm text-slate-400">No incidents found</span>
                  </div>
                ) : (
                  recentIncidents.map((i) => (
                    <article
                      key={i.id}
                      className="group rounded-xl border border-slate-100 bg-white p-4 transition-all duration-200 hover:border-amber-100 hover:bg-amber-50/20 hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={i.status} />
                            <span className="text-xs font-semibold text-slate-400">
                              {i.area || "—"}
                            </span>
                          </div>
                          <h3 className="mt-2 text-sm font-semibold text-slate-800 line-clamp-1">
                            {i.title || i.type || "Untitled"}
                          </h3>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                            {i.description || "No description provided"}
                          </p>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-1 text-[11px] text-slate-400">
                          <Clock className="h-3 w-3" />
                          {safeRelativeTime(i.updatedAt) || "—"}
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
              {incidents.length > 1 ? (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <Link
                    href="/incidents"
                    className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    See more ({incidents.length - 1} more)
                  </Link>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}