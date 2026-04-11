"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Loader from "@/components/Loader";
import {
  AlertCircle,
  MapPin,
  ArrowLeft,
  FileText,
  Calendar,
  Clock,
  CheckCircle,
  UserSearch,
  UserRoundSearch,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const StatusBadge = ({ status }) => {
  const config = {
    reported: { label: "Reported", color: "bg-blue-100 text-blue-800", icon: Clock },
    approved: { label: "Approved", color: "bg-green-100 text-green-800", icon: CheckCircle },
    resolved: { label: "Resolved", color: "bg-gray-100 text-gray-800", icon: CheckCircle },
    rejected: { label: "Rejected", color: "bg-red-100 text-red-800", icon: AlertCircle },
  };
  const { label, color, icon: Icon } = config[status] || config.reported;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
};

const getIncidentMedia = (media) => {
  const media0 = Array.isArray(media) ? media[0] : null;
  if (!media0?.url) return null;
  const url = media0.url;
  const isVideo =
    media0.resourceType === "video" ||
    String(url).match(/\.(mp4|webm|mov)(\?|$)/i);
  return { url, isVideo };
};

function formatShortDate(value) {
  if (!value) return "Unknown date";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MyIncidentsPage() {
  const router = useRouter();
  const [incidents, setIncidents] = useState([]);
  const [missingPersons, setMissingPersons] = useState([]);
  const [foundPersons, setFoundPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const totalCount = incidents.length + missingPersons.length + foundPersons.length;

  const summaryLabel = useMemo(() => {
    const parts = [];
    if (incidents.length) {
      parts.push(`${incidents.length} incident${incidents.length === 1 ? "" : "s"}`);
    }
    if (missingPersons.length) {
      parts.push(`${missingPersons.length} missing`);
    }
    if (foundPersons.length) {
      parts.push(`${foundPersons.length} found`);
    }
    if (parts.length === 0) return "No reports yet";
    return parts.join(" · ");
  }, [incidents.length, missingPersons.length, foundPersons.length]);

  useEffect(() => {
    const token = localStorage.getItem("dmews_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    const load = async () => {
      try {
        const [incRes, personRes] = await Promise.all([
          fetch(`${API_BASE}/incidents/my`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/missing-persons/my`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const incData = await incRes.json().catch(() => ({}));
        if (!incRes.ok) {
          setError(incData?.message || "Failed to load incidents.");
          return;
        }
        setIncidents(Array.isArray(incData) ? incData : []);

        const personData = await personRes.json().catch(() => ({}));
        if (personRes.ok) {
          setMissingPersons(Array.isArray(personData.missing) ? personData.missing : []);
          setFoundPersons(Array.isArray(personData.found) ? personData.found : []);
        } else {
          setMissingPersons([]);
          setFoundPersons([]);
        }
      } catch {
        setError("Network error.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section - unchanged */}
      <div className="relative overflow-hidden bg-gradient-to-r from-sky-600 to-sky-800 pb-12 pt-8 shadow-lg">
        <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                className="rounded-full bg-white/20 p-2 text-white transition hover:bg-white/30"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white sm:text-3xl">My reports</h1>
                <p className="mt-1 text-sm text-sky-100">{summaryLabel}</p>
              </div>
            </div>
            <div className="rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
              <FileText className="mr-2 inline-block h-4 w-4" />
              {totalCount} total
            </div>
          </div>
        </div>
        <div className="absolute inset-0 bg-black/10" />
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="rounded-full bg-slate-100 p-4">
              <FileText className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">No reports yet</h3>
            <p className="mt-2 text-sm text-slate-500">
              You have not submitted any emergency incidents or missing / found person reports while signed in.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/report-incident"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
              >
                <AlertCircle className="h-4 w-4" />
                Report an incident
              </Link>
              <Link
                href="/incidents/missing-persons"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                <UserSearch className="h-4 w-4" />
                Missing &amp; found persons
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* LEFT COLUMN: Emergency Incidents */}
            <div>
              {incidents.length > 0 ? (
                <section>
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <FileText className="h-5 w-5 text-sky-600" />
                    Emergency incidents
                  </h2>
                  <div className="space-y-4">
                    {incidents.map((inc) => (
                      <div
                        key={inc.id}
                        className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-lg font-semibold text-slate-900 transition group-hover:text-sky-600">
                              {inc.title || "Untitled Incident"}
                            </h3>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {inc.district || "Unknown district"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {formatShortDate(inc.reportedAt)}
                              </span>
                            </div>
                          </div>
                          <StatusBadge status={inc.status} />
                        </div>

                        {inc.description ? (
                          <p className="mt-3 line-clamp-3 text-sm text-slate-600">{inc.description}</p>
                        ) : null}

                        {(() => {
                          const media = getIncidentMedia(inc.media);
                          if (!media) return null;
                          return (
                            <div className="mt-4 overflow-hidden rounded-2xl bg-slate-50">
                              {media.isVideo ? (
                                <video src={media.url} controls className="max-h-72 w-full object-cover" />
                              ) : (
                                <img
                                  src={media.url}
                                  alt={inc.title || "Incident media"}
                                  className="w-full rounded-2xl object-cover"
                                />
                              )}
                            </div>
                          );
                        })()}

                        <div className="mt-4 flex justify-end">
                          <Link
                            href="/incidents"
                            className="text-xs font-medium text-sky-600 hover:text-sky-700"
                          >
                            View incidents →
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                  <FileText className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm text-slate-500">No emergency incidents reported.</p>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Persons (Missing + Found) */}
            <div className="space-y-8">
              {/* Missing Persons */}
              {missingPersons.length > 0 ? (
                <section>
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <UserSearch className="h-5 w-5 text-amber-600" />
                    Missing person reports
                  </h2>
                  <div className="space-y-4">
                    {missingPersons.map((person) => (
                      <div
                        key={person.id}
                        className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-lg font-semibold text-slate-900 transition group-hover:text-sky-600">
                              {person.fullName || "Missing person"}
                            </h3>
                            <p className="mt-0.5 text-sm text-slate-500">
                              Age {person.age}
                              {person.gender ? ` · ${person.gender}` : ""}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-4 w-4 shrink-0" />
                                {person.lastSeenLocation || "—"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4 shrink-0" />
                                Missing since {formatShortDate(person.dateMissing)}
                              </span>
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">
                            Missing
                          </span>
                        </div>
                        {person.description ? (
                          <p className="mt-3 line-clamp-3 text-sm text-slate-600">{person.description}</p>
                        ) : null}
                        {person.photoUrl ? (
                          <div className="mt-4 overflow-hidden rounded-2xl bg-slate-50">
                            <img
                              src={person.photoUrl}
                              alt={person.fullName || "Missing person"}
                              className="max-h-72 w-full object-cover"
                            />
                          </div>
                        ) : null}
                        <div className="mt-4 flex justify-end">
                          <Link
                            href="/incidents/missing-persons"
                            className="text-xs font-medium text-sky-600 hover:text-sky-700"
                          >
                            Open missing &amp; found page →
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Found Persons */}
              {foundPersons.length > 0 ? (
                <section>
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <UserRoundSearch className="h-5 w-5 text-emerald-600" />
                    Found person reports
                  </h2>
                  <div className="space-y-4">
                    {foundPersons.map((person) => (
                      <div
                        key={person.id}
                        className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-lg font-semibold text-slate-900 transition group-hover:text-sky-600">
                              {person.name || "Unknown"}
                            </h3>
                            <p className="mt-0.5 text-sm text-slate-500">
                              {person.age != null ? `Age ${person.age}` : "Age not given"}
                              {person.gender ? ` · ${person.gender}` : ""}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-4 w-4 shrink-0" />
                                {person.locationFound || "—"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4 shrink-0" />
                                Found {formatShortDate(person.dateFound)}
                              </span>
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900">
                            Found
                          </span>
                        </div>
                        {person.description ? (
                          <p className="mt-3 line-clamp-3 text-sm text-slate-600">{person.description}</p>
                        ) : null}
                        {person.photoUrl ? (
                          <div className="mt-4 overflow-hidden rounded-2xl bg-slate-50">
                            <img
                              src={person.photoUrl}
                              alt={person.name || "Found person"}
                              className="max-h-72 w-full object-cover"
                            />
                          </div>
                        ) : null}
                        <div className="mt-4 flex justify-end">
                          <Link
                            href="/incidents/missing-persons"
                            className="text-xs font-medium text-sky-600 hover:text-sky-700"
                          >
                            Open missing &amp; found page →
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* If no missing or found persons at all */}
              {missingPersons.length === 0 && foundPersons.length === 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                  <UserSearch className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm text-slate-500">No missing or found person reports.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}