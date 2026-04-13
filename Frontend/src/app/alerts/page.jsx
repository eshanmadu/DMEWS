"use client";

import { useEffect, useMemo, useState } from "react";
import { PublicAlertsMap } from "@/components/PublicAlertsMap";
import Loader from "@/components/Loader";
import Link from "next/link";
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
            {alert?.disasterType || "Disaster alert"}
          </h3>
        </div>

        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${style.badge}`}
        >
          {alert?.severity || "—"} severity
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
          {alert?.description || "No description available."}
        </p>

        <div className="rounded-xl border border-slate-200/80 bg-white/70 p-4">
          <div className="mb-2 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-700" />
            <p className="text-sm font-semibold text-slate-900">Safety instructions</p>
          </div>
          <p className="text-sm leading-6 text-slate-700">
            {alert?.safetyInstructions || "Follow official instructions carefully."}
          </p>
        </div>

        {featured && (
          <div className="rounded-xl border border-red-200 bg-red-100/70 px-3 py-2 text-sm font-medium text-red-800">
            Immediate attention recommended for this area.
          </div>
        )}
      </div>
      <Link
        href={`/alerts/${alert?._id}`}
        className="inline-flex w-center items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        View Live Details
      </Link>
    </article>
    
  );
}

export default function AlertsPage() {
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
        throw new Error("Expected JSON from backend.");
      }

      if (!res.ok) {
        setError(data?.message || "Failed to load alerts.");
        return;
      }

      setAlerts(Array.isArray(data) ? data : []);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      setError(err?.message || "Failed to load alerts.");
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
    return ["All", ...affectedAreas];
  }, [affectedAreas]);

  const visibleAlerts = useMemo(() => {
    if (districtFilter === "All") return activeAlerts;
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
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-3xl border border-red-200/70 bg-gradient-to-r from-red-600 via-amber-500 to-orange-500 text-white shadow-lg">
        <div className="flex flex-col gap-6 px-6 py-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-medium">
              <Siren className="h-4 w-4" />
              Live public safety updates
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Active Disaster Alerts
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/90 sm:text-base">
              Stay informed about current public warnings, affected areas, and official safety instructions.
            </p>

            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm text-white/95">
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              <span>
                Last updated: {lastUpdated ? formatDateTime(lastUpdated) : "—"}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/15 px-4 py-4 backdrop-blur-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-white/80">
                Active alerts
              </p>
              <p className="mt-2 text-3xl font-bold">{visibleAlerts.length}</p>
            </div>

            <div className="rounded-2xl bg-white/15 px-4 py-4 backdrop-blur-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-white/80">
                High severity
              </p>
              <p className="mt-2 text-3xl font-bold">{highAlerts.length}</p>
            </div>

            <div className="rounded-2xl bg-white/15 px-4 py-4 backdrop-blur-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-white/80">
                Areas affected
              </p>
              <p className="mt-2 text-3xl font-bold">{affectedAreas.length}</p>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
          <MapPin className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">District filter</h2>
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

            <PublicAlertsMap
        alerts={activeAlerts}
        selectedDistrict={districtFilter}
        onSelectDistrict={setDistrictFilter}
      />

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
          <MapPin className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">Affected areas</h2>
          <p className="text-xs text-slate-500">Currently impacted districts</p>
        </div>

        <div className="p-4">
          {affectedAreas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-sm text-slate-500">
              No affected areas to show.
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
            No active alerts right now
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            There are currently no active public disaster warnings for the selected district.
          </p>
        </section>
      ) : (
        <>
          {highAlerts.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Siren className="h-5 w-5 text-red-600" />
                <h2 className="text-xl font-bold text-slate-900">High Priority Alerts</h2>
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
                <h2 className="text-xl font-bold text-slate-900">Other Active Alerts</h2>
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
  );
}