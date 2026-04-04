"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Loader2,
  UploadCloud,
  ImageIcon,
  Video,
  MapPin,
  Trash2,
  X,
  Pencil,
  Save,
  ShieldAlert,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import Loader from "@/components/Loader";
import Background from "@/img/Background.png";

// Helper: format date only (for incident date)
function formatDateOnly(isoString) {
  if (!isoString) return "Unknown date";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "Invalid date";
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "Invalid date";
  }
}

// Helper: format time only (for submission time)
function formatTimeOnly(isoString) {
  if (!isoString) return "Unknown time";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "Invalid time";
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "Invalid time";
  }
}

function StatusBadge({ status }) {
  const c =
    status === "resolved"
      ? "badge-success"
      : status === "responding"
      ? "badge-info"
      : status === "assessing"
      ? "badge-warning"
      : "badge-critical";
  return <span className={`badge ${c} !rounded-full !px-3 !py-1 !text-xs !font-medium shadow-sm`}>{status}</span>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const DISTRICTS = [
  "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya",
  "Galle", "Matara", "Hambantota", "Jaffna", "Kilinochchi", "Mannar",
  "Vavuniya", "Mullaitivu", "Batticaloa", "Ampara", "Trincomalee",
  "Kurunegala", "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla",
  "Monaragala", "Ratnapura", "Kegalle",
];

function inferDistrict(incident) {
  if (incident?.district) return incident.district;
  const area = String(incident?.area || "");
  const m = area.match(/^([A-Za-z ]+?)\s+District\b/i);
  if (m?.[1]) return m[1].trim();
  const first = area.split(",")[0]?.trim();
  return first || "Other";
}

function getIncidentDateBounds() {
  const maxDate = new Date().toISOString().slice(0, 10);
  const minMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const minDate = new Date(minMs).toISOString().slice(0, 10);
  return { minDate, maxDate };
}

export default function IncidentsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");

  // Report form state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [district, setDistrict] = useState("");
  const [area, setArea] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reportedAt, setReportedAt] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Edit state
  const [editingIncident, setEditingIncident] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", description: "" });
  const [editFile, setEditFile] = useState(null);
  const [editFilePreview, setEditFilePreview] = useState(null);
  const [updating, setUpdating] = useState(false);

  const token = typeof window !== "undefined" ? window.localStorage.getItem("dmews_token") : null;
  const { minDate, maxDate } = useMemo(() => getIncidentDateBounds(), []);

  useEffect(() => {
    if (!isReportModalOpen) return;
    setReportedAt(maxDate);
  }, [isReportModalOpen, maxDate]);

  const currentUser = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem("dmews_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedDistrict = window.localStorage.getItem("dmews_user_district");
    if (savedDistrict && !district) setDistrict(savedDistrict);
  }, [district]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = districtFilter ? `?district=${encodeURIComponent(districtFilter)}` : "";
      const res = await fetch(`${API_BASE}/incidents${qs}`, { cache: "no-store" });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        setError(data?.message || "Failed to load incidents.");
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
  }, [districtFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const sortedIncidents = useMemo(() => {
    return rows.slice().sort((a, b) =>
      new Date(b?.createdAt || b?.reportedAt || 0).getTime() -
      new Date(a?.createdAt || a?.reportedAt || 0).getTime()
    );
  }, [rows]);

  const filePreviewUrl = useMemo(() => {
    if (!file) return null;
    try {
      return URL.createObjectURL(file);
    } catch {
      return null;
    }
  }, [file]);

  useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    };
  }, [filePreviewUrl]);

  useEffect(() => {
    if (!editFile) {
      setEditFilePreview(null);
      return;
    }
    try {
      const url = URL.createObjectURL(editFile);
      setEditFilePreview(url);
      return () => URL.revokeObjectURL(url);
    } catch {
      setEditFilePreview(null);
    }
  }, [editFile]);

  async function submit(e) {
    e.preventDefault();
    setNotice("");
    if (!token) {
      setNotice("Please log in to report an incident.");
      return;
    }
    if (!district || !area.trim() || !title.trim() || !description.trim()) {
      setNotice("District, area, title and description are required.");
      return;
    }
    if (!reportedAt) {
      setNotice("Incident date is required.");
      return;
    }
    if (reportedAt > maxDate) {
      setNotice("You can't choose an upcoming date.");
      return;
    }
    if (reportedAt < minDate) {
      setNotice("You can only choose a date up to 7 days ago.");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("district", district);
      fd.set("area", area.trim());
      fd.set("title", title.trim());
      fd.set("description", description.trim());
      fd.set("reportedAt", reportedAt);
      if (file) fd.set("media", file);

      const res = await fetch(`${API_BASE}/incidents/report`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data?.message || "Failed to report incident.");
      } else {
        setTitle("");
        setDescription("");
        setFile(null);
        setDistrict("");
        setArea("");
        setNotice("");
        setIsReportModalOpen(false);
        await load();
      }
    } catch {
      setNotice("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  async function doDelete(id) {
    if (!token) {
      setNotice("Please log in.");
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/incidents/report/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data?.message || "Failed to delete incident.");
      } else {
        setNotice(data?.message || "Incident deleted.");
        setConfirmDelete(null);
        await load();
      }
    } catch {
      setNotice("Network error.");
    } finally {
      setDeleting(false);
    }
  }

  function startEdit(incident) {
    setEditingIncident({
      id: incident.id,
      title: incident.title,
      description: incident.description,
    });
    setEditForm({ title: incident.title, description: incident.description });
    setEditFile(null);
    setEditFilePreview(null);
  }

  async function doUpdate(e) {
    e.preventDefault();
    if (!token) {
      setNotice("Please log in.");
      return;
    }
    if (!editForm.title.trim() || !editForm.description.trim()) {
      setNotice("Title and description are required.");
      return;
    }
    setUpdating(true);
    setNotice("");
    try {
      const fd = new FormData();
      fd.set("title", editForm.title.trim());
      fd.set("description", editForm.description.trim());
      if (editFile) fd.set("media", editFile);

      const res = await fetch(`${API_BASE}/incidents/report/${editingIncident.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data?.message || "Failed to update incident.");
      } else {
        setNotice("Incident updated.");
        setEditingIncident(null);
        await load();
      }
    } catch {
      setNotice("Network error.");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="relative mb-12 overflow-hidden rounded-2xl bg-gradient-to-r from-sky-700 via-sky-600 to-sky-700 shadow-lg">
        <div className="relative z-10 px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:gap-6 sm:text-left">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 shadow-sm">
              <AlertTriangle className="h-8 w-8 text-amber-300" />
            </div>
            <div className="flex-1">
              <h1 className="font-oswald text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Incident Reports
              </h1>
              <p className="mt-2 max-w-2xl text-sky-100">
                Capture incidents. Share updates. Track what’s happening near you.
              </p>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 bg-black/5" />
      </div>

      <div className="mb-6 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Filter by district
          </label>
          <select
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
          >
            <option value="">All districts</option>
            {DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-300"
          >
            <UploadCloud className="h-5 w-5" />
            Report Incident
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[280px] items-center justify-center">
          <Loader />
        </div>
      ) : (
        <div className="space-y-12">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
              <AlertTriangle className="mb-4 h-12 w-12 text-slate-300" />
              <p className="text-slate-600">No reported incidents.</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {sortedIncidents.map((incident) => {
                const media0 = Array.isArray(incident.media) ? incident.media[0] : null;
                const isVideo =
                  media0?.resourceType === "video" ||
                  String(media0?.url || "").match(/\.(mp4|webm|mov)(\?|$)/i);
                const reporterName = incident?.reporter?.name || incident?.reporter?.email || "Anonymous";
                const canDelete =
                  incident?.source === "user" &&
                  Boolean(currentUser?.id) &&
                  String(incident?.reporter?.id || "") === String(currentUser?.id);
                const districtName = incident.district || inferDistrict(incident);

                // Incident date (when event happened)
                const incidentDateOnly = formatDateOnly(incident.reportedAt);
                // Submission time (when report was created)
                const submissionTimeOnly = formatTimeOnly(incident.createdAt || incident.updatedAt);

                return (
                  <div
                    key={incident.id}
                    className="group flex h-full flex-col rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-md overflow-hidden"
                  >
                    {/* Media + district pill */}
                    {media0?.url ? (
                      <div className="relative overflow-hidden">
                        {isVideo ? (
                          <video src={media0.url} controls className="w-full" />
                        ) : (
                          <div className="relative aspect-[16/9] w-full bg-slate-100">
                            <Image
                              src={media0.url}
                              alt={incident.title || "Incident media"}
                              fill
                              className="object-cover transition-transform group-hover:scale-105"
                              sizes="(max-width: 768px) 100vw, 50vw"
                              unoptimized
                            />
                          </div>
                        )}
                        <div className="absolute left-3 top-3 z-10 rounded-full bg-white/80 backdrop-blur-sm px-3 py-1 shadow-md border border-white/30">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                            <MapPin className="h-3 w-3 text-rose-500" />
                            <span>{districtName}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="relative overflow-hidden">
                        <div className="relative aspect-[16/9] w-full bg-slate-100">
                          <Image
                            src={Background}
                            alt="Default incident thumbnail"
                            fill
                            className="object-cover transition-transform group-hover:scale-105"
                            sizes="(max-width: 768px) 100vw, 50vw"
                            unoptimized
                          />
                        </div>
                        <div className="absolute left-3 top-3 z-10 rounded-full bg-white/80 backdrop-blur-sm px-3 py-1 shadow-md border border-white/30">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                            <MapPin className="h-3 w-3 text-rose-500" />
                            <span>{districtName}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={incident.status} />
                          <span className="text-xs font-semibold text-slate-500 capitalize">
                            {incident.source === "user" ? "Community" : incident.type}
                          </span>
                        </div>
                      </div>

                      <h3 className="mt-3 text-lg font-semibold text-slate-800">
                        {incident.title}
                      </h3>
                      {incident.source === "user" && (
                        <p className="mt-1 text-xs text-slate-500">
                          Reported by <span className="font-semibold text-slate-700">{reporterName}</span>
                        </p>
                      )}
                      <p className="mt-1 text-sm text-slate-600 line-clamp-3">
                        {incident.description}
                      </p>

                      {/* Details row: Area, Affected, and INCIDENT DATE */}
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span><strong>Area:</strong> {incident.area}</span>
                        {incident.affectedPeople != null && (
                          <span><strong>Affected:</strong> {incident.affectedPeople}</span>
                        )}
                        <span><strong>Incident date:</strong> {incidentDateOnly}</span>
                      </div>

                      {/* Bottom row: Edit/Delete buttons + SUBMISSION TIME */}
                      <div className="mt-4 flex items-center justify-end gap-2">
                        {canDelete && (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(incident)}
                              className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 transition hover:bg-sky-100"
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete({ id: incident.id, title: incident.title })}
                              className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </>
                        )}
                        <span className="ml-auto text-[10px] font-medium text-slate-400">
                          Submitted {submissionTimeOnly}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Safety Tips */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-gradient-to-r from-amber-50 to-amber-50/50 px-5 py-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
                <h2 className="text-lg font-semibold text-slate-800">Incident Reporting Tips</h2>
              </div>
              <p className="mt-1 text-sm text-slate-600">Help responders by providing accurate information.</p>
            </div>
            <div className="p-5">
              <ul className="space-y-2 text-sm text-slate-700">
                <li>✓ Be specific about location (landmarks, street names).</li>
                <li>✓ Mention any injuries or urgent needs.</li>
                <li>✓ Include photos/videos if safe to do so.</li>
                <li>✓ Avoid sharing unverified details that could cause panic.</li>
                <li>✓ For emergencies, call <strong>117</strong> immediately.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <p className="mt-10 text-center text-sm text-slate-500">
        For emergencies, call <strong>117</strong> or your local police.
        <Link href="/" className="ml-2 text-sky-600 hover:underline">Back to dashboard</Link>.
      </p>

      {/* Report Incident Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => (submitting ? null : setIsReportModalOpen(false))}
            aria-label="Close"
          />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl border border-sky-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-sky-600 to-sky-500 px-5 py-4 text-white sticky top-0 z-10">
              <div>
                <h3 className="text-lg font-bold">Report an incident</h3>
                <p className="mt-1 text-xs text-sky-100">
                  Logged-in users can submit incidents. Media uploads use Cloudinary.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                disabled={submitting}
                className="rounded-lg p-1 text-white/90 transition hover:bg-white/15 disabled:opacity-60"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-6 px-5 py-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  District
                </label>
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                  required
                >
                  <option value="">Select district</option>
                  {DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Area
                  </label>
                  <input
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    maxLength={200}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                    placeholder="Landmark / street / town"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Title
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={120}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                    placeholder="Short headline"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Incident date
                </label>
                <input
                  type="date"
                  value={reportedAt}
                  onChange={(e) => setReportedAt(e.target.value)}
                  min={minDate}
                  max={maxDate}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                  required
                />
                <p className="mt-1 text-xs text-slate-400">
                  Can&apos;t pick future dates. Oldest allowed is 7 days ago.
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                  rows={5}
                  className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                  placeholder="What happened? Where exactly? Any injuries? Need urgent help?"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Optional photo/video
                </label>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-sky-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-sky-700 hover:file:bg-sky-200"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Max 25MB. Supported formats: JPG, PNG, MP4, MOV, WEBM.
                </p>
              </div>

              {filePreviewUrl && (
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
                    {file?.type?.startsWith("video/") ? (
                      <Video className="h-4 w-4 text-rose-500" />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-emerald-500" />
                    )}
                    Preview
                  </div>
                  <div className="p-3">
                    {file?.type?.startsWith("video/") ? (
                      <video src={filePreviewUrl} controls className="w-full rounded-lg" />
                    ) : (
                      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-slate-100">
                        <Image
                          src={filePreviewUrl}
                          alt="Incident media preview"
                          fill
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {notice && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {notice}
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  disabled={submitting}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-sky-500 disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                  {submitting ? "Submitting…" : "Submit incident"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[1200] flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => (deleting ? null : setConfirmDelete(null))}
            aria-label="Close"
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-rose-600 to-red-600 px-5 py-4 text-white">
              <div>
                <h3 className="text-lg font-bold">Delete incident report?</h3>
                <p className="mt-1 text-xs text-rose-100">
                  This will permanently remove your report from the incidents feed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="rounded-lg p-1 text-white/90 transition hover:bg-white/15 disabled:opacity-60"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Report
                </div>
                <div className="mt-1 font-semibold text-slate-900">
                  {confirmDelete.title || "Untitled"}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  disabled={deleting}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => doDelete(confirmDelete.id)}
                  disabled={deleting}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {deleting ? "Deleting…" : "Yes, delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingIncident && (
        <div className="fixed inset-0 z-[1200] flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => (updating ? null : setEditingIncident(null))}
            aria-label="Close"
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-sky-600 to-sky-500 px-5 py-4 text-white">
              <div>
                <h3 className="text-lg font-bold">Edit incident report</h3>
                <p className="mt-1 text-xs text-sky-100">
                  Update your report details.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingIncident(null)}
                disabled={updating}
                className="rounded-lg p-1 text-white/90 transition hover:bg-white/15 disabled:opacity-60"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={doUpdate} className="space-y-4 px-5 py-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Title
                </label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  maxLength={120}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Description
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  maxLength={2000}
                  rows={4}
                  className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-4 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Replace media (optional)
                </label>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm"
                />
                {editFilePreview && (
                  <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2">
                    {editFile?.type?.startsWith("video/") ? (
                      <video src={editFilePreview} controls className="max-h-40 w-full rounded" />
                    ) : (
                      <img src={editFilePreview} alt="Preview" className="max-h-40 w-full object-contain" />
                    )}
                  </div>
                )}
              </div>

              {notice && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {notice}
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setEditingIncident(null)}
                  disabled={updating}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-60"
                >
                  {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {updating ? "Updating…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}