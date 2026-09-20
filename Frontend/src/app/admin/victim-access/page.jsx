"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, CheckCircle, Clock, Eye, Loader2, RefreshCw, XCircle } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function StatusBadge({ status }) {
  const config = status === "approved"
    ? [CheckCircle, "bg-emerald-100 text-emerald-800", "Approved"]
    : status === "rejected"
      ? [XCircle, "bg-rose-100 text-rose-800", "Rejected"]
      : [Clock, "bg-amber-100 text-amber-900", "Pending"];
  const Icon = config[0];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${config[1]}`}><Icon className="h-3.5 w-3.5" />{config[2]}</span>;
}

export default function AdminVictimAccessPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    const token = typeof window !== "undefined" ? window.localStorage.getItem("dmews_token") : null;
    if (!token) { setError("Please log in with an administrator account."); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/victim-access/admin/list`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Could not load requests.");
      setRows(Array.isArray(data) ? data : []); setError("");
    } catch (e) { setError(e?.message || "Network error."); setRows([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function setStatus(id, status) {
    const token = window.localStorage.getItem("dmews_token");
    setBusyId(id);
    try {
      const res = await fetch(`${API_BASE}/victim-access/admin/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ status }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Update failed.");
      setRows((prev) => prev.map((row) => row.id === id ? { ...row, ...data } : row));
    } catch (e) { setError(e?.message || "Update failed."); } finally { setBusyId(null); }
  }

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-2xl font-bold tracking-tight text-slate-900">Officer access requests</h1><p className="mt-1 text-sm text-slate-600">Review identity documents before granting victim identification access.</p></div>
      <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"><RefreshCw className="h-4 w-4" />Refresh</button>
    </div>
    {error && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{error}</div>}
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div> : rows.length === 0 ? <div className="flex flex-col items-center gap-2 py-16 text-center text-slate-500"><BadgeCheck className="h-10 w-10 text-slate-300" /><p className="text-sm">No officer access requests yet.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Officer</th><th className="px-4 py-3">Role / organization</th><th className="px-4 py-3">Employee ID</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id} className="hover:bg-slate-50/80"><td className="px-4 py-3"><div className="font-medium text-slate-900">{row.user?.name || "—"}</div><div className="text-xs text-slate-500">{row.user?.email || "—"}</div></td><td className="px-4 py-3 text-slate-700"><div>{row.requestedRole}</div><div className="text-xs text-slate-500">{row.organization}</div></td><td className="px-4 py-3 font-mono text-xs text-slate-700">{row.employeeId}</td><td className="px-4 py-3"><StatusBadge status={row.status} /></td><td className="px-4 py-3 text-right"><div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setDetail(row)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Eye className="h-3.5 w-3.5" />View</button>{row.status !== "approved" && <button type="button" disabled={busyId === row.id} onClick={() => setStatus(row.id, "approved")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">Approve</button>}{row.status !== "rejected" && <button type="button" disabled={busyId === row.id} onClick={() => setStatus(row.id, "rejected")} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Reject</button>}{row.status !== "pending" && <button type="button" disabled={busyId === row.id} onClick={() => setStatus(row.id, "pending")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Reset</button>}</div></td></tr>)}</tbody></table></div>}
    </div>
    {detail && <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4"><button type="button" className="absolute inset-0 bg-slate-900/60" onClick={() => setDetail(null)} aria-label="Close details" /><div className="relative max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-900">Verification details</h2><p className="mt-1 text-sm text-slate-500">{detail.user?.name} · {detail.user?.email}</p></div><button type="button" onClick={() => setDetail(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold">Close</button></div><div className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><p><strong>Requested role:</strong> {detail.requestedRole}</p><p><strong>Organization:</strong> {detail.organization}</p><p><strong>Employee/Officer ID:</strong> {detail.employeeId}</p><p><strong>Status:</strong> {detail.status}</p></div><a href={detail.documentUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600">Open verification document</a></div></div>}
  </div>;
}