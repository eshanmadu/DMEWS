"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Siren,
  Loader2,
  Mail,
  Phone,
  MapPin,
  User,
  Shield,
  RefreshCw,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function rel(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "—";
  }
}

export default function AdminEmergenciesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const token =
      typeof window !== "undefined"
        ? window.localStorage.getItem("dmews_token")
        : null;
    if (!token) {
      setError("no_token");
      setLoading(false);
      setRows([]);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sos/admin/list`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        setError(typeof data?.message === "string" ? data.message : "Failed to load.");
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

  async function setStatus(id, status) {
    const token = window.localStorage.getItem("dmews_token");
    if (!token) return;
    setBusyId(id);
    try {
      const res = await fetch(`${API_BASE}/sos/admin/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.message || "Update failed");
      } else {
        await load();
      }
    } catch {
      alert("Network error");
    } finally {
      setBusyId(null);
    }
  }

  if (error === "no_token") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
        <p className="font-semibold">No API session (missing JWT)</p>
        <p className="mt-2 text-xs leading-relaxed">
          Admin pages need a <strong>real login token</strong>. Use{" "}
          <strong>email + password</strong> for an admin account, or in{" "}
          <strong>local dev</strong> use <code className="rounded bg-white/80 px-1">admin@admin.com</code> /{" "}
          <code className="rounded bg-white/80 px-1">admin@123</code> with{" "}
          <code className="rounded bg-white/80 px-1">ALLOW_DEV_ADMIN_JWT=true</code> in Backend{" "}
          <code className="rounded bg-white/80 px-1">.env</code>, then log in again.
        </p>
        <a href="/login?redirect=/admin/emergencies" className="mt-4 inline-block font-bold text-amber-800 underline">
          Go to login
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <Siren className="h-7 w-7 text-red-600" />
            SOS emergencies
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            User help requests from the home page SOS button. Profile data is captured at send time.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && error !== "no_token" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading && rows.length === 0 ? (
        <div className="flex items-center gap-2 py-12 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          Loading SOS requests…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center text-slate-500">
          No SOS requests yet.
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => {
            const u = r.userSnapshot || {};
            const hint = r.clientHint || {};
            return (
              <article
                key={r.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-red-50/60 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                        r.status === "open"
                          ? "bg-red-600 text-white"
                          : r.status === "acknowledged"
                            ? "bg-amber-400 text-amber-950"
                            : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {r.status}
                    </span>
                    <span className="text-xs text-slate-500">{rel(r.createdAt)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === r.id || r.status === "acknowledged"}
                      onClick={() => setStatus(r.id, "acknowledged")}
                      className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-40"
                    >
                      Acknowledge
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id || r.status === "resolved"}
                      onClick={() => setStatus(r.id, "resolved")}
                      className="rounded-lg bg-slate-700 px-3 py-1 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-40"
                    >
                      Resolved
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id || r.status === "open"}
                      onClick={() => setStatus(r.id, "open")}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Reopen
                    </button>
                  </div>
                </div>
                <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2 text-sm">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      User (snapshot)
                    </h3>
                    <p className="flex items-start gap-2 text-slate-800">
                      <User className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-600" />
                      <span>{u.name || "—"}</span>
                    </p>
                    <p className="flex items-start gap-2 text-slate-800">
                      <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-600" />
                      <a href={`mailto:${u.email}`} className="break-all text-sky-700 hover:underline">
                        {u.email || "—"}
                      </a>
                    </p>
                    <p className="flex items-start gap-2 text-slate-800">
                      <Phone className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-600" />
                      {u.mobile ? (
                        <a href={`tel:${u.mobile}`} className="text-sky-700 hover:underline">
                          {u.mobile}
                        </a>
                      ) : (
                        "—"
                      )}
                    </p>
                    <p className="flex items-start gap-2 text-slate-800">
                      <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-600" />
                      {u.district || "—"}
                    </p>
                    <p className="flex items-start gap-2 text-slate-800">
                      <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-600" />
                      Volunteer:{" "}
                      <span className="font-medium">{u.volunteerStatus || "none"}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Avatar ID: <code className="rounded bg-slate-100 px-1">{u.avatar || "—"}</code>
                    </p>
                    <p className="text-xs text-slate-500">
                      User ID: <code className="rounded bg-slate-100 px-1 break-all">{r.userId}</code>
                    </p>
                  </div>
                  <div className="space-y-2 text-sm sm:col-span-1 lg:col-span-2">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Message &amp; device
                    </h3>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-slate-800">
                      {r.message ? r.message : <span className="text-slate-400">No message provided.</span>}
                    </div>
                    <p className="text-xs text-slate-500">
                      Sent from: {hint.sentFrom || "—"}
                    </p>
                    <p className="break-all text-xs text-slate-400">
                      User-Agent: {hint.userAgent || "—"}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
