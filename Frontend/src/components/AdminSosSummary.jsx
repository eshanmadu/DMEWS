"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Siren, Loader2, ArrowRight } from "lucide-react";

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

export function AdminSosSummary() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const openCount = rows.filter((r) => r.status === "open").length;
  const recent = rows.slice(0, 4);

  if (error === "no_token") {
    return (
      <section className="card border-red-200/60 bg-red-50/40 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Siren className="h-4 w-4 text-red-600" />
          SOS emergencies
        </h2>
        <p className="mt-2 text-xs text-slate-600">
          Log in with an admin account to view user SOS requests.
        </p>
      </section>
    );
  }

  return (
    <section className="card border-red-100/80 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
              <Siren className="h-4 w-4 text-red-600" />
            </span>
            SOS emergencies
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Help requests from logged-in users on the home page ({openCount} open).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => load()}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
          <Link
            href="/admin/emergencies"
            className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-red-700"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : error ? (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      ) : recent.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-6 text-center text-sm text-slate-500">
          No SOS requests yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {recent.map((r) => {
            const u = r.userSnapshot || {};
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-slate-900">
                    {u.name || u.email || "User"}
                  </span>
                  <span className="text-slate-500"> · {u.district || "—"}</span>
                  {u.mobile ? (
                    <span className="block text-slate-600">{u.mobile}</span>
                  ) : null}
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      r.status === "open"
                        ? "bg-red-100 text-red-800"
                        : r.status === "acknowledged"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {r.status}
                  </span>
                  <div className="mt-0.5 text-[10px] text-slate-400">
                    {rel(r.createdAt)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
