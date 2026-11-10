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
  DoorOpen,
  DoorClosed,
  AlertTriangle,
  CheckCircle2,
  LocateFixed,
  Crosshair,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import RouteModal from "@/components/RouteModal";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** Hero background image – evacuation / shelter context */
const HERO_BG = "/img/shelter.png";
const MAX_RECOMMENDED_SHELTERS = 6;

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
  { district: "Puttalam", role: "Deputy Director", phones: ["+94 32 222 6913", "+94 773 957 888"] },
  { district: "Ratnapura", role: "Deputy Director", phones: ["+94 45 222 2261", "+94 773 957 877"] },
  { district: "Trincomalee", role: "Deputy Director", phones: ["+94 262 224 711", "+94 773 957 884"] },
  { district: "Vavuniya", role: "Asst. Director", phones: ["+94 242 225 553", "+94 773 957 892"] },
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

/* ------------------------------------------------------------------ */
/* Small UI primitives                                                 */
/* ------------------------------------------------------------------ */

function SectionHeader({ icon: Icon, title, subtitle, accent = "indigo" }) {
  const accents = {
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    red: "bg-red-50 text-red-700 ring-red-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
  };
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ${accents[accent] || accents.indigo}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Contacts                                                           */
/* ------------------------------------------------------------------ */

function ProvinceAccordion({ province, contacts, isExpanded, onToggle, isUserProvince, userDistrict }) {
  return (
    <div
      className={`rounded-xl border transition-all ${
        isUserProvince
          ? "border-red-300 bg-gradient-to-r from-red-50/40 to-orange-50/40"
          : "border-slate-200 bg-white"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 rounded-xl p-3.5 text-left focus:outline-none focus:ring-2 focus:ring-red-200"
      >
        <div className="flex min-w-0 items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
          )}
          <span className="truncate text-sm font-semibold text-slate-800">{province}</span>
          {isUserProvince && (
            <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
              Your province
            </span>
          )}
        </div>
        <span className="shrink-0 text-[11px] text-slate-500">{contacts.length} districts</span>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-100 px-3 pb-3 pt-2">
          <div className="space-y-2">
            {contacts.map((contact) => {
              const isMine =
                userDistrict && userDistrict.toLowerCase() === contact.district.toLowerCase();
              return (
                <div
                  key={contact.district}
                  className={`rounded-lg border p-2.5 transition hover:shadow-sm ${
                    isMine
                      ? "border-red-200 bg-red-50/40"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">{contact.district}</p>
                      <p className="text-[11px] text-slate-500">{contact.role}</p>
                    </div>
                    <Globe className="mt-0.5 h-3 w-3 shrink-0 text-slate-300" />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {contact.phones.map((phone, idx) => (
                      <a
                        key={idx}
                        href={`tel:${phone.replace(/\s/g, "").replace(/\+/g, "")}`}
                        className="inline-flex items-center gap-1 font-medium text-indigo-700 transition hover:text-indigo-900"
                      >
                        <PhoneCall className="h-3 w-3" />
                        <span className="break-all">{phone}</span>
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
}

/* ------------------------------------------------------------------ */
/* Shelter card                                                        */
/* ------------------------------------------------------------------ */

function ShelterCard({
  shelter,
  highlight,
  distanceLabel,
  onDirections,
  directionsReady,
  onLiveCapacityUpdated,
}) {
  const [measurement, setMeasurement] = useState(String(shelter.occupied || 0));
  const [measurementBusy, setMeasurementBusy] = useState(false);
  const [measurementMessage, setMeasurementMessage] = useState("");

  const occupied = Number(shelter.occupied || 0);
  const capacity = Number(shelter.capacity || 0);
  const isFull = Boolean(shelter.isFull || (capacity > 0 && occupied >= capacity));
  const isOpen =
    (shelter.availability || (shelter.status === "inactive" ? "closed" : "open")) === "open";
  const condition = shelter.condition || "good";
  const conditionLabel =
    condition === "needs-attention" ? "Needs attention" : condition[0].toUpperCase() + condition.slice(1);
  const conditionClass =
    condition === "critical"
      ? "bg-red-50 text-red-700 ring-1 ring-red-100"
      : condition === "needs-attention"
      ? "bg-amber-50 text-amber-700 ring-1 ring-amber-100"
      : condition === "fair"
      ? "bg-yellow-50 text-yellow-800 ring-1 ring-yellow-100"
      : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";

  async function submitCapacityMeasurement(event) {
    event.preventDefault();
    const token =
      typeof window !== "undefined" ? window.localStorage.getItem("dmews_token") : null;
    const value = Number(measurement);
    if (!token) {
      setMeasurementMessage("Sign in with your district account to report live capacity.");
      return;
    }
    if (!Number.isInteger(value) || value < 0 || value > capacity) {
      setMeasurementMessage(`Enter a whole number from 0 to ${capacity}.`);
      return;
    }
    setMeasurementBusy(true);
    setMeasurementMessage("");
    try {
      const response = await fetch(
        `${API_BASE}/shelters/${encodeURIComponent(shelter.id)}/capacity-measurement`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ occupied: value }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMeasurementMessage(data?.message || "Could not save the live measurement.");
        return;
      }
      onLiveCapacityUpdated?.(data);
      setMeasurementMessage("Report submitted successfully.");
    } catch {
      setMeasurementMessage("Network error while saving the measurement.");
    } finally {
      setMeasurementBusy(false);
    }
  }

  const occupancyPercent = capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0;

  return (
    <article
      className={`group relative flex flex-col rounded-2xl border bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
        highlight
          ? "border-indigo-300 shadow-md ring-2 ring-indigo-100"
          : "border-slate-200 hover:border-indigo-200"
      }`}
    >
      {highlight && (
        <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
          <Sparkles className="h-3 w-3" />
          Top pick
        </span>
      )}

      {/* Title + location */}
      <header>
        <h3 className="pr-2 text-base font-semibold leading-snug text-slate-900">{shelter.name}</h3>
        <div className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-500">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-2">{shelter.location}</span>
        </div>
      </header>

      {/* Status pills */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            isOpen ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
          }`}
        >
          {isOpen ? <DoorOpen className="h-3 w-3" /> : <DoorClosed className="h-3 w-3" />}
          {isOpen ? "Open" : "Closed"}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            isFull ? "bg-red-50 text-red-700 ring-1 ring-red-100" : "bg-sky-50 text-sky-700 ring-1 ring-sky-100"
          }`}
        >
          {isFull ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
          {shelter.capacity == null
            ? `${shelter.reportedPersons || 0} reported`
            : isFull
            ? "FULL"
            : `${Math.max(0, capacity - occupied)} spaces`}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${conditionClass}`}>
          {conditionLabel}
        </span>
      </div>

      {/* Meta grid */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">District</p>
          <p className="truncate text-xs font-semibold text-slate-800">{shelter.district || "—"}</p>
        </div>
        <div className={`rounded-lg px-2.5 py-1.5 ${distanceLabel ? "bg-indigo-50" : "bg-slate-50"}`}>
          <p className={`text-[10px] font-medium uppercase tracking-wide ${distanceLabel ? "text-indigo-600" : "text-slate-500"}`}>
            Distance
          </p>
          <p className={`truncate text-xs font-semibold ${distanceLabel ? "text-indigo-800" : "text-slate-500"}`}>
            {distanceLabel || "Add city"}
          </p>
        </div>
      </div>

      {/* Occupancy bar */}
      {capacity > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {occupied}/{capacity} occupied
            </span>
            <span className="font-semibold tabular-nums">{occupancyPercent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all ${
                occupancyPercent >= 90 ? "bg-red-500" : occupancyPercent >= 70 ? "bg-amber-500" : "bg-sky-500"
              }`}
              style={{ width: `${occupancyPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Report live capacity */}
      {capacity > 0 && !shelter.historical && (
        <form
          onSubmit={submitCapacityMeasurement}
          className="mt-3 rounded-lg border border-sky-100 bg-sky-50/60 p-2.5"
        >
          <label className="block text-[11px] font-semibold text-slate-700">
            Report live occupied count
            <div className="mt-1.5 flex gap-1.5">
              <input
                type="number"
                min="0"
                max={capacity}
                step="1"
                value={measurement}
                onChange={(e) => setMeasurement(e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm tabular-nums"
                disabled={measurementBusy}
              />
              <button
                type="submit"
                disabled={measurementBusy}
                className="rounded-md bg-sky-700 px-3 py-1 text-xs font-semibold text-white transition hover:bg-sky-800 disabled:opacity-60"
              >
                {measurementBusy ? "Saving…" : "Submit"}
              </button>
            </div>
          </label>
          {measurementMessage && (
            <p className="mt-1.5 text-[11px] font-medium text-slate-700">{measurementMessage}</p>
          )}
        </form>
      )}

      {/* Actions */}
      <div className="mt-auto flex flex-col gap-2 pt-4 sm:flex-row">
        {shelter.contact && (
          <a
            href={`tel:${shelter.contact.replace(/\D/g, "")}`}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
          >
            <PhoneCall className="h-3.5 w-3.5" />
            Call
          </a>
        )}
        <button
          type="button"
          onClick={onDirections}
          disabled={!shelter.latitude || !shelter.longitude}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          title={
            !shelter.latitude || !shelter.longitude
              ? "Shelter coordinates are not available"
              : "Use Browser GPS and OSRM to get directions"
          }
        >
          <Navigation className="h-3.5 w-3.5" />
          {directionsReady ? "Directions" : "Enable GPS"}
        </button>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

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
  const [browserLocation, setBrowserLocation] = useState(null);
  const [browserLocationStatus, setBrowserLocationStatus] = useState("idle");
  const [browserLocationError, setBrowserLocationError] = useState("");
  const [routeShelter, setRouteShelter] = useState(null);
  const [expandedShelterDistricts, setExpandedShelterDistricts] = useState({});
  const [contactsSearchQuery, setContactsSearchQuery] = useState("");
  const [showOnlyMyDistrict, setShowOnlyMyDistrict] = useState(false);
  const [expandedProvinces, setExpandedProvinces] = useState({});

  /* -------- Load user district from localStorage -------- */
  useEffect(() => {
    let user = null;
    try {
      const raw =
        typeof window !== "undefined" ? window.localStorage.getItem("dmews_user") : null;
      user = raw ? JSON.parse(raw) : null;
    } catch {}
    const district = (user?.district || "").trim();
    setUserDistrict(district || null);
    const lat = user?.cityLatitude;
    const lon = user?.cityLongitude;
    setUserCityLatitude(typeof lat === "number" && Number.isFinite(lat) ? lat : null);
    setUserCityLongitude(typeof lon === "number" && Number.isFinite(lon) ? lon : null);
  }, []);

  /* -------- Fetch shelters -------- */
  useEffect(() => {
    setSheltersError(null);
    setSheltersLoading(true);
    Promise.all([
      fetch(`${API_BASE}/shelters`, { cache: "no-store" }),
      fetch(`${API_BASE}/shelters/safe-centres`, { cache: "no-store" }),
    ])
      .then(async ([sheltersRes, centresRes]) => {
        const data = await sheltersRes.json().catch(() => ({}));
        const centresPayload = await centresRes.json().catch(() => ({}));
        if (!sheltersRes.ok) {
          setShelters([]);
          setDistricts([]);
          setSheltersError(
            data?.message ||
              (si
                ? `සහන කඳවුරු පූරණය කළ නොහැක (HTTP ${sheltersRes.status})`
                : `Could not load shelters (HTTP ${sheltersRes.status})`)
          );
          return;
        }
        if (Array.isArray(data)) {
          const centres = Array.isArray(centresPayload?.safe_centres)
            ? centresPayload.safe_centres.map((centre) => ({
                id: `safe-centre-${centre.no}`,
                name: centre.safe_centre_name,
                location: centre.ds_division,
                district: "Badulla",
                city: centre.ds_division,
                capacity: null,
                occupied: 0,
                availableSpaces: null,
                availability: "open",
                condition: centre.highlighted_green ? "good" : "fair",
                contact: centre.contact_no ? `0${centre.contact_no}` : "",
                notes: `Historical report: ${centre.families || 0} families and ${centre.persons || 0} persons. Current occupancy is not available. Coordinating officer: ${centre.coordinating_officer || "Not specified"}.`,
                source: "Badulla safe centres dataset",
                reportedPersons: Number(centre.persons) || 0,
                historical: true,
                highlightedGreen: Boolean(centre.highlighted_green),
              }))
            : [];
          const combined = [...data, ...centres];
          setShelters(combined);
          const uniqueDistricts = [...new Set(combined.map((s) => s.district).filter(Boolean))].sort();
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
          si ? "සහන කඳවුරු පූරණය කිරීමේදී ජාල දෝෂයකි." : "Network error while loading shelters."
        );
      })
      .finally(() => setSheltersLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------- Auto-expand user's district -------- */
  useEffect(() => {
    if (userDistrict && shelters.length > 0 && !expandedShelterDistricts[userDistrict]) {
      setExpandedShelterDistricts((prev) => ({ ...prev, [userDistrict]: true }));
    }
  }, [userDistrict, shelters, expandedShelterDistricts]);

  /* -------- Filtered shelters -------- */
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
        Number.isFinite(Number(s.latitude ?? s.cityLatitude)) &&
        Number.isFinite(Number(s.longitude ?? s.cityLongitude))
      ) {
        distanceKm = haversineKm(
          userCityLatitude,
          userCityLongitude,
          Number(s.latitude ?? s.cityLatitude),
          Number(s.longitude ?? s.cityLongitude)
        );
      }
      return { ...s, distanceKm };
    });
  }, [filteredByDistrict, userHasCoords, userCityLatitude, userCityLongitude]);

  /* -------- Recommended shelter -------- */
  const recommendedShelter = useMemo(() => {
    const recommendationLatitude = browserLocation?.latitude ?? userCityLatitude;
    const recommendationLongitude = browserLocation?.longitude ?? userCityLongitude;
    const hasRecommendationCoords =
      Number.isFinite(recommendationLatitude) && Number.isFinite(recommendationLongitude);
    const conditionRank = { good: 0, fair: 1, "needs-attention": 2, critical: 3 };

    const preferredDistrict = selectedDistrict || userDistrict;
    const districtShelters = preferredDistrict
      ? shelters.filter(
          (shelter) =>
            String(shelter.district || "").trim().toLowerCase() ===
            String(preferredDistrict).trim().toLowerCase()
        )
      : shelters;
    const candidates = districtShelters.length > 0 ? districtShelters : shelters;

    return (
      candidates
        .map((shelter) => {
          const capacity = Number(shelter.capacity);
          const occupied = Number(shelter.occupied || 0);
          const hasKnownCapacity = Number.isFinite(capacity) && capacity > 0;
          const availableSpaces = hasKnownCapacity ? Math.max(0, capacity - occupied) : null;
          const isOpen =
            (shelter.availability ||
              (shelter.status === "inactive" ? "closed" : "open")) === "open";
          const latitude = Number(shelter.latitude ?? shelter.cityLatitude);
          const longitude = Number(shelter.longitude ?? shelter.cityLongitude);
          const distanceKm =
            hasRecommendationCoords && Number.isFinite(latitude) && Number.isFinite(longitude)
              ? haversineKm(recommendationLatitude, recommendationLongitude, latitude, longitude)
              : null;

          return {
            ...shelter,
            recommendationDistanceKm: distanceKm,
            recommendationAvailableSpaces: availableSpaces,
            recommendationEligible: isOpen && (!hasKnownCapacity || availableSpaces > 0),
            recommendationConditionRank:
              conditionRank[shelter.condition || "good"] ?? conditionRank.good,
          };
        })
        .sort((a, b) => {
          if (a.recommendationEligible !== b.recommendationEligible) {
            return a.recommendationEligible ? -1 : 1;
          }
          if (a.recommendationConditionRank !== b.recommendationConditionRank) {
            return a.recommendationConditionRank - b.recommendationConditionRank;
          }
          const ad = a.recommendationDistanceKm;
          const bd = b.recommendationDistanceKm;
          if (ad != null && bd != null && ad !== bd) return ad - bd;
          if (ad != null && bd == null) return -1;
          if (ad == null && bd != null) return 1;
          return (a.name || "").localeCompare(b.name || "");
        })[0] || null
    );
  }, [browserLocation, selectedDistrict, shelters, userCityLatitude, userCityLongitude, userDistrict]);

  /* -------- Contacts filtering -------- */
  const filteredContacts = useMemo(() => {
    let fc = DISTRICT_CONTACTS;
    if (showOnlyMyDistrict && userDistrict) {
      fc = fc.filter((c) => c.district.toLowerCase() === userDistrict.toLowerCase());
    } else if (contactsSearchQuery) {
      const query = contactsSearchQuery.toLowerCase();
      fc = fc.filter(
        (contact) =>
          contact.district.toLowerCase().includes(query) ||
          (districtToProvince[contact.district] || "").toLowerCase().includes(query)
      );
    }
    return fc;
  }, [showOnlyMyDistrict, userDistrict, contactsSearchQuery]);

  const groupedContacts = useMemo(() => groupByProvince(filteredContacts), [filteredContacts]);
  const sortedProvinces = useMemo(
    () => Object.keys(groupedContacts).sort(),
    [groupedContacts]
  );

  useEffect(() => {
    if (contactsSearchQuery || showOnlyMyDistrict) {
      const allExpanded = {};
      sortedProvinces.forEach((p) => (allExpanded[p] = true));
      setExpandedProvinces(allExpanded);
    } else {
      setExpandedProvinces({});
    }
  }, [contactsSearchQuery, showOnlyMyDistrict, sortedProvinces]);

  const toggleProvince = (p) =>
    setExpandedProvinces((prev) => ({ ...prev, [p]: !prev[p] }));
  const toggleShelterDistrict = (d) =>
    setExpandedShelterDistricts((prev) => ({ ...prev, [d]: !prev[d] }));

  /* -------- Shelters by district (recommended slice) -------- */
  const sheltersByDistrict = useMemo(() => {
    const conditionRank = { good: 0, fair: 1, "needs-attention": 2, critical: 3 };
    const rankedShelters = [...sheltersWithDistance].sort((a, b) => {
      const aOpen =
        (a.availability || (a.status === "inactive" ? "closed" : "open")) === "open";
      const bOpen =
        (b.availability || (b.status === "inactive" ? "closed" : "open")) === "open";
      const aAvailable =
        a.availableSpaces == null && a.capacity == null
          ? true
          : Number(a.availableSpaces ?? Number(a.capacity || 0) - Number(a.occupied || 0)) > 0;
      const bAvailable =
        b.availableSpaces == null && b.capacity == null
          ? true
          : Number(b.availableSpaces ?? Number(b.capacity || 0) - Number(b.occupied || 0)) > 0;
      if (aOpen !== bOpen) return aOpen ? -1 : 1;
      if (aAvailable !== bAvailable) return aAvailable ? -1 : 1;
      const aCondition = conditionRank[a.condition || "good"] ?? conditionRank.good;
      const bCondition = conditionRank[b.condition || "good"] ?? conditionRank.good;
      if (aCondition !== bCondition) return aCondition - bCondition;
      if (a.distanceKm != null && b.distanceKm != null && a.distanceKm !== b.distanceKm) {
        return a.distanceKm - b.distanceKm;
      }
      if (a.distanceKm != null) return -1;
      if (b.distanceKm != null) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });
    const limitedShelters = rankedShelters.slice(0, MAX_RECOMMENDED_SHELTERS);
    const groups = {};
    limitedShelters.forEach((shelter) => {
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
    const districtNames = Object.keys(groups);
    districtNames.sort((a, b) => {
      if (userDistrict && a === userDistrict) return -1;
      if (userDistrict && b === userDistrict) return 1;
      return a.localeCompare(b);
    });
    return {
      groups,
      districtNames,
      totalCount: sheltersWithDistance.length,
      shownCount: limitedShelters.length,
    };
  }, [sheltersWithDistance, userDistrict]);

  /* -------- Hero stats -------- */
  const heroStats = useMemo(() => {
    const total = shelters.length;
    const openCount = shelters.filter(
      (s) => (s.availability || (s.status === "inactive" ? "closed" : "open")) === "open"
    ).length;
    return { total, openCount, districts: districts.length };
  }, [shelters, districts]);

  /* -------- Scroll helpers -------- */
  const scrollToShelters = () =>
    document.getElementById("shelters-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const scrollToContacts = () =>
    document.getElementById("district-contacts")?.scrollIntoView({ behavior: "smooth", block: "start" });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash === "#shelters-list" || hash === "#nearest-shelter") {
      setTimeout(() => scrollToShelters(), 0);
    }
  }, []);

  /* -------- Browser location -------- */
  const requestBrowserLocation = (shelterToRoute = null) => {
    if (!navigator.geolocation) {
      setBrowserLocationStatus("error");
      setBrowserLocationError("Browser GPS is not available on this device.");
      return;
    }
    setBrowserLocationStatus("loading");
    setBrowserLocationError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setBrowserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setBrowserLocationStatus("ready");
        if (shelterToRoute) setRouteShelter(shelterToRoute);
      },
      (error) => {
        setBrowserLocationStatus("error");
        setBrowserLocationError(
          error.code === 1
            ? "Location permission was denied. Enable GPS to get directions."
            : "Could not get your current location."
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  /* ---------------------------------------------------------------- */
  /* Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* ================= HERO ================= */}
      <section
        className="relative isolate overflow-hidden border-b border-indigo-900/20"
        aria-labelledby="shelters-hero-title"
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${HERO_BG})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/90 via-slate-900/85 to-indigo-900/80" />

        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-100">
              <Building2 className="h-3.5 w-3.5" aria-hidden />
              DisasterWatch
            </p>

            <h1
              id="shelters-hero-title"
              className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
            >
              {si ? "සහන කඳවුරු" : "Relief Camps"}
            </h1>

            <p className="mt-3 max-w-2xl text-base text-indigo-100/95 sm:text-lg">
              {si
                ? "ඔබගේ ස්ථානයට ආසන්න සහන කඳවුරු දුර අනුව පෙළගස්වා පෙන්වයි. නිල ඉවතලන මධ්‍යස්ථාන සහ හදිසි සම්බන්ධතා සොයාගන්න."
                : "Nearby shelters ranked by distance from your location for faster, safer access. Find official evacuation centres and emergency contacts."}
            </p>

            {/* Quick stats */}
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                { label: "Shelters", value: heroStats.total },
                { label: "Districts", value: heroStats.districts },
                { label: "Open now", value: heroStats.openCount },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-sm"
                >
                  <span className="text-lg font-bold tabular-nums text-white">{s.value}</span>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-indigo-100">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={scrollToShelters}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-indigo-950 shadow-lg shadow-black/20 transition hover:bg-amber-300"
              >
                {si ? "සහන කඳවුරු ලැයිස්තුව බලන්න" : "View Relief Camp List"}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={requestBrowserLocation}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-white/40 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
              >
                <LocateFixed className="h-4 w-4" />
                {browserLocationStatus === "ready" ? "GPS ready" : "Use my GPS"}
              </button>
              <button
                type="button"
                onClick={scrollToContacts}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-white/40 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
              >
                <Headphones className="h-4 w-4" />
                {si ? "හදිසි සම්බන්ධතා" : "Emergency Contacts"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* ================= SHELTERS ================= */}
          <section
            id="shelters-list"
            className="scroll-mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <SectionHeader
              icon={Building2}
              title={si ? "සහන කඳවුරු ලැයිස්තුව" : "Relief Camp List"}
              subtitle={
                si
                  ? "DMEWS සහන කඳවුරු දත්ත ගබඩාවෙන් පූරණය කර ඇත. මෙය අසමත් වුවද පහත දිස්ත්‍රික් සම්බන්ධතා භාවිතා කළ හැක."
                  : "Loaded from the DMEWS shelter database. If this fails, district contacts below are still available."
              }
            />

            {/* Sticky filter toolbar */}
            {!sheltersLoading && shelters.length > 0 && (
              <div className="sticky top-14 z-20 border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur sm:px-5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600">
                    <Filter className="h-3.5 w-3.5" />
                    {si ? "දිස්ත්‍රික්කය" : "District"}
                  </div>
                  <select
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">{si ? "සියලු දිස්ත්‍රික්ක" : "All districts"}</option>
                    {districts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>

                  {selectedDistrict && (
                    <button
                      type="button"
                      onClick={() => setSelectedDistrict("")}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
                    >
                      <X className="h-3.5 w-3.5" />
                      {si ? "ඉවත් කරන්න" : "Clear"}
                    </button>
                  )}

                  <span className="text-xs text-slate-500">
                    {selectedDistrict
                      ? `${sheltersByDistrict.totalCount} ${si ? "කඳවුරු" : "in district"}`
                      : `${sheltersByDistrict.totalCount} ${si ? "කඳවුරු" : "camps"}`}
                  </span>

                  <div className="ml-auto flex flex-wrap items-center gap-1.5">
                    {userDistrict && (
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-100">
                        <MapPin className="mr-1 inline h-3 w-3" />
                        {si ? "ඔබගේ දිස්ත්‍රික්කය" : "Your district"}: {userDistrict}
                      </span>
                    )}
                    {userHasCoords && (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                        <Navigation className="mr-1 inline h-3 w-3" />
                        {si ? "දුර පෙන්වයි" : "Distances shown"}
                      </span>
                    )}
                    {userDistrict && !userHasCoords && (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-100">
                        <AlertCircle className="mr-1 inline h-3 w-3" />
                        {si ? "නගරය පැතිකඩේ එක් කරන්න" : "Add city for distance"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 sm:p-5">
              {/* Error banner */}
              {sheltersError && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-semibold text-amber-900">
                      {si ? "සහන කඳවුරු පූරණය කළ නොහැක" : "Could not load shelters"}
                    </p>
                    <p className="mt-1 text-amber-900/90">{sheltersError}</p>
                    <p className="mt-2 text-xs text-amber-800/80">
                      {si ? "නිල සහන කඳවුරු තොරතුරු සඳහා පහත " : "Use "}
                      <strong>
                        {si
                          ? "දිස්ත්‍රික් ආපදා කළමනාකරණ සම්බන්ධතා"
                          : "District Disaster Management Contacts"}
                      </strong>{" "}
                      {si ? "භාවිතා කරන්න හෝ " : "below or call "}
                      <strong>117</strong> / <strong>119</strong>
                      {si ? " අමතන්න." : " for official shelter information."}
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
                  {/* Recommended shelter */}
                  {recommendedShelter && (
                    <div className="mb-5 overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-emerald-50/50 to-sky-50 shadow-sm">
                      <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
                        <div className="min-w-0">
                          <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                            <Sparkles className="h-3 w-3" />
                            {si ? "ඔබ සඳහා නිර්දේශිත" : "Recommended for you"}
                          </p>
                          <h3 className="mt-2 truncate text-xl font-bold text-slate-900">
                            {recommendedShelter.name}
                          </h3>
                          <p className="mt-0.5 truncate text-sm text-slate-600">
                            {recommendedShelter.location}, {recommendedShelter.district}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                            <span className="rounded-full bg-white px-2.5 py-1 text-emerald-800 ring-1 ring-emerald-100">
                              {recommendedShelter.recommendationAvailableSpaces == null
                                ? `${recommendedShelter.reportedPersons || recommendedShelter.occupied || 0} ${si ? "වාර්තා වී ඇත" : "people reported"}`
                                : `${recommendedShelter.recommendationAvailableSpaces} ${si ? "ඉඩ ඇත" : "spaces available"}`}
                            </span>
                            <span className="rounded-full bg-white px-2.5 py-1 text-slate-700 ring-1 ring-slate-100">
                              {recommendedShelter.condition === "needs-attention"
                                ? "Needs attention"
                                : `Condition: ${recommendedShelter.condition || "good"}`}
                            </span>
                          </div>
                        </div>

                        {recommendedShelter.recommendationDistanceKm != null && (
                          <div className="shrink-0 rounded-xl bg-white/70 px-4 py-3 text-center ring-1 ring-white/80 backdrop-blur">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                              {si ? "දුර" : "Distance"}
                            </p>
                            <p className="mt-0.5 text-2xl font-bold tabular-nums text-emerald-900">
                              {formatDistanceKm(recommendedShelter.recommendationDistanceKm)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Truncation notice */}
                  {sheltersByDistrict.totalCount > sheltersByDistrict.shownCount && (
                    <div className="mb-4 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-900">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        {si
                          ? `ඔබට වඩාත් සුදුසු සහ ආසන්න කඳවුරු ${sheltersByDistrict.shownCount}ක් පමණක් පෙන්වයි.`
                          : `Showing the ${sheltersByDistrict.shownCount} most suitable of ${sheltersByDistrict.totalCount}. Open shelters with space, safer condition, and proximity are prioritised.`}
                      </span>
                    </div>
                  )}

                  {/* List or empty state */}
                  {sheltersWithDistance.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
                      <Building2 className="mb-4 h-12 w-12 text-slate-300" />
                      <p className="max-w-md text-sm text-slate-600">
                        {selectedDistrict
                          ? si
                            ? `${selectedDistrict} දිස්ත්‍රික්කයේ සහන කඳවුරු හමු නොවීය. වෙනත් දිස්ත්‍රික්කයක් උත්සාහ කරන්න.`
                            : `No shelters found in ${selectedDistrict}. Try a different district.`
                          : si
                            ? "තවම සහන කඳවුරු ලැයිස්තුගත කර නොමැත. පසුව නැවත පරීක්ෂා කරන්න හෝ ප්‍රදේශීය ආපදා කළමනාකරණ මධ්‍යස්ථානය අමතන්න."
                            : "No shelters listed yet. Check back later or contact your local disaster management centre."}
                      </p>
                      <p className="mt-3 rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-700 ring-1 ring-red-100">
                        {si ? "හදිසි: 117" : "Emergency: 117 / 119"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sheltersByDistrict.districtNames.map((district) => {
                        const sheltersList = sheltersByDistrict.groups[district];
                        const isUserDistrict = userDistrict === district;
                        const isExpanded = expandedShelterDistricts[district] || false;
                        const openCount = sheltersList.filter(
                          (s) =>
                            (s.availability ||
                              (s.status === "inactive" ? "closed" : "open")) === "open"
                        ).length;

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
                              type="button"
                              onClick={() => toggleShelterDistrict(district)}
                              className="flex w-full items-center justify-between gap-2 rounded-xl p-4 text-left focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-500" />
                                )}
                                <h3 className="truncate font-semibold text-slate-800">
                                  {district} {si ? "දිස්ත්‍රික්කය" : "District"}
                                </h3>
                                {isUserDistrict && !selectedDistrict && (
                                  <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                                    {si ? "ඔබගේ" : "Yours"}
                                  </span>
                                )}
                              </div>
                              <div className="flex shrink-0 items-center gap-1.5 text-[11px]">
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                                  {sheltersList.length} {si ? "කඳවුරු" : "camps"}
                                </span>
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 ring-1 ring-emerald-100">
                                  {openCount} {si ? "විවෘත" : "open"}
                                </span>
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="border-t border-slate-100 px-4 pb-4 pt-4">
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                  {sheltersList.map((s) => (
                                    <ShelterCard
                                      key={s.id}
                                      shelter={s}
                                      highlight={isUserDistrict || s.id === recommendedShelter?.id}
                                      distanceLabel={formatDistanceKm(s.distanceKm)}
                                      onDirections={() => {
                                        if (!browserLocation) requestBrowserLocation(s);
                                        else setRouteShelter(s);
                                      }}
                                      directionsReady={Boolean(browserLocation)}
                                      onLiveCapacityUpdated={(updated) => {
                                        setShelters((current) =>
                                          current.map((item) =>
                                            item.id === updated.shelterId
                                              ? { ...item, ...updated }
                                              : item
                                          )
                                        );
                                      }}
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

          {/* ================= CONTACTS ================= */}
          <section
            id="district-contacts"
            className="scroll-mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-100 bg-gradient-to-r from-red-50 to-orange-50/30">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-700 ring-1 ring-red-100">
                    <Headphones className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold tracking-tight text-slate-900">
                      {si
                        ? "දිස්ත්‍රික් ආපදා කළමනාකරණ සම්බන්ධතා"
                        : "District Disaster Management Contacts"}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {si
                        ? "නිල උපදෙස් සහ සහාය සඳහා අමතන්න"
                        : "Call for official instructions & help"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contacts toolbar */}
            <div className="sticky top-14 z-10 border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur sm:px-5">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 focus-within:ring-2 focus-within:ring-red-200">
                  <Search className="h-4 w-4 shrink-0 text-slate-400" />
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
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                  />
                  {contactsSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setContactsSearchQuery("")}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {userDistrict && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowOnlyMyDistrict(!showOnlyMyDistrict);
                      if (!showOnlyMyDistrict) setContactsSearchQuery("");
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      showOnlyMyDistrict
                        ? "bg-red-100 text-red-700 ring-1 ring-red-300"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {showOnlyMyDistrict ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                    {showOnlyMyDistrict
                      ? si
                        ? "ඔබගේ දිස්ත්‍රික්කය පමණක්"
                        : "Only your district"
                      : si
                        ? "මගේ දිස්ත්‍රික්කය පමණක්"
                        : "Show only mine"}
                  </button>
                )}
              </div>
            </div>

            <div className="p-4 sm:p-5">
              {Object.keys(groupedContacts).length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-10 text-center">
                  <AlertCircle className="mb-2 h-10 w-10 text-amber-600" />
                  <p className="font-semibold text-amber-950">
                    {showOnlyMyDistrict
                      ? `No directory entry for ${userDistrict || "your district"}`
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
                      type="button"
                      onClick={() => {
                        setShowOnlyMyDistrict(false);
                        setContactsSearchQuery("");
                      }}
                      className="mt-4 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-200"
                    >
                      {si ? "පෙරණ ඉවත් කරන්න" : "Clear filters"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {sortedProvinces.map((province) => (
                    <ProvinceAccordion
                      key={province}
                      province={province}
                      contacts={groupedContacts[province]}
                      isExpanded={expandedProvinces[province] || false}
                      onToggle={() => toggleProvince(province)}
                      isUserProvince={
                        userDistrict && districtToProvince[userDistrict] === province
                      }
                      userDistrict={userDistrict}
                    />
                  ))}
                </div>
              )}

              <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-center text-xs text-slate-600">
                <AlertCircle className="mr-1 inline h-3.5 w-3.5 align-text-bottom text-red-500" />
                {si
                  ? "ඔබගේ දිස්ත්‍රික් සම්බන්ධතාව වෙත ළඟා විය නොහැකි නම් ජාතික හදිසි අංක "
                  : "If you cannot reach your district contact, call national emergency hotline "}
                <strong className="text-red-600">117</strong>
                {si ? " හෝ " : " or "}
                <strong className="text-red-600">119</strong>.
              </div>
            </div>
          </section>

          {/* ================= DO / DON'T ================= */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              icon={ShieldAlert}
              title={si ? "ආරක්ෂක උපදෙස්" : "Safety Instructions"}
              subtitle={
                si
                  ? "ඉවතලන අවස්ථාවේ කළ යුතු හා නොකළ යුතු දේ පිළිබඳ මාර්ගෝපදේශ."
                  : "A quick Do & Don't guide to stay safe during evacuation."
              }
              accent="amber"
            />

            <div className="bg-slate-50/60 p-5 sm:p-6">
              <div className="flex flex-wrap justify-center gap-6">
                {/* DO */}
                <div className="flex min-h-[480px] w-full max-w-[420px] overflow-hidden rounded-2xl bg-white shadow-[0_8px_40px_rgba(0,0,0,0.1)]">
                  <div className="relative flex w-[72px] flex-shrink-0 flex-col items-center justify-between bg-gradient-to-b from-[#2ecc5a] to-[#1fa843] py-5">
                    <ThumbsUp className="h-7 w-7 text-white" />
                    <span className="rotate-180 text-xl font-extrabold tracking-[0.2em] text-white [writing-mode:vertical-rl]">
                      DO
                    </span>
                    <span className="absolute right-[-18px] top-1/2 h-0 w-0 -translate-y-1/2 border-y-[22px] border-y-transparent border-l-[20px] border-l-[#1fa843]" />
                  </div>
                  <div className="flex-1 space-y-4 px-5 py-6">
                    {DOS.map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#2ecc5a]">
                          <Check className="h-3.5 w-3.5 text-white" />
                        </span>
                        <p className="text-sm leading-relaxed text-slate-700">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* DON'T */}
                <div className="flex min-h-[480px] w-full max-w-[420px] overflow-hidden rounded-2xl bg-white shadow-[0_8px_40px_rgba(0,0,0,0.1)]">
                  <div className="relative flex w-[72px] flex-shrink-0 flex-col items-center justify-between bg-gradient-to-b from-[#ff4e6a] to-[#ff8c42] py-5">
                    <ThumbsDown className="h-7 w-7 text-white" />
                    <span className="rotate-180 text-xl font-extrabold tracking-[0.1em] text-white [writing-mode:vertical-rl]">
                      DON&apos;T
                    </span>
                    <span className="absolute right-[-18px] top-1/2 h-0 w-0 -translate-y-1/2 border-y-[22px] border-y-transparent border-l-[20px] border-l-[#ff6b42]" />
                  </div>
                  <div className="flex-1 space-y-4 px-5 py-6">
                    {DONTS.map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#ff4e6a]">
                          <X className="h-3.5 w-3.5 text-white" />
                        </span>
                        <p className="text-sm leading-relaxed text-slate-700">{item}</p>
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
          <strong className="text-indigo-600">117</strong>
          {si ? " හෝ " : " or contact your "}
          {si ? "දිස්ත්‍රික් ආපදා කළමනාකරණ මධ්‍යස්ථානය අමතන්න." : "district disaster management centre."}
          <Link href="/" className="ml-2 font-medium text-indigo-600 hover:underline">
            {si ? "පුවරුවට ආපසු" : "Back to dashboard"}
          </Link>
          .
        </p>
      </div>

      {/* Route modal + error */}
      {browserLocationStatus === "error" && (
        <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-900 shadow-lg ring-1 ring-amber-200">
          <AlertCircle className="mr-1 inline h-4 w-4 align-text-bottom" />
          {browserLocationError}
        </div>
      )}
      {routeShelter && browserLocation && (
        <RouteModal
          shelter={routeShelter}
          userLocation={browserLocation}
          onClose={() => setRouteShelter(null)}
        />
      )}
    </div>
  );
}