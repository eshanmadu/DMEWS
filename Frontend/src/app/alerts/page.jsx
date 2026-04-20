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
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const REFRESH_MS = 45000;
const HERO_BG = "/img/alert.png";
  

const severityStyles = {
  Low: {
    badge: "border-yellow-300/60 bg-yellow-300/20 text-yellow-900",
    card: "border-yellow-200 bg-yellow-50/40",
    icon: "text-yellow-700",
  },
  Medium: {
    badge: "border-orange-400/60 bg-orange-400/20 text-orange-900",
    card: "border-orange-200 bg-orange-50/40",
    icon: "text-orange-700",
  },
  High: {
    badge: "border-red-500/60 bg-red-500/20 text-red-900",
    card: "border-red-300 bg-red-50/60",
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

function AlertCard({ alert, featured = false }) {
  const { i18n } = useTranslation();
  const si = String(i18n.language || "").startsWith("si");
  const style = severityStyles[alert?.severity] || severityStyles.Medium;

  return (
    <article
      className={`overflow-hidden rounded-2xl border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        featured ? `${style.card} ring-1 ring-red-200/70 animate-pulse` : style.card
      }`}
    >
      <div
        className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${
          featured ? "bg-white/70" : "bg-white/60"
        }`}
      >
        <div className="flex items-center gap-2">
          <TriangleAlert className={`h-5 w-5 ${style.icon}`} />
          <h3 className="text-base font-semibold text-slate-900">
            {alert?.disasterType || (si ? "ආපදා අනතුරු ඇඟවීම" : "Disaster alert")}
          </h3>
        </div>

        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${style.badge}`}
        >
          {alert?.severity || "—"} {si ? "බරපතළත්වය" : "severity"}
        </span>
      </div>

      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
          <div className="inline-flex items-center gap-2">
            <MapPin className="h-4 w-4 text-slate-400" />
            <span className="font-medium">{alert?.affectedArea || "—"}</span>
          </div>

          <div className="inline-flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-slate-400" />
            <span>
              {formatDateTime(alert?.startTime)} — {formatDateTime(alert?.expectedEndTime)}
            </span>
          </div>
        </div>

        <p className="text-sm leading-6 text-slate-700">
          {alert?.description || (si ? "විස්තරයක් නොමැත." : "No description available.")}
        </p>

        <div className="rounded-xl border border-slate-200/80 bg-white/70 p-4">
          <div className="mb-2 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-700" />
            <p className="text-sm font-semibold text-slate-900">{si ? "ආරක්ෂක උපදෙස්" : "Safety instructions"}</p>
          </div>
          <p className="text-sm leading-6 text-slate-700">
            {alert?.safetyInstructions || (si ? "නිල උපදෙස් සැලකිල්ලෙන් අනුගමනය කරන්න." : "Follow official instructions carefully.")}
          </p>
        </div>

        {featured && (
          <div className="rounded-xl border border-red-200 bg-red-100/70 px-3 py-2 text-sm font-medium text-red-800">
            {si ? "මෙම ප්‍රදේශය සඳහා වහාම අවධානය අවශ්‍යයි." : "Immediate attention recommended for this area."}
          </div>
        )}
      </div>
      <Link
        href={`/alerts/${alert?._id}`}
        className="inline-flex w-center items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        {si ? "සජීවී විස්තර බලන්න" : "View Live Details"}
      </Link>
    </article>
    
  );
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
    return [...new Set(activeAlerts.map((a) => a?.affectedArea).filter(Boolean))];
  }, [activeAlerts]);

  const districtOptions = useMemo(() => {
    return [si ? "සියල්ල" : "All", ...affectedAreas];
  }, [affectedAreas]);

  const visibleAlerts = useMemo(() => {
    if (districtFilter === "All" || districtFilter === "සියල්ල") return activeAlerts;
    return activeAlerts.filter((alert) => alert?.affectedArea === districtFilter);
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