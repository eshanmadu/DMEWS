"use client";

import { useEffect, useMemo, useState } from "react";
import { PublicAlertsMap } from "@/components/PublicAlertsMap";
import MapLockFrame from "@/components/MapLockFrame";
import Loader from "@/components/Loader";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  MapPin,
  Clock3,
  ShieldAlert,
  Siren,
  TriangleAlert,
  FileText,
  RefreshCw,
  ArrowRight,
  BellRing,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const REFRESH_MS = 45000;
const HERO_BG = "/img/alert.png";
  

const severityStyles = {
  Low: {
    badge: "border-yellow-300 bg-yellow-100 text-yellow-900",
    card: "border-yellow-200 bg-white",
    accent: "from-yellow-100 to-amber-50",
    icon: "text-yellow-700",
  },
  Medium: {
    badge: "border-orange-300 bg-orange-100 text-orange-900",
    card: "border-orange-200 bg-white",
    accent: "from-orange-100 to-amber-50",
    icon: "text-orange-700",
  },
  High: {
    badge: "border-red-300 bg-red-100 text-red-900",
    card: "border-red-200 bg-white",
    accent: "from-red-100 to-rose-50",
    icon: "text-red-700",
  },
};

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AlertMetaPill({ icon: Icon, children }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
      <Icon className="h-3.5 w-3.5 text-slate-500" />
      <span>{children}</span>
    </div>
  );
}

function AlertCard({ alert, featured = false }) {
  const style = severityStyles[alert?.severity] || severityStyles.Medium;

  return (
    <article
      className={`group relative overflow-hidden rounded-3xl border ${style.card} shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl`}
    >
      <div className={`absolute inset-y-0 left-0 w-1.5 ${style.icon.replace("text", "bg")}`} />
      <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-r ${style.accent || "from-slate-100 to-slate-50"} opacity-70`} />

      <div className="relative p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className={`mt-0.5 rounded-2xl p-3 ${featured ? "bg-white shadow-sm" : "bg-slate-50"} ${style.icon}`}>
              <TriangleAlert className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 sm:text-xl">
                  {alert?.disasterType || "Disaster alert"}
                </h3>

                {featured && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-700">
                    <BellRing className="h-3.5 w-3.5" />
                    High priority
                  </span>
                )}
              </div>

              <p className="text-sm text-slate-600">
                {alert?.status === "Active" ? "Currently active" : alert?.status || "Status unavailable"}
              </p>
            </div>
          </div>

          <span
            className={`inline-flex shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${style.badge}`}
          >
            {alert?.severity || "—"} severity
          </span>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          <AlertMetaPill icon={MapPin}>
            {alert?.affectedArea || "Unknown area"}
          </AlertMetaPill>

          <AlertMetaPill icon={Clock3}>
            {formatDateTime(alert?.startTime)}
          </AlertMetaPill>

          <AlertMetaPill icon={Clock3}>
            Until {formatDateTime(alert?.expectedEndTime)}
          </AlertMetaPill>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white/95 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Alert summary
              </p>
              <p className="text-sm leading-7 text-slate-700">
                {alert?.description || "No description available."}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-emerald-700" />
                <p className="text-sm font-semibold text-slate-900">
                  Safety instructions
                </p>
              </div>
              <p className="text-sm leading-7 text-slate-700">
                {alert?.safetyInstructions || "Follow official instructions carefully."}
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-4">
            <div className={`rounded-2xl border p-4 ${featured ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Public impact
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {featured
                  ? "This alert requires immediate public attention. People in the affected area should monitor updates closely and prepare to act quickly if conditions worsen."
                  : "This alert remains active for the affected area. People nearby should stay informed and follow official guidance."}
              </p>
            </div>

            <Link
              href={`/alerts/${alert?._id}`}
              className={`inline-flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition group-hover:shadow-md ${
                featured
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-slate-900 hover:bg-slate-800"
              }`}
            >
              <span>View Live Details</span>
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function extractDistrictFromArea(area = "") {
  const text = String(area).trim();
  if (!text) return "";

  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);

  const districtPart = parts.find((part) =>
    part.toLowerCase().includes("district")
  );

  if (districtPart) {
    return districtPart.replace(/district/i, "").trim();
  }

  return parts[0] || "";
}

export default function AlertsPage() {
  const { i18n } = useTranslation();
  const si = String(i18n.language || "").startsWith("si");
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [districtFilter, setDistrictFilter] = useState("All");

  async function loadAlerts(isRefresh = false) {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const res = await fetch(`${API_BASE}/alerts`, {
        cache: "no-store",
      });

      const text = await res.text();

      let data;
      try {
        data = text ? JSON.parse(text) : [];
      } catch {
        throw new Error(si ? "පසුබිම් සේවයෙන් JSON දත්ත බලාපොරොත්තු විය." : "Expected JSON from backend.");
      }

      if (!res.ok) {
        setError(data?.message || (si ? "අනතුරු ඇඟවීම් පූරණය කිරීමට අසමත් විය." : "Failed to load alerts."));
        return;
      }

      setAlerts(Array.isArray(data) ? data : []);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      setError(err?.message || (si ? "අනතුරු ඇඟවීම් පූරණය කිරීමට අසමත් විය." : "Failed to load alerts."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadAlerts(false);

    const timer = setInterval(() => {
      loadAlerts(true);
    }, REFRESH_MS);

    return () => clearInterval(timer);
  }, []);

  const activeAlerts = useMemo(() => {
    return alerts
      .filter((alert) => alert?.status === "Active")
      .sort((a, b) => {
        const rank = { High: 3, Medium: 2, Low: 1 };
        const bySeverity = (rank[b?.severity] || 0) - (rank[a?.severity] || 0);
        if (bySeverity !== 0) return bySeverity;
        return new Date(b?.createdAt).getTime() - new Date(a?.createdAt).getTime();
      });
  }, [alerts]);

  const affectedAreas = useMemo(() => {
  const extractedDistricts = activeAlerts
    .map((alert) => extractDistrictFromArea(alert?.affectedArea))
    .filter(Boolean);

  return [...new Set(extractedDistricts)];
}, [activeAlerts]);

  const districtOptions = useMemo(() => {
    return [si ? "සියල්ල" : "All", ...affectedAreas];
  }, [affectedAreas]);

  const visibleAlerts = useMemo(() => {
  if (districtFilter === "All" || districtFilter === "සියල්ල") return activeAlerts;

  return activeAlerts.filter((alert) => {
    const district = extractDistrictFromArea(alert?.affectedArea);
    return district.toLowerCase() === String(districtFilter).toLowerCase();
  });
}, [activeAlerts, districtFilter]);

  const highAlerts = visibleAlerts.filter((a) => a?.severity === "High");
  const otherAlerts = visibleAlerts.filter((a) => a?.severity !== "High");

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-slate-200/80 bg-white/80 shadow-sm">
          <Loader />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <section
        className="relative isolate overflow-hidden border-b border-red-900/20"
        aria-labelledby="alerts-hero-title"
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${HERO_BG})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-rose-950/88 via-slate-900/85 to-orange-900/80" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-rose-100">
                <Siren className="h-3.5 w-3.5" aria-hidden />
                {si ? "සජීවී මහජන ආරක්ෂක යාවත්කාලීන" : "Live public safety updates"}
              </p>
              <h1
                id="alerts-hero-title"
                className="mt-5 font-oswald text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
              >
                {si ? "සක්‍රීය ආපදා අනතුරු ඇඟවීම්" : "Active Disaster Alerts"}
              </h1>
              <p className="mt-4 max-w-2xl text-lg text-rose-100/95 sm:text-xl">
                {si
                  ? "දැනට පවතින අනතුරු ඇඟවීම්, බලපෑමට ලක් වූ ප්‍රදේශ සහ නිල ආරක්ෂක උපදෙස් පිළිබඳව දැනුවත් වන්න."
                  : "Stay informed about current public warnings, affected areas, and official safety instructions."}
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href="#alerts-list"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3.5 text-sm font-bold text-sky-950 shadow-lg shadow-black/20 transition hover:bg-amber-300"
                >
                  {si ? "අනතුරු ඇඟවීම් බලන්න" : "View alerts"}
                </a>
                <div className="inline-flex items-center gap-2 rounded-xl border-2 border-white/40 bg-white/10 px-5 py-3.5 text-sm font-semibold text-white backdrop-blur-sm">
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  <span>
                    {si ? "අවසන් යාවත්කාලීන කිරීම:" : "Last updated:"}{" "}
                    {lastUpdated ? formatDateTime(lastUpdated) : "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/15 px-4 py-4 backdrop-blur-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-white/80">
                  {si ? "සක්‍රීය අනතුරු ඇඟවීම්" : "Active alerts"}
                </p>
                <p className="mt-2 text-3xl font-bold text-white">{visibleAlerts.length}</p>
              </div>

              <div className="rounded-2xl bg-white/15 px-4 py-4 backdrop-blur-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-white/80">
                  {si ? "ඉහළ බරපතළත්වය" : "High severity"}
                </p>
                <p className="mt-2 text-3xl font-bold text-white">{highAlerts.length}</p>
              </div>

              <div className="rounded-2xl bg-white/15 px-4 py-4 backdrop-blur-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-white/80">
                  {si ? "බලපෑමට ලක් වූ ප්‍රදේශ" : "Areas affected"}
                </p>
                <p className="mt-2 text-3xl font-bold text-white">{affectedAreas.length}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div id="alerts-list" className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">

        {error && (
        <div className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
          <MapPin className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">{si ? "දිස්ත්‍රික් පෙරණය" : "District filter"}</h2>
        </div>

        <div className="p-4">
          <select
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200 sm:max-w-sm"
          >
            {districtOptions.map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>
        </div>
      </section>

        <MapLockFrame className="w-full">
          <PublicAlertsMap
            alerts={activeAlerts}
            selectedDistrict={districtFilter}
            onSelectDistrict={setDistrictFilter}
          />
        </MapLockFrame>

        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
          <MapPin className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">{si ? "බලපෑමට ලක් වූ ප්‍රදේශ" : "Affected areas"}</h2>
          <p className="text-xs text-slate-500">{si ? "දැනට බලපෑමට ලක් වූ දිස්ත්‍රික්ක" : "Currently impacted districts"}</p>
        </div>

        <div className="p-4">
          {affectedAreas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-sm text-slate-500">
              {si ? "පෙන්වීමට බලපෑමට ලක් වූ ප්‍රදේශ නොමැත." : "No affected areas to show."}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {affectedAreas.map((area) => {
                const selected = districtFilter === area;
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setDistrictFilter(area)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      selected
                        ? "border-red-300 bg-red-50 text-red-800"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {area}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

        {visibleAlerts.length === 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <AlertTriangle className="mx-auto h-10 w-10 text-emerald-600" />
            <h2 className="mt-4 text-xl font-semibold text-slate-900">
              {si ? "දැනට සක්‍රීය අනතුරු ඇඟවීම් නොමැත" : "No active alerts right now"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {si
                ? "තෝරාගත් දිස්ත්‍රික්කය සඳහා දැනට සක්‍රීය මහජන ආපදා අනතුරු ඇඟවීම් නොමැත."
                : "There are currently no active public disaster warnings for the selected district."}
            </p>
          </section>
        ) : (
          <>
            {highAlerts.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Siren className="h-5 w-5 text-red-600" />
                  <h2 className="text-xl font-bold text-slate-900">
                    {si ? "ඉහළ ප්‍රමුඛතා අනතුරු ඇඟවීම්" : "High Priority Alerts"}
                  </h2>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  {highAlerts.map((alert) => (
                    <AlertCard key={alert._id} alert={alert} featured />
                  ))}
                </div>
              </section>
            )}

            {otherAlerts.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-slate-600" />
                  <h2 className="text-xl font-bold text-slate-900">
                    {si ? "අනෙකුත් සක්‍රීය අනතුරු ඇඟවීම්" : "Other Active Alerts"}
                  </h2>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  {otherAlerts.map((alert) => (
                    <AlertCard key={alert._id} alert={alert} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}