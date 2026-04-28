"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Package,
  Pill,
  Shirt,
  Droplets,
  Truck,
  CalendarDays,
  HandHeart,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Loader2,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const PROGRAMS_CACHE_KEY = "dmews_resource_programs_cache";

function formatDateOnly(d) {
  return d.toISOString().slice(0, 10);
}

function normalizePhoneDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("94")) return digits.slice(2);
  return digits;
}

const RESOURCE_TYPES = [
  {
    id: "dry-food",
    title: "Dry Foods",
    icon: Package,
    color: "from-amber-500 to-orange-500",
    examples: "Rice, dhal, milk powder, canned food, instant meals",
  },
  {
    id: "medicines",
    title: "Medicines",
    icon: Pill,
    color: "from-emerald-500 to-teal-500",
    examples: "First-aid kits, pain relief, antiseptic, ORS, masks",
  },
  {
    id: "clothes",
    title: "Clothes",
    icon: Shirt,
    color: "from-indigo-500 to-violet-500",
    examples: "Children wear, blankets, raincoats, footwear",
  },
  {
    id: "water",
    title: "Clean Water",
    icon: Droplets,
    color: "from-sky-500 to-blue-500",
    examples: "Bottled water, purification tablets, refill containers",
  },
];
const OTHER_RESOURCE_ID = "other";

export default function ResourcesPage() {
  const { i18n } = useTranslation();
  const si = String(i18n.language || "").startsWith("si");
  const tr = (en, siText) => (si ? siText : en);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    district: "",
    resourceTypes: ["dry-food"],
    otherResource: "",
    quantity: "",
    availableDate: "",
    canTransport: false,
    deliveryMode: "self-drop",
    pickupAddress: "",
    notes: "",
  });
  const [programs, setPrograms] = useState([]);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const selectedResources = useMemo(
    () => RESOURCE_TYPES.filter((r) => (form.resourceTypes || []).includes(r.id)),
    [form.resourceTypes]
  );

  const estimatedFamilies = useMemo(() => {
    const qty = Number(form.quantity || 0);
    if (!Number.isFinite(qty) || qty <= 0) return 0;
    return Math.max(1, Math.floor(qty / 5));
  }, [form.quantity]);
  const minAvailableDate = useMemo(() => formatDateOnly(new Date()), []);
  const maxAvailableDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return formatDateOnly(d);
  }, []);

  function setField(name, value) {
    setSubmitted(false);
    setSubmitError("");
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function toggleResourceType(resourceId, checked) {
    setSubmitted(false);
    setSubmitError("");
    setForm((prev) => {
      const current = Array.isArray(prev.resourceTypes) ? prev.resourceTypes : [];
      const next = checked
        ? Array.from(new Set([...current, resourceId]))
        : current.filter((id) => id !== resourceId);
      return { ...prev, resourceTypes: next };
    });
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawUser = window.localStorage.getItem("dmews_user");
      const user = rawUser ? JSON.parse(rawUser) : null;
      if (!user) return;
      setForm((prev) => ({
        ...prev,
        name: prev.name || user.name || "",
        email: prev.email || user.email || "",
        phone: prev.phone || user.mobile || "",
        district: prev.district || user.district || "",
      }));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadPrograms() {
      setProgramsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/resource-programs`, { cache: "no-store" });
        const data = await res.json().catch(() => []);
        const rows = Array.isArray(data) ? data : [];
        if (!cancelled) {
          setPrograms(rows);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(PROGRAMS_CACHE_KEY, JSON.stringify(rows));
          }
        }
      } catch {
        if (typeof window !== "undefined") {
          try {
            const cached = window.localStorage.getItem(PROGRAMS_CACHE_KEY);
            const rows = cached ? JSON.parse(cached) : [];
            if (!cancelled) setPrograms(Array.isArray(rows) ? rows : []);
          } catch {
            if (!cancelled) setPrograms([]);
          }
        } else if (!cancelled) {
          setPrograms([]);
        }
      } finally {
        if (!cancelled) setProgramsLoading(false);
      }
    }
    loadPrograms();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    const phoneDigits = normalizePhoneDigits(form.phone);
    if (phoneDigits.length !== 10) {
      setSubmitError(tr("Phone number must have exactly 10 digits.", "දුරකථන අංකයට ඉලක්කම් 10ක් නිවැරදිව තිබිය යුතුය."));
      return;
    }
    const selectedTypes = Array.isArray(form.resourceTypes) ? form.resourceTypes : [];
    if (selectedTypes.length === 0) {
      setSubmitError(tr("Please select at least one resource type.", "අවම වශයෙන් එක් සම්පත් වර්ගයක් තෝරන්න."));
      return;
    }
    if (selectedTypes.includes(OTHER_RESOURCE_ID) && !form.otherResource.trim()) {
      setSubmitError(tr('Please describe the "Other" resource type.', '"වෙනත්" සම්පත් වර්ගය විස්තර කරන්න.'));
      return;
    }
    if (!form.availableDate) {
      setSubmitError(tr("Available date is required.", "ලබාදිය හැකි දිනය අනිවාර්යයි."));
      return;
    }
    if (form.availableDate < minAvailableDate) {
      setSubmitError(tr("Available date cannot be in the past.", "ලබාදිය හැකි දිනය අතීත දිනයක් විය නොහැක."));
      return;
    }
    if (form.availableDate > maxAvailableDate) {
      setSubmitError(tr("Available date must be within the next 30 days.", "ලබාදිය හැකි දිනය ඉදිරි දින 30 ඇතුළත විය යුතුය."));
      return;
    }
    if (form.deliveryMode === "pickup" && !form.pickupAddress.trim()) {
      setSubmitError(tr("Pickup address is required when pickup is selected.", "Pickup තේරූ විට ලිපිනය අනිවාර්යයි."));
      return;
    }
    const token =
      typeof window !== "undefined" ? window.localStorage.getItem("dmews_token") : null;
    if (!token) {
      setSubmitError(tr("Please log in to submit resource participation.", "සම්පත් සහභාගීත්වය යැවීමට කරුණාකර පිවිසෙන්න."));
      return;
    }
    const payload = {
      ...form,
      phone: phoneDigits,
      resourceTypes: selectedTypes,
      resourceType: selectedTypes[0] || "",
      otherResource: selectedTypes.includes(OTHER_RESOURCE_ID) ? form.otherResource.trim() : "",
      pickupAddress:
        form.deliveryMode === "pickup" ? form.pickupAddress.trim() : "",
    };
    try {
      if (token) {
        const res = await fetch(`${API_BASE}/resource-participations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setSubmitError(data?.message || tr("Could not submit participation.", "සහභාගීත්වය යැවීමට නොහැකි විය."));
          return;
        }
      }
    } catch {
      setSubmitError(tr("Network error. Please try again.", "ජාල දෝෂයක්. නැවත උත්සාහ කරන්න."));
      return;
    }
    setSubmitted(true);
    setShowConfirmModal(true);
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/70">
      <section className="border-b border-slate-200 bg-gradient-to-br from-sky-900 via-indigo-900 to-slate-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-sky-100">
              <Sparkles className="h-3.5 w-3.5" />
              {tr("Community Resource Hub", "ප්‍රජා සම්පත් මධ්‍යස්ථානය")}
            </p>
            <h1 className="mt-5 font-oswald text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              {tr("Join Community Support Programs", "ප්‍රජා සහාය වැඩසටහන් වලට එකතු වන්න")}
            </h1>
            <p className="mt-4 text-base text-sky-100/95 sm:text-lg">
              {tr(
                "Support relief operations by contributing dry foods, medicines, clothes, water, and transport help. This page matches your contribution with active district programs.",
                "වියළි ආහාර, ඖෂධ, ඇඳුම්, පිරිසිදු ජලය සහ ප්‍රවාහන සහාය ලබාදී සහන ක්‍රියාකාරකම් වලට දායක වන්න. මෙම පිටුව ඔබගේ දායකත්වය සක්‍රීය දිස්ත්‍රික් වැඩසටහන් සමඟ ගැළපේ."
              )}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-3 lg:px-8">
        <section className="space-y-5 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-gradient-to-r from-sky-50 to-indigo-50/50 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-800">
                {tr("Priority Resource Streams", "ප්‍රමුඛ සම්පත් ප්‍රවාහ")}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {tr("Choose where your support makes the biggest impact.", "ඔබගේ සහාය වැඩිම බලපෑමක් ඇති කරන ස්ථානය තෝරන්න.")}
              </p>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {RESOURCE_TYPES.map((resource) => {
                const Icon = resource.icon;
                return (
                  <article
                    key={resource.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${resource.color} text-white`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-3 font-semibold text-slate-900">
                      {resource.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {resource.examples}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50/50 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-800">
                {tr("Active Allocation Programs", "සක්‍රීය බෙදාහැරීමේ වැඩසටහන්")}
              </h2>
            </div>
            <div className="space-y-3 p-5">
              {programsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
                </div>
              ) : programs.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {tr(
                    "No active allocation programs right now. Admin can add programs from the admin panel.",
                    "දැනට සක්‍රීය බෙදාහැරීමේ වැඩසටහන් නොමැත. පරිපාලක මණ්ඩලයෙන් වැඩසටහන් එක් කළ හැක."
                  )}
                </div>
              ) : (
                programs.map((program) => (
                <div
                  key={program.id || program._id || program.name}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-slate-900">{program.name}</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {program.date || tr("Open schedule", "විවෘත කාලසටහන")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{program.target}</p>
                  {program.location && (
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {tr("Location:", "ස්ථානය:")} {program.location}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(Array.isArray(program.resourceFocus)
                      ? program.resourceFocus
                      : []
                    ).map((focus) => (
                      <span
                        key={focus}
                        className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700"
                      >
                        {focus}
                      </span>
                    ))}
                  </div>
                </div>
                ))
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-gradient-to-r from-rose-50 to-orange-50/50 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-800">
                {tr("Participate Now", "දැන් සහභාගී වන්න")}
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                {tr("Register your available resources for dispatch planning.", "බෙදාහැරීමේ සැලසුම් සඳහා ඔබගේ තිබෙන සම්පත් ලියාපදිංචි කරන්න.")}
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3 p-5">
              <input
                required
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder={tr("Your name", "ඔබගේ නම")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder={tr("Email", "ඊමේල්")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                required
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                placeholder={tr("Phone number", "දුරකථන අංකය")}
                inputMode="numeric"
                maxLength={10}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                required
                value={form.district}
                onChange={(e) => setField("district", e.target.value)}
                placeholder={tr("District / City", "දිස්ත්‍රික්කය / නගරය")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {tr("Select resources (tick all that apply)", "සම්පත් තෝරන්න (අදාළ සියල්ල ටික් කරන්න)")}
                </p>
                <div className="space-y-2">
                  {RESOURCE_TYPES.map((resource) => (
                    <label key={resource.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={(form.resourceTypes || []).includes(resource.id)}
                        onChange={(e) => toggleResourceType(resource.id, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span>{resource.title}</span>
                    </label>
                  ))}
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={(form.resourceTypes || []).includes(OTHER_RESOURCE_ID)}
                      onChange={(e) => toggleResourceType(OTHER_RESOURCE_ID, e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span>{tr("Other", "වෙනත්")}</span>
                  </label>
                </div>
                {(form.resourceTypes || []).includes(OTHER_RESOURCE_ID) && (
                  <input
                    value={form.otherResource}
                    onChange={(e) => setField("otherResource", e.target.value)}
                    placeholder={tr("Please specify other resource", "වෙනත් සම්පත සඳහන් කරන්න")}
                    className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                )}
              </div>
              <input
                required
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setField("quantity", e.target.value)}
                placeholder={tr("Estimated quantity", "ඇස්තමේන්තු ප්‍රමාණය")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                required
                type="date"
                value={form.availableDate}
                onChange={(e) => setField("availableDate", e.target.value)}
                min={minAvailableDate}
                max={maxAvailableDate}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <p className="text-[11px] text-slate-500">
                {tr("Date must be between today and next 30 days.", "දිනය අද සිට ඉදිරි දින 30 අතර විය යුතුය.")}
              </p>
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {tr("Delivery Option", "බෙදාහැරීමේ විකල්පය")}
                </p>
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="deliveryMode"
                    checked={form.deliveryMode === "self-drop"}
                    onChange={() => setField("deliveryMode", "self-drop")}
                    className="mt-0.5"
                  />
                  {tr("I can bring items to a collection point.", "මට භාණ්ඩ එකතු කිරීමේ ස්ථානයකට ගෙන යා හැක.")}
                </label>
                <label className="mt-2 flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="deliveryMode"
                    checked={form.deliveryMode === "pickup"}
                    onChange={() => setField("deliveryMode", "pickup")}
                    className="mt-0.5"
                  />
                  {tr("I cannot bring items; please come and collect from my location.", "මට භාණ්ඩ ගෙන යා නොහැක; කරුණාකර මාගේ ස්ථානයෙන් ගෙනයන්න.")}
                </label>
                {form.deliveryMode === "pickup" && (
                  <input
                    required
                    value={form.pickupAddress}
                    onChange={(e) => setField("pickupAddress", e.target.value)}
                    placeholder={tr("Pickup address", "එකතු කිරීමේ ලිපිනය")}
                    className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                )}
              </div>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder={tr("Notes (packing state, special handling, etc.)", "සටහන් (ඇසුරුම් තත්වය, විශේෂ හැසිරවීම්, ආදිය)")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.canTransport}
                  onChange={(e) => setField("canTransport", e.target.checked)}
                  className="mt-0.5"
                />
                {tr("I can help with transportation to the nearest allocation center.", "ළඟම බෙදාහැරීමේ මධ්‍යස්ථානයට ප්‍රවාහනයට මට සහාය විය හැක.")}
              </label>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500"
              >
                <HandHeart className="h-4 w-4" />
                {tr("Join Resource Program", "සම්පත් වැඩසටහනට එකතු වන්න")}
              </button>
              {submitError && (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {submitError}
                </p>
              )}
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {tr("Impact Preview", "බලපෑම් පෙරදසුන")}
            </h3>
            <p className="mt-2 text-sm text-slate-700">
              {tr("Based on your current quantity, we estimate support for:", "ඔබගේ වත්මන් ප්‍රමාණය අනුව, අපි සහාය ඇස්තමේන්තු කරන්නේ:")}
            </p>
            <p className="mt-2 text-3xl font-bold text-indigo-700">
              {estimatedFamilies} {tr("families", "පවුල්")}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {tr("Resource type(s):", "සම්පත් වර්ග(ය):")}{" "}
              <strong>
                {[
                  ...selectedResources.map((r) => r.title),
                  (form.resourceTypes || []).includes(OTHER_RESOURCE_ID) && form.otherResource.trim()
                    ? form.otherResource.trim()
                    : null,
                ]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </strong>
            </p>
            {form.canTransport && (
              <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <Truck className="h-3.5 w-3.5" />
                {tr("Transport volunteer enabled", "ප්‍රවාහන ස්වේච්ඡා සේවය සක්‍රීයයි")}
              </p>
            )}
          </div>

          {submitted && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 shadow-sm">
              <p className="inline-flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-5 w-5" />
                {tr("Participation request recorded", "සහභාගීත්ව ඉල්ලීම සටහන් විය")}
              </p>
              <p className="mt-2 text-sm">
                {tr(
                  "Coordination team will contact you to schedule collection and dispatch details.",
                  "එකතු කිරීම හා බෙදාහැරීමේ විස්තර සැලසුම් කිරීමට සම්බන්ධීකරණ කණ්ඩායම ඔබව සම්බන්ධ කරගනී."
                )}
              </p>
            </div>
          )}
        </aside>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            onClick={() => setShowConfirmModal(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="rounded-t-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4 text-white">
              <p className="inline-flex items-center gap-2 text-lg font-semibold">
                <CheckCircle2 className="h-5 w-5" />
                {tr("Submission Confirmed", "යැවීම තහවුරු විය")}
              </p>
            </div>
            <div className="space-y-4 px-5 py-5">
              <p className="text-sm text-slate-700">
                {tr(
                  "Your resource participation request was submitted successfully. We will contact you soon with collection and allocation details.",
                  "ඔබගේ සම්පත් සහභාගීත්ව ඉල්ලීම සාර්ථකව යවන ලදී. එකතු කිරීම හා බෙදාහැරීමේ විස්තර සමඟ අපි ඉක්මනින් ඔබව සම්බන්ධ කරගනිමු."
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {tr("Close", "වසන්න")}
                </button>
                <a
                  href="/volunteer"
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  {tr("Join field missions", "ක්ෂේත්‍ර මෙහෙයුම් වලට එකතු වන්න")}
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
