"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Loader from "@/components/Loader";
import {
  Building2,
  MapPin,
  Users,
  Phone,
  ShieldAlert,
  Navigation,
  PhoneCall,
  Filter,
  X,
  Globe,
  Headphones,
  Search,
  Eye,
  EyeOff,
  ThumbsUp,
  ThumbsDown,
  Check,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** Hero background image – evacuation / shelter context (Unsplash) */
const HERO_BG = "/img/shelter.png";

/** Haversine formula for distance calculation */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistanceKm(km) {
  if (km == null || !Number.isFinite(km)) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

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

// District to Province mapping
const districtToProvince = {
  Ampara: "Eastern",
  Anuradhapura: "North Central",
  Badulla: "Uva",
  Batticaloa: "Eastern",
  Colombo: "Western",
  Galle: "Southern",
  Gampaha: "Western",
  Hambantota: "Southern",
  Jaffna: "Northern",
  Kalutara: "Western",
  Kandy: "Central",
  Kegalle: "Sabaragamuwa",
  Kilinochchi: "Northern",
  Kurunegala: "North Western",
  Puttalam: "North Western",
  Mannar: "Northern",
  Matale: "Central",
  Matara: "Southern",
  Monaragala: "Uva",
  Ratnapura: "Sabaragamuwa",
  Mullaitivu: "Northern",
  "Nuwara Eliya": "Central",
  Polonnaruwa: "North Central",
  Trincomalee: "Eastern",
  Vavuniya: "Northern",
};

// District contacts
const DISTRICT_CONTACTS = [
  {
    district: "Ampara",
    role: "Deputy Director",
    phones: ["+94 632 222 218", "+94 773 957 883"],
  },
  {
    district: "Anuradhapura",
    role: "Asst. Director",
    phones: ["+94 252 234 817", "+94 773 957 881"],
  },
  {
    district: "Badulla",
    role: "Deputy Director",
    phones: ["+94 552 224 751", "+94 773 957 880"],
  },
  {
    district: "Batticaloa",
    role: "Deputy Director",
    phones: ["+94 652 227 701", "+94 773 957 885"],
  },
  {
    district: "Colombo",
    role: "Asst. Director",
    phones: ["+94 112 434 028", "+94 773 957 870"],
  },
  {
    district: "Galle",
    role: "Asst. Director",
    phones: ["+94 912 227 315", "+94 773 957 873"],
  },
  {
    district: "Gampaha",
    role: "Deputy Director",
    phones: ["+94 332 234 671", "+94 773 957 871"],
  },
  {
    district: "Hambantota",
    role: "Asst. Director",
    phones: ["+94 472 256 463", "+94 773 957 875"],
  },
  {
    district: "Jaffna",
    role: "Deputy Director",
    phones: ["+94 212 221 676", "+94 773 957 894"],
  },
  {
    district: "Kalutara",
    role: "Asst. Director",
    phones: ["+94 342 222 912", "+94 773 957 872"],
  },
  {
    district: "Kandy",
    role: "Deputy Director",
    phones: ["+94 812 202 697", "+94 773 957 878"],
  },
  {
    district: "Kegalle",
    role: "Deputy Director",
    phones: ["+94 352 222 603", "+94 773 957 876"],
  },
  {
    district: "Kilinochchi",
    role: "Asst. Director",
    phones: ["+94 212 285 330", "+94 772 320 528"],
  },
  {
    district: "Kurunegala",
    role: "Deputy Director",
    phones: ["+94 372 221 709", "+94 773 957 887"],
  },
  {
    district: "Mannar",
    role: "Asst. Director",
    phones: ["+94 232 250 133", "+94 772 320 529"],
  },
  {
    district: "Matale",
    role: "Deputy Director",
    phones: ["+94 662 230 926", "+94 773 957 890"],
  },
  {
    district: "Matara",
    role: "Asst. Director",
    phones: ["+94 412 234 134", "+94 773 957 874"],
  },
  {
    district: "Monaragala",
    role: "Asst. Director",
    phones: ["+94 552 276 867", "+94 773 957 889"],
  },
  {
    district: "Mullaitivu",
    role: "Asst. Director",
    phones: ["+94 212 290 054", "+94 773 957 886"],
  },
  {
    district: "Nuwara Eliya",
    role: "Asst. Director",
    phones: ["+94 522 222 113", "+94 773 957 879"],
  },
  {
    district: "Polonnaruwa",
    role: "Asst. Director",
    phones: ["+94 272 226 676", "+94 773 957 882"],
  },
  {
    district: "Puttalam",
    role: "Deputy Director",
    phones: ["+94 32 222 6913", "+94 773 957 888"],
  },
  {
    district: "Ratnapura",
    role: "Deputy Director",
    phones: ["+94 45 222 2261", "+94 773 957 877"],
  },
  {
    district: "Trincomalee",
    role: "Deputy Director",
    phones: ["+94 262 224 711", "+94 773 957 884"],
  },
  {
    district: "Vavuniya",
    role: "Asst. Director",
    phones: ["+94 242 225 553", "+94 773 957 892"],
  },
];

const groupByProvince = (contacts) => {
  const groups = {};
  contacts.forEach((contact) => {
    const province = districtToProvince[contact.district];
    if (!province) return;
    if (!groups[province]) groups[province] = [];
    groups[province].push(contact);
  });
  Object.keys(groups).forEach((province) => {
    groups[province].sort((a, b) => a.district.localeCompare(b.district));
  });
  return groups;
};

export default function SheltersPage() {
  const { i18n } = useTranslation();
  const si = String(i18n.language || "").startsWith("si");
  const [shelters, setShelters] = useState([]);
  const [sheltersLoading, setSheltersLoading] = useState(true);
  const [sheltersError, setSheltersError] = useState(null);
  const [userDistrict, setUserDistrict] = useState(null);
  const [userCityLatitude, setUserCityLatitude] = useState(null);
  const [userCityLongitude, setUserCityLongitude] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [districts, setDistricts] = useState([]);

  // Shelters accordion state
  const [expandedShelterDistricts, setExpandedShelterDistricts] = useState({});

  // Contacts state
  const [contactsSearchQuery, setContactsSearchQuery] = useState("");
  const [showOnlyMyDistrict, setShowOnlyMyDistrict] = useState(false);
  const [expandedProvinces, setExpandedProvinces] = useState({});

  // Load user district
  useEffect(() => {
    let user = null;
    try {
      const raw =
        typeof window !== "undefined"
          ? window.localStorage.getItem("dmews_user")
          : null;
      user = raw ? JSON.parse(raw) : null;
    } catch {}
    const district = (user?.district || "").trim();
    setUserDistrict(district || null);
    const lat = user?.cityLatitude;
    const lon = user?.cityLongitude;
    setUserCityLatitude(
      typeof lat === "number" && Number.isFinite(lat) ? lat : null
    );
    setUserCityLongitude(
      typeof lon === "number" && Number.isFinite(lon) ? lon : null
    );
  }, []);

  // Fetch shelters
  useEffect(() => {
    setSheltersError(null);
    setSheltersLoading(true);
    fetch(`${API_BASE}/shelters`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setShelters([]);
          setDistricts([]);
          setSheltersError(
            data?.message ||
              (si
                ? `සහන කඳවුරු පූරණය කළ නොහැක (HTTP ${res.status})`
                : `Could not load shelters (HTTP ${res.status})`)
          );
          return;
        }
        if (Array.isArray(data)) {
          setShelters(data);
          const uniqueDistricts = [
            ...new Set(data.map((s) => s.district).filter(Boolean)),
          ].sort();
          setDistricts(uniqueDistricts);
        } else {
          setShelters([]);
          setDistricts([]);
          setSheltersError(
            si
              ? "සහන කඳවුරු ලැයිස්තුව බලාපොරොත්තු වූ ආකෘතියේ නොමැත."
              : "Shelter list was not in the expected format."
          );
        }
      })
      .catch(() => {
        setShelters([]);
        setDistricts([]);
        setSheltersError(
          si
            ? "සහන කඳවුරු පූරණය කිරීමේදී ජාල දෝෂයකි."
            : "Network error while loading shelters."
        );
      })
      .finally(() => setSheltersLoading(false));
  }, []);

  // Auto-expand user's district in shelters when data loads
  useEffect(() => {
    if (
      userDistrict &&
      shelters.length > 0 &&
      !expandedShelterDistricts[userDistrict]
    ) {
      setExpandedShelterDistricts((prev) => ({
        ...prev,
        [userDistrict]: true,
      }));
    }
  }, [userDistrict, shelters, expandedShelterDistricts]);

  // Filter shelters by selected district
  const filteredByDistrict = selectedDistrict
    ? shelters.filter((s) => s.district === selectedDistrict)
    : shelters;

  const userHasCoords =
    typeof userCityLatitude === "number" &&
    typeof userCityLongitude === "number" &&
    Number.isFinite(userCityLatitude) &&
    Number.isFinite(userCityLongitude);

  const sheltersWithDistance = useMemo(() => {
    return filteredByDistrict.map((s) => {
      let distanceKm = null;
      if (
        userHasCoords &&
        typeof s.cityLatitude === "number" &&
        typeof s.cityLongitude === "number" &&
        Number.isFinite(s.cityLatitude) &&
        Number.isFinite(s.cityLongitude)
      ) {
        distanceKm = haversineKm(
          userCityLatitude,
          userCityLongitude,
          s.cityLatitude,
          s.cityLongitude
        );
      }
      return { ...s, distanceKm };
    });
  }, [filteredByDistrict, userHasCoords, userCityLatitude, userCityLongitude]);

  const handleResetFilter = () => setSelectedDistrict("");

  // Contacts filtering & grouping
  const filteredContacts = useMemo(() => {
    let fc = DISTRICT_CONTACTS;
    if (showOnlyMyDistrict && userDistrict) {
      fc = fc.filter(
        (c) => c.district.toLowerCase() === userDistrict.toLowerCase()
      );
    } else if (contactsSearchQuery) {
      const query = contactsSearchQuery.toLowerCase();
      fc = fc.filter(
        (contact) =>
          contact.district.toLowerCase().includes(query) ||
          (districtToProvince[contact.district] || "")
            .toLowerCase()
            .includes(query)
      );
    }
    return fc;
  }, [showOnlyMyDistrict, userDistrict, contactsSearchQuery]);

  const groupedContacts = useMemo(
    () => groupByProvince(filteredContacts),
    [filteredContacts]
  );
  const sortedProvinces = useMemo(
    () => Object.keys(groupedContacts).sort(),
    [groupedContacts]
  );

  // Auto-expand provinces when searching
  useEffect(() => {
    if (contactsSearchQuery || showOnlyMyDistrict) {
      const allExpanded = {};
      sortedProvinces.forEach((province) => {
        allExpanded[province] = true;
      });
      setExpandedProvinces(allExpanded);
    } else {
      setExpandedProvinces({});
    }
  }, [contactsSearchQuery, showOnlyMyDistrict, sortedProvinces]);

  const toggleProvince = (province) => {
    setExpandedProvinces((prev) => ({ ...prev, [province]: !prev[province] }));
  };

  const toggleShelterDistrict = (district) => {
    setExpandedShelterDistricts((prev) => ({
      ...prev,
      [district]: !prev[district],
    }));
  };

  const cleanPhone = (phone) => phone.replace(/\s/g, "").replace(/\+/g, "");

  // Group shelters by district for accordion display
  const sheltersByDistrict = useMemo(() => {
    const groups = {};
    sheltersWithDistance.forEach((shelter) => {
      const dist = shelter.district || "Unknown";
      if (!groups[dist]) groups[dist] = [];
      groups[dist].push(shelter);
    });
    Object.keys(groups).forEach((d) => {
      groups[d].sort((a, b) => {
        const ad = a.distanceKm;
        const bd = b.distanceKm;
        if (ad != null && bd != null && ad !== bd) return ad - bd;
        if (ad != null && bd == null) return -1;
        if (ad == null && bd != null) return 1;
        return (a.name || "").localeCompare(b.name || "");
      });
    });
    // Sort districts: user's first, then alphabetically
    const districtNames = Object.keys(groups);
    districtNames.sort((a, b) => {
      if (userDistrict && a === userDistrict) return -1;
      if (userDistrict && b === userDistrict) return 1;
      return a.localeCompare(b);
    });
    return { groups, districtNames };
  }, [sheltersWithDistance, userDistrict]);

  // Smooth scroll to shelters section
  const scrollToShelters = () => {
    document
      .getElementById("shelters-list")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Smooth scroll to contacts section
  const scrollToContacts = () => {
    document
      .getElementById("district-contacts")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* ========== HERO SECTION – VOLUNTEER PAGE STYLE ========== */}
      <section
        className="relative isolate overflow-hidden border-b border-indigo-900/20"
        aria-labelledby="shelters-hero-title"
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${HERO_BG})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/88 via-slate-900/85 to-indigo-900/80" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-100">
              <Building2 className="h-3.5 w-3.5" aria-hidden />
              DisasterWatch
            </p>
            <h1
              id="shelters-hero-title"
              className="mt-5 font-oswald text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
            >
              {si ? "සහන කඳවුරු" : "Relief Camps"}
            </h1>
            <p className="mt-4 text-lg text-indigo-100/95 sm:text-xl">
              {si
                ? "ඔබගේ ස්ථානයට ආසන්න සහන කඳවුරු දුර අනුව පෙළගස්වා පෙන්වයි. නිල ඉවතලන මධ්‍යස්ථාන සහ හදිසි සම්බන්ධතා සොයාගන්න."
                : "Nearby shelters ranked by distance from your location for faster, safer access. Find official evacuation centres and emergency contacts."}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={scrollToShelters}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3.5 text-sm font-bold text-indigo-950 shadow-lg shadow-black/20 transition hover:bg-amber-300"
              >
                {si ? "සහන කඳවුරු ලැයිස්තුව බලන්න" : "View Relief Camp List"}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={scrollToContacts}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-white/40 bg-white/10 px-5 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
              >
                {si ? "හදිසි සම්බන්ධතා" : "Emergency Contacts"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-12">
          {/* ========== SHELTERS SECTION – ACCORDION PER DISTRICT ========== */}
          <section
            id="shelters-list"
            className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden scroll-mt-8"
          >
            <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-sky-50/40 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600" />
                <h2 className="text-lg font-semibold text-slate-800">
                  {si ? "සහන කඳවුරු ලැයිස්තුව" : "Relief Camp List"}
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {si
                  ? "DMEWS සහන කඳවුරු දත්ත ගබඩාවෙන් පූරණය කර ඇත. මෙය අසමත් වුවද පහත දිස්ත්‍රික් සම්බන්ධතා භාවිතා කළ හැක."
                  : "Loaded from the DMEWS shelter database. If this fails, district contacts below are still available."}
              </p>
            </div>

            <div className="p-5">
              {sheltersError && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-semibold text-amber-900">
                      {si
                        ? "සහන කඳවුරු පූරණය කළ නොහැක"
                        : "Could not load shelters"}
                    </p>
                    <p className="mt-1 text-amber-900/90">{sheltersError}</p>
                    <p className="mt-2 text-xs text-amber-800/80">
                      {si
                        ? "නිල සහන කඳවුරු තොරතුරු සඳහා පහත "
                        : "Use "}
                      <strong>
                        {si
                          ? "දිස්ත්‍රික් ආපදා කළමනාකරණ සම්බන්ධතා"
                          : "District Disaster Management Contacts"}
                      </strong>{" "}
                      {si ? "භාවිතා කරන්න හෝ " : "below or call "}
                      <strong>117</strong> / <strong>119</strong>
                      {si
                        ? " අමතන්න."
                        : " for official shelter information."}
                    </p>
                  </div>
                </div>
              )}

              {sheltersLoading ? (
                <div className="flex min-h-[220px] items-center justify-center py-8">
                  <Loader />
                </div>
              ) : (
                <>
                  {shelters.length > 0 && (
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-4 shadow-sm border border-slate-200">
                      <div className="flex items-center gap-2">
                        <Filter className="h-5 w-5 text-slate-500" />
                        <span className="text-sm font-medium text-slate-700">
                          {si
                            ? "දිස්ත්‍රික් අනුව පෙරණය:"
                            : "Filter by district:"}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-wrap items-center gap-3">
                        <select
                          value={selectedDistrict}
                          onChange={(e) => setSelectedDistrict(e.target.value)}
                          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        >
                          <option value="">
                            {si ? "සියලු දිස්ත්‍රික්ක" : "All districts"}
                          </option>
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
                            {si ? "ඉවත් කරන්න" : "Clear"}
                          </button>
                        )}
                      </div>
                      {(userDistrict || userHasCoords) && (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                          {userDistrict && (
                            <span className="rounded-full bg-indigo-50 px-3 py-1.5 font-medium">
                              {si ? "ඔබගේ දිස්ත්‍රික්කය:" : "Your district:"}{" "}
                              {userDistrict}
                            </span>
                          )}
                          {userHasCoords && (
                            <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-600">
                              {si
                                ? "ඔබගේ නගරයෙන් දුර (ආසන්න)"
                                : "Distance from your city (approx.)"}
                            </span>
                          )}
                          {userDistrict && !userHasCoords && (
                            <span className="rounded-full bg-amber-50 px-3 py-1.5 font-medium text-amber-900">
                              {si
                                ? "දුර පෙන්වීමට පැතිකඩේ නගරය එක් කරන්න"
                                : "Add your city in profile to see distances"}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {sheltersWithDistance.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
                      <Building2 className="mb-4 h-12 w-12 text-slate-300" />
                      <p className="text-slate-600">
                        {selectedDistrict
                          ? si
                            ? `${selectedDistrict} දිස්ත්‍රික්කයේ සහන කඳවුරු හමු නොවීය. වෙනත් දිස්ත්‍රික්කයක් උත්සාහ කරන්න.`
                            : `No shelters found in ${selectedDistrict}. Try a different district.`
                          : si
                            ? "තවම සහන කඳවුරු ලැයිස්තුගත කර නොමැත. පසුව නැවත පරීක්ෂා කරන්න හෝ ප්‍රදේශීය ආපදා කළමනාකරණ මධ්‍යස්ථානය අමතන්න."
                            : "No shelters listed yet. Check back later or contact your local disaster management centre."}
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-500">
                        {si ? "හදිසි: 117" : "Emergency: 117"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sheltersByDistrict.districtNames.map((district) => {
                        const sheltersList =
                          sheltersByDistrict.groups[district];
                        const isUserDistrict = userDistrict === district;
                        const isExpanded =
                          expandedShelterDistricts[district] || false;

                        return (
                          <div
                            key={district}
                            className={`rounded-xl border transition-all ${
                              isUserDistrict && !selectedDistrict
                                ? "border-indigo-300 bg-gradient-to-r from-indigo-50/40 to-sky-50/40"
                                : "border-slate-200 bg-white"
                            }`}
                          >
                            <button
                              onClick={() => toggleShelterDistrict(district)}
                              className="flex w-full items-center justify-between p-4 text-left focus:outline-none focus:ring-2 focus:ring-indigo-200 rounded-xl"
                            >
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="h-5 w-5 text-slate-500" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 text-slate-500" />
                                )}
                                <h3 className="font-semibold text-slate-800">
                                  {district}{" "}
                                  {si ? "දිස්ත්‍රික්කය" : "District"}
                                </h3>
                                {isUserDistrict && !selectedDistrict && (
                                  <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                                    {si
                                      ? "ඔබගේ දිස්ත්‍රික්කය"
                                      : "Your district"}
                                  </span>
                                )}
                                <span className="text-xs text-slate-500">
                                  ({sheltersList.length}{" "}
                                  {si ? "කඳවුරු" : "Camps"})
                                </span>
                              </div>
                            </button>
                            {isExpanded && (
                              <div className="border-t border-slate-100 px-4 pb-4 pt-2">
                                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                                  {sheltersList.map((s) => (
                                    <ShelterCard
                                      key={s.id}
                                      shelter={s}
                                      highlight={isUserDistrict}
                                      distanceLabel={formatDistanceKm(
                                        s.distanceKm
                                      )}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* ========== DISTRICT DISASTER MANAGEMENT CONTACTS – TWO COLUMNS + ACCORDIONS ========== */}
          <section
            id="district-contacts"
            className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden scroll-mt-8"
          >
            <div className="border-b border-slate-100 bg-gradient-to-r from-red-50 to-orange-50/30 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Headphones className="h-5 w-5 text-red-600" />
                  <h2 className="text-lg font-semibold text-slate-800">
                    {si
                      ? "දිස්ත්‍රික් ආපදා කළමනාකරණ සම්බන්ධතා"
                      : "District Disaster Management Contacts"}
                  </h2>
                </div>
                <div className="text-xs text-slate-500 bg-white/60 px-3 py-1 rounded-full">
                  {si
                    ? "නිල උපදෙස් සහ සහාය සඳහා අමතන්න"
                    : "Call for official instructions & help"}
                </div>
              </div>
            </div>

            <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-3">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex flex-1 items-center gap-2 rounded-lg bg-white border border-slate-200 px-3 py-1.5 focus-within:ring-2 focus-within:ring-red-200">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder={
                      si
                        ? "දිස්ත්‍රික්කය හෝ පළාත අනුව සොයන්න..."
                        : "Search by district or province..."
                    }
                    value={contactsSearchQuery}
                    onChange={(e) => {
                      setContactsSearchQuery(e.target.value);
                      if (e.target.value) setShowOnlyMyDistrict(false);
                    }}
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                  />
                  {contactsSearchQuery && (
                    <button
                      onClick={() => setContactsSearchQuery("")}
                      className="text-slate-400 hover:text-slate-600"
                    >
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
                    {showOnlyMyDistrict ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                    {showOnlyMyDistrict
                      ? si
                        ? "ඔබගේ දිස්ත්‍රික්කය පමණක් පෙන්වයි"
                        : "Showing only your district"
                      : si
                        ? "මගේ දිස්ත්‍රික්කය පමණක් පෙන්වන්න"
                        : "Show only my district"}
                  </button>
                )}
              </div>
            </div>

            <div className="p-5">
              {Object.keys(groupedContacts).length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-amber-200 bg-amber-50/60 py-10 text-center px-4">
                  <AlertCircle className="mb-2 h-10 w-10 text-amber-600" />
                  <p className="font-semibold text-amber-950">
                    {showOnlyMyDistrict
                      ? `No directory entry for ${
                          userDistrict || "your district"
                        }`
                      : si
                        ? "ගැලපෙන දිස්ත්‍රික්ක නොමැත"
                        : "No matching districts"}
                  </p>
                  <p className="mt-2 max-w-md text-sm text-amber-900/90">
                    {showOnlyMyDistrict
                      ? si
                        ? "මෙම දිස්ත්‍රික්කය තවම නාමාවලියේ නොතිබිය හැක. 117 හෝ 119 ජාතික හදිසි අංක අමතන්න, නැතහොත් පෙරණය ඉවත් කරන්න."
                        : "This district may not be listed in the directory yet. Call national emergency 117 or 119, or clear the filter."
                      : si
                        ? "වෙනත් සෙවුම් පදයක් උත්සාහ කරන්න, නැතහොත් සියලු පළාත් දැකීමට පෙරණ ඉවත් කරන්න."
                        : "Try another search term, or clear filters to see all provinces."}
                  </p>
                  {(showOnlyMyDistrict || contactsSearchQuery) && (
                    <button
                      onClick={() => {
                        setShowOnlyMyDistrict(false);
                        setContactsSearchQuery("");
                      }}
                      className="mt-4 text-sm font-semibold text-red-700 hover:underline"
                    >
                      {si ? "පෙරණ ඉවත් කරන්න" : "Clear filters"}
                    </button>
                  )}
                </div>
              ) : (
                // Two independent columns for provinces
                <div className="flex flex-col gap-5 md:flex-row">
                  {/* Left column */}
                  <div className="flex-1 space-y-5">
                    {sortedProvinces
                      .slice(0, Math.ceil(sortedProvinces.length / 2))
                      .map((province) => {
                        const districtsInProvince = groupedContacts[province];
                        const isExpanded = expandedProvinces[province] || false;
                        const isUserProvince =
                          userDistrict &&
                          districtToProvince[userDistrict] === province;
                        return (
                          <div
                            key={province}
                            className={`rounded-xl border transition-all ${
                              isUserProvince &&
                              !showOnlyMyDistrict &&
                              !contactsSearchQuery
                                ? "border-red-300 bg-gradient-to-r from-red-50/40 to-orange-50/40"
                                : "border-slate-200 bg-white"
                            }`}
                          >
                            <button
                              onClick={() => toggleProvince(province)}
                              className="flex w-full items-center justify-between p-4 text-left focus:outline-none focus:ring-2 focus:ring-red-200 rounded-xl"
                            >
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="h-5 w-5 text-slate-500" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 text-slate-500" />
                                )}
                                <h3 className="font-semibold text-slate-800">
                                  {province} {si ? "පළාත" : "Province"}
                                </h3>
                                {isUserProvince &&
                                  !showOnlyMyDistrict &&
                                  !contactsSearchQuery && (
                                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                                      {si
                                        ? "ඔබගේ දිස්ත්‍රික්කය"
                                        : "Your district"}
                                    </span>
                                  )}
                                <span className="text-xs text-slate-500">
                                  ({districtsInProvince.length} districts)
                                </span>
                              </div>
                            </button>
                            {isExpanded && (
                              <div className="border-t border-slate-100 px-4 pb-4 pt-2">
                                <div className="space-y-3">
                                  {districtsInProvince.map((contact) => {
                                    const isUserDistrictFlag =
                                      userDistrict &&
                                      userDistrict.toLowerCase() ===
                                        contact.district.toLowerCase();
                                    return (
                                      <div
                                        key={contact.district}
                                        className={`rounded-lg border p-3 transition-all hover:shadow-sm ${
                                          isUserDistrictFlag
                                            ? "border-red-200 bg-red-50/30"
                                            : "border-slate-200 bg-white hover:border-slate-300"
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div>
                                            <div className="font-bold text-slate-800">
                                              {contact.district}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                              {contact.role}
                                            </div>
                                          </div>
                                          <div className="rounded-full bg-slate-100 p-1">
                                            <Globe className="h-3 w-3 text-slate-400" />
                                          </div>
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                                          {contact.phones.map((phone, idx) => (
                                            <a
                                              key={idx}
                                              href={`tel:${cleanPhone(phone)}`}
                                              className="inline-flex items-center gap-1 text-indigo-700 transition hover:text-indigo-900"
                                            >
                                              <PhoneCall className="h-3 w-3" />
                                              <span className="break-all">
                                                {phone}
                                              </span>
                                            </a>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>

                  {/* Right column */}
                  <div className="flex-1 space-y-5">
                    {sortedProvinces
                      .slice(Math.ceil(sortedProvinces.length / 2))
                      .map((province) => {
                        const districtsInProvince = groupedContacts[province];
                        const isExpanded = expandedProvinces[province] || false;
                        const isUserProvince =
                          userDistrict &&
                          districtToProvince[userDistrict] === province;
                        return (
                          <div
                            key={province}
                            className={`rounded-xl border transition-all ${
                              isUserProvince &&
                              !showOnlyMyDistrict &&
                              !contactsSearchQuery
                                ? "border-red-300 bg-gradient-to-r from-red-50/40 to-orange-50/40"
                                : "border-slate-200 bg-white"
                            }`}
                          >
                            <button
                              onClick={() => toggleProvince(province)}
                              className="flex w-full items-center justify-between p-4 text-left focus:outline-none focus:ring-2 focus:ring-red-200 rounded-xl"
                            >
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="h-5 w-5 text-slate-500" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 text-slate-500" />
                                )}
                                <h3 className="font-semibold text-slate-800">
                                  {province} {si ? "පළාත" : "Province"}
                                </h3>
                                {isUserProvince &&
                                  !showOnlyMyDistrict &&
                                  !contactsSearchQuery && (
                                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                                      {si
                                        ? "ඔබගේ දිස්ත්‍රික්කය"
                                        : "Your district"}
                                    </span>
                                  )}
                                <span className="text-xs text-slate-500">
                                  ({districtsInProvince.length} districts)
                                </span>
                              </div>
                            </button>
                            {isExpanded && (
                              <div className="border-t border-slate-100 px-4 pb-4 pt-2">
                                <div className="space-y-3">
                                  {districtsInProvince.map((contact) => {
                                    const isUserDistrictFlag =
                                      userDistrict &&
                                      userDistrict.toLowerCase() ===
                                        contact.district.toLowerCase();
                                    return (
                                      <div
                                        key={contact.district}
                                        className={`rounded-lg border p-3 transition-all hover:shadow-sm ${
                                          isUserDistrictFlag
                                            ? "border-red-200 bg-red-50/30"
                                            : "border-slate-200 bg-white hover:border-slate-300"
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div>
                                            <div className="font-bold text-slate-800">
                                              {contact.district}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                              {contact.role}
                                            </div>
                                          </div>
                                          <div className="rounded-full bg-slate-100 p-1">
                                            <Globe className="h-3 w-3 text-slate-400" />
                                          </div>
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                                          {contact.phones.map((phone, idx) => (
                                            <a
                                              key={idx}
                                              href={`tel:${cleanPhone(phone)}`}
                                              className="inline-flex items-center gap-1 text-indigo-700 transition hover:text-indigo-900"
                                            >
                                              <PhoneCall className="h-3 w-3" />
                                              <span className="break-all">
                                                {phone}
                                              </span>
                                            </a>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
              <div className="mt-6 rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-500 border border-slate-100">
                {si
                  ? "📢 ඔබගේ දිස්ත්‍රික් සම්බන්ධතාව වෙත ළඟා විය නොහැකි නම් ජාතික හදිසි අංක "
                  : "📢 If you cannot reach your district contact, call national emergency hotline "}
                <strong className="text-red-600">117</strong>{" "}
                {si ? "හෝ " : "or "}
                <strong className="text-red-600">119</strong>.
              </div>
            </div>
          </section>

          {/* ========== SAFETY INSTRUCTIONS – DO / DON'T INFOGRAPHIC ========== */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-gradient-to-r from-amber-50 to-yellow-50/30 px-5 py-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
                <h2 className="text-lg font-semibold text-slate-800">
                  {si ? "ආරක්ෂක උපදෙස්" : "Safety Instructions"}
                </h2>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {si
                  ? "ඉවතලන අවස්ථාවේ කළ යුතු හා නොකළ යුතු දේ පිළිබඳ මාර්ගෝපදේශ."
                  : "A quick Do & Don't guide to stay safe during evacuation."}
              </p>
            </div>

            <div className="bg-slate-50/60 p-5">
              <div className="mb-6 text-center">
                <h3 className="text-2xl font-extrabold text-slate-900">
                  Do &amp; Don&apos;t
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {si ? "ඉවතලන මාර්ගෝපදේශ" : "Evacuation Guide"}
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-8">
                {/* DO Card */}
                <div className="flex min-h-[480px] w-full max-w-[420px] overflow-hidden rounded-2xl bg-white shadow-[0_8px_40px_rgba(0,0,0,0.12)]">
                  <div className="relative flex w-[72px] flex-shrink-0 flex-col items-center justify-between bg-gradient-to-b from-[#2ecc5a] to-[#1fa843] py-5">
                    <ThumbsUp className="h-7 w-7 text-white" />
                    <span className="rotate-180 text-xl font-extrabold tracking-[0.2em] text-white [writing-mode:vertical-rl]">
                      DO
                    </span>
                    <span className="absolute right-[-18px] top-1/2 h-0 w-0 -translate-y-1/2 border-y-[22px] border-y-transparent border-l-[20px] border-l-[#1fa843]" />
                  </div>
                  <div className="flex-1 space-y-5 px-6 py-7">
                    {DOS.map((item, i) => (
                      <div key={i} className="flex items-start gap-3.5">
                        <span className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#2ecc5a]">
                          <Check className="h-4 w-4 text-white" />
                        </span>
                        <p className="text-[0.92rem] leading-relaxed text-slate-700">
                          {item}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* DON'T Card */}
                <div className="flex min-h-[480px] w-full max-w-[420px] overflow-hidden rounded-2xl bg-white shadow-[0_8px_40px_rgba(0,0,0,0.12)]">
                  <div className="relative flex w-[72px] flex-shrink-0 flex-col items-center justify-between bg-gradient-to-b from-[#ff4e6a] to-[#ff8c42] py-5">
                    <ThumbsDown className="h-7 w-7 text-white" />
                    <span className="rotate-180 text-xl font-extrabold tracking-[0.1em] text-white [writing-mode:vertical-rl]">
                      DON&apos;T
                    </span>
                    <span className="absolute right-[-18px] top-1/2 h-0 w-0 -translate-y-1/2 border-y-[22px] border-y-transparent border-l-[20px] border-l-[#ff6b42]" />
                  </div>
                  <div className="flex-1 space-y-5 px-6 py-7">
                    {DONTS.map((item, i) => (
                      <div key={i} className="flex items-start gap-3.5">
                        <span className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#ff4e6a]">
                          <X className="h-4 w-4 text-white" />
                        </span>
                        <p className="text-[0.92rem] leading-relaxed text-slate-700">
                          {item}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <p className="mt-10 text-center text-sm text-slate-500">
          {si
            ? "නවතම සහන කඳවුරු තොරතුරු සඳහා "
            : "For the latest shelter availability, call "}
          <strong className="text-indigo-600">117</strong> or contact your
          {si
            ? " දිස්ත්‍රික් ආපදා කළමනාකරණ මධ්‍යස්ථානය අමතන්න."
            : " district disaster management centre."}
          <Link
            href="/"
            className="ml-2 text-indigo-600 hover:underline font-medium"
          >
            {si ? "පුවරුවට ආපසු" : "Back to dashboard"}
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

// Shelter Card Component
function ShelterCard({ shelter, highlight, distanceLabel }) {
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
        <h3 className="pr-8 text-lg font-semibold text-slate-900">
          {shelter.name}
        </h3>
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
            {shelter.city && (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                City: {shelter.city}
              </span>
            )}
            {distanceLabel && (
              <span className="flex items-center gap-1.5 font-medium text-indigo-700">
                <Navigation className="h-3.5 w-3.5" />
                {distanceLabel} away
              </span>
            )}
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
              href={`tel:${shelter.contact.replace(/\D/g, "")}`}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
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