"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  UserSearch,
  UserCheck,
  Sparkles,
  MapPin,
  Calendar,
  Phone,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { MatchScoreBreakdown } from "@/components/MatchScoreBreakdown";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString();
}

function MatchChip({ score }) {
  const s = Number(score || 0);
  const tone =
    s >= 60
      ? "bg-emerald-100 text-emerald-800"
      : s >= 40
      ? "bg-amber-100 text-amber-900"
      : "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
      <Sparkles className="h-3 w-3" />
      Score {s}
    </span>
  );
}

function MissingCard({ person }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {person.photoUrl ? (
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-slate-100">
            <Image src={person.photoUrl} alt="" fill className="object-cover" sizes="80px" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-slate-900">{person.fullName}</p>
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">Age {person.age}</span>
          </div>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            <p className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{person.lastSeenLocation}</p>
            <p className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Missing: {fmtDate(person.dateMissing)}</p>
            {person.ifYouSeePhone ? <p className="flex items-center gap-1 text-xs"><Phone className="h-3 w-3" />{person.ifYouSeePhone}</p> : null}
          </div>
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
          Possible found matches ({person.possibleMatches?.length || 0})
        </p>
        {!person.possibleMatches?.length ? (
          <p className="text-xs text-slate-500">No likely matches yet.</p>
        ) : (
          <div className="space-y-2">
            {person.possibleMatches.map((m) => (
              <div key={m.id} className="rounded-md border border-slate-200 bg-white p-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium text-slate-900">{m.name || "Unknown"}</p>
                  <MatchChip score={m.matchScore} />
                </div>
                <p className="mt-1 text-xs text-slate-600">{m.locationFound}</p>
                {m.scoreBreakdown ? (
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <MatchScoreBreakdown breakdown={m.scoreBreakdown} compact />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FoundCard({ person }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {person.photoUrl ? (
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-slate-100">
            <Image src={person.photoUrl} alt="" fill className="object-cover" sizes="80px" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-slate-900">{person.name || "Unknown"}</p>
            {person.age != null ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Age ~{person.age}</span> : null}
          </div>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            <p className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{person.locationFound}</p>
            <p className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Found: {fmtDate(person.dateFound)}</p>
            {person.ifYouSeePhone ? <p className="flex items-center gap-1 text-xs"><Phone className="h-3 w-3" />{person.ifYouSeePhone}</p> : null}
          </div>
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
          Possible missing matches ({person.possibleMatches?.length || 0})
        </p>
        {!person.possibleMatches?.length ? (
          <p className="text-xs text-slate-500">No likely matches yet.</p>
        ) : (
          <div className="space-y-2">
            {person.possibleMatches.map((m) => (
              <div key={m.id} className="rounded-md border border-slate-200 bg-white p-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium text-slate-900">{m.fullName}</p>
                  <MatchChip score={m.matchScore} />
                </div>
                <p className="mt-1 text-xs text-slate-600">{m.lastSeenLocation}</p>
                {m.scoreBreakdown ? (
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <MatchScoreBreakdown breakdown={m.scoreBreakdown} compact />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminMissingPersonsPage() {
  const [tab, setTab] = useState("missing");
  const [rowsMissing, setRowsMissing] = useState([]);
  const [rowsFound, setRowsFound] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const token = typeof window !== "undefined" ? window.localStorage.getItem("dmews_token") : null;
    if (!token) {
      setError("Please log in with an admin account to view person reports.");
      setRowsMissing([]);
      setRowsFound([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/missing-persons/admin/overview`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Failed to load person reports.");
      }
      setRowsMissing(Array.isArray(data.missing) ? data.missing : []);
      setRowsFound(Array.isArray(data.found) ? data.found : []);
    } catch (e) {
      setError(e?.message || "Failed to load person reports.");
      setRowsMissing([]);
      setRowsFound([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const currentRows = tab === "missing" ? rowsMissing : rowsFound;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Missing Persons</h1>
          <p className="mt-1 text-sm text-slate-600">
            Review missing/found reports and possible matches ranked by match score.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setTab("missing")}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${tab === "missing" ? "bg-rose-600 text-white" : "text-slate-700 hover:bg-slate-50"}`}
        >
          <UserSearch className="h-4 w-4" />
          Missing ({rowsMissing.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("found")}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${tab === "found" ? "bg-emerald-600 text-white" : "text-slate-700 hover:bg-slate-50"}`}
        >
          <UserCheck className="h-4 w-4" />
          Found ({rowsFound.length})
        </button>
      </div>

      {error ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{error}</div> : null}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
        </div>
      ) : currentRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
          No records in this section.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {tab === "missing"
            ? currentRows.map((person) => <MissingCard key={person.id} person={person} />)
            : currentRows.map((person) => <FoundCard key={person.id} person={person} />)}
        </div>
      )}
    </div>
  );
}

