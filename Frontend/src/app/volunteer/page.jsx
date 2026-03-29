"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Heart,
  Shield,
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function VolunteerPage() {
  const router = useRouter();
  const [token, setToken] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [volunteer, setVolunteer] = useState(null);

  const [message, setMessage] = useState("");
  const [skills, setSkills] = useState("");
  const [availability, setAvailability] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = window.localStorage.getItem("dmews_token");
    if (!t) {
      router.replace("/login?redirect=/volunteer");
      setAuthChecked(true);
      return;
    }
    setToken(t);
    setAuthChecked(true);

    async function load() {
      try {
        const res = await fetch(`${API_BASE}/volunteers/me`, {
          headers: { Authorization: `Bearer ${t}` },
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.volunteer) {
          setVolunteer(data.volunteer);
          setMessage(data.volunteer.message || "");
          setSkills(data.volunteer.skills || "");
          setAvailability(data.volunteer.availability || "");
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/volunteers/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message, skills, availability }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Could not submit your request.");
      } else {
        setSuccess(
          data?.volunteer?.status === "pending"
            ? "Your request was submitted. An admin will review it soon."
            : "Saved."
        );
        if (data?.volunteer) setVolunteer(data.volunteer);
        if (data?.user && typeof window !== "undefined") {
          window.localStorage.setItem("dmews_user", JSON.stringify(data.user));
          window.dispatchEvent(new Event("dmews-auth-changed"));
        }
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
      </div>
    );
  }

  if (!token) return null;

  const status = volunteer?.status;
  const approved = status === "approved";
  const pending = status === "pending";
  const rejected = status === "rejected";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      

      <div className="overflow-hidden rounded-2xl border border-sky-200/80 bg-white shadow-lg">
        <div className="bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 px-6 py-8 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
              <Heart className="h-7 w-7" />
            </span>
            <div>
              <h1 className="font-oswald text-2xl font-semibold tracking-wide">
                Emergency volunteers
              </h1>
              <p className="mt-1 text-sm text-rose-50/95">
                Sign up to help your community during disasters. Admin approval
                required.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-6 sm:p-8">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
            </div>
          ) : approved ? (
            <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-emerald-900">
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">You are a verified volunteer</p>
                <p className="mt-1 text-sm text-emerald-800/90">
                  Thank you. A blue check appears next to your name in the
                  header. Stay ready for alerts from officials.
                </p>
              </div>
            </div>
          ) : pending ? (
            <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-amber-950">
              <Shield className="h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Application pending</p>
                <p className="mt-1 text-sm text-amber-900/90">
                  An administrator will approve or reject your request. You can
                  update your details below while waiting.
                </p>
              </div>
            </div>
          ) : rejected ? (
            <div className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-rose-950">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Previous request was not approved</p>
                <p className="mt-1 text-sm text-rose-900/90">
                  You can submit a new application below.
                </p>
              </div>
            </div>
          ) : null}

          {!approved && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  How can you help? *
                </label>
                <textarea
                  required
                  minLength={10}
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. First aid, logistics, community outreach, transport in Colombo district…"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Skills (optional)
                </label>
                <input
                  type="text"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="Languages, certifications, equipment you can bring…"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Availability (optional)
                </label>
                <input
                  type="text"
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  placeholder="e.g. Weekends, evenings, on-call during warnings"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || approved}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : pending ? (
                  "Update application"
                ) : (
                  "Submit volunteer application"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
