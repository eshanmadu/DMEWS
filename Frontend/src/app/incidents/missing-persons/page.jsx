"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  UserSearch,
  UserPlus,
  UserCheck,
  MapPin,
  Calendar,
  Phone,
  Trash2,
  X,
  ImageIcon,
  Sparkles,
  UserCircle,
  ZoomIn,
  AlertTriangle,
} from "lucide-react";

import { MatchScoreBreakdown } from "@/components/MatchScoreBreakdown";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getStoredUserId() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("dmews_user");
  if (!raw) return null;
  try {
    const u = JSON.parse(raw);
    return u._id || u.id || null;
  } catch {
    return null;
  }
}

function authHeaders() {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem("dmews_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function readStoredProfileHint() {
  if (typeof window === "undefined") return { name: "", mobile: "" };
  const raw = window.localStorage.getItem("dmews_user");
  if (!raw) return { name: "", mobile: "" };
  try {
    const u = JSON.parse(raw);
    return {
      name: String(u.name || "").trim(),
      mobile: String(u.mobile || "").trim(),
    };
  } catch {
    return { name: "", mobile: "" };
  }
}

function canDeleteEntry(person) {
  const uid = getStoredUserId();
  const token = typeof window !== "undefined" ? window.localStorage.getItem("dmews_token") : null;
  return Boolean(
    token && uid && person.submittedByUserId && String(person.submittedByUserId) === String(uid)
  );
}

function hasLetters(value) {
  return /[A-Za-z]/.test(String(value || ""));
}

function isValidPersonName(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return false;
  return /^[A-Za-z][A-Za-z\s.'-]*$/.test(normalized);
}

function isValidPhone(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return true;
  return /^\+?[0-9][0-9\s\-()]{6,19}$/.test(normalized);
}

function sanitizeNameInput(value) {
  return String(value || "").replace(/[^A-Za-z\s.'-]/g, "");
}

function sanitizeAgeInput(value) {
  const digitsOnly = String(value || "").replace(/[^\d]/g, "");
  if (!digitsOnly) return "";
  return String(Math.min(120, Number(digitsOnly)));
}

export default function MissingPersonsPage() {
  const [missingPersons, setMissingPersons] = useState([]);
  const [foundPersons, setFoundPersons] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);

  const [showMissingForm, setShowMissingForm] = useState(false);
  const [showFoundForm, setShowFoundForm] = useState(false);

  const [missingForm, setMissingForm] = useState({
    fullName: "",
    age: "",
    gender: "",
    lastSeenLocation: "",
    dateMissing: "",
    description: "",
    contactInfo: "",
  });
  const [missingPhoto, setMissingPhoto] = useState(null);
  const missingPhotoInputRef = useRef(null);
  const [missingErrors, setMissingErrors] = useState({});

  const [foundForm, setFoundForm] = useState({
    name: "",
    gender: "",
    age: "",
    locationFound: "",
    dateFound: "",
    description: "",
    contactInfo: "",
  });
  const [foundPhoto, setFoundPhoto] = useState(null);
  const foundPhotoInputRef = useRef(null);
  const [foundErrors, setFoundErrors] = useState({});

  const [successMsg, setSuccessMsg] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submittingMissing, setSubmittingMissing] = useState(false);
  const [submittingFound, setSubmittingFound] = useState(false);
  const [foundMatchModal, setFoundMatchModal] = useState(null);
  const [photoLightboxUrl, setPhotoLightboxUrl] = useState(null);
  const [profileHint, setProfileHint] = useState({ name: "", mobile: "" });
  const [clientSignedIn, setClientSignedIn] = useState(false);

  const loadLists = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch(`${API_BASE}/missing-persons`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Failed to load reports.");
      }
      setMissingPersons(Array.isArray(data.missing) ? data.missing : []);
      setFoundPersons(Array.isArray(data.found) ? data.found : []);
    } catch (e) {
      setListError(e?.message || "Failed to load reports.");
      setMissingPersons([]);
      setFoundPersons([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  useEffect(() => {
    setProfileHint(readStoredProfileHint());
    setClientSignedIn(Boolean(window.localStorage.getItem("dmews_token")));
  }, [showMissingForm, showFoundForm]);

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  useEffect(() => {
    if (!foundMatchModal) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") setFoundMatchModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [foundMatchModal]);

  useEffect(() => {
    if (!photoLightboxUrl) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") setPhotoLightboxUrl(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [photoLightboxUrl]);

  const validateMissing = () => {
    const errors = {};
    if (!missingForm.fullName.trim()) errors.fullName = "Full name is required";
    else if (!isValidPersonName(missingForm.fullName)) errors.fullName = "Name can only contain letters";
    if (!missingForm.age) errors.age = "Age is required";
    else if (
      isNaN(Number(missingForm.age)) ||
      Number(missingForm.age) < 0 ||
      Number(missingForm.age) > 120
    )
      errors.age = "Age must be 0–120";
    if (!missingForm.lastSeenLocation.trim()) errors.lastSeenLocation = "Last seen location is required";
    if (!missingForm.dateMissing) errors.dateMissing = "Date missing is required";
    else if (new Date(missingForm.dateMissing) > new Date()) errors.dateMissing = "Date cannot be in the future";
    if (!missingForm.description.trim()) errors.description = "Description is required";
    if (!isValidPhone(missingForm.contactInfo)) errors.contactInfo = "Additional contact must be a valid phone number";
    if (missingPhoto && !String(missingPhoto.type || "").toLowerCase().startsWith("image/")) {
      errors.photo = "Please choose an image file.";
    }
    setMissingErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddMissing = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    if (!clientSignedIn) {
      setSubmitError("Please log in before submitting a missing person report.");
      return;
    }
    if (!validateMissing()) return;

    setSubmittingMissing(true);
    try {
      const fd = new FormData();
      fd.append("fullName", missingForm.fullName.trim());
      fd.append("age", String(missingForm.age));
      fd.append("gender", missingForm.gender);
      fd.append("lastSeenLocation", missingForm.lastSeenLocation.trim());
      fd.append("dateMissing", missingForm.dateMissing);
      fd.append("description", missingForm.description.trim());
      fd.append("contactInfo", missingForm.contactInfo.trim());
      if (missingPhoto) fd.append("photo", missingPhoto);

      const res = await fetch(`${API_BASE}/missing-persons/missing`, {
        method: "POST",
        headers: authHeaders(),
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Submit failed.");
      }

      if (data.person) {
        setMissingPersons((prev) => [data.person, ...prev]);
      } else {
        await loadLists();
      }

      setMissingForm({
        fullName: "",
        age: "",
        gender: "",
        lastSeenLocation: "",
        dateMissing: "",
        description: "",
        contactInfo: "",
      });
      setMissingPhoto(null);
      if (missingPhotoInputRef.current) missingPhotoInputRef.current.value = "";
      setSuccessMsg({ type: "missing", text: "✓ Missing person report submitted" });
      setShowMissingForm(false);
    } catch (err) {
      setSubmitError(err?.message || "Submit failed.");
    } finally {
      setSubmittingMissing(false);
    }
  };

  const deleteMissing = async (id) => {
    setSubmitError(null);
    try {
      const res = await fetch(`${API_BASE}/missing-persons/missing/${id}`, {
        method: "DELETE",
        headers: { ...authHeaders() },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Delete failed.");
      setMissingPersons((prev) => prev.filter((p) => p.id !== id));
      setSuccessMsg({ type: "missing", text: "Entry removed" });
    } catch (err) {
      setSubmitError(err?.message || "Delete failed.");
    }
  };

  const validateFound = () => {
    const errors = {};
    if (foundForm.name.trim() && !isValidPersonName(foundForm.name))
      errors.name = "Name can only contain letters";
    if (!foundForm.locationFound.trim()) errors.locationFound = "Location found is required";
    if (!foundForm.dateFound) errors.dateFound = "Date found is required";
    else if (new Date(foundForm.dateFound) > new Date()) errors.dateFound = "Date cannot be in the future";
    if (!foundForm.description.trim()) errors.description = "Description is required";
    if (
      foundForm.age &&
      (isNaN(Number(foundForm.age)) || Number(foundForm.age) < 0 || Number(foundForm.age) > 120)
    )
      errors.age = "Age must be 0–120";
    if (!isValidPhone(foundForm.contactInfo)) errors.contactInfo = "Additional contact must be a valid phone number";
    if (foundPhoto && !String(foundPhoto.type || "").toLowerCase().startsWith("image/")) {
      errors.photo = "Please choose an image file.";
    }
    setFoundErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddFound = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    if (!clientSignedIn) {
      setSubmitError("Please log in before submitting a found person report.");
      return;
    }
    if (!validateFound()) return;

    setSubmittingFound(true);
    try {
      const fd = new FormData();
      fd.append("name", foundForm.name.trim());
      fd.append("gender", foundForm.gender);
      fd.append("age", foundForm.age);
      fd.append("locationFound", foundForm.locationFound.trim());
      fd.append("dateFound", foundForm.dateFound);
      fd.append("description", foundForm.description.trim());
      fd.append("contactInfo", foundForm.contactInfo.trim());
      if (foundPhoto) fd.append("photo", foundPhoto);

      const res = await fetch(`${API_BASE}/missing-persons/found`, {
        method: "POST",
        headers: authHeaders(),
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Submit failed.");
      }

      if (data.person) {
        setFoundPersons((prev) => [data.person, ...prev]);
      } else {
        await loadLists();
      }

      const mm = Array.isArray(data.missingMatches) ? data.missingMatches : [];
      if (mm.length > 0) {
        setFoundMatchModal({ matches: mm });
      }

      setFoundForm({
        name: "",
        gender: "",
        age: "",
        locationFound: "",
        dateFound: "",
        description: "",
        contactInfo: "",
      });
      setFoundPhoto(null);
      if (foundPhotoInputRef.current) foundPhotoInputRef.current.value = "";
      setSuccessMsg({ type: "found", text: "✓ Found person report submitted" });
      setShowFoundForm(false);
    } catch (err) {
      setSubmitError(err?.message || "Submit failed.");
    } finally {
      setSubmittingFound(false);
    }
  };

  const deleteFound = async (id) => {
    setSubmitError(null);
    try {
      const res = await fetch(`${API_BASE}/missing-persons/found/${id}`, {
        method: "DELETE",
        headers: { ...authHeaders() },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Delete failed.");
      setFoundPersons((prev) => prev.filter((p) => p.id !== id));
      setSuccessMsg({ type: "found", text: "Entry removed" });
    } catch (err) {
      setSubmitError(err?.message || "Delete failed.");
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? String(dateStr) : d.toLocaleDateString();
  };

  function PersonPhotoThumb({ photoUrl, className, sizes = "96px" }) {
    if (!photoUrl) return null;
    return (
      <button
        type="button"
        onClick={() => setPhotoLightboxUrl(photoUrl)}
        className={`group relative shrink-0 overflow-hidden rounded-md bg-slate-100 ring-2 ring-transparent transition hover:ring-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500 ${className}`}
        aria-label="View photo larger"
      >
        <Image src={photoUrl} alt="" fill className="object-cover" sizes={sizes} />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/35">
          <ZoomIn className="h-7 w-7 text-white opacity-0 drop-shadow-md transition group-hover:opacity-100" aria-hidden />
        </span>
      </button>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero Section - Modernized */}
      <div className="relative mb-12 overflow-hidden rounded-2xl bg-gradient-to-r from-violet-500 via-indigo-500 to-violet-500 shadow-lg">
        <div className="relative z-10 px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:gap-6 sm:text-left">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 shadow-sm">
              <UserSearch className="h-8 w-8 text-amber-300" />
            </div>
            <div className="flex-1">
              <h1 className="font-oswald text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Missing & Found Persons
              </h1>
              <p className="mt-2 max-w-2xl text-rose-100">
                Report missing individuals or notify about found persons. Your report helps reunite families.
              </p>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 bg-black/5" />
      </div>

      {/* Back link & toggle buttons - modernized */}
      <div className="mb-6 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium text-sky-600 hover:text-sky-700"
        >
          ← Back to Dashboard
        </Link>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowMissingForm((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-300"
          >
            <UserPlus className="h-5 w-5" />
            {showMissingForm ? "Hide" : "Report Missing"}
          </button>
          <button
            onClick={() => setShowFoundForm((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-300"
          >
            <UserCheck className="h-5 w-5" />
            {showFoundForm ? "Hide" : "Report Found"}
          </button>
        </div>
      </div>

      {/* Global error / success messages (unchanged styling) */}
      {submitError && (
        <div className="mb-6 flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertTriangle className="h-4 w-4" />
          <span>{submitError}</span>
          <button type="button" onClick={() => setSubmitError(null)} className="ml-auto" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <UserCheck className="h-4 w-4" />
          <span>{successMsg.text}</span>
          <button type="button" onClick={() => setSuccessMsg(null)} className="ml-auto" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Missing Person Form (unchanged) */}
      {showMissingForm && (
        <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-3">
            <UserPlus className="h-5 w-5 text-rose-600" />
            <h2 className="text-xl font-semibold text-slate-800">Report missing person</h2>
          </div>
          <form onSubmit={handleAddMissing} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Full name *</label>
              <input
                type="text"
                value={missingForm.fullName}
                onChange={(e) =>
                  setMissingForm({ ...missingForm, fullName: sanitizeNameInput(e.target.value) })
                }
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              {missingErrors.fullName && <p className="mt-1 text-xs text-rose-600">{missingErrors.fullName}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">Age *</label>
                <input
                  type="number"
                  value={missingForm.age}
                  onChange={(e) => setMissingForm({ ...missingForm, age: sanitizeAgeInput(e.target.value) })}
                  min={0}
                  max={120}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                {missingErrors.age && <p className="mt-1 text-xs text-rose-600">{missingErrors.age}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Gender</label>
                <select
                  value={missingForm.gender}
                  onChange={(e) => setMissingForm({ ...missingForm, gender: e.target.value })}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Prefer not to say</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Last seen location *</label>
              <input
                type="text"
                value={missingForm.lastSeenLocation}
                onChange={(e) => setMissingForm({ ...missingForm, lastSeenLocation: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              {missingErrors.lastSeenLocation && (
                <p className="mt-1 text-xs text-rose-600">{missingErrors.lastSeenLocation}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Date missing *</label>
              <input
                type="date"
                value={missingForm.dateMissing}
                onChange={(e) => setMissingForm({ ...missingForm, dateMissing: e.target.value })}
                max={new Date().toISOString().slice(0, 10)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              {missingErrors.dateMissing && <p className="mt-1 text-xs text-rose-600">{missingErrors.dateMissing}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Description (clothing, features) *</label>
              <textarea
                rows={2}
                value={missingForm.description}
                onChange={(e) => setMissingForm({ ...missingForm, description: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              {missingErrors.description && <p className="mt-1 text-xs text-rose-600">{missingErrors.description}</p>}
            </div>

            {clientSignedIn ? (
              <div className="rounded-lg border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-4 text-sm shadow-sm">
                <p className="font-semibold text-slate-800">If you see — reporter (from your account)</p>
                <p className="mt-1 text-xs text-slate-600">
                  Your name and phone are taken from your profile when you submit (same as shown below).
                </p>
                <div className="mt-3 space-y-2 rounded-md border border-sky-100 bg-white/80 px-3 py-2">
                  <p className="flex items-center gap-2 text-slate-800">
                    <UserCircle className="h-4 w-4 shrink-0 text-sky-600" />
                    <span className="text-slate-500">Reporter name:</span>{" "}
                    <span className="font-medium">{profileHint.name || "—"}</span>
                  </p>
                  <p className="flex items-center gap-2 text-slate-800">
                    <Phone className="h-4 w-4 shrink-0 text-sky-600" />
                    <span className="text-slate-500">Phone:</span>{" "}
                    <span className="font-medium">{profileHint.mobile || "—"}</span>
                  </p>
                </div>
                {profileHint.mobile ? null : (
                  <p className="mt-2 text-xs text-amber-800">
                    Add a mobile number in your profile so callers can reach you.
                  </p>
                )}
                <div className="mt-3">
                  <label className="block text-sm font-medium text-slate-700">Additional contact (optional)</label>
                  <input
                    type="text"
                    value={missingForm.contactInfo}
                    onChange={(e) => setMissingForm({ ...missingForm, contactInfo: e.target.value })}
                    placeholder="Extra phone number"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  {missingErrors.contactInfo && (
                    <p className="mt-1 text-xs text-rose-600">{missingErrors.contactInfo}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
                <p className="font-medium">Sign in is required to submit a report</p>
                <p className="mt-1 text-xs opacity-90">
                  Missing person reports require a logged-in account so your reporter details appear in the
                  &quot;If you see&quot; section.
                </p>
              </div>
            )}

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <ImageIcon className="h-4 w-4 text-slate-500" />
                Photo (optional, max 10MB)
              </label>
              <input
                ref={missingPhotoInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => setMissingPhoto(e.target.files?.[0] || null)}
                className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
              {missingErrors.photo && <p className="mt-1 text-xs text-rose-600">{missingErrors.photo}</p>}
            </div>

            <button
              type="submit"
              disabled={submittingMissing || !clientSignedIn}
              className="w-full rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-60"
            >
              {submittingMissing ? "Submitting…" : "Submit missing person report"}
            </button>
          </form>
        </div>
      )}

      {/* Found Person Form (unchanged) */}
      {showFoundForm && (
        <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-3">
            <UserCheck className="h-5 w-5 text-emerald-600" />
            <h2 className="text-xl font-semibold text-slate-800">Report found person</h2>
          </div>
          <form onSubmit={handleAddFound} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Name (if known)</label>
              <input
                type="text"
                value={foundForm.name}
                onChange={(e) => setFoundForm({ ...foundForm, name: sanitizeNameInput(e.target.value) })}
                placeholder="Leave blank for unknown"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              {foundErrors.name && <p className="mt-1 text-xs text-rose-600">{foundErrors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Gender (optional)</label>
              <select
                value={foundForm.gender}
                onChange={(e) => setFoundForm({ ...foundForm, gender: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Prefer not to say</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-binary">Non-binary</option>
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                If provided on both reports, matching compares gender for a higher score.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Estimated age</label>
              <input
                type="number"
                value={foundForm.age}
                onChange={(e) => setFoundForm({ ...foundForm, age: sanitizeAgeInput(e.target.value) })}
                min={0}
                max={120}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              {foundErrors.age && <p className="mt-1 text-xs text-rose-600">{foundErrors.age}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Location found *</label>
              <input
                type="text"
                value={foundForm.locationFound}
                onChange={(e) => setFoundForm({ ...foundForm, locationFound: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              {foundErrors.locationFound && (
                <p className="mt-1 text-xs text-rose-600">{foundErrors.locationFound}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Date found *</label>
              <input
                type="date"
                value={foundForm.dateFound}
                onChange={(e) => setFoundForm({ ...foundForm, dateFound: e.target.value })}
                max={new Date().toISOString().slice(0, 10)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              {foundErrors.dateFound && <p className="mt-1 text-xs text-rose-600">{foundErrors.dateFound}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Description *</label>
              <textarea
                rows={2}
                value={foundForm.description}
                onChange={(e) => setFoundForm({ ...foundForm, description: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              {foundErrors.description && <p className="mt-1 text-xs text-rose-600">{foundErrors.description}</p>}
            </div>

            {clientSignedIn ? (
              <div className="rounded-lg border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 text-sm shadow-sm">
                <p className="font-semibold text-slate-800">If you see — reporter (from your account)</p>
                <p className="mt-1 text-xs text-slate-600">
                  Your name and phone are taken from your profile when you submit.
                </p>
                <div className="mt-3 space-y-2 rounded-md border border-emerald-100 bg-white/80 px-3 py-2">
                  <p className="flex items-center gap-2 text-slate-800">
                    <UserCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="text-slate-500">Reporter name:</span>{" "}
                    <span className="font-medium">{profileHint.name || "—"}</span>
                  </p>
                  <p className="flex items-center gap-2 text-slate-800">
                    <Phone className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="text-slate-500">Phone:</span>{" "}
                    <span className="font-medium">{profileHint.mobile || "—"}</span>
                  </p>
                </div>
                {profileHint.mobile ? null : (
                  <p className="mt-2 text-xs text-amber-800">
                    Add a mobile number in your profile so callers can reach you.
                  </p>
                )}
                <div className="mt-3">
                  <label className="block text-sm font-medium text-slate-700">Additional contact (optional)</label>
                  <input
                    type="text"
                    value={foundForm.contactInfo}
                    onChange={(e) => setFoundForm({ ...foundForm, contactInfo: e.target.value })}
                    placeholder="Extra phone number"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  {foundErrors.contactInfo && (
                    <p className="mt-1 text-xs text-rose-600">{foundErrors.contactInfo}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
                <p className="font-medium">Sign in is required to submit a report</p>
                <p className="mt-1 text-xs opacity-90">
                  Found person reports require a logged-in account so your reporter details appear in the
                  &quot;If you see&quot; section.
                </p>
              </div>
            )}

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <ImageIcon className="h-4 w-4 text-slate-500" />
                Photo (optional, max 10MB)
              </label>
              <input
                ref={foundPhotoInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => setFoundPhoto(e.target.files?.[0] || null)}
                className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
              {foundErrors.photo && <p className="mt-1 text-xs text-rose-600">{foundErrors.photo}</p>}
            </div>

            <button
              type="submit"
              disabled={submittingFound || !clientSignedIn}
              className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
            >
              {submittingFound ? "Submitting…" : "Submit found person report"}
            </button>
          </form>
        </div>
      )}

      {/* Lists of Missing and Found People - unchanged */}
      <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Missing people list */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-800">
              <UserSearch className="h-5 w-5 text-rose-600" />
              Missing people ({missingPersons.length})
            </h2>
          </div>
          {listLoading ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">Loading…</div>
          ) : listError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center text-amber-900">
              {listError}
            </div>
          ) : missingPersons.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
              No missing person reports yet. Click "Report Missing Person" to add one.
            </div>
          ) : (
            <div className="space-y-4">
              {missingPersons.map((person) => (
                <div key={person.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex gap-3">
                    <PersonPhotoThumb photoUrl={person.photoUrl} className="h-24 w-24" />
                    <div className="flex min-w-0 flex-1 justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-900">{person.fullName}</h3>
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                            Age {person.age}
                          </span>
                          {person.gender ? <span className="text-xs text-slate-500">{person.gender}</span> : null}
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-slate-600">
                          <p className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 shrink-0" /> Last seen: {person.lastSeenLocation}
                          </p>
                          <p className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 shrink-0" /> Missing since:{" "}
                            {formatDate(person.dateMissing)}
                          </p>
                          <p className="text-slate-700">{person.description}</p>
                          {person.reporterName || person.ifYouSeePhone || person.contactInfo ? (
                            <div className="mt-2 rounded-md border border-sky-200 bg-sky-50/90 px-3 py-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-900">
                                If you see
                              </p>
                              {person.reporterName ? (
                                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-800">
                                  <UserCircle className="h-3.5 w-3.5 shrink-0 text-sky-600" />
                                  <span className="text-slate-500">Reporter:</span> {person.reporterName}
                                </p>
                              ) : null}
                              {person.ifYouSeePhone ? (
                                <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-slate-900">
                                  <Phone className="h-3.5 w-3.5 shrink-0 text-sky-600" />
                                  Call {person.ifYouSeePhone}
                                </p>
                              ) : null}
                              {person.contactInfo ? (
                                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-700">
                                  <Phone className="h-3.5 w-3.5 shrink-0 text-sky-600" />
                                  Additional: {person.contactInfo}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {canDeleteEntry(person) ? (
                        <button
                          type="button"
                          onClick={() => deleteMissing(person.id)}
                          className="shrink-0 text-slate-400 hover:text-rose-600"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Found people list */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-800">
              <UserCheck className="h-5 w-5 text-emerald-600" />
              Found people ({foundPersons.length})
            </h2>
          </div>
          {listLoading ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">Loading…</div>
          ) : listError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center text-amber-900">
              {listError}
            </div>
          ) : foundPersons.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
              No found person reports yet. Click "Report Found Person" to add one.
            </div>
          ) : (
            <div className="space-y-4">
              {foundPersons.map((person) => (
                <div key={person.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex gap-3">
                    <PersonPhotoThumb photoUrl={person.photoUrl} className="h-24 w-24" />
                    <div className="flex min-w-0 flex-1 justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-900">{person.name}</h3>
                          {person.age !== null && person.age !== undefined ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              Age ~{person.age}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-slate-600">
                          <p className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 shrink-0" /> Found at: {person.locationFound}
                          </p>
                          <p className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 shrink-0" /> Date found: {formatDate(person.dateFound)}
                          </p>
                          <p className="text-slate-700">{person.description}</p>
                          {person.reporterName || person.ifYouSeePhone || person.contactInfo ? (
                            <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50/90 px-3 py-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900">
                                If you see
                              </p>
                              {person.reporterName ? (
                                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-800">
                                  <UserCircle className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                  <span className="text-slate-500">Reporter:</span> {person.reporterName}
                                </p>
                              ) : null}
                              {person.ifYouSeePhone ? (
                                <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-slate-900">
                                  <Phone className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                  Call {person.ifYouSeePhone}
                                </p>
                              ) : null}
                              {person.contactInfo ? (
                                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-700">
                                  <Phone className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                  Additional: {person.contactInfo}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {canDeleteEntry(person) ? (
                        <button
                          type="button"
                          onClick={() => deleteFound(person.id)}
                          className="shrink-0 text-slate-400 hover:text-rose-600"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ========== IMPROVED FOUND MATCH MODAL - BEAUTIFUL UI ========== */}
      {foundMatchModal ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="found-match-modal-title"
        >
          {/* Backdrop with blur and fade */}
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm transition-all duration-200"
            onClick={() => setFoundMatchModal(null)}
            aria-label="Close"
          />
          {/* Modal card - elegant, larger, with smooth shadow */}
          <div className="relative z-10 w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 animate-in zoom-in-95 fade-in duration-200">
            {/* Header with gradient and icon */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 text-white">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                  <Sparkles className="h-6 w-6 text-amber-200" aria-hidden />
                </div>
                <div className="flex-1">
                  <h2 id="found-match-modal-title" className="font-oswald text-2xl font-bold tracking-tight">
                    Possible Matches Found
                  </h2>
                  <p className="mt-1 text-sm text-emerald-50/90">
                    We found missing person reports that may line up with this found report. The score combines
                    location, age, dates, and optionally gender and name—not proof of identity.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFoundMatchModal(null)}
                  className="rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Scrollable matches list */}
            <div className="max-h-[calc(85vh-12rem)] overflow-y-auto px-4 py-5 sm:px-6">
              <div className="space-y-5">
                {foundMatchModal.matches.map((person) => (
                  <div
                    key={person.id}
                    className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-emerald-200"
                  >
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Photo column */}
                      <div className="flex justify-center sm:block">
                        {person.photoUrl ? (
                          <PersonPhotoThumb
                            photoUrl={person.photoUrl}
                            className="h-28 w-28 rounded-xl ring-2 ring-white shadow-md"
                            sizes="112px"
                          />
                        ) : (
                          <div className="flex h-28 w-28 items-center justify-center rounded-xl bg-slate-100 text-slate-400 shadow-inner">
                            <UserSearch className="h-10 w-10" />
                          </div>
                        )}
                      </div>

                      {/* Details column */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-bold text-slate-900">{person.fullName}</h3>
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 shadow-sm"
                              title="Total match score"
                            >
                              <Sparkles className="h-3 w-3" />
                              Score {person.matchScore ?? 0}
                            </span>
                          </div>
                        </div>

                        <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="truncate">Last seen: {person.lastSeenLocation}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
                            <span>Missing since: {formatDate(person.dateMissing)}</span>
                          </div>
                          {person.age != null && (
                            <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                              <span className="font-medium">Age on report:</span> {person.age}
                            </div>
                          )}
                          {person.gender && (
                            <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                              <span className="font-medium">Gender:</span> {person.gender}
                            </div>
                          )}
                        </div>

                        {/* Reporter contact section */}
                        {(person.reporterName || person.ifYouSeePhone) && (
                          <div className="mt-3 rounded-lg border border-sky-100 bg-sky-50/50 px-3 py-2 text-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">If you see</p>
                            {person.reporterName && (
                              <p className="mt-1 flex items-center gap-1.5 text-slate-700">
                                <UserCircle className="h-3.5 w-3.5 text-sky-600" />
                                {person.reporterName}
                              </p>
                            )}
                            {person.ifYouSeePhone && (
                              <p className="mt-0.5 flex items-center gap-1.5 font-medium text-slate-900">
                                <Phone className="h-3.5 w-3.5 text-sky-600" />
                                {person.ifYouSeePhone}
                              </p>
                            )}
                          </div>
                        )}
                        {person.contactInfo && (
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                            <Phone className="h-3 w-3" />
                            Also: {person.contactInfo}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Match breakdown (if available) */}
                    {person.scoreBreakdown && (
                      <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/30 p-3">
                        <MatchScoreBreakdown breakdown={person.scoreBreakdown} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer with action button */}
            <div className="border-t border-slate-100 bg-slate-50/90 px-6 py-4">
              <button
                type="button"
                onClick={() => setFoundMatchModal(null)}
                className="w-full rounded-lg bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:from-slate-700 hover:to-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Photo lightbox (unchanged) */}
      {photoLightboxUrl ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Photo preview"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            onClick={() => setPhotoLightboxUrl(null)}
            aria-label="Close"
          />
          <div className="relative z-10 max-h-[min(92vh,900px)] max-w-[min(96vw,1200px)]">
            <button
              type="button"
              onClick={() => setPhotoLightboxUrl(null)}
              className="absolute -right-1 -top-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:-right-2 sm:-top-2 sm:bg-slate-900/80"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoLightboxUrl}
              alt=""
              className="max-h-[min(90vh,880px)] max-w-full rounded-lg object-contain shadow-2xl ring-1 ring-white/20"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}