"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Heart,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Eye,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const SKILL_ORDER = [
  "First Aid / Medical",
  "Search & Rescue",
  "Disaster Relief Distribution",
  "Technical Support / IT",
  "Drone Operation",
  "Communication / Coordination",
  "Logistics",
  "Counseling / Psychological Support",
  "General Volunteer",
];

function StatusBadge({ status }) {
  const base =
    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold";
  if (status === "approved")
    return (
      <span className={`${base} bg-emerald-100 text-emerald-800`}>
        <CheckCircle className="h-3.5 w-3.5" /> Approved
      </span>
    );
  if (status === "rejected")
    return (
      <span className={`${base} bg-rose-100 text-rose-800`}>
        <XCircle className="h-3.5 w-3.5" /> Rejected
      </span>
    );
  return (
    <span className={`${base} bg-amber-100 text-amber-900`}>
      <Clock className="h-3.5 w-3.5" /> Pending
    </span>
  );
}

export default function AdminVolunteersPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [detailRow, setDetailRow] = useState(null);

  const load = useCallback(async () => {
    const token = typeof window !== "undefined"
      ? window.localStorage.getItem("dmews_token")
      : null;
    if (!token) {
      setError(
        "no_token"
      );
      setLoading(false);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/volunteers/admin/list`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Could not load volunteers.");
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
      const res = await fetch(`${API_BASE}/volunteers/admin/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Update failed.");
      } else {
        setRows((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: data.status,
                  reviewedAt: data.reviewedAt,
                  reviewedBy: data.reviewedBy,
                }
              : r
          )
        );
      }
    } catch {
      setError("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  const skillBuckets = SKILL_ORDER.map((skill) => ({
    skill,
    rows: rows.filter((r) => Array.isArray(r.skills) && r.skills.includes(skill)),
  })).filter((b) => b.rows.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Volunteers
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Approve or reject volunteer requests. Approved users get a verified
            badge next to their name.
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
            The <code className="rounded bg-amber-100/80 px-1">admin@admin.com</code> shortcut
            only opens the admin UI — it does <strong>not</strong> create a backend session, so
            volunteer approvals cannot load.
          </p>
          <p className="mt-2">
            <Link
              href="/login?redirect=/admin/volunteers"
              className="font-semibold text-amber-950 underline hover:text-amber-800"
            >
              Log in with your email and password
            </Link>
            {" "}
            (the same email you registered with). Then add that email to{" "}
            <code className="rounded bg-amber-100/80 px-1">ADMIN_EMAILS</code> in{" "}
            <code className="rounded bg-amber-100/80 px-1">Backend/.env</code> and restart the
            backend — or for local dev only set{" "}
            <code className="rounded bg-amber-100/80 px-1">
              ALLOW_VOLUNTEER_ADMIN_ANY_USER=true
            </code>
            .
          </p>
        </div>
      )}
      {error && error !== "no_token" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {error}
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800">
            Volunteer categories by skill
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {skillBuckets.map((b) => (
              <span
                key={b.skill}
                className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800"
              >
                {b.skill}
                <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-sky-700">
                  {b.rows.length}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-slate-500">
            <Heart className="h-10 w-10 text-slate-300" />
            <p className="text-sm">No volunteer applications yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">District</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Message</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {row.user?.name || "—"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {row.user?.email}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.user?.district || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="max-w-xs px-4 py-3 text-slate-600">
                      <p className="line-clamp-3">{row.message || "—"}</p>
                      {Array.isArray(row.skills) && row.skills.length > 0 && (
                        <p className="mt-1 text-xs text-slate-400">
                          Skills: {row.skills.join(", ")}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailRow(row)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                        {row.status !== "approved" && (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => setStatus(row.id, "approved")}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                          >
                            Approve
                          </button>
                        )}
                        {row.status !== "rejected" && (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => setStatus(row.id, "rejected")}
                            className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        )}
                        {row.status !== "pending" && (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => setStatus(row.id, "pending")}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            Reset pending
                          </button>
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

      {detailRow && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/60"
            onClick={() => setDetailRow(null)}
            aria-label="Close details"
          />
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Volunteer Details</h3>
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="space-y-5 px-5 py-5 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <p><span className="font-semibold text-slate-700">Status:</span> {detailRow.status}</p>
                <p><span className="font-semibold text-slate-700">Can travel:</span> {detailRow.canTravelOtherDistricts ? "Yes" : "No"}</p>
                <p><span className="font-semibold text-slate-700">Full Name:</span> {detailRow.fullName || detailRow.user?.name || "—"}</p>
                <p><span className="font-semibold text-slate-700">Date of Birth:</span> {detailRow.dateOfBirth ? String(detailRow.dateOfBirth).slice(0, 10) : "—"}</p>
                <p><span className="font-semibold text-slate-700">Gender:</span> {detailRow.gender || "—"}</p>
                <p><span className="font-semibold text-slate-700">NIC / ID:</span> {detailRow.nicIdNumber || "—"}</p>
                <p><span className="font-semibold text-slate-700">Phone:</span> {detailRow.phoneNumber || detailRow.user?.mobile || "—"}</p>
                <p><span className="font-semibold text-slate-700">Email:</span> {detailRow.emailAddress || detailRow.user?.email || "—"}</p>
                <p><span className="font-semibold text-slate-700">District / City:</span> {detailRow.districtCity || detailRow.user?.district || "—"}</p>
                <p><span className="font-semibold text-slate-700">Current Location:</span> {detailRow.currentLocation || "—"}</p>
              </div>

              <div>
                <p className="font-semibold text-slate-700">Skills & Expertise</p>
                <p className="mt-1 text-slate-600">
                  {Array.isArray(detailRow.skills) && detailRow.skills.length
                    ? detailRow.skills.join(", ")
                    : "—"}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <p><span className="font-semibold text-slate-700">Medical conditions:</span> {detailRow.medicalConditions || "—"}</p>
                <p><span className="font-semibold text-slate-700">Emergency contact person:</span> {detailRow.emergencyContactPerson || "—"}</p>
                <p><span className="font-semibold text-slate-700">Emergency contact number:</span> {detailRow.emergencyContactNumber || "—"}</p>
                <p><span className="font-semibold text-slate-700">Agreed safety guidelines:</span> {detailRow.agreeSafetyGuidelines ? "Yes" : "No"}</p>
                <p><span className="font-semibold text-slate-700">Agreed emergency contact:</span> {detailRow.agreeEmergencyContact ? "Yes" : "No"}</p>
                <p><span className="font-semibold text-slate-700">Submitted:</span> {detailRow.createdAt ? new Date(detailRow.createdAt).toLocaleString() : "—"}</p>
              </div>

              {detailRow.message && (
                <div>
                  <p className="font-semibold text-slate-700">Additional message</p>
                  <p className="mt-1 text-slate-600">{detailRow.message}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
