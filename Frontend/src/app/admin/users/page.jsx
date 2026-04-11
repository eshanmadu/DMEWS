"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users,
  Loader2,
  RefreshCw,
  Eye,
  Trash2,
  Shield,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ActivityBadge({ isInactive, isAdmin }) {
  if (isAdmin) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800">
        <Shield className="h-3.5 w-3.5" />
        Admin
      </span>
    );
  }
  if (isInactive) {
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
        Inactive
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
      Active
    </span>
  );
}

export default function AdminUsersPage() {
  const [rows, setRows] = useState([]);
  const [inactiveDays, setInactiveDays] = useState(90);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [meId, setMeId] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const load = useCallback(async () => {
    const token =
      typeof window !== "undefined" ? window.localStorage.getItem("dmews_token") : null;
    if (!token) {
      setError("no_token");
      setLoading(false);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const [usersRes, meRes] = await Promise.all([
        fetch(`${API_BASE}/admin/users`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
        fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
      ]);

      const meData = await meRes.json().catch(() => ({}));
      if (meRes.ok && meData?.id) {
        setMeId(String(meData.id));
      } else {
        setMeId(null);
      }

      const data = await usersRes.json().catch(() => ({}));
      if (!usersRes.ok) {
        setError(data?.message || "Could not load users.");
        setRows([]);
      } else {
        setRows(Array.isArray(data.users) ? data.users : []);
        if (typeof data.inactiveUserDays === "number") {
          setInactiveDays(data.inactiveUserDays);
        }
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

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filter, districtFilter]);

  const openDetail = async (id) => {
    const token = window.localStorage.getItem("dmews_token");
    if (!token) return;
    setDetailId(id);
    setDetail(null);
    setDetailLoading(true);
    setActionError("");
    try {
      const res = await fetch(`${API_BASE}/admin/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data?.message || "Failed to load user.");
        setDetailId(null);
      } else {
        setDetail(data);
      }
    } catch {
      setActionError("Network error.");
      setDetailId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailId(null);
    setDetail(null);
    setActionError("");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const token = window.localStorage.getItem("dmews_token");
    if (!token) return;
    setDeleteBusy(true);
    setActionError("");
    try {
      const res = await fetch(`${API_BASE}/admin/users/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data?.message || "Delete failed.");
      } else {
        setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
        setDeleteTarget(null);
        if (detailId === deleteTarget.id) closeDetail();
      }
    } catch {
      setActionError("Network error.");
    } finally {
      setDeleteBusy(false);
    }
  };

  // Unique districts for filter
  const districts = useMemo(() => {
    const distSet = new Set();
    rows.forEach((user) => {
      if (user.district && user.district.trim() !== "") {
        distSet.add(user.district);
      }
    });
    return Array.from(distSet).sort();
  }, [rows]);

  // Combined filtering
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      // Activity filter
      if (filter === "inactive" && !r.isInactive) return false;
      if (filter === "active" && (r.isInactive || r.isAdmin)) return false;
      if (filter === "admins" && !r.isAdmin) return false;
      // District filter
      if (districtFilter !== "all" && r.district !== districtFilter) return false;
      // Search filter
      if (!q) return true;
      return (
        (r.name || "").toLowerCase().includes(q) ||
        (r.email || "").toLowerCase().includes(q) ||
        (r.district || "").toLowerCase().includes(q) ||
        (r.mobile || "").includes(q)
      );
    });
  }, [rows, search, filter, districtFilter]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage]);

  const stats = useMemo(() => {
    const inactive = rows.filter((r) => r.isInactive && !r.isAdmin).length;
    const admins = rows.filter((r) => r.isAdmin).length;
    return { inactive, admins, total: rows.length };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Users</h1>
          <p className="mt-1 text-sm text-slate-600">
            View registered accounts, recent sign-ins, and remove{" "}
            <strong>inactive</strong> users only (no login in the last{" "}
            {inactiveDays} days, or never logged in with an account older than {inactiveDays}{" "}
            days). Admin accounts cannot be deleted here.
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
          <p className="font-semibold">You need a logged-in session</p>
          <p className="mt-2 text-amber-900/90">
            <Link
              href="/login?redirect=/admin/users"
              className="font-semibold text-amber-950 underline hover:text-amber-800"
            >
              Log in
            </Link>{" "}
            with an account whose email is listed in{" "}
            <code className="rounded bg-amber-100/80 px-1">ADMIN_EMAILS</code>, or use local{" "}
            <code className="rounded bg-amber-100/80 px-1">ALLOW_VOLUNTEER_ADMIN_ANY_USER=true</code>.
          </p>
        </div>
      )}
      {error && error !== "no_token" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {error}
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total users
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Inactive (eligible for removal)
            </p>
            <p className="mt-1 text-2xl font-bold text-amber-800">{stats.inactive}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Admin accounts
            </p>
            <p className="mt-1 text-2xl font-bold text-violet-800">{stats.admins}</p>
          </div>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, district, mobile…"
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none ring-sky-500/30 focus:border-sky-400 focus:ring-2"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-sky-400"
            >
              <option value="all">All users</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
              <option value="admins">Admins</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-sky-400"
            >
              <option value="all">All districts</option>
              {districts.map((dist) => (
                <option key={dist} value={dist}>
                  {dist}
                </option>
              ))}
            </select>
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
            <Users className="h-10 w-10 text-slate-300" />
            <p className="text-sm">No registered users in the database.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">District</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3">Last login</th>
                    <th className="px-4 py-3">Activity</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedUsers.map((row) => {
                    const canRemove =
                      row.isInactive &&
                      !row.isAdmin &&
                      meId &&
                      row.id !== meId;
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{row.name || "—"}</div>
                          <div className="text-xs text-slate-500">{row.email}</div>
                          {row.mobile ? (
                            <div className="text-xs text-slate-400">{row.mobile}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{row.district || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{fmtDate(row.createdAt)}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.lastLoginAt ? fmtDate(row.lastLoginAt) : (
                            <span className="text-amber-700">Never</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <ActivityBadge isInactive={row.isInactive} isAdmin={row.isAdmin} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openDetail(row.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </button>
                            <button
                              type="button"
                              disabled={!canRemove}
                              title={
                                !canRemove
                                  ? row.isAdmin
                                    ? "Admin accounts cannot be deleted"
                                    : !row.isInactive
                                      ? "Only inactive users can be removed"
                                      : row.id === meId
                                        ? "You cannot delete your own account"
                                        : "Log in to enable delete"
                                  : "Permanently delete inactive user"
                              }
                              onClick={() => {
                                setActionError("");
                                setDeleteTarget(row);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 sm:px-6">
                <div className="flex flex-1 justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="relative ml-3 inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-slate-700">
                      Showing{" "}
                      <span className="font-medium">
                        {(currentPage - 1) * itemsPerPage + 1}
                      </span>{" "}
                      to{" "}
                      <span className="font-medium">
                        {Math.min(currentPage * itemsPerPage, filtered.length)}
                      </span>{" "}
                      of <span className="font-medium">{filtered.length}</span> users
                    </p>
                  </div>
                  <div>
                    <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center rounded-l-md border border-slate-300 bg-white px-2 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 focus:z-20 disabled:opacity-40"
                      >
                        <span className="sr-only">Previous</span>
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`relative inline-flex items-center border px-4 py-2 text-sm font-medium focus:z-20 ${
                            page === currentPage
                              ? "z-10 border-sky-500 bg-sky-50 text-sky-600"
                              : "border-slate-300 bg-white text-slate-500 hover:bg-slate-50"
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center rounded-r-md border border-slate-300 bg-white px-2 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 focus:z-20 disabled:opacity-40"
                      >
                        <span className="sr-only">Next</span>
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {filtered.length === 0 && !loading && rows.length > 0 && (
        <p className="text-center text-sm text-slate-500">No users match your filters.</p>
      )}

      {/* Detail modal (unchanged) */}
      {detailId && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/60"
            onClick={closeDetail}
            aria-label="Close details"
          />
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <h3 className="text-lg font-semibold text-slate-900">User details</h3>
              <button
                type="button"
                onClick={closeDetail}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            {actionError && (
              <div className="mx-5 mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {actionError}
              </div>
            )}

            {detailLoading && (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
              </div>
            )}

            {!detailLoading && detail?.user && (
              <div className="space-y-5 px-5 py-5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <ActivityBadge
                    isInactive={detail.user.isInactive}
                    isAdmin={detail.user.isAdmin}
                  />
                  {detail.user.isInactive && !detail.user.isAdmin && (
                    <span className="text-xs text-slate-500">
                      Inactive rule: no login in {detail.inactiveUserDays ?? inactiveDays} days
                      (or never logged in with an old account).
                    </span>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <p>
                    <span className="font-semibold text-slate-700">Name:</span>{" "}
                    {detail.user.name || "—"}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Email:</span>{" "}
                    {detail.user.email}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Mobile:</span>{" "}
                    {detail.user.mobile || "—"}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">District:</span>{" "}
                    {detail.user.district || "—"}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Registered:</span>{" "}
                    {fmtDate(detail.user.createdAt)}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Profile updated:</span>{" "}
                    {fmtDate(detail.user.updatedAt)}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Last login:</span>{" "}
                    {detail.user.lastLoginAt ? fmtDate(detail.user.lastLoginAt) : "Never"}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Volunteer:</span>{" "}
                    {detail.user.volunteerStatus || "none"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Content counts
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-slate-700 sm:grid-cols-3">
                    <span>Incidents: {detail.counts?.incidents ?? 0}</span>
                    <span>SOS alerts: {detail.counts?.sos ?? 0}</span>
                    <span>Login events: {detail.counts?.loginLogs ?? 0}</span>
                    <span>Missing reports: {detail.counts?.missingPersonReports ?? 0}</span>
                    <span>Found reports: {detail.counts?.foundPersonReports ?? 0}</span>
                  </div>
                </div>

                {detail.volunteerApplication && (
                  <div className="rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">
                      Volunteer application
                    </p>
                    <p className="mt-1 text-slate-700">
                      Status:{" "}
                      <strong>{detail.volunteerApplication.status}</strong>
                      {detail.volunteerApplication.skills?.length ? (
                        <>
                          {" "}
                          · Skills: {detail.volunteerApplication.skills.join(", ")}
                        </>
                      ) : null}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Recent sign-ins (up to 25)
                  </p>
                  {!detail.recentLogins?.length ? (
                    <p className="mt-2 text-slate-500">No login history recorded.</p>
                  ) : (
                    <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-100 bg-white p-2 text-xs text-slate-600">
                      {detail.recentLogins.map((log, i) => (
                        <li key={`${log.at}-${i}`} className="border-b border-slate-50 pb-2 last:border-0">
                          <span className="font-medium text-slate-800">{fmtDate(log.at)}</span>
                          {log.ip ? (
                            <span className="ml-2 text-slate-500">IP {log.ip}</span>
                          ) : null}
                          {log.userAgent ? (
                            <div className="mt-0.5 line-clamp-2 text-slate-400">{log.userAgent}</div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {detail.user.isInactive &&
                  !detail.user.isAdmin &&
                  meId &&
                  detail.user.id !== meId && (
                    <button
                      type="button"
                      onClick={() => {
                        setActionError("");
                        setDeleteTarget(detail.user);
                        closeDetail();
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-100"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove inactive user…
                    </button>
                  )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation modal (unchanged) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/60"
            onClick={() => !deleteBusy && setDeleteTarget(null)}
            aria-label="Cancel delete"
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Remove inactive user?</h3>
            <p className="mt-2 text-sm text-slate-600">
              This permanently deletes{" "}
              <strong>{deleteTarget.name || deleteTarget.email}</strong> ({deleteTarget.email}).
              Their incidents and SOS records are removed; missing/found person reports they filed
              stay public but are detached from this account.
            </p>
            {actionError && (
              <p className="mt-3 text-sm text-rose-600">{actionError}</p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={confirmDelete}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {deleteBusy ? "Removing…" : "Delete user"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}