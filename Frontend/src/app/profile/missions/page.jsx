"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Loader from "@/components/Loader";
import { AlertCircle, MapPin, ArrowLeft, Users, Calendar, Clock, Flame, Leaf } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const UrgencyBadge = ({ urgency }) => {
  const config = {
    high: { label: "High Urgency", color: "bg-rose-100 text-rose-800", icon: Flame },
    medium: { label: "Medium Urgency", color: "bg-amber-100 text-amber-800", icon: Clock },
    low: { label: "Low Urgency", color: "bg-emerald-100 text-emerald-800", icon: Leaf },
  };
  const { label, color, icon: Icon } = config[urgency] || config.medium;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
};

export default function MyMissionsPage() {
  const router = useRouter();
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("dmews_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    const fetchMissions = async () => {
      try {
        const res = await fetch(`${API_BASE}/missions/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.message || "Failed to load missions.");
          return;
        }
        const missionsList = Array.isArray(data?.missions) ? data.missions : [];
        setMissions(missionsList);
      } catch {
        setError("Network error.");
      } finally {
        setLoading(false);
      }
    };

    fetchMissions();
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
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-700 pb-12 pt-8 shadow-lg">
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
                <h1 className="text-2xl font-bold text-white sm:text-3xl">Missions I Joined</h1>
                <p className="mt-1 text-sm text-emerald-100">
                  {missions.length} {missions.length === 1 ? "mission" : "missions"} actively supported
                </p>
              </div>
            </div>
            <div className="rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
              <Users className="mr-2 inline-block h-4 w-4" />
              Your volunteer contributions
            </div>
          </div>
        </div>
        <div className="absolute inset-0 bg-black/10" />
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {missions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="rounded-full bg-slate-100 p-4">
              <Users className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">No missions joined yet</h3>
            <p className="mt-2 text-sm text-slate-500">
              {
                "You haven't volunteered for any missions. Check available missions to lend a hand."
              }
            </p>
            <Link href="/volunteer"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
            >
              <MapPin className="h-4 w-4" />
              Find missions
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {missions.map((m) => (
              <div
                key={m.id}
                className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-slate-300"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold text-slate-900 group-hover:text-emerald-600 transition">
                      {m.title || "Untitled Mission"}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {m.district || "Unknown district"}
                      </span>
                      {m.startDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(m.startDate).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <UrgencyBadge urgency={m.urgency} />
                </div>

                {m.description && (
                  <p className="mt-3 text-sm text-slate-600 line-clamp-3">{m.description}</p>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>👥 Volunteers: {m.joinedCount ?? 1} / {m.volunteersNeeded || "?"}</span>
                  </div>
                  <button className="text-xs font-medium text-emerald-600 hover:text-emerald-700">
                     View mission details →
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