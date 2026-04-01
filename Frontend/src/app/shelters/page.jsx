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
  Filter,
  X,
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
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [districts, setDistricts] = useState([]);

  // Load user district from localStorage
  useEffect(() => {
    let user = null;
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem("dmews_user") : null;
      user = raw ? JSON.parse(raw) : null;
    } catch {}
    const district = (user?.district || "").trim();
    setUserDistrict(district || null);
  }, []);

  // Fetch shelters
  useEffect(() => {
    fetch(`${API_BASE}/shelters`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setShelters(data);
          // Extract unique districts for filter
          const uniqueDistricts = [...new Set(data.map(s => s.district).filter(Boolean))].sort();
          setDistricts(uniqueDistricts);
        } else {
          setError(data?.message || "Failed to load shelters.");
        }
      })
      .catch((e) => setError(e?.message || "Failed to load shelters."))
      .finally(() => setLoading(false));
  }, []);

  // Filter shelters by selected district
  const filteredByDistrict = selectedDistrict
    ? shelters.filter(s => s.district === selectedDistrict)
    : shelters;

  // Sort: user's district first, then others
  const sortedShelters = [...filteredByDistrict].sort((a, b) => {
    if (!userDistrict) return 0;
    const aIsUserDistrict = a.district === userDistrict;
    const bIsUserDistrict = b.district === userDistrict;
    if (aIsUserDistrict && !bIsUserDistrict) return -1;
    if (!aIsUserDistrict && bIsUserDistrict) return 1;
    return 0;
  });

  // For display grouping (optional, but we keep single grid)
  const userDistrictShelters = userDistrict
    ? sortedShelters.filter(s => s.district === userDistrict)
    : [];
  const otherShelters = userDistrict
    ? sortedShelters.filter(s => s.district !== userDistrict)
    : sortedShelters;

  const handleResetFilter = () => setSelectedDistrict("");

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
                Find designated shelters near you. Shelters in your district are shown first.
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
        <div className="space-y-8">
          {/* Filter Bar */}
          {shelters.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-4 shadow-sm border border-slate-200">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">Filter by district:</span>
              </div>
              <div className="flex flex-1 flex-wrap items-center gap-3">
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                >
                  <option value="">All districts</option>
                  {districts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                {selectedDistrict && (
                  <button
                    onClick={handleResetFilter}
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
                  >
                    <X className="h-4 w-4" />
                    Clear
                  </button>
                )}
              </div>
              {userDistrict && (
                <div className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full">
                  📌 Your district: <span className="font-medium">{userDistrict}</span>
                </div>
              )}
            </div>
          )}

          {/* Shelters Grid */}
          {sortedShelters.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
              <Building2 className="mb-4 h-12 w-12 text-slate-300" />
              <p className="text-slate-600">
                {selectedDistrict
                  ? `No shelters found in ${selectedDistrict}. Try a different district.`
                  : "No shelters listed yet. Check back later or contact your local disaster management centre."}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-500">Emergency: 117</p>
            </div>
          ) : (
            <>
              {/* Optionally show section headers if userDistrict exists and we have both groups */}
              {userDistrict && userDistrictShelters.length > 0 && (
                <div className="mb-2 flex items-center gap-2">
                  <div className="rounded-full bg-sky-100 p-2">
                    <Navigation className="h-5 w-5 text-sky-700" />
                  </div>
                  <h2 className="text-xl font-semibold tracking-tight text-slate-800">
                    Shelters in your district <span className="text-sky-600">({userDistrict})</span>
                  </h2>
                </div>
              )}
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {userDistrictShelters.map((s) => (
                  <ShelterCard key={s.id} shelter={s} highlight />
                ))}
              </div>

              {userDistrict && otherShelters.length > 0 && (
                <>
                  <div className="mt-8 mb-2 flex items-center gap-2">
                    <div className="rounded-full bg-slate-100 p-2">
                      <Building2 className="h-5 w-5 text-slate-600" />
                    </div>
                    <h2 className="text-xl font-semibold tracking-tight text-slate-800">
                      Other Districts
                    </h2>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {otherShelters.map((s) => (
                      <ShelterCard key={s.id} shelter={s} />
                    ))}
                  </div>
                </>
              )}

              {!userDistrict && (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {sortedShelters.map((s) => (
                    <ShelterCard key={s.id} shelter={s} />
                  ))}
                </div>
              )}
            </>
          )}

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
          Your District
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