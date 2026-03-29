"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Loader from "@/components/Loader";
import { format } from "date-fns";
import {
  AlertTriangle,
  Bell,
  Calendar,
  MapPin,
  ShieldAlert,
  CheckCircle2,
  XCircle,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Severity badge component with Tailwind styling
function SeverityBadge({ severity }) {
  let bgColor = "bg-gray-100 text-gray-800";
  let label = severity;

  switch (severity?.toLowerCase()) {
    case "critical":
      bgColor = "bg-red-100 text-red-800";
      break;
    case "warning":
      bgColor = "bg-amber-100 text-amber-800";
      break;
    case "watch":
      bgColor = "bg-blue-100 text-blue-800";
      break;
    default:
      bgColor = "bg-green-100 text-green-800";
      label = severity || "info";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${bgColor}`}
    >
      {label}
    </span>
  );
}

// Safe date formatter (prevents crashes)
function safeFormat(dateValue) {
  if (!dateValue) return "Unknown time";

  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return "Invalid date";

  return format(date, "PPp");
}

// Safety guidelines for alerts (similar to SheltersPage Do's/Don'ts)
const ALERT_DOS = [
  "Stay tuned to official channels (DisasterWatch, local radio) for updates.",
  "Prepare an emergency kit with essentials (medicines, documents, water).",
  "Follow instructions from authorities immediately.",
  "Check on neighbours, especially the elderly or those with disabilities.",
  "Keep mobile phones charged and have backup power sources ready.",
  "If evacuation is advised, move early to avoid traffic or blocked routes.",
];

const ALERT_DONTS = [
  "Do not ignore official warnings – they are issued for your safety.",
  "Do not spread rumours or unverified information.",
  "Do not put yourself at risk by taking unnecessary photos or videos.",
  "Do not wait until the last moment to act; take pre‑emptive steps.",
  "Do not use elevators during power outages or flooding.",
  "Do not return to evacuated areas until declared safe.",
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/alerts`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch alerts");
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setAlerts(data);
        else if (data.alerts && Array.isArray(data.alerts)) setAlerts(data.alerts);
        else throw new Error("Invalid response format");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="relative mb-12 overflow-hidden rounded-2xl bg-gradient-to-r from-rose-700 via-rose-600 to-rose-700 shadow-lg">
        <div className="relative z-10 px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:gap-6 sm:text-left">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 shadow-sm">
              <Bell className="h-8 w-8 text-amber-300" />
            </div>
            <div>
              <h1 className="font-oswald text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Early Warnings & Alerts
              </h1>
              <p className="mt-2 max-w-2xl text-rose-100">
                Active advisories and early warning notifications from official
                sources.
              </p>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 bg-black/5" />
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[280px] items-center justify-center">
          <Loader />
        </div>
      ) : (
        <div className="space-y-12">
          {/* Alerts List */}
          <section>
            <div className="mb-5 flex items-center gap-2">
              <div className="rounded-full bg-rose-100 p-2">
                <AlertTriangle className="h-5 w-5 text-rose-700" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-800">
                Active Alerts
              </h2>
            </div>

            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
                <Bell className="mb-4 h-12 w-12 text-slate-300" />
                <p className="text-slate-600">
                  No active alerts at this time. The system will display early
                  warnings here when issued.
                </p>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  Stay safe and check back regularly.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <article
                    key={alert._id || alert.id}
                    className="group rounded-xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <SeverityBadge severity={alert.severity} />
                          {alert.type && (
                            <span className="text-sm text-slate-500 capitalize">
                              {alert.type}
                            </span>
                          )}
                        </div>

                        <h3 className="mt-2 text-xl font-semibold text-slate-900">
                          {alert.title}
                        </h3>

                        <p className="mt-1 text-slate-600">
                          {alert.description}
                        </p>

                        {(alert.area || alert.source) && (
                          <p className="mt-2 text-sm text-slate-500">
                            {alert.area && (
                              <>
                                <strong>Area:</strong> {alert.area}
                              </>
                            )}
                            {alert.source && (
                              <>
                                {alert.area && " · "}
                                <strong>Source:</strong> {alert.source}
                              </>
                            )}
                          </p>
                        )}
                      </div>

                      <div className="text-right text-sm text-slate-500">
                        <div className="flex items-center justify-end gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Issued: {safeFormat(alert.issuedAt)}</span>
                        </div>
                        {alert.expiresAt && (
                          <div className="mt-1 flex items-center justify-end gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>Expires: {safeFormat(alert.expiresAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Safety Instructions */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-gradient-to-r from-amber-50 to-amber-50/50 px-5 py-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
                <h2 className="text-lg font-semibold text-slate-800">
                  Alert Response Guidelines
                </h2>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Important steps to take when an alert is issued.
              </p>
            </div>
            <div className="grid gap-6 p-5 sm:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                  <h3 className="font-semibold">Do&apos;s</h3>
                </div>
                <ul className="space-y-2.5">
                  {ALERT_DOS.map((item, i) => (
                    <li key={i} className="flex gap-3 text-sm text-slate-700">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-red-700">
                  <XCircle className="h-5 w-5" />
                  <h3 className="font-semibold">Don&apos;ts</h3>
                </div>
                <ul className="space-y-2.5">
                  {ALERT_DONTS.map((item, i) => (
                    <li key={i} className="flex gap-3 text-sm text-slate-700">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="mt-10 text-center text-sm text-slate-500">
        For the latest updates, follow official channels or call{" "}
        <strong>117</strong>.
        <Link href="/" className="ml-2 text-sky-600 hover:underline">
          Back to dashboard
        </Link>
        .
      </p>
    </div>
  );
}