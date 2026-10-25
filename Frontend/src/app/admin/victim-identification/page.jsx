"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, BrainCircuit, RefreshCw, ShieldCheck, Users } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function authHeaders() {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("dmews_token") : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function Metric({ icon: Icon, label, value, accent }) {
  return <div className={`group rounded-2xl border bg-white p-5 shadow-sm transition duration-500 hover:-translate-y-1 hover:shadow-lg ${accent}`}>
    <div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-500">{label}</span><Icon className="h-5 w-5 text-sky-600 transition duration-500 group-hover:scale-125" /></div>
    <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">{value}</p>
  </div>;
}

export default function AdminVictimIdentificationPage() {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/victim-access/admin/scans`, { headers: authHeaders(), cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Could not load scan analysis.");
      setScans(Array.isArray(data.scans) ? data.scans : []);
      setError("");
    } catch (loadError) {
      setError(loadError?.message || "Could not load scan analysis.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const completed = scans.filter((scan) => scan.status === "completed").length;
  const potentialMatches = scans.reduce((total, scan) => total + (scan.matches?.length || 0), 0);
  const unavailable = scans.filter((scan) => scan.status !== "completed").length;

  return <div className="space-y-7">
    <div className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-9">
      <div className="absolute -right-20 -top-20 h-56 w-56 animate-pulse rounded-full bg-sky-500/20 blur-3xl" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-sky-300"><BrainCircuit className="h-5 w-5" /> Analysis centre</div><h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Victim identification intelligence</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Monitor officer-submitted scans, review ranked potential matches, and keep every result subject to human verification.</p></div>
        <button type="button" onClick={load} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/20"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh analysis</button>
      </div>
    </div>
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Metric icon={Activity} label="Total scans" value={scans.length} accent="border-sky-100" />
      <Metric icon={ShieldCheck} label="Analysed" value={completed} accent="border-emerald-100" />
      <Metric icon={Users} label="Potential matches" value={potentialMatches} accent="border-indigo-100" />
      <Metric icon={AlertTriangle} label="Needs attention" value={unavailable} accent="border-amber-100" />
    </div>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-900">Live scan analysis</h2><p className="mt-1 text-sm text-slate-500">Images are not displayed here; review is based on audit-safe result metadata.</p></div>
      {loading ? <div className="space-y-3 p-5">{[1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div> : scans.length === 0 ? <div className="px-5 py-16 text-center text-sm text-slate-500">No officer scans have been submitted.</div> : <div className="divide-y divide-slate-100">{scans.map((scan, index) => <article key={scan.id} className="animate-in fade-in slide-in-from-bottom-2 px-5 py-5 duration-500" style={{ animationDelay: `${index * 60}ms` }}><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${scan.status === "completed" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{scan.status}</span><span className="text-xs text-slate-500">{new Date(scan.createdAt).toLocaleString()}</span></div><h3 className="mt-2 font-bold text-slate-900">{scan.officer?.name || "Officer"} <span className="font-normal text-slate-500">({scan.officer?.district || "District unavailable"})</span></h3><p className="mt-1 text-sm text-slate-600">{scan.serviceMessage || "No service message."}</p></div><div className="rounded-xl bg-slate-50 px-4 py-3 text-sm"><span className="font-bold text-slate-900">{scan.matches?.length || 0}</span><span className="ml-1 text-slate-500">potential match(es)</span></div></div>{scan.matches?.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{scan.matches.map((match) => <div key={match.personId} className="rounded-xl border border-sky-100 bg-sky-50/60 p-4 transition hover:border-sky-300"><div className="flex items-center justify-between gap-3"><p className="font-bold text-slate-900">{match.person?.fullName || "Missing-person record"}</p><span className="text-sm font-black text-sky-700">{Math.round((match.confidence || 0) * 100)}%</span></div><p className="mt-1 text-xs text-slate-600">{match.person?.lastSeenLocation || "Location unavailable"}</p>      <p className="mt-2 text-xs font-semibold text-rose-700">{match.matchType === "face" ? "Face and details are supporting signals — verify official identity." : "Details-based potential match only — verify official identity."}</p></div>)}</div> : null}</article>)}</div>}
    </section>
  </div>;
}
