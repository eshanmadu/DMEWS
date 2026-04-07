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
  Globe,
  Headphones,
  Search,
  ArrowUpDown,
  AlertCircle,
  Eye,
  EyeOff,
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

// Disaster Management Center contacts per district
const DISTRICT_CONTACTS = [
  { district: "Ampara", role: "Deputy Director", phones: ["+94 632 222 218", "+94 773 957 883"] },
  { district: "Anuradhapura", role: "Asst. Director", phones: ["+94 252 234 817", "+94 773 957 881"] },
  { district: "Badulla", role: "Deputy Director", phones: ["+94 552 224 751", "+94 773 957 880"] },
  { district: "Batticaloa", role: "Deputy Director", phones: ["+94 652 227 701", "+94 773 957 885"] },
  { district: "Colombo", role: "Asst. Director", phones: ["+94 112 434 028", "+94 773 957 870"] },
  { district: "Galle", role: "Asst. Director", phones: ["+94 912 227 315", "+94 773 957 873"] },
  { district: "Gampaha", role: "Deputy Director", phones: ["+94 332 234 671", "+94 773 957 871"] },
  { district: "Hambantota", role: "Asst. Director", phones: ["+94 472 256 463", "+94 773 957 875"] },
  { district: "Jaffna", role: "Deputy Director", phones: ["+94 212 221 676", "+94 773 957 894"] },
  { district: "Kalutara", role: "Asst. Director", phones: ["+94 342 222 912", "+94 773 957 872"] },
  { district: "Kandy", role: "Deputy Director", phones: ["+94 812 202 697", "+94 773 957 878"] },
  { district: "Kegalle", role: "Deputy Director", phones: ["+94 352 222 603", "+94 773 957 876"] },
  { district: "Kilinochchi", role: "Asst. Director", phones: ["+94 212 285 330", "+94 772 320 528"] },
  { district: "Kurunegala", role: "Deputy Director", phones: ["+94 372 221 709", "+94 773 957 887"] },
  { district: "Mannar", role: "Asst. Director", phones: ["+94 232 250 133", "+94 772 320 529"] },
  { district: "Matale", role: "Deputy Director", phones: ["+94 662 230 926", "+94 773 957 890"] },
  { district: "Matara", role: "Asst. Director", phones: ["+94 412 234 134", "+94 773 957 874"] },
  { district: "Monaragala", role: "Asst. Director", phones: ["+94 552 276 867", "+94 773 957 889"] },
  { district: "Mullaitivu", role: "Asst. Director", phones: ["+94 212 290 054", "+94 773 957 886"] },
  { district: "Nuwara Eliya", role: "Asst. Director", phones: ["+94 522 222 113", "+94 773 957 879"] },
  { district: "Polonnaruwa", role: "Asst. Director", phones: ["+94 272 226 676", "+94 773 957 882"] },
  { district: "Trincomalee", role: "Deputy Director", phones: ["+94 262 224 711", "+94 773 957 884"] },
  { district: "Vavuniya", role: "Asst. Director", phones: ["+94 242 225 553", "+94 773 957 892"] },
];

export default function SheltersPage() {
  const [shelters, setShelters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userDistrict, setUserDistrict] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [districts, setDistricts] = useState([]);

  // Contacts filter & sort state
  const [contactsSearchQuery, setContactsSearchQuery] = useState("");
  const [contactsSortOrder, setContactsSortOrder] = useState("asc");
  const [showOnlyMyDistrict, setShowOnlyMyDistrict] = useState(false);

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

  const userDistrictShelters = userDistrict
    ? sortedShelters.filter(s => s.district === userDistrict)
    : [];
  const otherShelters = userDistrict
    ? sortedShelters.filter(s => s.district !== userDistrict)
    : sortedShelters;

  const handleResetFilter = () => setSelectedDistrict("");

  // Filter & sort contacts – with "show only my district" toggle
  let filteredContacts = DISTRICT_CONTACTS;
  if (showOnlyMyDistrict && userDistrict) {
    filteredContacts = filteredContacts.filter(
      (c) => c.district.toLowerCase() === userDistrict.toLowerCase()
    );
  } else if (contactsSearchQuery) {
    filteredContacts = filteredContacts.filter((contact) =>
      contact.district.toLowerCase().includes(contactsSearchQuery.toLowerCase())
    );
  }
  const sortedContacts = [...filteredContacts].sort((a, b) => {
    if (contactsSortOrder === "asc") {
      return a.district.localeCompare(b.district);
    } else {
      return b.district.localeCompare(a.district);
    }
  });

  // Helper to clean phone string for tel: link
  const cleanPhone = (phone) => phone.replace(/\s/g, "").replace(/\+/g, "");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="relative mb-12 overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-sky-700 shadow-xl">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10 px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:gap-6 sm:text-left">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm shadow-sm">
              <Building2 className="h-8 w-8 text-amber-300" />
            </div>
            <div>
              <h1 className="font-oswald text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Evacuation Shelters
              </h1>
              <p className="mt-2 max-w-2xl text-indigo-100">
                Find designated shelters near you. Shelters in your district are shown first.
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[280px] items-center justify-center">
          <Loader />
        </div>
      ) : (
        <div className="space-y-12">
          {/* ========== SHELTERS SECTION ========== */}
          <section>
            {/* Filter Bar */}
            {shelters.length > 0 && (
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-4 shadow-sm border border-slate-200">
                <div className="flex items-center gap-2">
                  <Filter className="h-5 w-5 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">Filter by district:</span>
                </div>
                <div className="flex flex-1 flex-wrap items-center gap-3">
                  <select
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
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
                  <div className="text-xs text-slate-600 bg-indigo-50 px-3 py-1.5 rounded-full font-medium">
                    📌 Your district: {userDistrict}
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
                {userDistrict && userDistrictShelters.length > 0 && (
                  <div className="mb-3 flex items-center gap-2">
                    <div className="rounded-full bg-indigo-100 p-2">
                      <Navigation className="h-5 w-5 text-indigo-700" />
                    </div>
                    <h2 className="text-xl font-semibold tracking-tight text-slate-800">
                      Shelters in your district <span className="text-indigo-600">({userDistrict})</span>
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
                    <div className="mt-8 mb-3 flex items-center gap-2">
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
          </section>

          {/* ========== DISTRICT CONTACTS SECTION – REDESIGNED ========== */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-gradient-to-r from-red-50 to-orange-50/30 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Headphones className="h-5 w-5 text-red-600" />
                  <h2 className="text-lg font-semibold text-slate-800">District Disaster Management Contacts</h2>
                </div>
                <div className="text-xs text-slate-500 bg-white/60 px-3 py-1 rounded-full">
                  Call for official instructions & help
                </div>
              </div>
            </div>

            {/* Filter & Sort Controls for Contacts – with "Show only my district" toggle */}
            <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-3">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex flex-1 items-center gap-2 rounded-lg bg-white border border-slate-200 px-3 py-1.5 focus-within:ring-2 focus-within:ring-red-200">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by district name..."
                    value={contactsSearchQuery}
                    onChange={(e) => {
                      setContactsSearchQuery(e.target.value);
                      if (e.target.value) setShowOnlyMyDistrict(false); // disable my-district filter when searching
                    }}
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                  />
                  {contactsSearchQuery && (
                    <button onClick={() => setContactsSearchQuery("")} className="text-slate-400 hover:text-slate-600">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {userDistrict && (
                  <button
                    onClick={() => {
                      setShowOnlyMyDistrict(!showOnlyMyDistrict);
                      if (!showOnlyMyDistrict) setContactsSearchQuery("");
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      showOnlyMyDistrict
                        ? "bg-red-100 text-red-700 ring-1 ring-red-300"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {showOnlyMyDistrict ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {showOnlyMyDistrict ? "Showing only your district" : "Show only my district"}
                  </button>
                )}
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-slate-500" />
                  <select
                    value={contactsSortOrder}
                    onChange={(e) => setContactsSortOrder(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-red-300 focus:outline-none"
                  >
                    <option value="asc">District (A-Z)</option>
                    <option value="desc">District (Z-A)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-5">
              {sortedContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Globe className="h-10 w-10 text-slate-300 mb-2" />
                  <p className="text-slate-500">
                    {showOnlyMyDistrict
                      ? `No contact info for your district (${userDistrict}) yet.`
                      : "No matching districts found."}
                  </p>
                  {(showOnlyMyDistrict || contactsSearchQuery) && (
                    <button
                      onClick={() => {
                        setShowOnlyMyDistrict(false);
                        setContactsSearchQuery("");
                      }}
                      className="mt-2 text-sm text-red-500 hover:underline"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {sortedContacts.map((contact) => {
                    const isUserDistrict = userDistrict && userDistrict.toLowerCase() === contact.district.toLowerCase();
                    return (
                      <div
                        key={contact.district}
                        className={`rounded-xl border transition-all hover:shadow-md ${
                          isUserDistrict
                            ? "border-red-300 bg-gradient-to-br from-red-50 to-amber-50/50 shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        {isUserDistrict && (
                          <div className="inline-block rounded-tl-xl rounded-br-xl bg-red-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
                            Your District
                          </div>
                        )}
                        <div className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-bold text-slate-800 text-base">{contact.district}</h3>
                              <p className="text-xs text-slate-500 mt-0.5">{contact.role}</p>
                            </div>
                            <div className="rounded-full bg-slate-100 p-1.5">
                              <Globe className="h-3.5 w-3.5 text-slate-400" />
                            </div>
                          </div>
                          <div className="mt-3 space-y-2">
                            {contact.phones.map((phone, idx) => (
                              <a
                                key={idx}
                                href={`tel:${cleanPhone(phone)}`}
                                className="flex items-center gap-2 text-sm text-indigo-700 transition hover:text-indigo-900 group"
                              >
                                <PhoneCall className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="break-all">{phone}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mt-6 rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-500 border border-slate-100">
                📢 If you cannot reach your district contact, call national emergency hotline <strong className="text-red-600">117</strong> or <strong className="text-red-600">119</strong>.
              </div>
            </div>
          </section>

          {/* ========== SAFETY INSTRUCTIONS (DO's & DON'Ts) – IMPROVED COLORS ========== */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-gradient-to-r from-amber-50 to-yellow-50/30 px-5 py-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
                <h2 className="text-lg font-semibold text-slate-800">Safety Instructions</h2>
              </div>
              <p className="mt-1 text-sm text-slate-600">Important guidelines for your safety during an evacuation.</p>
            </div>
            <div className="grid gap-6 p-5 sm:grid-cols-2">
              {/* Do's – soft green background */}
              <div className="space-y-3 rounded-xl bg-emerald-50/60 p-4 border border-emerald-100">
                <div className="flex items-center gap-2 text-emerald-800 border-b border-emerald-200 pb-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <h3 className="font-semibold text-base">Do's</h3>
                </div>
                <ul className="space-y-2.5">
                  {DOS.map((item, i) => (
                    <li key={i} className="flex gap-3 text-sm text-slate-800">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {/* Don'ts – soft rose background */}
              <div className="space-y-3 rounded-xl bg-rose-50/60 p-4 border border-rose-100">
                <div className="flex items-center gap-2 text-rose-800 border-b border-rose-200 pb-2">
                  <XCircle className="h-5 w-5" />
                  <h3 className="font-semibold text-base">Don'ts</h3>
                </div>
                <ul className="space-y-2.5">
                  {DONTS.map((item, i) => (
                    <li key={i} className="flex gap-3 text-sm text-slate-800">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-rose-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>
      )}

      <p className="mt-10 text-center text-sm text-slate-500">
        For the latest shelter availability, call <strong className="text-indigo-600">117</strong> or contact your district disaster management centre.
        <Link href="/" className="ml-2 text-indigo-600 hover:underline font-medium">Back to dashboard</Link>.
      </p>
    </div>
  );
}

// Shelter Card Component with improved readability
function ShelterCard({ shelter, highlight }) {
  return (
    <div
      className={`group relative rounded-xl border transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${
        highlight
          ? "border-indigo-300 bg-gradient-to-br from-indigo-50/90 to-white shadow-md"
          : "border-slate-200 bg-white hover:border-indigo-200"
      }`}
    >
      {highlight && (
        <div className="absolute -top-2 -right-2 rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm">
          Your District
        </div>
      )}
      <div className="p-5">
        <h3 className="pr-8 text-lg font-semibold text-slate-900">{shelter.name}</h3>
        <div className="mt-3 space-y-2">
          <div className="flex items-start gap-2 text-sm text-slate-700">
            <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
            <span>{shelter.location}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
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
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <Phone className="h-4 w-4 flex-shrink-0 text-slate-500" />
              <span className="break-all">{shelter.contact}</span>
            </div>
          )}
        </div>
        {shelter.contact && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <a
              href={`tel:${shelter.contact.replace(/\D/g, '')}`}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              Call Shelter
            </a>
          </div>
        )}
      </div>
    </div>
  );
}