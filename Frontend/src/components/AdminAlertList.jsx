"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Loader from "@/components/Loader";
import {
  FileText,
  Search,
  Filter,
  TriangleAlert,
  Eye,
  PencilLine,
  Ban,
  Archive,
  Trash2,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const DISASTER_TYPES = ["All", "Flood", "Landslide", "Cyclone", "Tsunami"];
const SEVERITIES = ["All", "Low", "Medium", "High"];
const STATUSES = ["All", "Active", "Expired", "Cancelled", "Archived"];

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
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminAlertList() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [pendingAction, setPendingAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAlerts() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE}/alerts`, {
          cache: "no-store",
        });

        const text = await res.text();

        let data;
        try {
          data = text ? JSON.parse(text) : [];
        } catch {
          throw new Error("Expected JSON from backend but received non-JSON response.");
        }

        if (!res.ok) {
          if (!cancelled) {
            setError(data?.message || "Failed to load alerts.");
          }
          return;
        }

        if (!cancelled) {
          setAlerts(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Failed to load alerts.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAlerts();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleStatusChange(id, nextStatus) {
  try {
    setActionLoading(true);
    setError(null);

    const res = await fetch(`${API_BASE}/alerts/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    const text = await res.text();

    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error("Server did not return JSON for status update.");
    }

    if (!res.ok) {
      throw new Error(data?.message || "Failed to update status.");
    }

    setAlerts((prev) => prev.map((a) => (a._id === id ? data : a)));
    setPendingAction(null);
  } catch (err) {
    console.error(err);
    setError(err?.message || "Failed to update alert status.");
  } finally {
    setActionLoading(false);
  }
}

  async function handleDeleteAlert(id) {
  try {
    setActionLoading(true);
    setError(null);

    const res = await fetch(`${API_BASE}/alerts/${id}`, {
      method: "DELETE",
    });

    const text = await res.text();

    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error("Server did not return JSON for delete request.");
    }

    if (!res.ok) {
      throw new Error(data?.message || "Failed to delete alert.");
    }

    setAlerts((prev) => prev.filter((a) => a._id !== id));
    setPendingAction(null);
  } catch (err) {
    console.error(err);
    setError(err?.message || "Failed to delete alert.");
  } finally {
    setActionLoading(false);
  }
}

  function openActionModal(actionType, alert) {
  let title = "";
  let message = "";
  let confirmLabel = "";

  if (actionType === "cancel") {
    title = "Confirm cancellation";
    message = `Mark alert ${alert._id} as Cancelled? This alert will no longer remain active.`;
    confirmLabel = "Cancel alert";
  }

  if (actionType === "archive") {
    title = "Confirm archive";
    message = `Archive alert ${alert._id}? Archived alerts stay in history but are no longer active.`;
    confirmLabel = "Archive alert";
  }

  if (actionType === "delete") {
    title = "Confirm deletion";
    message = `Delete alert ${alert._id}? Only cancelled alerts can be permanently deleted.`;
    confirmLabel = "Delete alert";
  }

  setPendingAction({
    type: actionType,
    alert,
    title,
    message,
    confirmLabel,
  });
}

async function handleConfirmAction() {
  if (!pendingAction?.alert?._id) return;

  if (pendingAction.type === "cancel") {
    await handleStatusChange(pendingAction.alert._id, "Cancelled");
  }

  if (pendingAction.type === "archive") {
    await handleStatusChange(pendingAction.alert._id, "Archived");
  }

  if (pendingAction.type === "delete") {
    await handleDeleteAlert(pendingAction.alert._id);
  }
}

  function clearFilters() {
    setSearch("");
    setTypeFilter("All");
    setSeverityFilter("All");
    setStatusFilter("All");
  }

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const term = search.trim().toLowerCase();

      const matchesSearch =
        !term ||
        String(alert?._id || "").toLowerCase().includes(term) ||
        String(alert?.affectedArea || "").toLowerCase().includes(term) ||
        String(alert?.disasterType || "").toLowerCase().includes(term);

      const matchesType =
        typeFilter === "All" || alert?.disasterType === typeFilter;

      const matchesSeverity =
        severityFilter === "All" || alert?.severity === severityFilter;

      const matchesStatus =
        statusFilter === "All" || alert?.status === statusFilter;

      return (
        matchesSearch &&
        matchesType &&
        matchesSeverity &&
        matchesStatus
      );
    });
  }, [alerts, search, typeFilter, severityFilter, statusFilter]);

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-slate-200/80 bg-white/80 shadow-sm">
        <Loader />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Alert list
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Search, filter, and manage all disaster alerts from one place.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Search and filters */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
          <Filter className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">Search & filters</h2>
          <p className="text-xs text-slate-500">Filter alerts by type, severity, status, or search text.</p>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5 xl:col-span-2">
            <label className="text-sm font-medium text-slate-700">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by alert ID, area, or disaster type"
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Disaster type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            >
              {DISASTER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Severity</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            >
              {SEVERITIES.map((severity) => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            Showing <span className="font-semibold text-slate-900">{filteredAlerts.length}</span> of{" "}
            <span className="font-semibold text-slate-900">{alerts.length}</span> alerts
          </p>

          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Clear filters
          </button>
        </div>
      </section>

      {/* Alert table */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
          <FileText className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">All alerts</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60">
                <th className="py-3 pl-4 pr-2 font-semibold text-slate-700">Alert ID</th>
                <th className="px-2 py-3 font-semibold text-slate-700">Type</th>
                <th className="px-2 py-3 font-semibold text-slate-700">Severity</th>
                <th className="px-2 py-3 font-semibold text-slate-700">Affected area</th>
                <th className="px-2 py-3 font-semibold text-slate-700">Start time</th>
                <th className="px-2 py-3 font-semibold text-slate-700">End time</th>
                <th className="px-2 py-3 font-semibold text-slate-700">Status</th>
                <th className="pl-2 pr-4 py-3 font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10">
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-sm text-slate-500">
                      No alerts match the selected filters.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alert) => {
                  const severityClass =
                    severityStyles[alert?.severity] ||
                    "border-slate-300 bg-slate-100 text-slate-700";

                  const statusClass =
                    statusStyles[alert?.status] ||
                    "border-slate-300 bg-slate-100 text-slate-700";

                  return (
                    <tr
                      key={alert._id}
                      className="border-b border-slate-100 transition hover:bg-amber-50/40"
                    >
                      <td className="py-3 pl-4 pr-2 font-medium text-slate-800">
                        {alert._id}
                      </td>

                      <td className="px-2 py-3 text-slate-700">
                        <div className="inline-flex items-center gap-2">
                          <TriangleAlert className="h-4 w-4 text-slate-400" />
                          {alert.disasterType || "—"}
                        </div>
                      </td>

                      <td className="px-2 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${severityClass}`}
                        >
                          {alert.severity || "—"}
                        </span>
                      </td>

                      <td className="px-2 py-3 text-slate-700">
                        {alert.affectedArea || "—"}
                      </td>

                      <td className="px-2 py-3 text-slate-600">
                        {formatDateTime(alert.startTime)}
                      </td>

                      <td className="px-2 py-3 text-slate-600">
                        {formatDateTime(alert.expectedEndTime)}
                      </td>

                      <td className="px-2 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass}`}
                        >
                          {alert.status || "—"}
                        </span>
                      </td>

                      <td className="pl-2 pr-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/admin/alertDetails?id=${alert._id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Link>

                          <Link
                            href={`/admin/editAlert?id=${alert._id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-100"
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                            Edit
                          </Link>

                          {alert.status !== "Cancelled" && alert.status !== "Archived" && (
                            <button
                              type="button"
                              onClick={() => openActionModal("cancel", alert)}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100"
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Cancel
                            </button>
                          )}

                          {alert.status !== "Archived" && (
                            <button
                              type="button"
                              onClick={() => openActionModal("archive", alert)}
                              className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-amber-500"
                            >
                              <Archive className="h-3.5 w-3.5" />
                              Archive
                            </button>
                          )}

                          {alert.status === "Cancelled" && (
                            <button
                              type="button"
                              onClick={() => openActionModal("delete", alert)}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {pendingAction && (
  <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
      <h3 className="text-sm font-semibold text-slate-900">
        {pendingAction.title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-600">
        {pendingAction.message}
      </p>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setPendingAction(null)}
          disabled={actionLoading}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-70"
        >
          Close
        </button>

        <button
          type="button"
          onClick={handleConfirmAction}
          disabled={actionLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-70"
        >
          {actionLoading && <Loader size="sm" />}
          {actionLoading ? "Processing..." : pendingAction.confirmLabel}
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}