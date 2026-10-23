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
  Loader2,
  MapPin,
  ChevronLeft,
  ChevronRight,
  PackageCheck,
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
    title: "Food and dry rations",
    icon: Package,
    color: "from-amber-500 to-orange-500",
    examples: "Rice, dhal, milk powder, canned food",
    requiresCondition: false,
  },
  {
    id: "medicines",
    title: "Medical supplies",
    icon: Pill,
    color: "from-emerald-500 to-teal-500",
    examples: "First-aid kits, antiseptic, ORS, masks",
    requiresCondition: false,
  },
  {
    id: "clothes",
    title: "Clothing and bedding",
    icon: Shirt,
    color: "from-indigo-500 to-violet-500",
    examples: "Children's wear, blankets, raincoats",
    requiresCondition: true,
  },
  {
    id: "water",
    title: "Drinking water",
    icon: Droplets,
    color: "from-sky-500 to-blue-500",
    examples: "Bottled water and purification supplies",
    requiresCondition: false,
  },
];
const OTHER_RESOURCE_ID = "other";
const OTHER_RESOURCE = { id: OTHER_RESOURCE_ID, title: "Other essentials", icon: HandHeart, color: "from-slate-500 to-slate-700", examples: "Hygiene items, tools, and other urgent needs", requiresCondition: true };
const ALL_RESOURCE_TYPES = [...RESOURCE_TYPES, OTHER_RESOURCE];
const CONDITION_OPTIONS = [
  ["new", "New"],
  ["good", "Good condition"],
  ["used", "Used"],
  ["needs-review", "Needs review"],
];

function resourceNeedsCondition(resourceId) {
  return ALL_RESOURCE_TYPES.find((resource) => resource.id === resourceId)?.requiresCondition === true;
}

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
    unit: "units",
    condition: "new",
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
  const [step, setStep] = useState(1);
  const [submittedReference, setSubmittedReference] = useState("");
  const [resourceItems, setResourceItems] = useState({});

  const selectedResources = useMemo(
    () => ALL_RESOURCE_TYPES.filter((r) => (form.resourceTypes || []).includes(r.id)),
    [form.resourceTypes]
  );

  const estimatedFamilies = useMemo(() => {
    const qty = Object.values(resourceItems).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    if (!Number.isFinite(qty) || qty <= 0) return 0;
    return Math.max(1, Math.floor(qty / 5));
  }, [resourceItems]);
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
      setResourceItems((items) => checked
        ? { ...items, [resourceId]: items[resourceId] || { quantity: "", unit: "units", condition: "new" } }
        : Object.fromEntries(Object.entries(items).filter(([id]) => id !== resourceId)));
      return { ...prev, resourceTypes: next };
    });
  }

  function updateResourceItem(resourceId, field, value) {
    setSubmitted(false);
    setSubmitError("");
    setResourceItems((previous) => ({
      ...previous,
      [resourceId]: { ...(previous[resourceId] || { quantity: "", unit: "units", condition: "new" }), [field]: value },
    }));
  }

  function scrollToSection(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function validateStep(nextStep) {
    if (nextStep === 2) {
      if (!form.resourceTypes.length) return "Select at least one resource category.";
      const invalid = form.resourceTypes.some((id) => {
        const item = resourceItems[id];
        return !item
          || !Number.isFinite(Number(item.quantity))
          || Number(item.quantity) < 1
          || !item.unit
          || (resourceNeedsCondition(id) && !item.condition);
      });
      if (invalid) return "Add a valid quantity and unit for each selected resource, plus a condition where requested.";
    }
    if (nextStep === 3) {
      if (!form.availableDate) return "Choose when your resources will be available.";
      if (form.deliveryMode === "pickup" && !form.pickupAddress.trim()) return "Add a pickup location to continue.";
    }
    return "";
  }

  function continueStep() {
    const validation = validateStep(step + 1);
    if (validation) return setSubmitError(validation);
    setSubmitError("");
    setStep((current) => Math.min(3, current + 1));
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
    const stepValidation = validateStep(3);
    if (stepValidation) {
      setSubmitError(stepValidation);
      return;
    }
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
      quantity: Number(resourceItems[selectedTypes[0]]?.quantity || 0),
      unit: resourceItems[selectedTypes[0]]?.unit || "units",
      condition: resourceItems[selectedTypes[0]]?.condition || "new",
      resourceItems: selectedTypes.map((id) => ({ resourceType: id, ...resourceItems[id], quantity: Number(resourceItems[id].quantity) })),
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
        setSubmittedReference(data?.id || "");
      }
    } catch {
      setSubmitError(tr("Network error. Please try again.", "ජාල දෝෂයක්. නැවත උත්සාහ කරන්න."));
      return;
    }
    setSubmitted(true);
    setStep(1);
    setShowConfirmModal(true);
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/70">
      <section
        className="relative isolate min-h-[320px] overflow-hidden border-b border-slate-800 sm:min-h-[380px] lg:min-h-[420px]"
        aria-labelledby="resources-hero-title"
      >
        {/* Photo fills hero; gradient sleeve on the left reads text clearly */}
        <div
          className="absolute inset-0 bg-sky-950 bg-cover bg-[center_right] bg-no-repeat sm:bg-center"
          style={{ backgroundImage: "url(/img/resources.png)" }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-full bg-gradient-to-r from-[#0a1628] via-[#0a1628]/92 to-transparent sm:max-w-[58%] sm:via-[#0a1628]/88 lg:max-w-[52%]"
          aria-hidden
        />
        <div className="pointer-events-none absolute left-3 top-3 h-16 w-16 rounded-full border border-sky-400/20 opacity-40 sm:left-6 sm:top-6" aria-hidden />
        <div className="pointer-events-none absolute bottom-8 left-6 h-2 w-2 rounded-full bg-sky-400/40 sm:bottom-10 sm:left-10" aria-hidden />
        <div className="pointer-events-none absolute bottom-12 left-14 h-1.5 w-1.5 rounded-full bg-sky-300/30" aria-hidden />

        <div className="relative z-10 mx-auto flex max-w-7xl flex-col justify-center px-4 py-12 sm:px-6 sm:py-16 lg:min-h-[420px] lg:px-8 lg:py-20">
          <div className="max-w-xl lg:max-w-lg">
            <div className="mb-4 flex justify-start">
              <HandHeart
                className="h-16 w-16 text-sky-300/45 sm:h-20 sm:w-20"
                strokeWidth={1.15}
                aria-hidden
              />
            </div>
            <p className="sr-only">{tr("Community Resource Hub", "ප්‍රජා සම්පත් මධ්‍යස්ථානය")}</p>
            <h1
              id="resources-hero-title"
              className="font-oswald text-3xl font-bold uppercase tracking-[0.08em] text-white sm:text-4xl lg:text-5xl lg:leading-tight"
            >
              {tr("Your Help Can Make a Difference", "ඔබගේ සහායට විශාල වෙනසක් කළ හැකිය")}
            </h1>
            <div className="mt-3 h-0.5 w-14 rounded-full bg-sky-400 sm:w-16" aria-hidden />
            <p className="mt-4 text-base font-medium text-sky-100 sm:text-lg">
              {tr(
                "Your resources. Their relief. Our community.",
                "ඔබගේ සම්පත්. ඔවුන්ගේ සහනය. අපගේ ප්‍රජාව."
              )}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-sky-100/85 sm:text-base">
              {tr(
                "Your confirmed contribution can move from a collection point to families and communities affected by disasters.",
                "ඔබගේ තහවුරු කළ දායකත්වය එකතු කිරීමේ ස්ථානයේ සිට ආපදා බලපෑමට ලක් වූ පවුල් සහ ප්‍රජාවන් වෙත ගෙන යා හැකිය."
              )}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button type="button" onClick={() => { setStep(1); scrollToSection("resource-contribution-form"); }} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:bg-rose-500">
                {tr("Contribute Resources", "සම්පත් දායක කරන්න")} <ArrowRight className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => scrollToSection("active-resource-programs")} className="inline-flex items-center gap-2 rounded-lg border border-white/35 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15">
                {tr("View Active Programs", "සක්‍රීය වැඩසටහන් බලන්න")} <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-3 lg:px-8">
        <section className="space-y-5 lg:col-span-2">
          <div id="resource-categories" className="rounded-2xl border border-slate-200 bg-white shadow-sm scroll-mt-6">
            <div className="border-b border-slate-100 bg-gradient-to-r from-sky-50 to-indigo-50/50 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-800">
                {tr("Choose resources to contribute", "දායක කිරීමට සම්පත් තෝරන්න")}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {tr("Select one or more categories, then add the quantity and relevant details for each.", "එක් හෝ වැඩි සම්පත් වර්ග තෝරා එක් එක් වර්ගයට ප්‍රමාණය සහ අදාළ විස්තර එක් කරන්න.")}
              </p>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {ALL_RESOURCE_TYPES.map((resource) => {
                const Icon = resource.icon;
                const selected = (form.resourceTypes || []).includes(resource.id);
                const item = resourceItems[resource.id] || { quantity: "", unit: "units", condition: "new" };
                return (
                  <article
                    key={resource.id}
                    className={`rounded-xl border p-4 transition ${selected ? "border-rose-400 bg-rose-50/50 shadow-md ring-2 ring-rose-100" : "border-slate-200 bg-white hover:-translate-y-0.5 hover:shadow-md"}`}
                  >
                    <button type="button" onClick={() => toggleResourceType(resource.id, !selected)} className="flex w-full items-start gap-3 text-left">
                      <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${resource.color} text-white`}><Icon className="h-5 w-5" /></span>
                      <span className="min-w-0 flex-1"><span className="block font-semibold text-slate-900">{resource.title}</span><span className="mt-1 block text-sm text-slate-600">{resource.examples}</span></span>
                      <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-rose-600 bg-rose-600 text-white" : "border-slate-300 bg-white"}`}>{selected ? "✓" : ""}</span>
                    </button>
                    {selected && <div className="mt-4 grid grid-cols-2 gap-2 border-t border-rose-100 pt-3"><label className="text-xs font-semibold text-slate-600">Quantity<input required min="1" type="number" step="0.01" value={item.quantity} onChange={(e) => updateResourceItem(resource.id, "quantity", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-normal text-slate-900" /></label><label className="text-xs font-semibold text-slate-600">Unit<select value={item.unit} onChange={(e) => updateResourceItem(resource.id, "unit", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-normal text-slate-900"><option value="units">Units</option><option value="kg">kg</option><option value="liters">Liters</option><option value="boxes">Boxes</option><option value="cartons">Cartons</option><option value="packs">Packs</option><option value="kits">Kits</option><option value="pairs">Pairs</option></select></label>{resourceNeedsCondition(resource.id) && <label className="col-span-2 text-xs font-semibold text-slate-600">Condition<select value={item.condition} onChange={(e) => updateResourceItem(resource.id, "condition", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-normal text-slate-900">{CONDITION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}{resource.id === OTHER_RESOURCE_ID && <label className="col-span-2 text-xs font-semibold text-slate-600">Describe essential<input required value={form.otherResource} onChange={(e) => setField("otherResource", e.target.value)} placeholder="e.g. hygiene kits" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-normal text-slate-900" /></label>}</div>}
                  </article>
                );
              })}
            </div>
          </div>

          <div id="active-resource-programs" className="rounded-2xl border border-slate-200 bg-white shadow-sm scroll-mt-6">
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
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><h3 className="font-semibold text-slate-900">{program.name}</h3><p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500"><MapPin className="h-3.5 w-3.5" />{program.location || tr("District not specified", "දිස්ත්‍රික්කය සඳහන් කර නැත")}</p></div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {program.status === "active" ? tr("Active", "සක්‍රීය") : program.status}
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
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3"><p className="text-xs text-slate-500">{tr("Confirmed stock figures are shown only after warehouse receipt.", "තහවුරු කළ තොග සංඛ්‍යා පෙන්වන්නේ ගබඩා ලැබීමෙන් පසුව පමණි.")}</p><button type="button" onClick={() => { setStep(1); scrollToSection("resource-contribution-form"); }} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500">{tr("Contribute to this program", "මෙම වැඩසටහනට දායක වන්න")}<ArrowRight className="h-3.5 w-3.5" /></button></div>
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
            <form id="resource-contribution-form" onSubmit={handleSubmit} className="space-y-3 p-5 scroll-mt-6">
              <div className="mb-5 grid grid-cols-3 gap-2" aria-label="Contribution steps">
                {["Choose resources", "Arrange delivery", "Your details"].map((label, index) => {
                  const number = index + 1;
                  return <div key={label} className={`border-t-2 pt-2 text-[11px] font-semibold ${step >= number ? "border-rose-600 text-rose-700" : "border-slate-200 text-slate-400"}`}><span>{number}. </span>{tr(label, ["සම්පත් තෝරන්න", "බෙදාහැරීම සකසන්න", "ඔබගේ විස්තර"][index])}</div>;
                })}
              </div>
              {step === 1 && <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3 text-sm text-slate-700"><p className="font-semibold text-slate-900">{tr("Choose resources", "සම්පත් තෝරන්න")}</p><p className="mt-1 text-xs text-slate-600">{tr("Select cards on the left and add quantity, unit, and any requested condition details for each selected item. Food, medical supplies, and water are recorded as new/unused.", "වම් පස ඇති කාඩ්පත් තෝරා එක් එක් සම්පතට ප්‍රමාණය, ඒකකය සහ ඉල්ලා ඇති තත්ත්ව විස්තර එක් කරන්න. ආහාර, වෛද්‍ය සැපයුම් සහ ජලය නව/භාවිත නොකළ ලෙස සටහන් වේ.")}</p>{selectedResources.length > 0 && <ul className="mt-3 space-y-1 text-xs">{selectedResources.map((resource) => <li key={resource.id} className="flex items-center justify-between"><span>{resource.title}</span><span className="font-semibold">{resourceItems[resource.id]?.quantity || "—"} {resourceItems[resource.id]?.unit || ""}</span></li>)}</ul>}</div>}
              {step === 3 && <>
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
              </>}
              {step === 2 && <>
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
              </>}
              {step === 3 && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"><p className="font-semibold text-slate-900">{tr("Final review", "අවසාන සමාලෝචනය")}</p><p className="mt-1">{selectedResources.map((resource) => `${resource.title}: ${resourceItems[resource.id]?.quantity || "—"} ${resourceItems[resource.id]?.unit || ""}`).join(" · ")}</p><p className="mt-1">{form.deliveryMode === "pickup" ? `Pickup: ${form.pickupAddress || "—"}` : "Self-delivery to a collection point"} · {form.availableDate || "No date"}</p></div>}

              <button
                type={step === 3 ? "submit" : "button"}
                onClick={step === 3 ? undefined : continueStep}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500"
              >
                {step > 1 && <ChevronLeft className="h-4 w-4" />}
                {step === 3 ? <HandHeart className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {step === 3 ? tr("Submit contribution", "දායකත්වය යවන්න") : tr("Continue", "ඉදිරියට")}
              </button>
              {step > 1 && <button type="button" onClick={() => setStep((current) => current - 1)} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">{tr("Back", "ආපසු")}</button>}
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
              <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{tr("Reference number", "යොමු අංකය")}</p><p className="mt-1 font-mono text-sm font-bold text-slate-900">{submittedReference || "Pending"}</p></div>
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
