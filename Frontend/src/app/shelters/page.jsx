"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Loader from "@/components/Loader";
import {
  Building2,
  MapPin,
  Users,
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
  Loader2,
  DoorOpen,
  DoorClosed,
  AlertTriangle,
  CheckCircle2,
  LocateFixed,
  Mountain,
  Waves,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import RouteModal from "@/components/RouteModal";
import { buildGaugeFeedUrl, parseArcGISFeed } from "@/lib/riverGauges";
import { buildAreas, locateGauges, matchWarningAreas, normalizeDistrict } from "@/lib/cascadeRisk";
import { assessPersonalRisk } from "@/lib/personalRisk";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const HERO_BG = "/img/shelter.png";
const MAX_RECOMMENDED_SHELTERS = 6;

const DISTRICT_COORDINATES = {
  Ampara: [7.2833, 81.6667],
  Anuradhapura: [8.3114, 80.4037],
  Badulla: [6.9934, 81.055],
  Batticaloa: [7.7248, 81.6964],
  Colombo: [6.9271, 79.8612],
  Galle: [6.0329, 80.217],
  Gampaha: [7.0873, 80.0144],
  Hambantota: [6.1248, 81.1185],
  Jaffna: [9.6615, 80.0255],
  Kalutara: [6.5854, 79.9607],
  Kandy: [7.2906, 80.6337],
  Kegalle: [7.2513, 80.3464],
  Kilinochchi: [9.3803, 80.377],
  Kurunegala: [7.4863, 80.3623],
  Mannar: [8.9771, 79.9042],
  Matale: [7.4675, 80.6234],
  Matara: [5.9549, 80.5549],
  Monaragala: [6.8728, 81.3507],
  Mullaitivu: [9.2671, 80.8142],
  "Nuwara Eliya": [6.9497, 80.7891],
  Polonnaruwa: [7.9403, 81.0188],
  Puttalam: [8.0408, 79.8394],
  Ratnapura: [6.6828, 80.3992],
  Trincomalee: [8.5874, 81.2152],
  Vavuniya: [8.7514, 80.4971],
};

function getShelterCoordinates(shelter) {
  const latitude = Number(shelter?.latitude ?? shelter?.cityLatitude);
  const longitude = Number(shelter?.longitude ?? shelter?.cityLongitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return { latitude, longitude };
  }
  const districtCenter = DISTRICT_COORDINATES[String(shelter?.district || "").trim()];
  return districtCenter ? { latitude: districtCenter[0], longitude: districtCenter[1] } : null;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
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
/* Safety check modal                                                  */
/* ------------------------------------------------------------------ */

function SafetyCheckModal({ isOpen, onClose, si, safetyChecking, safetyCheck, safetyError, onRetry }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const riskPalette = [
    { chip: "from-emerald-500 to-teal-500", bg: "from-emerald-50 to-teal-50", border: "border-emerald-200", text: "text-emerald-950" },
    { chip: "from-yellow-500 to-amber-500", bg: "from-yellow-50 to-amber-50", border: "border-yellow-200", text: "text-yellow-950" },
    { chip: "from-orange-500 to-amber-500", bg: "from-orange-50 to-amber-50", border: "border-orange-200", text: "text-orange-950" },
    { chip: "from-rose-500 to-red-500", bg: "from-rose-50 to-red-50", border: "border-rose-200", text: "text-rose-950" },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="safety-modal-title"
    >
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-slate-900/5 sm:rounded-3xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-emerald-50/80 via-white to-sky-50/60 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div>
              <h2 id="safety-modal-title" className="text-lg font-semibold tracking-tight text-slate-900">
                {si ? "මම ආරක්ෂිතද?" : "Am I safe?"}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
                {si
                  ? "ඔබගේ වත්මන් ස්ථානය සජීවී අනතුරු ඇඟවීම් සමඟ සසඳයි"
                  : "Comparing your live location with active warnings"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {safetyChecking && (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400/20" />
                <div className="relative grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30">
                  <Loader2 className="h-7 w-7 animate-spin text-white" />
                </div>
              </div>
              <p className="mt-5 text-sm font-semibold text-slate-900">
                {si ? "ඔබගේ ආරක්ෂාව පරීක්ෂා කරමින්…" : "Checking your safety…"}
              </p>
              <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-slate-500">
                {si
                  ? "සජීවී ගංගා මිනුම්, ප්‍රකාශිත අවදානම් මට්ටම් සහ DMC නායයෑම් අනතුරු ඇඟවීම් සමඟ සසඳමින්"
                  : "Matching against live river gauges, published risk levels, and DMC landslide warnings"}
              </p>
            </div>
          )}

          {!safetyChecking && safetyError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-700">
                  <AlertCircle className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-rose-900">
                    {si ? "පරීක්ෂාව සම්පූර්ණ කළ නොහැක" : "Could not complete check"}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-rose-800">{safetyError}</p>
                </div>
              </div>
            </div>
          )}

          {!safetyChecking && !safetyError && safetyCheck && (() => {
            const { assessment, point, checkedAt, unmatchedWarnings } = safetyCheck;
            const incomplete = !assessment.place || unmatchedWarnings.length > 0;
            const palette = incomplete ? null : riskPalette[assessment.overall] || riskPalette[0];
            const incompleteMessage = !assessment.place
              ? si
                ? "ඔබගේ ස්ථානය සිතියම්ගත කළ ප්‍රාදේශීය ලේකම් කොට්ඨාසයකට ගැළපීමට නොහැකි විය. මෙම පරීක්ෂාවෙන් ආරක්ෂිත බව තහවුරු කළ නොහැක."
                : "Your location could not be matched to a mapped DS division. This check cannot confirm that your location is safe."
              : si
                ? "ඔබගේ දිස්ත්‍රික්කයේ අනතුරු ඇඟවීම් ප්‍රදේශ සිතියමට ගැළපීමට නොහැකි විය. මෙය ආරක්ෂිත බව තහවුරු නොකරයි."
                : "A DMC warning in your district could not be matched to a mapped area. This check cannot confirm that your location is safe.";

            return (
              <div className="space-y-4">
                {/* Verdict card */}
                <div
                  className={`relative overflow-hidden rounded-2xl border p-5 ${
                    incomplete
                      ? "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50"
                      : `${palette.border} bg-gradient-to-br ${palette.bg}`
                  }`}
                >
                  <div
                    className={`absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20 blur-2xl ${
                      incomplete ? "bg-amber-400" : `bg-gradient-to-br ${palette.chip}`
                    }`}
                  />
                  <div className="relative flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className={`text-[10px] font-bold uppercase tracking-[0.15em] ${incomplete ? "text-amber-700" : palette.text} opacity-70`}>
                        {si ? "ඔබගේ වත්මන් අවදානම" : "Current location status"}
                      </p>
                      <h3 className={`mt-1.5 text-2xl font-bold tracking-tight ${incomplete ? "text-amber-950" : palette.text}`}>
                        {incomplete
                          ? si ? "අසම්පූර්ණ පරීක්ෂාව" : "Check incomplete"
                          : assessment.level.label}
                      </h3>
                      <p className={`mt-1.5 max-w-md text-sm leading-relaxed ${incomplete ? "text-amber-900" : palette.text} opacity-90`}>
                        {incomplete ? incompleteMessage : assessment.level.headline}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${incomplete ? "bg-amber-100 text-amber-800" : "bg-white/70 text-slate-700 backdrop-blur"}`}>
                      {si ? "පරීක්ෂා කළේ" : "Checked"}{" "}
                      {checkedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>

                {/* Detail cards */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-700">
                        <Mountain className="h-4 w-4" />
                      </span>
                      <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        {si ? "නායයෑම්" : "Landslide"}
                      </h4>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-900">{assessment.landslide.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{assessment.landslide.detail}</p>
                  </article>
                  <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sky-700">
                        <Waves className="h-4 w-4" />
                      </span>
                      <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        {si ? "ගංගා / ගංවතුර" : "Flood / River"}
                      </h4>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-900">{assessment.flood.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{assessment.flood.detail}</p>
                  </article>
                </div>

                {assessment.combined.reasons.length > 0 && (
                  <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                    <p className="text-sm font-semibold text-orange-950">{assessment.combined.title}</p>
                    <ul className="mt-2 space-y-1 text-sm text-orange-900">
                      {assessment.combined.reasons.map((reason) => (
                        <li key={reason} className="flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {incomplete && (
                  <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-950">
                      {si ? "සිතියමට ගැළපීමට නොහැකි DMC අනතුරු ඇඟවීම්" : "DMC warnings not mapped to an area"}
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-amber-900">
                      {unmatchedWarnings.map((warning, index) => (
                        <li key={`${warning.district}-${warning.division}-${index}`} className="flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                          <span>
                            {warning.division}, {warning.district} (level {warning.level})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-[11px] leading-relaxed text-slate-500">
                  {si
                    ? `${assessment.place ? `${assessment.place.dsDivision}, ${assessment.place.district} · ` : ""}ස්ථානය: ${point.lat.toFixed(4)}, ${point.lon.toFixed(4)} · DMC අනතුරු ඇඟවීම්, වාරිමාර්ග දෙපාර්තමේන්තු මිනුම් සහ ප්‍රකාශිත දිස්ත්‍රික් අවදානම් මට්ටම් භාවිතා කර ඇත.`
                    : `${assessment.place ? `${assessment.place.dsDivision}, ${assessment.place.district} · ` : ""}Location: ${point.lat.toFixed(4)}, ${point.lon.toFixed(4)} · Sources: DMC landslide warnings, Irrigation Department gauge levels, and published district risk levels.`}
                </p>
              </div>
            );
          })()}

          {!safetyChecking && !safetyError && !safetyCheck && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-6 text-center">
              <p className="text-sm text-slate-600">
                {si ? "ස්ථානය පරීක්ෂා කිරීමට සූදානම්." : "Ready to check your current location."}
              </p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              >
                <LocateFixed className="h-4 w-4" />
                {si ? "පරීක්ෂාව ආරම්භ කරන්න" : "Start check"}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-5 py-3 sm:px-6">
          <p className="text-[11px] text-slate-500">
            {si ? "ඔබගේ ස්ථානය සුරැකෙන්නේ නැත." : "Your location is not saved."}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {si ? "වසන්න" : "Close"}
            </button>
            <button
              type="button"
              onClick={onRetry}
              disabled={safetyChecking}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
            >
              {safetyChecking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
              {safetyChecking
                ? si ? "පරීක්ෂා කරයි…" : "Checking…"
                : si ? "නැවත පරීක්ෂා කරන්න" : "Check again"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section header                                                      */
/* ------------------------------------------------------------------ */

function SectionHeader({ icon: Icon, title, subtitle, accent = "indigo" }) {
  const accents = {
    indigo: "from-indigo-500 to-violet-600 shadow-indigo-500/20",
    emerald: "from-emerald-500 to-teal-600 shadow-emerald-500/20",
    amber: "from-amber-500 to-orange-500 shadow-amber-500/20",
    rose: "from-rose-500 to-pink-500 shadow-rose-500/20",
  };
  return (
    <div className="flex items-start gap-3.5 border-b border-slate-200/70 px-5 py-5 sm:px-6">
      <span
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-md ${
          accents[accent] || accents.indigo
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
        {subtitle && <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">{subtitle}</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Province accordion                                                  */
/* ------------------------------------------------------------------ */

function ProvinceAccordion({ province, contacts, isExpanded, onToggle, isUserProvince, userDistrict }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border transition-all ${
        isUserProvince
          ? "border-rose-200 bg-gradient-to-br from-rose-50/60 to-orange-50/40 shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/60"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl transition ${
              isExpanded ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
            }`}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
          <span className="truncate text-sm font-semibold text-slate-800">{province}</span>
          {isUserProvince && (
            <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700">
              Yours
            </span>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
          {contacts.length} district{contacts.length === 1 ? "" : "s"}
        </span>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-200/70 px-3 pb-3 pt-3">
          <div className="space-y-2">
            {contacts.map((contact) => {
              const isMine =
                userDistrict && userDistrict.toLowerCase() === contact.district.toLowerCase();
              return (
                <div
                  key={contact.district}
                  className={`rounded-xl border p-3 transition ${
                    isMine
                      ? "border-rose-200 bg-white shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">{contact.district}</p>
                      <p className="text-[11px] text-slate-500">{contact.role}</p>
                    </div>
                    <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    {contact.phones.map((phone, idx) => (
                      <a
                        key={idx}
                        href={`tel:${phone.replace(/\s/g, "").replace(/\+/g, "")}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700 transition hover:bg-indigo-100"
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

function ShelterCard({ shelter, highlight, distanceLabel, onDirections, directionsReady, onLiveCapacityUpdated }) {
  const [measurement, setMeasurement] = useState(String(shelter.occupied || 0));
  const [measurementBusy, setMeasurementBusy] = useState(false);
  const [measurementMessage, setMeasurementMessage] = useState("");

  const occupied = Number(shelter.occupied || 0);
  const capacity = Number(shelter.capacity || 0);
  const isFull = Boolean(shelter.isFull || (capacity > 0 && occupied >= capacity));
  const isOpen =
    (shelter.availability || (shelter.status === "inactive" ? "closed" : "open")) === "open";
  const shelterCoordinates = getShelterCoordinates(shelter);
  const condition = shelter.condition || "good";
  const conditionLabel =
    condition === "needs-attention" ? "Needs attention" : condition[0].toUpperCase() + condition.slice(1);
  const conditionClass =
    condition === "critical"
      ? "bg-red-50 text-red-700 border-red-200"
      : condition === "needs-attention"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : condition === "fair"
      ? "bg-yellow-50 text-yellow-800 border-yellow-200"
      : "bg-emerald-50 text-emerald-700 border-emerald-200";

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
  const occupancyColor =
    occupancyPercent >= 90 ? "bg-gradient-to-r from-red-500 to-rose-500" : occupancyPercent >= 70 ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-gradient-to-r from-sky-500 to-cyan-500";

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
        highlight
          ? "border-indigo-300 shadow-md ring-2 ring-indigo-100"
          : "border-slate-200 hover:border-indigo-200"
      }`}
    >
      {highlight && (
        <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-md">
          <Sparkles className="h-3 w-3" />
          Top pick
        </span>
      )}

      <header>
        <h3 className="pr-2 text-base font-semibold leading-snug text-slate-900">{shelter.name}</h3>
        <div className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-500">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-2">{shelter.location}</span>
        </div>
      </header>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
            isOpen
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-slate-100 text-slate-600"
          }`}
        >
          {isOpen ? <DoorOpen className="h-3 w-3" /> : <DoorClosed className="h-3 w-3" />}
          {isOpen ? "Open" : "Closed"}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
            isFull ? "border-red-200 bg-red-50 text-red-700" : "border-sky-200 bg-sky-50 text-sky-700"
          }`}
        >
          {isFull ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
          {shelter.capacity == null
            ? `${shelter.reportedPersons || 0} reported`
            : isFull
            ? "FULL"
            : `${Math.max(0, capacity - occupied)} spaces`}
        </span>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${conditionClass}`}>
          {conditionLabel}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-slate-50 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">District</p>
          <p className="truncate text-xs font-semibold text-slate-800">{shelter.district || "—"}</p>
        </div>
        <div className={`rounded-xl px-2.5 py-2 ${distanceLabel ? "bg-indigo-50" : "bg-slate-50"}`}>
          <p
            className={`text-[10px] font-semibold uppercase tracking-wide ${
              distanceLabel ? "text-indigo-600" : "text-slate-500"
            }`}
          >
            Distance
          </p>
          <p className={`truncate text-xs font-semibold ${distanceLabel ? "text-indigo-800" : "text-slate-500"}`}>
            {distanceLabel || "Add city"}
          </p>
        </div>
      </div>

      {capacity > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {occupied}/{capacity} occupied
            </span>
            <span className="font-semibold tabular-nums text-slate-700">{occupancyPercent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full transition-all ${occupancyColor}`} style={{ width: `${occupancyPercent}%` }} />
          </div>
        </div>
      )}

      {capacity > 0 && !shelter.historical && (
        <form onSubmit={submitCapacityMeasurement} className="mt-3 rounded-xl border border-sky-100 bg-sky-50/60 p-2.5">
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
                className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm tabular-nums focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
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

      <div className="mt-auto flex flex-col gap-2 pt-4 sm:flex-row">
        {shelter.contact && (
          <a
            href={`tel:${shelter.contact.replace(/\D/g, "")}`}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
          >
            <PhoneCall className="h-3.5 w-3.5" />
            Call
          </a>
        )}
        <button
          type="button"
          onClick={onDirections}
          disabled={!shelterCoordinates}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-400"
          title={
            !shelterCoordinates
              ? "Shelter and district coordinates are not available"
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
  const [safetyChecking, setSafetyChecking] = useState(false);
  const [safetyCheck, setSafetyCheck] = useState(null);
  const [safetyError, setSafetyError] = useState("");
  const [safetyModalOpen, setSafetyModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [routeShelter, setRouteShelter] = useState(null);
  const [expandedShelterDistricts, setExpandedShelterDistricts] = useState({});
  const [contactsSearchQuery, setContactsSearchQuery] = useState("");
  const [showOnlyMyDistrict, setShowOnlyMyDistrict] = useState(false);
  const [expandedProvinces, setExpandedProvinces] = useState({});

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let user = null;
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem("dmews_user") : null;
      user = raw ? JSON.parse(raw) : null;
    } catch {}
    const district = (user?.district || "").trim();
    setUserDistrict(district || null);
    const lat = user?.cityLatitude;
    const lon = user?.cityLongitude;
    setUserCityLatitude(typeof lat === "number" && Number.isFinite(lat) ? lat : null);
    setUserCityLongitude(typeof lon === "number" && Number.isFinite(lon) ? lon : null);
  }, []);

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
          const combined = [...data, ...centres].map((shelter) => {
            const coordinates = getShelterCoordinates(shelter);
            return coordinates
              ? { ...shelter, latitude: coordinates.latitude, longitude: coordinates.longitude }
              : shelter;
          });
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

  useEffect(() => {
    if (userDistrict && shelters.length > 0 && !expandedShelterDistricts[userDistrict]) {
      setExpandedShelterDistricts((prev) => ({ ...prev, [userDistrict]: true }));
    }
  }, [userDistrict, shelters, expandedShelterDistricts]);

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
            (shelter.availability || (shelter.status === "inactive" ? "closed" : "open")) === "open";
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
  const sortedProvinces = useMemo(() => Object.keys(groupedContacts).sort(), [groupedContacts]);

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

  const sheltersByDistrict = useMemo(() => {
    const conditionRank = { good: 0, fair: 1, "needs-attention": 2, critical: 3 };
    const rankedShelters = [...sheltersWithDistance].sort((a, b) => {
      const aOpen = (a.availability || (a.status === "inactive" ? "closed" : "open")) === "open";
      const bOpen = (b.availability || (b.status === "inactive" ? "closed" : "open")) === "open";
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

  const heroStats = useMemo(() => {
    const total = shelters.length;
    const openCount = shelters.filter(
      (s) => (s.availability || (s.status === "inactive" ? "closed" : "open")) === "open"
    ).length;
    return { total, openCount, districts: districts.length };
  }, [shelters, districts]);

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
        if (shelterToRoute) {
          const coordinates = getShelterCoordinates(shelterToRoute);
          setRouteShelter(
            coordinates
              ? { ...shelterToRoute, latitude: coordinates.latitude, longitude: coordinates.longitude }
              : shelterToRoute
          );
        }
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

  const checkCurrentSafety = () => {
    setSafetyCheck(null);
    setSafetyError("");
    if (!navigator.geolocation) {
      setSafetyError("Browser GPS is not available on this device.");
      return;
    }

    setSafetyChecking(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const point = { lat: position.coords.latitude, lon: position.coords.longitude };
        setBrowserLocation({ latitude: point.lat, longitude: point.lon });
        setBrowserLocationStatus("ready");
        setBrowserLocationError("");

        try {
          const fetchJson = async (url, label) => {
            const response = await fetch(url, { cache: "no-store" });
            const data = await response.json().catch(() => null);
            if (!response.ok) throw new Error(data?.message || `${label} could not be loaded.`);
            if (data?.error) throw new Error(data.error.message || `${label} could not be loaded.`);
            return data;
          };

          const [dsBoundaries, districtBoundaries, gaugeFeed, landslideData, publishedRisk] =
            await Promise.all([
              fetchJson("/sri-lanka-dsds.geojson", "DS division boundaries"),
              fetchJson("/sri-lanka-districts.geojson", "District boundaries"),
              fetchJson(buildGaugeFeedUrl(), "Live river gauge warnings"),
              fetchJson(`${API_BASE}/landslide-warnings`, "DMC landslide warnings"),
              fetchJson(`${API_BASE}/risk-levels`, "Published risk levels"),
            ]);

          if (!Array.isArray(gaugeFeed?.features)) {
            throw new Error("Live river gauge data is in an unexpected format.");
          }
          if (!Array.isArray(landslideData?.warnings)) {
            throw new Error("DMC landslide warning data is in an unexpected format.");
          }
          if (!Array.isArray(publishedRisk)) {
            throw new Error("Published risk levels are in an unexpected format.");
          }

          const areas = buildAreas(dsBoundaries, districtBoundaries);
          if (!areas.length) throw new Error("Area boundaries could not be loaded for the safety check.");
          const gauges = locateGauges(parseArcGISFeed(gaugeFeed), areas);
          const warnings = landslideData.warnings;
          const { warnedAreas, unmatched } = matchWarningAreas(warnings, areas);
          const unmatchedWarnings = [
            ...unmatched,
            ...warnings
              .filter((warning) => !Array.isArray(warning.divisions) || !warning.divisions.length)
              .map((warning) => ({
                district: warning.district,
                level: warning.level,
                division: "Unspecified area",
              })),
          ];
          const riskLevels = Object.fromEntries(
            publishedRisk
              .filter((item) => item?.district && item?.level)
              .map((item) => [normalizeDistrict(item.district), String(item.level).toLowerCase()])
          );
          const assessment = assessPersonalRisk(point, {
            areas,
            warnedAreas,
            gauges,
            riskLevels,
            weatherByDistrict: new Map(),
            alerts: [],
            weather: null,
          });
          const locationWarnings = unmatchedWarnings.filter(
            (warning) =>
              normalizeDistrict(warning.district) ===
              normalizeDistrict(assessment.place?.district)
          );

          setSafetyCheck({
            assessment,
            point,
            checkedAt: new Date(),
            unmatchedWarnings: locationWarnings,
          });
        } catch (checkError) {
          setSafetyError(checkError?.message || "Could not check current flood and landslide warnings.");
        } finally {
          setSafetyChecking(false);
        }
      },
      (locationError) => {
        const message =
          locationError.code === 1
            ? "Location permission was denied. Allow GPS access to check your safety."
            : "Could not get your current location.";
        setSafetyError(message);
        setBrowserLocationStatus("error");
        setBrowserLocationError(message);
        setSafetyChecking(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const openSafetyModal = () => {
    setSafetyModalOpen(true);
    if (!safetyChecking) checkCurrentSafety();
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      {/* ================= HERO ================= */}
      <section className="relative isolate overflow-hidden" aria-labelledby="shelters-hero-title">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${HERO_BG})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900/95 to-indigo-950/90" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.3),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.15),transparent_55%)]" />

        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-indigo-200 backdrop-blur-sm">
              <Building2 className="h-3.5 w-3.5" aria-hidden />
              DisasterWatch
            </span>

            <h1
              id="shelters-hero-title"
              className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl"
            >
              {si ? "සහන කඳවුරු" : (
                <>
                  Relief{" "}
                  <span className="bg-gradient-to-r from-indigo-300 via-sky-300 to-emerald-300 bg-clip-text text-transparent">
                    Camps
                  </span>
                </>
              )}
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              {si
                ? "ඔබගේ ස්ථානයට ආසන්න සහන කඳවුරු දුර අනුව පෙළගස්වා පෙන්වයි. නිල ඉවතලන මධ්‍යස්ථාන සහ හදිසි සම්බන්ධතා සොයාගන්න."
                : "Nearby shelters ranked by distance from your location for faster, safer access. Find official evacuation centres and emergency contacts."}
            </p>

            {/* Bento stats */}
            <div className="mt-8 grid max-w-2xl grid-cols-3 gap-2.5 sm:gap-3">
              {[
                { label: si ? "කඳවුරු" : "Shelters", value: heroStats.total, accent: "text-indigo-300" },
                { label: si ? "දිස්ත්‍රික්ක" : "Districts", value: heroStats.districts, accent: "text-sky-300" },
                { label: si ? "විවෘත" : "Open now", value: heroStats.openCount, accent: "text-emerald-300" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 backdrop-blur-md transition hover:bg-white/[0.08]"
                >
                  <div className={`text-3xl font-bold tabular-nums ${s.accent} sm:text-4xl`}>{s.value}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={scrollToShelters}
                className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-bold text-slate-900 shadow-xl shadow-black/20 transition hover:bg-slate-100"
              >
                {si ? "සහන කඳවුරු ලැයිස්තුව බලන්න" : "View Relief Camp List"}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </button>
              <button
                type="button"
                onClick={openSafetyModal}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-3.5 text-sm font-bold text-white shadow-xl shadow-emerald-900/40 transition hover:from-emerald-400 hover:to-teal-500"
              >
                <ShieldAlert className="h-4 w-4" />
                {si ? "මම ආරක්ෂිතද?" : "Am I safe?"}
              </button>
              <button
                type="button"
                onClick={requestBrowserLocation}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-5 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
              >
                <LocateFixed className="h-4 w-4" />
                {browserLocationStatus === "ready" ? "GPS ready" : "Use my GPS"}
              </button>
              <button
                type="button"
                onClick={scrollToContacts}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-5 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
              >
                <Headphones className="h-4 w-4" />
                {si ? "හදිසි සම්බන්ධතා" : "Emergency Contacts"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* ================= SHELTERS ================= */}
          <section
            id="shelters-list"
            className="scroll-mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
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

            {!sheltersLoading && shelters.length > 0 && (
              <div className="sticky top-14 z-20 border-b border-slate-200/70 bg-white/90 px-4 py-3 backdrop-blur-lg sm:px-5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
                    <Filter className="h-3.5 w-3.5" />
                    {si ? "දිස්ත්‍රික්කය" : "District"}
                  </div>
                  <select
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
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

                  <span className="text-xs font-medium text-slate-500">
                    {selectedDistrict
                      ? `${sheltersByDistrict.totalCount} ${si ? "කඳවුරු" : "in district"}`
                      : `${sheltersByDistrict.totalCount} ${si ? "කඳවුරු" : "camps"}`}
                  </span>

                  <div className="ml-auto flex flex-wrap items-center gap-1.5">
                    {userDistrict && (
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                        <MapPin className="mr-1 inline h-3 w-3" />
                        {si ? "ඔබගේ දිස්ත්‍රික්කය" : "Your district"}: {userDistrict}
                      </span>
                    )}
                    {userHasCoords && (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                        <Navigation className="mr-1 inline h-3 w-3" />
                        {si ? "දුර පෙන්වයි" : "Distances shown"}
                      </span>
                    )}
                    {userDistrict && !userHasCoords && (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                        <AlertCircle className="mr-1 inline h-3 w-3" />
                        {si ? "නගරය පැතිකඩේ එක් කරන්න" : "Add city for distance"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 sm:p-5">
              {sheltersError && (
                <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3.5 text-sm text-amber-950">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-semibold text-amber-900">
                      {si ? "සහන කඳවුරු පූරණය කළ නොහැක" : "Could not load shelters"}
                    </p>
                    <p className="mt-1 text-amber-900/90">{sheltersError}</p>
                    <p className="mt-2 text-xs text-amber-800/80">
                      {si ? "නිල සහන කඳවුරු තොරතුරු සඳහා පහත " : "Use "}
                      <strong>
                        {si ? "දිස්ත්‍රික් ආපදා කළමනාකරණ සම්බන්ධතා" : "District Disaster Management Contacts"}
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
                  {recommendedShelter && (
                    <div className="mb-5 overflow-hidden rounded-3xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-emerald-50/50 to-sky-50 shadow-sm">
                      <div className="grid gap-4 p-5 sm:p-6 md:grid-cols-[1fr_auto] md:items-center">
                        <div className="min-w-0">
                          <p className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                            <Sparkles className="h-3 w-3" />
                            {si ? "ඔබ සඳහා නිර්දේශිත" : "Recommended for you"}
                          </p>
                          <h3 className="mt-2.5 truncate text-xl font-bold tracking-tight text-slate-900">
                            {recommendedShelter.name}
                          </h3>
                          <p className="mt-1 truncate text-sm text-slate-600">
                            {recommendedShelter.location}, {recommendedShelter.district}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                            <span className="rounded-full bg-white px-2.5 py-1 text-emerald-800 shadow-sm ring-1 ring-emerald-100">
                              {recommendedShelter.recommendationAvailableSpaces == null
                                ? `${recommendedShelter.reportedPersons || recommendedShelter.occupied || 0} ${
                                    si ? "වාර්තා වී ඇත" : "people reported"
                                  }`
                                : `${recommendedShelter.recommendationAvailableSpaces} ${
                                    si ? "ඉඩ ඇත" : "spaces available"
                                  }`}
                            </span>
                            <span className="rounded-full bg-white px-2.5 py-1 text-slate-700 shadow-sm ring-1 ring-slate-100">
                              {recommendedShelter.condition === "needs-attention"
                                ? "Needs attention"
                                : `Condition: ${recommendedShelter.condition || "good"}`}
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row md:flex-col">
                          {recommendedShelter.recommendationDistanceKm != null && (
                            <div className="rounded-2xl bg-white/70 px-4 py-3 text-center shadow-sm backdrop-blur">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                                {si ? "දුර" : "Distance"}
                              </p>
                              <p className="mt-0.5 text-2xl font-bold tabular-nums text-emerald-900">
                                {formatDistanceKm(recommendedShelter.recommendationDistanceKm)}
                              </p>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const coordinates = getShelterCoordinates(recommendedShelter);
                              const routableShelter = coordinates
                                ? {
                                    ...recommendedShelter,
                                    latitude: coordinates.latitude,
                                    longitude: coordinates.longitude,
                                  }
                                : recommendedShelter;
                              if (!browserLocation) {
                                requestBrowserLocation(routableShelter);
                              } else {
                                setRouteShelter(routableShelter);
                              }
                            }}
                            disabled={!getShelterCoordinates(recommendedShelter)}
                            className="inline-flex min-w-[150px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none"
                          >
                            <Navigation className="h-4 w-4" />
                            {browserLocation
                              ? si
                                ? "දිශාවන්"
                                : "Directions"
                              : si
                                ? "GPS සක්‍රීය කරන්න"
                                : "Enable GPS"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {sheltersByDistrict.totalCount > sheltersByDistrict.shownCount && (
                    <div className="mb-4 flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50/70 px-4 py-3 text-sm text-sky-900">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        {si
                          ? `ඔබට වඩාත් සුදුසු සහ ආසන්න කඳවුරු ${sheltersByDistrict.shownCount}ක් පමණක් පෙන්වයි.`
                          : `Showing the ${sheltersByDistrict.shownCount} most suitable of ${sheltersByDistrict.totalCount}. Open shelters with space, safer condition, and proximity are prioritised.`}
                      </span>
                    </div>
                  )}

                  {sheltersWithDistance.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-slate-50/80 px-6 py-14 text-center">
                      <Building2 className="mb-4 h-12 w-12 text-slate-300" />
                      <p className="max-w-md text-sm leading-relaxed text-slate-600">
                        {selectedDistrict
                          ? si
                            ? `${selectedDistrict} දිස්ත්‍රික්කයේ සහන කඳවුරු හමු නොවීය. වෙනත් දිස්ත්‍රික්කයක් උත්සාහ කරන්න.`
                            : `No shelters found in ${selectedDistrict}. Try a different district.`
                          : si
                            ? "තවම සහන කඳවුරු ලැයිස්තුගත කර නොමැත. පසුව නැවත පරීක්ෂා කරන්න හෝ ප්‍රදේශීය ආපදා කළමනාකරණ මධ්‍යස්ථානය අමතන්න."
                            : "No shelters listed yet. Check back later or contact your local disaster management centre."}
                      </p>
                      <p className="mt-3 rounded-full bg-red-50 px-3.5 py-1.5 text-sm font-semibold text-red-700 ring-1 ring-red-100">
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
                            className={`overflow-hidden rounded-2xl border transition-all ${
                              isUserDistrict && !selectedDistrict
                                ? "border-indigo-200/80 bg-gradient-to-br from-indigo-50/50 to-sky-50/40 shadow-sm"
                                : "border-slate-200 bg-white"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleShelterDistrict(district)}
                              className="flex w-full items-center justify-between gap-2 p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
                            >
                              <div className="flex min-w-0 items-center gap-2.5">
                                <span
                                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl transition ${
                                    isExpanded ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
                                  }`}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </span>
                                <h3 className="truncate font-semibold text-slate-800">
                                  {district} {si ? "දිස්ත්‍රික්කය" : "District"}
                                </h3>
                                {isUserDistrict && !selectedDistrict && (
                                  <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                                    {si ? "ඔබගේ" : "Yours"}
                                  </span>
                                )}
                              </div>
                              <div className="flex shrink-0 items-center gap-1.5 text-[11px]">
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                                  {sheltersList.length} {si ? "කඳවුරු" : "camps"}
                                </span>
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 ring-1 ring-emerald-100">
                                  {openCount} {si ? "විවෘත" : "open"}
                                </span>
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="border-t border-slate-200/70 px-4 pb-4 pt-4">
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                  {sheltersList.map((s) => (
                                    <ShelterCard
                                      key={s.id}
                                      shelter={s}
                                      highlight={isUserDistrict || s.id === recommendedShelter?.id}
                                      distanceLabel={formatDistanceKm(s.distanceKm)}
                                      onDirections={() => {
                                        const coordinates = getShelterCoordinates(s);
                                        const routableShelter = coordinates
                                          ? {
                                              ...s,
                                              latitude: coordinates.latitude,
                                              longitude: coordinates.longitude,
                                            }
                                          : s;
                                        if (!browserLocation) requestBrowserLocation(routableShelter);
                                        else setRouteShelter(routableShelter);
                                      }}
                                      directionsReady={Boolean(browserLocation)}
                                      onLiveCapacityUpdated={(updated) => {
                                        setShelters((current) =>
                                          current.map((item) =>
                                            item.id === updated.shelterId ? { ...item, ...updated } : item
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
            className="scroll-mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-200/70 bg-gradient-to-r from-rose-50 to-orange-50/40">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-6">
                <div className="flex items-center gap-3.5">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-md shadow-rose-500/20">
                    <Headphones className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                      {si
                        ? "දිස්ත්‍රික් ආපදා කළමනාකරණ සම්බන්ධතා"
                        : "District Disaster Management Contacts"}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
                      {si ? "නිල උපදෙස් සහ සහාය සඳහා අමතන්න" : "Call for official instructions & help"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky top-14 z-10 border-b border-slate-200/70 bg-white/90 px-4 py-3 backdrop-blur-lg sm:px-5">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 transition focus-within:border-rose-300 focus-within:ring-2 focus-within:ring-rose-200/50">
                  <Search className="h-4 w-4 shrink-0 text-slate-400" />
                  <input
                    type="text"
                    placeholder={
                      si ? "දිස්ත්‍රික්කය හෝ පළාත අනුව සොයන්න..." : "Search by district or province..."
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
                      className="text-slate-400 transition hover:text-slate-600"
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
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      showOnlyMyDistrict
                        ? "bg-gradient-to-r from-rose-600 to-orange-600 text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {showOnlyMyDistrict ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
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
                <div className="flex flex-col items-center justify-center rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-12 text-center">
                  <AlertCircle className="mb-3 h-10 w-10 text-amber-600" />
                  <p className="font-semibold text-amber-950">
                    {showOnlyMyDistrict
                      ? `No directory entry for ${userDistrict || "your district"}`
                      : si
                        ? "ගැලපෙන දිස්ත්‍රික්ක නොමැත"
                        : "No matching districts"}
                  </p>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-amber-900/90">
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
                      className="mt-4 rounded-xl bg-rose-100 px-3.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-200"
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
                      isUserProvince={userDistrict && districtToProvince[userDistrict] === province}
                      userDistrict={userDistrict}
                    />
                  ))}
                </div>
              )}

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs text-slate-600">
                <AlertCircle className="mr-1 inline h-3.5 w-3.5 align-text-bottom text-rose-500" />
                {si
                  ? "ඔබගේ දිස්ත්‍රික් සම්බන්ධතාව වෙත ළඟා විය නොහැකි නම් ජාතික හදිසි අංක "
                  : "If you cannot reach your district contact, call national emergency hotline "}
                <strong className="text-rose-600">117</strong>
                {si ? " හෝ " : " or "}
                <strong className="text-rose-600">119</strong>.
              </div>
            </div>
          </section>

          {/* ================= DO / DON'T ================= */}
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
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
              <div className="grid gap-4 md:grid-cols-2">
                <div className="overflow-hidden rounded-2xl border border-emerald-200/70 bg-white shadow-sm">
                  <div className="flex items-center gap-3 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50/40 px-5 py-4">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
                      <ThumbsUp className="h-4 w-4" />
                    </span>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-900">Do</h3>
                  </div>
                  <div className="space-y-3.5 p-5">
                    {DOS.map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </span>
                        <p className="text-sm leading-relaxed text-slate-700">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-rose-200/70 bg-white shadow-sm">
                  <div className="flex items-center gap-3 border-b border-rose-100 bg-gradient-to-r from-rose-50 to-orange-50/40 px-5 py-4">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-sm">
                      <ThumbsDown className="h-4 w-4" />
                    </span>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-rose-900">Don&apos;t</h3>
                  </div>
                  <div className="space-y-3.5 p-5">
                    {DONTS.map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                          <X className="h-3.5 w-3.5" strokeWidth={3} />
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
          {si ? "නවතම සහන කඳවුරු තොරතුරු සඳහා " : "For the latest shelter availability, call "}
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
        <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 shadow-lg">
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

      {/* ================= SAFETY CHECK MODAL ================= */}
      {mounted &&
        safetyModalOpen &&
        createPortal(
          <SafetyCheckModal
            isOpen={safetyModalOpen}
            onClose={() => setSafetyModalOpen(false)}
            si={si}
            safetyChecking={safetyChecking}
            safetyCheck={safetyCheck}
            safetyError={safetyError}
            onRetry={checkCurrentSafety}
          />,
          document.body
        )}
    </div>
  );
}