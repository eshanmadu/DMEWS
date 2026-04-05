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
} from "lucide-react";

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

function canDeleteEntry(person) {
  const uid = getStoredUserId();
  const token = typeof window !== "undefined" ? window.localStorage.getItem("dmews_token") : null;
  return Boolean(
    token && uid && person.submittedByUserId && String(person.submittedByUserId) === String(uid)
  );
}

export default function MissingPersonsPage() {
  const [missingPersons, setMissingPersons] = useState([]);
  const [foundPersons, setFoundPersons] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);

  // Toggle states for forms
  const [showMissingForm, setShowMissingForm] = useState(false);
  const [showFoundForm, setShowFoundForm] = useState(false);

  // Missing form state
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

  // Found form state
  const [foundForm, setFoundForm] = useState({
    name: "",
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
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  const validateMissing = () => {
    const errors = {};
    if (!missingForm.fullName.trim()) errors.fullName = "Full name is required";
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
    if (missingPhoto && !String(missingPhoto.type || "").toLowerCase().startsWith("image/")) {
      errors.photo = "Please choose an image file.";
    }
    setMissingErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddMissing = async (e) => {
    e.preventDefault();
    setSubmitError(null);
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
      setShowMissingForm(false); // optional: auto-close form after submit
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
    if (!foundForm.locationFound.trim()) errors.locationFound = "Location found is required";
    if (!foundForm.dateFound) errors.dateFound = "Date found is required";
    else if (new Date(foundForm.dateFound) > new Date()) errors.dateFound = "Date cannot be in the future";
    if (!foundForm.description.trim()) errors.description = "Description is required";
    if (
      foundForm.age &&
      (isNaN(Number(foundForm.age)) || Number(foundForm.age) < 0 || Number(foundForm.age) > 120)
    )
      errors.age = "Age must be 0–120";
    if (foundPhoto && !String(foundPhoto.type || "").toLowerCase().startsWith("image/")) {
      errors.photo = "Please choose an image file.";
    }
    setFoundErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddFound = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validateFound()) return;

    setSubmittingFound(true);
    try {
      const fd = new FormData();
      fd.append("name", foundForm.name.trim());
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

      setFoundForm({
        name: "",
        age: "",
        locationFound: "",
        dateFound: "",
        description: "",
        contactInfo: "",
      });
      setFoundPhoto(null);
      if (foundPhotoInputRef.current) foundPhotoInputRef.current.value = "";
      setSuccessMsg({ type: "found", text: "✓ Found person report submitted" });
      setShowFoundForm(false); // optional: auto-close form after submit
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          href="/incidents"
          className="inline-flex items-center text-sm font-medium text-sky-600 hover:text-sky-700"
        >
          ← Back to incidents
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="font-oswald text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Missing & found persons
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
          Report missing individuals or notify about found persons. Reports are saved on the server. Optional photos are
          stored with Cloudinary when the backend is configured. Sign in before submitting if you want to delete your own
          reports later.
        </p>
      </div>

      {/* Global error / success messages */}
      {submitError && (
        <div className="mb-6 flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
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

      {/* Toggle Buttons */}
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={() => setShowMissingForm((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          <UserPlus className="h-4 w-4" />
          {showMissingForm ? "Hide" : "Report"} Missing Person
        </button>
        <button
          onClick={() => setShowFoundForm((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <UserCheck className="h-4 w-4" />
          {showFoundForm ? "Hide" : "Report"} Found Person
        </button>
      </div>

      {/* Missing Person Form (conditionally shown) */}
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
                onChange={(e) => setMissingForm({ ...missingForm, fullName: e.target.value })}
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
                  onChange={(e) => setMissingForm({ ...missingForm, age: e.target.value })}
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

            <div>
              <label className="block text-sm font-medium text-slate-700">Contact info (phone/email)</label>
              <input
                type="text"
                value={missingForm.contactInfo}
                onChange={(e) => setMissingForm({ ...missingForm, contactInfo: e.target.value })}
                placeholder="Optional – how to reach you"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <ImageIcon className="h-4 w-4 text-slate-500" />
                Photo (optional)
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
              disabled={submittingMissing}
              className="w-full rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-60"
            >
              {submittingMissing ? "Submitting…" : "Submit missing person report"}
            </button>
          </form>
        </div>
      )}

      {/* Found Person Form (conditionally shown) */}
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
                onChange={(e) => setFoundForm({ ...foundForm, name: e.target.value })}
                placeholder="Leave blank for unknown"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Estimated age</label>
              <input
                type="number"
                value={foundForm.age}
                onChange={(e) => setFoundForm({ ...foundForm, age: e.target.value })}
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

            <div>
              <label className="block text-sm font-medium text-slate-700">Your contact info</label>
              <input
                type="text"
                value={foundForm.contactInfo}
                onChange={(e) => setFoundForm({ ...foundForm, contactInfo: e.target.value })}
                placeholder="Optional"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <ImageIcon className="h-4 w-4 text-slate-500" />
                Photo (optional)
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
              disabled={submittingFound}
              className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
            >
              {submittingFound ? "Submitting…" : "Submit found person report"}
            </button>
          </form>
        </div>
      )}

      {/* Lists of Missing and Found People */}
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
                    {person.photoUrl ? (
                      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md bg-slate-100">
                        <Image
                          src={person.photoUrl}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="96px"
                        />
                      </div>
                    ) : null}
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
                          {person.contactInfo ? (
                            <p className="flex items-center gap-1 text-xs text-slate-500">
                              <Phone className="h-3 w-3 shrink-0" /> Contact: {person.contactInfo}
                            </p>
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
                    {person.photoUrl ? (
                      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md bg-slate-100">
                        <Image
                          src={person.photoUrl}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="96px"
                        />
                      </div>
                    ) : null}
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
                          {person.contactInfo ? (
                            <p className="flex items-center gap-1 text-xs text-slate-500">
                              <Phone className="h-3 w-3 shrink-0" /> Reporter contact: {person.contactInfo}
                            </p>
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
    </div>
  );
}