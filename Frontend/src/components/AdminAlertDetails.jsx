"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Loader from "@/components/Loader";
import {
  TriangleAlert,
  MapPin,
  Clock3,
  ShieldAlert,
  FileText,
  UserCircle2,
  PencilLine,
  Archive,
  Ban,
  ChevronLeft,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const severityStyles = {
  Low: "border-yellow-300/60 bg-yellow-300/20 text-yellow-900",
  Medium: "border-orange-400/60 bg-orange-400/20 text-orange-900",
  High: "border-red-500/60 bg-red-500/20 text-red-900",
};

const statusStyles = {
  Active: "border-emerald-300/60 bg-emerald-500/15 text-emerald-800",
  Expired: "border-slate-300/60 bg-slate-200/60 text-slate-700",
  Cancelled: "border-red-300/60 bg-red-500/15 text-red-800",
  Archived: "border-amber-300/60 bg-amber-500/15 text-amber-800",
};

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminAlertDetails({ alertId }) {
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAlert() {
      if (!alertId) {
        setError("Missing alert ID.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE}/alerts/${alertId}`, {
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok) {
          if (!cancelled) {
            setError(data?.message || "Failed to load alert.");
          }
          return;
        }

        if (!cancelled) {
          setAlert(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Failed to load alert.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAlert();

    return () => {
      cancelled = true;
    };
  }, [alertId]);

  async function handleStatusChange(nextStatus) {
    if (!alert?._id) return;

    try {
      setActionLoading(nextStatus);
      setError(null);
      setSuccess(null);

      const res = await fetch(`${API_BASE}/alerts/${alert._id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message || `Failed to set status to ${nextStatus}.`);
        return;
      }

      setAlert(data);
      setSuccess(`Alert marked as ${nextStatus}.`);
    } catch (err) {
      setError(err?.message || "Failed to update alert status.");
    } finally {
      setActionLoading("");
    }
  }

  const severityClass = useMemo(
    () =>
      severityStyles[alert?.severity] ||
      "border-slate-300 bg-slate-100 text-slate-700",
    [alert]
  );

  const statusClass = useMemo(
    () =>
      statusStyles[alert?.status] ||
      "border-slate-300 bg-slate-100 text-slate-700",
    [alert]
  );

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-slate-200/80 bg-white/80 shadow-sm">
        <Loader />
      </div>
    );
  }

  if (error && !alert) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/list"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to alert list
        </Link>

        <div className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/admin/list"
            className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to alert list
          </Link>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Alert details
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            View full alert information, timing, status, and safety guidance.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/editAlert?id=${alert?._id}`}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
          >
            <PencilLine className="h-4 w-4 text-amber-700" />
            Edit
          </Link>

          <button
            type="button"
            onClick={() => handleStatusChange("Cancelled")}
            disabled={actionLoading === "Cancelled" || alert?.status === "Cancelled"}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actionLoading === "Cancelled" ? <Loader size="sm" /> : <Ban className="h-4 w-4" />}
            Cancel
          </button>

          <button
            type="button"
            onClick={() => handleStatusChange("Archived")}
            disabled={actionLoading === "Archived" || alert?.status === "Archived"}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actionLoading === "Archived" ? <Loader size="sm" /> : <Archive className="h-4 w-4" />}
            Archive
          </button>
        </div>
      </div>

      {(error || success) && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            error
              ? "border border-red-200 bg-red-50/80 text-red-800"
              : "border border-emerald-200 bg-emerald-50/80 text-emerald-800"
          }`}
        >
          {error || success}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
          <TriangleAlert className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">Alert summary</h2>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Disaster type
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {alert?.disasterType || "—"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Severity
            </p>
            <div className="mt-2">
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${severityClass}`}>
                {alert?.severity || "—"}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Status
            </p>
            <div className="mt-2">
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
                {alert?.status || "—"}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Alert ID
            </p>
            <p className="mt-2 break-all text-sm font-medium text-slate-900">
              {alert?._id || "—"}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
            <FileText className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-800">Alert information</h2>
          </div>

          <div className="space-y-5 p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Affected area
              </p>
              <div className="mt-2 flex items-start gap-2 text-sm text-slate-800">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                <span>{alert?.affectedArea || "—"}</span>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Description
              </p>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
                {alert?.description || "—"}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Safety instructions
              </p>
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700" />
                  <p className="whitespace-pre-line text-sm leading-6 text-amber-900">
                    {alert?.safetyInstructions || "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
            <Clock3 className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-800">Timing & ownership</h2>
          </div>

          <div className="space-y-4 p-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Start time
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">
                {formatDateTime(alert?.startTime)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Expected end time
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">
                {formatDateTime(alert?.expectedEndTime)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Created at
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">
                {formatDateTime(alert?.createdAt)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Last updated
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">
                {formatDateTime(alert?.updatedAt)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Created by
              </p>
              <div className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-900">
                <UserCircle2 className="h-4 w-4 text-slate-400" />
                <span>{alert?.createdBy || "Admin"}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}