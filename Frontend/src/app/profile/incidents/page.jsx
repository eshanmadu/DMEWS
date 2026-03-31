"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Loader from "@/components/Loader";
import { AlertCircle, MapPin, ArrowLeft, FileText, Calendar, Clock, CheckCircle } from "lucide-react";

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

export default function MyIncidentsPage() {
  const router = useRouter();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("dmews_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    const fetchIncidents = async () => {
      try {
        const res = await fetch(`${API_BASE}/incidents/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.message || "Failed to load incidents.");
          return;
        }
        setIncidents(Array.isArray(data) ? data : []);
      } catch {
        setError("Network error.");
      } finally {
        setLoading(false);
      }
    };

    fetchIncidents();
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
      {/* Hero Header */}
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
                <h1 className="text-2xl font-bold text-white sm:text-3xl">My Reported Incidents</h1>
                <p className="mt-1 text-sm text-sky-100">
                  {incidents.length} {incidents.length === 1 ? "incident" : "incidents"} reported
                </p>
              </div>
            </div>
            <div className="rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
              <FileText className="mr-2 inline-block h-4 w-4" />
              Your emergency reports
            </div>
          </div>
        </div>
        <div className="absolute inset-0 bg-black/10" />
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="rounded-full bg-slate-100 p-4">
              <FileText className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">No incidents reported</h3>
            <p className="mt-2 text-sm text-slate-500">
              You haven't reported any emergencies yet. When you do, they'll appear here.
            </p>
            <Link
              href="/report-incident"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              <AlertCircle className="h-4 w-4" />
              Report an incident
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {incidents.map((inc) => (
              <div
                key={inc.id}
                className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-slate-300"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold text-slate-900 group-hover:text-sky-600 transition">
                      {inc.title || "Untitled Incident"}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {inc.district || "Unknown district"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {inc.reportedAt
                          ? new Date(inc.reportedAt).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "Unknown date"}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={inc.status} />
                </div>

                {inc.description && (
                  <p className="mt-3 text-sm text-slate-600 line-clamp-3">{inc.description}</p>
                )}

                {(() => {
                  const media = getIncidentMedia(inc.media);
                  if (!media) return null;
                  return (
                    <div className="mt-4 overflow-hidden rounded-2xl bg-slate-50">
                      {media.isVideo ? (
                        <video
                          src={media.url}
                          controls
                          className="w-full max-h-72 object-cover"
                        />
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
                  <button className="text-xs font-medium text-sky-600 hover:text-sky-700">
                   <Link href="/incidents"> View details →</Link>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}