"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Loader from "@/components/Loader";
import {
  Building2,
  MapPin,
  Users,
  Phone,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Navigation,
  PhoneCall,
  Clock,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const DOS = [
  "Follow official evacuation orders and go to the nearest designated shelter.",
  "Take your emergency kit (medicines, documents, water, torch).",
  "Stay calm and help children and elderly reach the shelter safely.",
  "Listen to radio or check DisasterWatch for updates.",
  "Register at the shelter and stay until authorities say it is safe to return.",
  "Keep family together and inform shelter staff of any medical needs.",
];

const DONTS = [
  "Do not ignore evacuation warnings or wait until the last moment.",
  "Do not walk or drive through floodwater—depth and currents can be dangerous.",
  "Do not return home until officials declare the area safe.",
  "Do not use generators or open flames inside shelters.",
  "Do not spread unverified rumours; rely on official sources only.",
  "Do not leave children or vulnerable people unattended.",
];

export default function SheltersPage() {
  const [shelters, setShelters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userDistrict, setUserDistrict] = useState(null);

  useEffect(() => {
    let user = null;
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem("dmews_user") : null;
      user = raw ? JSON.parse(raw) : null;
    } catch {}
    const district = (user?.district || "").trim();
    setUserDistrict(district || null);
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/shelters`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setShelters(data);
        else setError(data?.message || "Failed to load shelters.");
      })
      .catch((e) => setError(e?.message || "Failed to load shelters."))
      .finally(() => setLoading(false));
  }, []);

  const nearYou = userDistrict
    ? shelters.filter((s) => s.district?.toLowerCase() === userDistrict.toLowerCase())
    : [];
  const others = userDistrict
    ? shelters.filter((s) => s.district?.toLowerCase() !== userDistrict.toLowerCase())
    : shelters;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="relative mb-12 overflow-hidden rounded-2xl bg-gradient-to-r from-sky-700 via-sky-600 to-sky-700 shadow-lg">
        <div className="relative z-10 px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:gap-6 sm:text-left">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 shadow-sm">
              <Building2 className="h-8 w-8 text-amber-300" />
            </div>
            <div>
              <h1 className="font-oswald text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Evacuation Shelters
              </h1>
              <p className="mt-2 max-w-2xl text-sky-100">
                Find designated shelters near you. When logged in, we show shelters in your district first.
              </p>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 bg-black/5" />
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
          {/* Shelters near you */}
          {userDistrict && nearYou.length > 0 && (
            <section>
              <div className="mb-5 flex items-center gap-2">
                <div className="rounded-full bg-sky-100 p-2">
                  <Navigation className="h-5 w-5 text-sky-700" />
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-800">
                  Shelters in your district <span className="text-sky-600">({userDistrict})</span>
                </h2>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {nearYou.map((s) => (
                  <ShelterCard key={s.id} shelter={s} highlight />
                ))}
              </div>
            </section>
          )}

          {/* All shelters / Other shelters */}
          <section>
            <div className="mb-5 flex items-center gap-2">
              <div className="rounded-full bg-sky-100 p-2">
                <Building2 className="h-5 w-5 text-sky-700" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-800">
                {userDistrict && nearYou.length > 0 ? "Other Shelters" : "All Shelters"}
              </h2>
            </div>
            {others.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
                <Building2 className="mb-4 h-12 w-12 text-slate-300" />
                <p className="text-slate-600">No shelters listed yet. Check back later or contact your local disaster management centre.</p>
                <p className="mt-2 text-sm font-medium text-slate-500">Emergency: 117</p>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {others.map((s) => (
                  <ShelterCard key={s.id} shelter={s} />
                ))}
              </div>
            )}
          </section>

          {/* Safety Instructions */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-gradient-to-r from-amber-50 to-amber-50/50 px-5 py-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
                <h2 className="text-lg font-semibold text-slate-800">Safety Instructions</h2>
              </div>
              <p className="mt-1 text-sm text-slate-600">Important guidelines for your safety during an evacuation.</p>
            </div>
            <div className="grid gap-6 p-5 sm:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                  <h3 className="font-semibold">Do&apos;s</h3>
                </div>
                <ul className="space-y-2.5">
                  {DOS.map((item, i) => (
                    <li key={i} className="flex gap-3 text-sm text-slate-700">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-red-700">
                  <XCircle className="h-5 w-5" />
                  <h3 className="font-semibold">Don&apos;ts</h3>
                </div>
                <ul className="space-y-2.5">
                  {DONTS.map((item, i) => (
                    <li key={i} className="flex gap-3 text-sm text-slate-700">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="mt-10 text-center text-sm text-slate-500">
        For the latest shelter availability, call <strong>117</strong> or contact your district disaster management centre.
        <Link href="/" className="ml-2 text-sky-600 hover:underline">Back to dashboard</Link>.
      </p>
    </div>
  );
}

function ShelterCard({ shelter, highlight }) {
  return (
    <div
      className={`group relative rounded-xl border transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${
        highlight
          ? "border-sky-400 bg-gradient-to-br from-sky-50 to-white shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      {/* Highlight badge */}
      {highlight && (
        <div className="absolute -top-2 -right-2 rounded-full bg-sky-500 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm">
          Near you
        </div>
      )}

      <div className="p-5">
        <h3 className="pr-8 text-lg font-semibold text-slate-900">{shelter.name}</h3>

        <div className="mt-3 space-y-2">
          <div className="flex items-start gap-2 text-sm text-slate-600">
            <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
            <span>{shelter.location}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {shelter.district}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Capacity: {shelter.capacity}
            </span>
          </div>

          {shelter.contact && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Phone className="h-4 w-4 flex-shrink-0 text-slate-400" />
              <span className="break-all">{shelter.contact}</span>
            </div>
          )}
        </div>

        {/* Call button for quick dial */}
        {shelter.contact && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <a
              href={`tel:${shelter.contact.replace(/\D/g, '')}`}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 transition hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              Call
            </a>
          </div>
        )}
      </div>
    </div>
  );
}