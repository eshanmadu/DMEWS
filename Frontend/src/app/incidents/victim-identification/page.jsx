"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, FileUp, Loader2, MapPin, ShieldCheck } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function authHeaders() {
  const token = window.localStorage.getItem("dmews_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function displayDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("en-GB");
}

export default function VictimIdentificationPage() {
  const [state, setState] = useState({ loading: true, allowed: false, error: "" });
  const [cases, setCases] = useState([]);
  const [form, setForm] = useState({ location: "", date: "", evidence: null });
  const [loadingCases, setLoadingCases] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadCases() {
    setLoadingCases(true);
    try {
      const response = await fetch(`${API_BASE}/victim-access/cases`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Could not load cases.");
      setCases(Array.isArray(data.cases) ? data.cases : []);
    } catch (loadError) {
      setError(loadError?.message || "Could not load cases.");
    } finally {
      setLoadingCases(false);
    }
  }

  useEffect(() => {
    const token = window.localStorage.getItem("dmews_token");
    if (!token) {
      setState({ loading: false, allowed: false, error: "Sign in is required." });
      return;
    }
    fetch(`${API_BASE}/victim-access/protected`, { headers: authHeaders(), cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.message || "Access denied.");
        setState({ loading: false, allowed: Boolean(data.allowed), error: "" });
        await loadCases();
      })
      .catch((accessError) => setState({ loading: false, allowed: false, error: accessError.message }));
  }, []);

  async function submitCase(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!form.location.trim() || !form.date || !form.evidence) {
      setError("Location, date, and evidence are required.");
      return;
    }
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append("location", form.location.trim());
      body.append("date", form.date);
      body.append("evidence", form.evidence);
      const response = await fetch(`${API_BASE}/victim-access/cases`, {
        method: "POST",
        headers: authHeaders(),
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Could not upload case.");
      setCases((previous) => [data.case, ...previous]);
      setForm({ location: "", date: "", evidence: null });
      const input = document.getElementById("victim-case-evidence");
      if (input) input.value = "";
      setSuccess(`Case ${data.case.caseId} uploaded successfully.`);
    } catch (submitError) {
      setError(submitError?.message || "Could not upload case.");
    } finally {
      setSubmitting(false);
    }
  }

  if (state.loading) return <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  if (!state.allowed) return <main className="mx-auto max-w-2xl px-4 py-16"><div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900"><h1 className="text-xl font-bold">Access denied</h1><p className="mt-2 text-sm">{state.error}</p><Link href="/incidents/missing-persons" className="mt-5 inline-flex items-center gap-2 font-semibold underline"><ArrowLeft className="h-4 w-4" />Back to missing persons</Link></div></main>;

  return <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
    <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div><Link href="/incidents/missing-persons" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:text-indigo-900"><ArrowLeft className="h-4 w-4" />Back to reports</Link><div className="mt-4 flex items-center gap-3"><ShieldCheck className="h-8 w-8 text-indigo-700" /><div><p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">Verified officer workspace</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Victim Identification</h1></div></div></div>
      <p className="max-w-sm text-sm text-slate-600">Upload body cases and evidence. Only your own uploaded cases are returned to this account.</p>
    </div>

    <section className="mt-8 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-bold text-slate-900">Upload body case</h2>
      <p className="mt-1 text-sm text-slate-600">New cases start with status Under Investigation.</p>
      <form onSubmit={submitCase} className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">Location
          <span className="relative mt-1 block"><MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input required value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Badulla" className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" /></span>
        </label>
        <label className="text-sm font-medium text-slate-700">Date
          <span className="relative mt-1 block"><CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input required type="date" max={new Date().toISOString().slice(0, 10)} value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" /></span>
        </label>
        <label className="text-sm font-medium text-slate-700">Evidence
          <span className="mt-1 flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-indigo-300 bg-white px-3 text-sm text-indigo-800 hover:bg-indigo-50"><FileUp className="h-4 w-4 shrink-0" /><span className="truncate">{form.evidence?.name || "Choose image or PDF"}</span><input id="victim-case-evidence" required type="file" accept="image/*,.pdf,application/pdf" onChange={(event) => setForm({ ...form, evidence: event.target.files?.[0] || null })} className="hidden" /></span>
        </label>
        <div className="md:col-span-3 flex flex-wrap items-center justify-between gap-3 border-t border-indigo-100 pt-4"><p className="text-xs text-slate-500">Evidence files must be images or PDF documents, up to 10MB.</p><button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}Upload case</button></div>
      </form>
      {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {success && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>}
    </section>

    <section className="mt-8"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold text-slate-900">My uploaded cases</h2><p className="mt-1 text-sm text-slate-600">Private to your officer account.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{cases.length} case{cases.length === 1 ? "" : "s"}</span></div>
      {loadingCases ? <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-indigo-600" /></div> : cases.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">No cases uploaded yet.</div> : <div className="mt-4 grid gap-4 md:grid-cols-2">{cases.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-sm font-bold text-indigo-700">{item.caseId}</p><h3 className="mt-1 text-lg font-bold text-slate-900">BODY CASE</h3></div><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">{item.status}</span></div><dl className="mt-4 space-y-2 text-sm text-slate-600"><div className="flex gap-2"><dt className="font-semibold text-slate-800">Location:</dt><dd>{item.location}</dd></div><div className="flex gap-2"><dt className="font-semibold text-slate-800">Date:</dt><dd>{displayDate(item.date)}</dd></div></dl><a href={item.evidenceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:text-indigo-900"><FileUp className="h-4 w-4" />View evidence</a></article>)}</div>}
    </section>
  </main>;
}
