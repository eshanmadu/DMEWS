"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Boxes,
  Clock,
  Loader2,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function UrgencyBadge({ urgency }) {
  const u = String(urgency || "medium").toLowerCase();
  if (u === "high") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
        <ShieldAlert className="h-3.5 w-3.5" />
        High
      </span>
    );
  }
  if (u === "low") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
        <Clock className="h-3.5 w-3.5" />
        Low
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
      <Clock className="h-3.5 w-3.5" />
      Medium
    </span>
  );
}

export default function AdminMissionsPage() {
  const categoryOptions = [
    { value: "flood", label: "Flood response" },
    { value: "landslide", label: "Landslide response" },
    { value: "shelter", label: "Shelter support" },
    { value: "supply", label: "Relief supply distribution" },
    { value: "medical", label: "Medical assistance" },
    { value: "logistics", label: "Logistics coordination" },
    { value: "evacuation", label: "Evacuation support" },
    { value: "remote", label: "Remote coordination" },
    { value: "other", label: "Other" },
  ];

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const [form, setForm] = useState({
    title: "",
    category: "",
    customCategory: "",
    district: "",
    description: "",
    volunteersNeeded: 0,
    skills: "",
    urgency: "medium",
  });

  const canSubmit = useMemo(() => {
    const selectedCategory = String(form.category || "").trim();
    const customCategory = String(form.customCategory || "").trim();
    const hasCategory =
      selectedCategory.length > 0 &&
      (selectedCategory !== "other" || customCategory.length > 0);

    return (
      String(form.title || "").trim().length > 2 &&
      hasCategory
    );
  }, [form.title, form.category, form.customCategory]);

  const load = useCallback(async () => {
    const token = typeof window !== "undefined" ? window.localStorage.getItem("dmews_token") : null;
    if (!token) {
      setError("no_token");
      setLoading(false);
      return;
    }

    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/missions/admin/list`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Could not load missions.");
        setRows([]);
      } else {
        setRows(Array.isArray(data) ? data : []);
      }
    } catch {
      setError("Network error.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createMission(e) {
    e.preventDefault();
    const token = window.localStorage.getItem("dmews_token");
    if (!token) return;
    setError("");

    setBusyId("create");
    try {
      const selectedCategory = String(form.category || "").trim();
      const payload = {
        ...form,
        category:
          selectedCategory === "other"
            ? String(form.customCategory || "").trim()
            : selectedCategory,
      };

      const res = await fetch(`${API_BASE}/missions/admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Create mission failed.");
        return;
      }

      setForm({
        title: "",
        category: "",
        customCategory: "",
        district: "",
        description: "",
        volunteersNeeded: 0,
        skills: "",
        urgency: "medium",
      });
      await load();
    } catch {
      setError("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  async function closeMission(id, nextStatus) {
    const token = window.localStorage.getItem("dmews_token");
    if (!token) return;
    setBusyId(id);
    setError("");
    try {
      const endpoint =
        nextStatus === "closed"
          ? `${API_BASE}/missions/admin/${id}/close`
          : `${API_BASE}/missions/admin/${id}/open`;

      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Update failed.");
        return;
      }

      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: data.status,
                closedAt: data.closedAt,
                closedBy: data.closedBy,
              }
            : r
        )
      );
    } catch {
      setError("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Missions
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Admin-controlled active missions shown on the Volunteer Hub. Create and close missions as needed.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error === "no_token" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">You need a normal account login (with a session token)</p>
          <p className="mt-2 text-amber-900/90">
            The dev admin shortcut only opens the admin UI. Add your login email to <code className="rounded bg-amber-100/80 px-1">ADMIN_EMAILS</code> in <code className="rounded bg-amber-100/80 px-1">Backend/.env</code> and restart the backend.
          </p>
          <p className="mt-2">
            <Link
              href="/login?redirect=/admin/missions"
              className="font-semibold text-amber-950 underline hover:text-amber-800"
            >
              Log in with your email and password
            </Link>
          </p>
        </div>
      )}

      {error && error !== "no_token" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Boxes className="h-5 w-5 text-sky-700" />
            Create mission
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Missions can be closed anytime. Volunteers will only see active ones.
          </p>
        </div>

        <form onSubmit={createMission} className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Title *
              </label>
              <input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Flood relief – Ratnapura"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Urgency
              </label>
              <select
                value={form.urgency}
                onChange={(e) => setForm((p) => ({ ...p, urgency: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Volunteers needed
              </label>
              <input
                type="number"
                min={0}
                value={form.volunteersNeeded}
                onChange={(e) =>
                  setForm((p) => ({ ...p, volunteersNeeded: Number(e.target.value) || 0 }))
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                District (optional)
              </label>
              <input
                value={form.district}
                onChange={(e) => setForm((p) => ({ ...p, district: e.target.value }))}
                placeholder="Ratnapura"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Category *
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    category: e.target.value,
                    customCategory: e.target.value === "other" ? p.customCategory : "",
                  }))
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              >
                <option value="" disabled>
                  Select a category
                </option>
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {form.category === "other" && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Custom category *
                </label>
                <input
                  value={form.customCategory}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, customCategory: e.target.value }))
                  }
                  placeholder="Type the category"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Required skills
              </label>
              <input
                value={form.skills}
                onChange={(e) => setForm((p) => ({ ...p, skills: e.target.value }))}
                placeholder="First aid, logistics"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Description (optional)
            </label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  description: e.target.value,
                }))
              }
              placeholder="Short details about what coordinators need during this mission."
              className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit || busyId === "create"}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyId === "create" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create mission"
            )}
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">All missions</h2>
          <p className="mt-1 text-sm text-slate-600">
            Active missions are what volunteers see.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-slate-500">
            <Boxes className="h-10 w-10 text-slate-300" />
            <p className="text-sm">No missions created yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">District</th>
                  <th className="px-4 py-3">Volunteers</th>
                  <th className="px-4 py-3">Skills</th>
                  <th className="px-4 py-3">Urgency</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{row.title || "—"}</div>
                      {row.description && (
                        <div className="mt-1 max-w-[320px] line-clamp-2 text-xs text-slate-500">
                          {row.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.district || "—"}</td>
                    <td className="px-4 py-3 text-slate-800">
                      {Number(row.joinedCount ?? 0)}
                      {row.volunteersNeeded > 0
                        ? ` / ${row.volunteersNeeded}`
                        : ""}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-slate-600">
                      <div className="line-clamp-2">{row.skills || "—"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <UrgencyBadge urgency={row.urgency} />
                    </td>
                    <td className="px-4 py-3">
                      {row.status === "open" ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                          Open
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                          Closed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {row.status === "open" ? (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => closeMission(row.id, "closed")}
                            className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
                          >
                            Close
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => closeMission(row.id, "open")}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            Re-open
                          </button>
                        )}

                        {row.status === "closed" && (
                          <button
                            type="button"
                            onClick={() => closeMission(row.id, "closed")}
                            disabled
                            className="hidden"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

