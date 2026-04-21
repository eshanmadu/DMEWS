"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, PackagePlus, RefreshCw, Trash2 } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
export default function AdminResourcesPage() {
  const [rows, setRows] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    target: "",
    date: "",
    location: "",
    resourceFocus: "",
  });

  const canSubmit = useMemo(() => {
    return (
      form.name.trim().length > 2 &&
      form.date.trim().length > 0 &&
      form.location.trim().length > 0
    );
  }, [form.name, form.date, form.location]);
  const minProgramDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const loadPrograms = useCallback(async () => {
    const token = window.localStorage.getItem("dmews_token");
    if (!token) {
      setError("Please login with an admin-enabled account.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/resource-programs/admin/list`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        setError(data?.message || "Could not load resource programs.");
        setRows([]);
      } else {
        setRows(Array.isArray(data) ? data : []);
      }
    } catch {
      setError("Network error while loading programs.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSubmissions = useCallback(async () => {
    const token = window.localStorage.getItem("dmews_token");
    if (!token) {
      setSubmissionsLoading(false);
      return;
    }
    setSubmissionsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/resource-participations/admin/list`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        setError(data?.message || "Could not load submissions.");
        setSubmissions([]);
      } else {
        setSubmissions(Array.isArray(data) ? data : []);
      }
    } catch {
      setError("Network error while loading submissions.");
      setSubmissions([]);
    } finally {
      setSubmissionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrograms();
    loadSubmissions();
  }, [loadPrograms, loadSubmissions]);

  async function createProgram(e) {
    e.preventDefault();
    const token = window.localStorage.getItem("dmews_token");
    if (!token) {
      setError("Please login with an admin-enabled account.");
      return;
    }
    setBusyId("create");
    setError("");
    if (!form.date.trim()) {
      setError("Program date is required.");
      setBusyId(null);
      return;
    }
    if (form.date < minProgramDate) {
      setError("Program date cannot be in the past.");
      setBusyId(null);
      return;
    }
    if (!form.location.trim()) {
      setError("Program location is required.");
      return;
    }
    const nextProgram = {
      name: form.name.trim(),
      target: form.target.trim(),
      date: form.date.trim(),
      location: form.location.trim(),
      resourceFocus: form.resourceFocus
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    try {
      const res = await fetch(`${API_BASE}/resource-programs/admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(nextProgram),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Could not create program.");
        return;
      }
      await loadPrograms();
    } catch {
      setError("Network error.");
    } finally {
      setBusyId(null);
      setForm({
        name: "",
        target: "",
        date: "",
        location: "",
        resourceFocus: "",
      });
    }
  }

  async function removeProgram(id) {
    const token = window.localStorage.getItem("dmews_token");
    setBusyId(id);
    try {
      if (!token) {
        setError("Please login with an admin-enabled account.");
        return;
      }
      const res = await fetch(`${API_BASE}/resource-programs/admin/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Could not remove program.");
        return;
      }
      setRows((prev) => prev.filter((r) => String(r.id || r._id) !== String(id)));
    } catch {
      setError("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Resource Programs</h1>
          <p className="mt-1 text-sm text-slate-600">
            Create programs shown on the public Resources page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            loadPrograms();
            loadSubmissions();
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Create program</h2>
        </div>
        <form onSubmit={createProgram} className="grid gap-4 p-6 sm:grid-cols-2">
          <input
            required
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Program name"
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm sm:col-span-2"
          />
          <input
            required
            type="date"
            min={minProgramDate}
            value={form.date}
            onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
          />
          <input
            required
            value={form.location}
            onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
            placeholder="Program location / collection center"
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
          />
          <input
            value={form.resourceFocus}
            onChange={(e) => setForm((p) => ({ ...p, resourceFocus: e.target.value }))}
            placeholder="Focus tags (comma separated)"
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
          />
          <textarea
            rows={3}
            value={form.target}
            onChange={(e) => setForm((p) => ({ ...p, target: e.target.value }))}
            placeholder="Program target / objective"
            className="resize-none rounded-xl border border-slate-300 px-4 py-2.5 text-sm sm:col-span-2"
          />
          <button
            type="submit"
            disabled={!canSubmit || busyId === "create"}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
          >
            {busyId === "create" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <PackagePlus className="h-4 w-4" />
                Add program
              </>
            )}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Active programs</h2>
        </div>
        {loading ? (
          <div className="flex justify-center py-14">
            <Loader2 className="h-7 w-7 animate-spin text-sky-600" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-500">
            No programs yet.
          </p>
        ) : (
          <div className="space-y-3 p-6">
            {rows.map((row) => {
              const id = row.id || row._id || row.name;
              return (
                <div key={id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{row.name}</h3>
                      <p className="mt-1 text-sm text-slate-600">{row.target || "—"}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        {row.date ? new Date(row.date).toLocaleDateString() : "—"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Location: {row.location || "—"}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === id}
                      onClick={() => removeProgram(id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">User submissions</h2>
          <p className="mt-1 text-sm text-slate-600">
            Resource participation requests from users.
          </p>
        </div>
        {submissionsLoading ? (
          <div className="flex justify-center py-14">
            <Loader2 className="h-7 w-7 animate-spin text-sky-600" />
          </div>
        ) : submissions.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-500">
            No submissions yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">District</th>
                  <th className="px-4 py-3">Resource</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Delivery</th>
                  <th className="px-4 py-3">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {submissions.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{row.name}</div>
                      <div className="text-xs text-slate-500">{row.status}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{row.email}</div>
                      <div className="text-xs text-slate-500">{row.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.district}</td>
                    <td className="px-4 py-3 text-slate-700">{row.resourceType}</td>
                    <td className="px-4 py-3 text-slate-700">{row.quantity}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{row.deliveryMode === "pickup" ? "Pickup needed" : "Self drop"}</div>
                      {row.deliveryMode === "pickup" && row.pickupAddress && (
                        <div className="text-xs text-slate-500">{row.pickupAddress}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.availableDate
                        ? new Date(row.availableDate).toLocaleDateString()
                        : "—"}
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
