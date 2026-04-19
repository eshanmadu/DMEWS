"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  UserSearch,
  UserPlus,
  UserCheck,
  MapPin,
  Calendar,
  Phone,
  Trash2,
  Pencil,
  X,
  ImageIcon,
  Sparkles,
  UserCircle,
  ZoomIn,
  AlertTriangle,
  User,
  CalendarDays,
  FileText,
  Loader2,
  Camera,
} from "lucide-react";

import { MatchScoreBreakdown } from "@/components/MatchScoreBreakdown";
import { LocationSuggestInput } from "@/components/LocationSuggestInput";

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

function additionalPhoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

/** Optional field: empty OK, otherwise exactly 10 digits. */
function isValidOptionalAdditionalPhone(value) {
  const d = additionalPhoneDigits(value);
  if (d.length === 0) return true;
  return d.length === 10;
}

function sanitizeAdditionalPhoneInput(value) {
  return additionalPhoneDigits(value).slice(0, 10);
}

function normalizeAdditionalPhoneForSubmit(value) {
  const d = additionalPhoneDigits(value);
  return d.length === 10 ? d : "";
}

/** Primary = account phone; additional = optional second number. */
function formatContactCallDisplay(primary, additional) {
  const p = String(primary || "").trim();
  const a = String(additional || "").trim();
  if (!p && !a) return "";
  if (p && a) return `Call ${p} / ${a} (additional)`;
  if (p) return `Call ${p}`;
  return `${a} (additional)`;
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
  const { i18n } = useTranslation();
  const si = String(i18n.language || "").startsWith("si");
  const tr = (en, siText) => (si ? siText : en);
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
  const [missingPhotoPreview, setMissingPhotoPreview] = useState(null);

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
  const [foundPhotoPreview, setFoundPhotoPreview] = useState(null);

  const [successMsg, setSuccessMsg] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submittingMissing, setSubmittingMissing] = useState(false);
  const [submittingFound, setSubmittingFound] = useState(false);
  const [missingEdit, setMissingEdit] = useState(null);
  const [missingEditPhoto, setMissingEditPhoto] = useState(null);
  const [missingEditPreview, setMissingEditPreview] = useState(null);
  const [missingEditErrors, setMissingEditErrors] = useState({});
  const [submittingMissingEdit, setSubmittingMissingEdit] = useState(false);
  const missingEditPhotoInputRef = useRef(null);
  const [foundEdit, setFoundEdit] = useState(null);
  const [foundEditPhoto, setFoundEditPhoto] = useState(null);
  const [foundEditPreview, setFoundEditPreview] = useState(null);
  const [foundEditErrors, setFoundEditErrors] = useState({});
  const [submittingFoundEdit, setSubmittingFoundEdit] = useState(false);
  const foundEditPhotoInputRef = useRef(null);
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
        throw new Error(data?.message || tr("Failed to load reports.", "වාර්තා පූරණය කිරීමට අසමත් විය."));
      }
      setMissingPersons(Array.isArray(data.missing) ? data.missing : []);
      setFoundPersons(Array.isArray(data.found) ? data.found : []);
    } catch (e) {
      setListError(e?.message || tr("Failed to load reports.", "වාර්තා පූරණය කිරීමට අසමත් විය."));
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

  useEffect(() => {
    const open = Boolean(missingEdit) || Boolean(foundEdit);
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") {
        setMissingEdit(null);
        setFoundEdit(null);
        setMissingEditPhoto(null);
        setFoundEditPhoto(null);
        setMissingEditPreview(null);
        setFoundEditPreview(null);
        setMissingEditErrors({});
        setFoundEditErrors({});
        if (missingEditPhotoInputRef.current) missingEditPhotoInputRef.current.value = "";
        if (foundEditPhotoInputRef.current) foundEditPhotoInputRef.current.value = "";
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [missingEdit, foundEdit]);

  const validateMissing = () => {
    const errors = {};
    if (!missingForm.fullName.trim()) errors.fullName = tr("Full name is required", "සම්පූර්ණ නම අනිවාර්යයි");
    else if (!isValidPersonName(missingForm.fullName)) errors.fullName = tr("Name can only contain letters", "නමට අක්ෂර පමණක් භාවිතා කරන්න");
    if (!missingForm.age) errors.age = tr("Age is required", "වයස අනිවාර්යයි");
    else if (
      isNaN(Number(missingForm.age)) ||
      Number(missingForm.age) < 0 ||
      Number(missingForm.age) > 120
    )
      errors.age = tr("Age must be 0–120", "වයස 0–120 අතර විය යුතුය");
    if (!missingForm.lastSeenLocation.trim()) errors.lastSeenLocation = tr("Last seen location is required", "අවසන් වරට දැකගත් ස්ථානය අනිවාර්යයි");
    if (!missingForm.dateMissing) errors.dateMissing = tr("Date missing is required", "අතුරුදහන් වූ දිනය අනිවාර්යයි");
    else if (new Date(missingForm.dateMissing) > new Date()) errors.dateMissing = tr("Date cannot be in the future", "ඉදිරි දිනයක් යෙදිය නොහැක");
    if (!missingForm.description.trim()) errors.description = tr("Description is required", "විස්තරය අනිවාර්යයි");
    if (!isValidOptionalAdditionalPhone(missingForm.contactInfo))
      errors.contactInfo = tr("Additional contact must be exactly 10 digits, or leave blank", "අමතර දුරකථන අංකය ඉලක්කම් 10ක් විය යුතුය, නැතහොත් හිස්ව තබන්න");
    if (missingPhoto && !String(missingPhoto.type || "").toLowerCase().startsWith("image/")) {
      errors.photo = tr("Please choose an image file.", "කරුණාකර රූප ගොනුවක් තෝරන්න.");
    }
    setMissingErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddMissing = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    if (!clientSignedIn) {
      setSubmitError(tr("Please log in before submitting a missing person report.", "අතුරුදහන් පුද්ගල වාර්තාවක් යැවීමට පෙර කරුණාකර පිවිසෙන්න."));
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
      fd.append("contactInfo", normalizeAdditionalPhoneForSubmit(missingForm.contactInfo));
      if (missingPhoto) fd.append("photo", missingPhoto);

      const res = await fetch(`${API_BASE}/missing-persons/missing`, {
        method: "POST",
        headers: authHeaders(),
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || tr("Submit failed.", "යැවීම අසාර්ථක විය."));
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
      setMissingPhotoPreview(null);
      if (missingPhotoInputRef.current) missingPhotoInputRef.current.value = "";
      setSuccessMsg({ type: "missing", text: tr("✓ Missing person report submitted", "✓ අතුරුදහන් පුද්ගල වාර්තාව යවන ලදී") });
      setShowMissingForm(false);
    } catch (err) {
      setSubmitError(err?.message || tr("Submit failed.", "යැවීම අසාර්ථක විය."));
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
      if (!res.ok) throw new Error(data?.message || tr("Delete failed.", "මකා දැමීම අසාර්ථක විය."));
      setMissingPersons((prev) => prev.filter((p) => p.id !== id));
      setSuccessMsg({ type: "missing", text: tr("Entry removed", "ප්‍රවේශය ඉවත් කරන ලදී") });
    } catch (err) {
      setSubmitError(err?.message || tr("Delete failed.", "මකා දැමීම අසාර්ථක විය."));
    }
  };

  const validateFound = () => {
    const errors = {};
    if (foundForm.name.trim() && !isValidPersonName(foundForm.name))
      errors.name = tr("Name can only contain letters", "නමට අක්ෂර පමණක් භාවිතා කරන්න");
    if (!foundForm.locationFound.trim()) errors.locationFound = tr("Location found is required", "හමු වූ ස්ථානය අනිවාර්යයි");
    if (!foundForm.dateFound) errors.dateFound = tr("Date found is required", "හමු වූ දිනය අනිවාර්යයි");
    else if (new Date(foundForm.dateFound) > new Date()) errors.dateFound = tr("Date cannot be in the future", "ඉදිරි දිනයක් යෙදිය නොහැක");
    if (!foundForm.description.trim()) errors.description = tr("Description is required", "විස්තරය අනිවාර්යයි");
    if (
      foundForm.age &&
      (isNaN(Number(foundForm.age)) || Number(foundForm.age) < 0 || Number(foundForm.age) > 120)
    )
      errors.age = tr("Age must be 0–120", "වයස 0–120 අතර විය යුතුය");
    if (!isValidOptionalAdditionalPhone(foundForm.contactInfo))
      errors.contactInfo = tr("Additional contact must be exactly 10 digits, or leave blank", "අමතර දුරකථන අංකය ඉලක්කම් 10ක් විය යුතුය, නැතහොත් හිස්ව තබන්න");
    if (foundPhoto && !String(foundPhoto.type || "").toLowerCase().startsWith("image/")) {
      errors.photo = tr("Please choose an image file.", "කරුණාකර රූප ගොනුවක් තෝරන්න.");
    }
    setFoundErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddFound = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    if (!clientSignedIn) {
      setSubmitError(tr("Please log in before submitting a found person report.", "හමු වූ පුද්ගල වාර්තාවක් යැවීමට පෙර කරුණාකර පිවිසෙන්න."));
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
      fd.append("contactInfo", normalizeAdditionalPhoneForSubmit(foundForm.contactInfo));
      if (foundPhoto) fd.append("photo", foundPhoto);

      const res = await fetch(`${API_BASE}/missing-persons/found`, {
        method: "POST",
        headers: authHeaders(),
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || tr("Submit failed.", "යැවීම අසාර්ථක විය."));
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
      setFoundPhotoPreview(null);
      if (foundPhotoInputRef.current) foundPhotoInputRef.current.value = "";
      setSuccessMsg({ type: "found", text: tr("✓ Found person report submitted", "✓ හමු වූ පුද්ගල වාර්තාව යවන ලදී") });
      setShowFoundForm(false);
    } catch (err) {
      setSubmitError(err?.message || tr("Submit failed.", "යැවීම අසාර්ථක විය."));
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
      if (!res.ok) throw new Error(data?.message || tr("Delete failed.", "මකා දැමීම අසාර්ථක විය."));
      setFoundPersons((prev) => prev.filter((p) => p.id !== id));
      setSuccessMsg({ type: "found", text: tr("Entry removed", "ප්‍රවේශය ඉවත් කරන ලදී") });
    } catch (err) {
      setSubmitError(err?.message || tr("Delete failed.", "මකා දැමීම අසාර්ථක විය."));
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? String(dateStr) : d.toLocaleDateString();
  };

  const toDateInputValue = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  };

  const openMissingEdit = (person) => {
    setMissingEdit({
      id: person.id,
      fullName: person.fullName || "",
      age: String(person.age ?? ""),
      gender: person.gender || "",
      lastSeenLocation: person.lastSeenLocation || "",
      dateMissing: toDateInputValue(person.dateMissing),
      description: person.description || "",
      contactInfo: sanitizeAdditionalPhoneInput(person.contactInfo || ""),
      existingPhotoUrl: person.photoUrl || "",
    });
    setMissingEditPhoto(null);
    setMissingEditPreview(person.photoUrl || null);
    setMissingEditErrors({});
    if (missingEditPhotoInputRef.current) missingEditPhotoInputRef.current.value = "";
  };

  const openFoundEdit = (person) => {
    setFoundEdit({
      id: person.id,
      name: person.name === "Unknown" ? "" : person.name || "",
      gender: person.gender || "",
      age: person.age != null && person.age !== "" ? String(person.age) : "",
      locationFound: person.locationFound || "",
      dateFound: toDateInputValue(person.dateFound),
      description: person.description || "",
      contactInfo: sanitizeAdditionalPhoneInput(person.contactInfo || ""),
      existingPhotoUrl: person.photoUrl || "",
    });
    setFoundEditPhoto(null);
    setFoundEditPreview(person.photoUrl || null);
    setFoundEditErrors({});
    if (foundEditPhotoInputRef.current) foundEditPhotoInputRef.current.value = "";
  };

  const validateMissingEdit = () => {
    if (!missingEdit) return false;
    const errors = {};
    const f = missingEdit;
    if (!f.fullName.trim()) errors.fullName = "Full name is required";
    else if (!isValidPersonName(f.fullName)) errors.fullName = "Name can only contain letters";
    if (!f.age) errors.age = "Age is required";
    else if (isNaN(Number(f.age)) || Number(f.age) < 0 || Number(f.age) > 120)
      errors.age = "Age must be 0–120";
    if (!f.lastSeenLocation.trim()) errors.lastSeenLocation = "Last seen location is required";
    if (!f.dateMissing) errors.dateMissing = "Date missing is required";
    else if (new Date(f.dateMissing) > new Date()) errors.dateMissing = "Date cannot be in the future";
    if (!f.description.trim()) errors.description = "Description is required";
    if (!isValidOptionalAdditionalPhone(f.contactInfo))
      errors.contactInfo = "Additional contact must be exactly 10 digits, or leave blank";
    if (missingEditPhoto && !String(missingEditPhoto.type || "").toLowerCase().startsWith("image/")) {
      errors.photo = "Please choose an image file.";
    }
    setMissingEditErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateFoundEdit = () => {
    if (!foundEdit) return false;
    const errors = {};
    const f = foundEdit;
    if (f.name.trim() && !isValidPersonName(f.name)) errors.name = "Name can only contain letters";
    if (!f.locationFound.trim()) errors.locationFound = "Location found is required";
    if (!f.dateFound) errors.dateFound = "Date found is required";
    else if (new Date(f.dateFound) > new Date()) errors.dateFound = "Date cannot be in the future";
    if (!f.description.trim()) errors.description = "Description is required";
    if (
      f.age &&
      (isNaN(Number(f.age)) || Number(f.age) < 0 || Number(f.age) > 120)
    )
      errors.age = "Age must be 0–120";
    if (!isValidOptionalAdditionalPhone(f.contactInfo))
      errors.contactInfo = "Additional contact must be exactly 10 digits, or leave blank";
    if (foundEditPhoto && !String(foundEditPhoto.type || "").toLowerCase().startsWith("image/")) {
      errors.photo = "Please choose an image file.";
    }
    setFoundEditErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleMissingEditPhotoChange = (e) => {
    const file = e.target.files?.[0] || null;
    setMissingEditPhoto(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setMissingEditPreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setMissingEditPreview(missingEdit?.existingPhotoUrl || null);
    }
  };

  const handleFoundEditPhotoChange = (e) => {
    const file = e.target.files?.[0] || null;
    setFoundEditPhoto(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFoundEditPreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setFoundEditPreview(foundEdit?.existingPhotoUrl || null);
    }
  };

  const handleUpdateMissing = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    if (!clientSignedIn || !missingEdit) return;
    if (!validateMissingEdit()) return;
    setSubmittingMissingEdit(true);
    try {
      const fd = new FormData();
      fd.append("fullName", missingEdit.fullName.trim());
      fd.append("age", String(missingEdit.age));
      fd.append("gender", missingEdit.gender);
      fd.append("lastSeenLocation", missingEdit.lastSeenLocation.trim());
      fd.append("dateMissing", missingEdit.dateMissing);
      fd.append("description", missingEdit.description.trim());
      fd.append("contactInfo", normalizeAdditionalPhoneForSubmit(missingEdit.contactInfo));
      if (missingEditPhoto) fd.append("photo", missingEditPhoto);
      const res = await fetch(`${API_BASE}/missing-persons/missing/${missingEdit.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Update failed.");
      if (data.person) {
        setMissingPersons((prev) => prev.map((p) => (p.id === data.person.id ? data.person : p)));
      } else {
        await loadLists();
      }
      setMissingEdit(null);
      setMissingEditPhoto(null);
      setMissingEditPreview(null);
      if (missingEditPhotoInputRef.current) missingEditPhotoInputRef.current.value = "";
      setSuccessMsg({ type: "missing", text: "✓ Missing person report updated" });
    } catch (err) {
      setSubmitError(err?.message || "Update failed.");
    } finally {
      setSubmittingMissingEdit(false);
    }
  };

  const handleUpdateFound = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    if (!clientSignedIn || !foundEdit) return;
    if (!validateFoundEdit()) return;
    setSubmittingFoundEdit(true);
    try {
      const fd = new FormData();
      fd.append("name", foundEdit.name.trim());
      fd.append("gender", foundEdit.gender);
      fd.append("age", foundEdit.age);
      fd.append("locationFound", foundEdit.locationFound.trim());
      fd.append("dateFound", foundEdit.dateFound);
      fd.append("description", foundEdit.description.trim());
      fd.append("contactInfo", normalizeAdditionalPhoneForSubmit(foundEdit.contactInfo));
      if (foundEditPhoto) fd.append("photo", foundEditPhoto);
      const res = await fetch(`${API_BASE}/missing-persons/found/${foundEdit.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Update failed.");
      if (data.person) {
        setFoundPersons((prev) => prev.map((p) => (p.id === data.person.id ? data.person : p)));
      } else {
        await loadLists();
      }
      setFoundEdit(null);
      setFoundEditPhoto(null);
      setFoundEditPreview(null);
      if (foundEditPhotoInputRef.current) foundEditPhotoInputRef.current.value = "";
      setSuccessMsg({ type: "found", text: "✓ Found person report updated" });
    } catch (err) {
      setSubmitError(err?.message || "Update failed.");
    } finally {
      setSubmittingFoundEdit(false);
    }
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

  // Helper for image preview
  const handleMissingPhotoChange = (e) => {
    const file = e.target.files?.[0] || null;
    setMissingPhoto(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setMissingPhotoPreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setMissingPhotoPreview(null);
    }
  };

  const handleFoundPhotoChange = (e) => {
    const file = e.target.files?.[0] || null;
    setFoundPhoto(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFoundPhotoPreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setFoundPhotoPreview(null);
    }
  };

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
                {tr("Missing & Found Persons", "අතුරුදහන් සහ හමු වූ පුද්ගලයින්")}
              </h1>
              <p className="mt-2 max-w-2xl text-rose-100">
                {tr("Report missing individuals or notify about found persons. Your report helps reunite families.", "අතුරුදහන් පුද්ගලයින් වාර්තා කරන්න හෝ හමු වූ පුද්ගලයින් ගැන දැනුම් දෙන්න. ඔබගේ වාර්තාව පවුල් නැවත එකතු කිරීමට උපකාරී වේ.")}
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
          ← {tr("Back to Dashboard", "පුවරුවට ආපසු")}
        </Link>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowMissingForm((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-300"
          >
            <UserPlus className="h-5 w-5" />
            {showMissingForm ? tr("Hide", "සඟවන්න") : tr("Report Missing", "අතුරුදහන් වාර්තා කරන්න")}
          </button>
          <button
            onClick={() => setShowFoundForm((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-300"
          >
            <UserCheck className="h-5 w-5" />
            {showFoundForm ? tr("Hide", "සඟවන්න") : tr("Report Found", "හමුවූ පුද්ගලයා වාර්තා කරන්න")}
          </button>
        </div>
      </div>

      {/* Global error / success messages */}
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

      {/* MODERN MISSING PERSON FORM */}
      {showMissingForm && (
        <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl transition-all duration-300">
          <div className="bg-gradient-to-r from-rose-600 to-rose-500 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <UserPlus className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">{tr("Report Missing Person", "අතුරුදහන් පුද්ගලයා වාර්තා කරන්න")}</h2>
            </div>
            <p className="mt-1 text-sm text-rose-100">{tr("Help bring someone back home by sharing details", "විස්තර බෙදාගෙන කෙනෙකු ආපසු ගෙදරට ගෙන ඒමට උපකාරී වන්න")}</p>
          </div>

          <form onSubmit={handleAddMissing} className="p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              {/* Full Name */}
              <div className="relative">
                <label className="mb-1 block text-sm font-medium text-slate-700">{tr("Full name *", "සම්පූර්ණ නම *")}</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={missingForm.fullName}
                    onChange={(e) =>
                      setMissingForm({ ...missingForm, fullName: sanitizeNameInput(e.target.value) })
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm transition-all focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    placeholder={tr("e.g., John Doe", "උදා: නම")}
                  />
                </div>
                {missingErrors.fullName && <p className="mt-1 text-xs text-rose-600">{missingErrors.fullName}</p>}
              </div>

              {/* Age */}
              <div className="relative">
                <label className="mb-1 block text-sm font-medium text-slate-700">{tr("Age *", "වයස *")}</label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    value={missingForm.age}
                    onChange={(e) => setMissingForm({ ...missingForm, age: sanitizeAgeInput(e.target.value) })}
                    min={0}
                    max={120}
                    className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm transition-all focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    placeholder={tr("e.g., 28", "උදා: 28")}
                  />
                </div>
                {missingErrors.age && <p className="mt-1 text-xs text-rose-600">{missingErrors.age}</p>}
              </div>

              {/* Gender */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{tr("Gender", "ස්ත්‍රී/පුරුෂභාවය")}</label>
                <select
                  value={missingForm.gender}
                  onChange={(e) => setMissingForm({ ...missingForm, gender: e.target.value })}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm transition-all focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                >
                  <option value="">{tr("Prefer not to say", "පැවසීමට කැමති නැත")}</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                </select>
              </div>

              {/* Last Seen Location */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{tr("Last seen location *", "අවසන් වරට දැකගත් ස්ථානය *")}</label>
                <LocationSuggestInput
                  label=""
                  value={missingForm.lastSeenLocation}
                  onChange={(v) => setMissingForm({ ...missingForm, lastSeenLocation: v })}
                  error={missingErrors.lastSeenLocation}
                />
              </div>

              {/* Date Missing */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{tr("Date missing *", "අතුරුදහන් වූ දිනය *")}</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={missingForm.dateMissing}
                    onChange={(e) => setMissingForm({ ...missingForm, dateMissing: e.target.value })}
                    max={new Date().toISOString().slice(0, 10)}
                    className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm transition-all focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  />
                </div>
                {missingErrors.dateMissing && <p className="mt-1 text-xs text-rose-600">{missingErrors.dateMissing}</p>}
              </div>

              {/* Description */}
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">{tr("Description (clothing, features) *", "විස්තරය (ඇඳුම්, ලක්ෂණ) *")}</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <textarea
                    rows={3}
                    value={missingForm.description}
                    onChange={(e) => setMissingForm({ ...missingForm, description: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 pl-9 pr-3 pt-2 text-sm transition-all focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    placeholder={tr("Describe appearance, clothing, distinguishing features...", "පෙනුම, ඇඳුම්, විශේෂ ලක්ෂණ සඳහන් කරන්න...")}
                  />
                </div>
                {missingErrors.description && <p className="mt-1 text-xs text-rose-600">{missingErrors.description}</p>}
              </div>
            </div>

            {/* Reporter Section */}
            {clientSignedIn ? (
              <div className="mt-6 rounded-xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white p-5 shadow-sm">
                <p className="font-semibold text-slate-800">{tr("📢 If you see — reporter (from your account)", "📢 දැක්කොත් — වාර්තාකරු (ඔබගේ ගිණුමෙන්)")}</p>
                <p className="mt-1 text-xs text-slate-600">
                  Your name and phone are taken from your profile when you submit.
                </p>
                <div className="mt-3 space-y-2 rounded-lg border border-rose-100 bg-white/80 px-4 py-3">
                  <p className="flex items-center gap-2 text-sm text-slate-800">
                    <UserCircle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span className="text-slate-500">{tr("Reporter name:", "වාර්තාකරු නම:")}</span>{" "}
                    <span className="font-medium">{profileHint.name || "—"}</span>
                  </p>
                  <p className="flex items-center gap-2 text-sm text-slate-800">
                    <Phone className="h-4 w-4 shrink-0 text-rose-600" />
                    <span className="text-slate-500">{tr("Phone:", "දුරකථනය:")}</span>{" "}
                    <span className="font-medium">{profileHint.mobile || "—"}</span>
                  </p>
                </div>
                {profileHint.mobile ? null : (
                  <p className="mt-2 text-xs text-amber-800">
                    Add a mobile number in your profile so callers can reach you.
                  </p>
                )}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700">Additional contact (optional)</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={missingForm.contactInfo}
                      onChange={(e) =>
                        setMissingForm({
                          ...missingForm,
                          contactInfo: sanitizeAdditionalPhoneInput(e.target.value),
                        })
                      }
                      placeholder={tr("10-digit number (optional)", "ඉලක්කම් 10 අංකය (විකල්ප)")}
                      inputMode="numeric"
                      maxLength={10}
                      autoComplete="tel"
                      className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm transition-all focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    />
                  </div>
                  {missingErrors.contactInfo && (
                    <p className="mt-1 text-xs text-rose-600">{missingErrors.contactInfo}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
                <p className="font-medium">{tr("Sign in is required to submit a report", "වාර්තාවක් යැවීමට පිවිසීම අනිවාර්යයි")}</p>
                <p className="mt-1 text-xs opacity-90">
                  Missing person reports require a logged-in account so your reporter details appear.
                </p>
              </div>
            )}

            {/* Photo Upload with Preview */}
            <div className="mt-6">
              <label className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700">
                <Camera className="h-4 w-4 text-slate-500" />
                {tr("Photo (optional, max 10MB)", "ඡායාරූපය (විකල්ප, උපරිම 10MB)")}
              </label>
              <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
                  <ImageIcon className="h-4 w-4" />
                  {tr("Choose image", "රූපය තෝරන්න")}
                  <input
                    ref={missingPhotoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleMissingPhotoChange}
                    className="hidden"
                  />
                </label>
                {missingPhotoPreview && (
                  <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 shadow-sm">
                    <img src={missingPhotoPreview} alt="Preview" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setMissingPhoto(null);
                        setMissingPhotoPreview(null);
                        if (missingPhotoInputRef.current) missingPhotoInputRef.current.value = "";
                      }}
                      className="absolute -right-1 -top-1 rounded-full bg-white p-0.5 text-red-600 shadow-md"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
              {missingErrors.photo && <p className="mt-1 text-xs text-rose-600">{missingErrors.photo}</p>}
            </div>

            <button
              type="submit"
              disabled={submittingMissing || !clientSignedIn}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:from-rose-700 hover:to-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:opacity-60"
            >
              {submittingMissing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {submittingMissing ? tr("Submitting...", "යවමින්...") : tr("Submit missing person report", "අතුරුදහන් පුද්ගල වාර්තාව යවන්න")}
            </button>
          </form>
        </div>
      )}

      {/* MODERN FOUND PERSON FORM */}
      {showFoundForm && (
        <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl transition-all duration-300">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-500 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <UserCheck className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">{tr("Report Found Person", "හමු වූ පුද්ගලයා වාර්තා කරන්න")}</h2>
            </div>
            <p className="mt-1 text-sm text-emerald-100">Help reunite someone with their family</p>
          </div>

          <form onSubmit={handleAddFound} className="p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              {/* Name (optional) */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name (if known)</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={foundForm.name}
                    onChange={(e) => setFoundForm({ ...foundForm, name: sanitizeNameInput(e.target.value) })}
                    placeholder="Leave blank for unknown"
                    className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm transition-all focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                {foundErrors.name && <p className="mt-1 text-xs text-rose-600">{foundErrors.name}</p>}
              </div>

              {/* Gender */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Gender (optional)</label>
                <select
                  value={foundForm.gender}
                  onChange={(e) => setFoundForm({ ...foundForm, gender: e.target.value })}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm transition-all focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">Prefer not to say</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  If provided on both reports, matching compares gender.
                </p>
              </div>

              {/* Estimated Age */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Estimated age</label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    value={foundForm.age}
                    onChange={(e) => setFoundForm({ ...foundForm, age: sanitizeAgeInput(e.target.value) })}
                    min={0}
                    max={120}
                    className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm transition-all focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="e.g., 35"
                  />
                </div>
                {foundErrors.age && <p className="mt-1 text-xs text-rose-600">{foundErrors.age}</p>}
              </div>

              {/* Location Found */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Location found *</label>
                <LocationSuggestInput
                  label=""
                  value={foundForm.locationFound}
                  onChange={(v) => setFoundForm({ ...foundForm, locationFound: v })}
                  error={foundErrors.locationFound}
                />
              </div>

              {/* Date Found */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Date found *</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={foundForm.dateFound}
                    onChange={(e) => setFoundForm({ ...foundForm, dateFound: e.target.value })}
                    max={new Date().toISOString().slice(0, 10)}
                    className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm transition-all focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                {foundErrors.dateFound && <p className="mt-1 text-xs text-rose-600">{foundErrors.dateFound}</p>}
              </div>

              {/* Description */}
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Description *</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <textarea
                    rows={3}
                    value={foundForm.description}
                    onChange={(e) => setFoundForm({ ...foundForm, description: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 pl-9 pr-3 pt-2 text-sm transition-all focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="Describe appearance, clothing, condition, any details..."
                  />
                </div>
                {foundErrors.description && <p className="mt-1 text-xs text-rose-600">{foundErrors.description}</p>}
              </div>
            </div>

            {/* Reporter Section */}
            {clientSignedIn ? (
              <div className="mt-6 rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
                <p className="font-semibold text-slate-800">📢 If you see — reporter (from your account)</p>
                <p className="mt-1 text-xs text-slate-600">
                  Your name and phone are taken from your profile when you submit.
                </p>
                <div className="mt-3 space-y-2 rounded-lg border border-emerald-100 bg-white/80 px-4 py-3">
                  <p className="flex items-center gap-2 text-sm text-slate-800">
                    <UserCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="text-slate-500">Reporter name:</span>{" "}
                    <span className="font-medium">{profileHint.name || "—"}</span>
                  </p>
                  <p className="flex items-center gap-2 text-sm text-slate-800">
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
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700">Additional contact (optional)</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={foundForm.contactInfo}
                      onChange={(e) =>
                        setFoundForm({
                          ...foundForm,
                          contactInfo: sanitizeAdditionalPhoneInput(e.target.value),
                        })
                      }
                      placeholder="10-digit number (optional)"
                      inputMode="numeric"
                      maxLength={10}
                      autoComplete="tel"
                      className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm transition-all focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                  {foundErrors.contactInfo && (
                    <p className="mt-1 text-xs text-rose-600">{foundErrors.contactInfo}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
                <p className="font-medium">Sign in is required to submit a report</p>
                <p className="mt-1 text-xs opacity-90">
                  Found person reports require a logged-in account.
                </p>
              </div>
            )}

            {/* Photo Upload with Preview */}
            <div className="mt-6">
              <label className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700">
                <Camera className="h-4 w-4 text-slate-500" />
                Photo (optional, max 10MB)
              </label>
              <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
                  <ImageIcon className="h-4 w-4" />
                  Choose image
                  <input
                    ref={foundPhotoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFoundPhotoChange}
                    className="hidden"
                  />
                </label>
                {foundPhotoPreview && (
                  <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 shadow-sm">
                    <img src={foundPhotoPreview} alt="Preview" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setFoundPhoto(null);
                        setFoundPhotoPreview(null);
                        if (foundPhotoInputRef.current) foundPhotoInputRef.current.value = "";
                      }}
                      className="absolute -right-1 -top-1 rounded-full bg-white p-0.5 text-red-600 shadow-md"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
              {foundErrors.photo && <p className="mt-1 text-xs text-rose-600">{foundErrors.photo}</p>}
            </div>

            <button
              type="submit"
              disabled={submittingFound || !clientSignedIn}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:from-emerald-700 hover:to-teal-600 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-60"
            >
              {submittingFound ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
              {submittingFound ? "Submitting..." : "Submit found person report"}
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
              {tr("Missing people", "අතුරුදහන් පුද්ගලයින්")} ({missingPersons.length})
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
              {tr('No missing person reports yet. Click "Report Missing Person" to add one.', 'තවම අතුරුදහන් පුද්ගල වාර්තා නොමැත. එක් කිරීමට "අතුරුදහන් වාර්තා කරන්න" ඔබන්න.')}
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
                            <MapPin className="h-3.5 w-3.5 shrink-0" /> {tr("Last seen:", "අවසන් වරට දැක්කා:")} {person.lastSeenLocation}
                          </p>
                          <p className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 shrink-0" /> {tr("Missing since:", "අතුරුදහන් වූ දින සිට:")}{" "}
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
                              {person.ifYouSeePhone || person.contactInfo ? (
                                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-900">
                                  <Phone className="h-3.5 w-3.5 shrink-0 text-sky-600" />
                                  {formatContactCallDisplay(person.ifYouSeePhone, person.contactInfo)}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {canDeleteEntry(person) ? (
                        <div className="flex shrink-0 flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => openMissingEdit(person)}
                            className="text-slate-400 hover:text-sky-600"
                            aria-label="Edit report"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMissing(person.id)}
                            className="text-slate-400 hover:text-rose-600"
                            aria-label="Delete"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
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
              {tr("Found people", "හමුවූ පුද්ගලයින්")} ({foundPersons.length})
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
              {tr('No found person reports yet. Click "Report Found Person" to add one.', 'තවම හමුවූ පුද්ගල වාර්තා නොමැත. එක් කිරීමට "හමු වූ පුද්ගලයා වාර්තා කරන්න" ඔබන්න.')}
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
                              {person.ifYouSeePhone || person.contactInfo ? (
                                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-900">
                                  <Phone className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                  {formatContactCallDisplay(person.ifYouSeePhone, person.contactInfo)}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {canDeleteEntry(person) ? (
                        <div className="flex shrink-0 flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => openFoundEdit(person)}
                            className="text-slate-400 hover:text-sky-600"
                            aria-label="Edit report"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteFound(person.id)}
                            className="text-slate-400 hover:text-rose-600"
                            aria-label="Delete"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit missing person */}
      {missingEdit ? (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-missing-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
            onClick={() => {
              setMissingEdit(null);
              setMissingEditPhoto(null);
              setMissingEditPreview(null);
              setMissingEditErrors({});
            }}
            aria-label="Close"
          />
          <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-rose-600 to-rose-500 px-5 py-4">
              <h2 id="edit-missing-title" className="text-lg font-bold text-white">
                Edit missing person report
              </h2>
              <button
                type="button"
                onClick={() => {
                  setMissingEdit(null);
                  setMissingEditPhoto(null);
                  setMissingEditPreview(null);
                  setMissingEditErrors({});
                }}
                className="rounded-full p-1 text-white/90 hover:bg-white/20"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateMissing} className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Full name *</label>
                  <input
                    type="text"
                    value={missingEdit.fullName}
                    onChange={(e) =>
                      setMissingEdit({ ...missingEdit, fullName: sanitizeNameInput(e.target.value) })
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  />
                  {missingEditErrors.fullName && (
                    <p className="mt-1 text-xs text-rose-600">{missingEditErrors.fullName}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Age *</label>
                  <input
                    type="number"
                    value={missingEdit.age}
                    onChange={(e) =>
                      setMissingEdit({ ...missingEdit, age: sanitizeAgeInput(e.target.value) })
                    }
                    min={0}
                    max={120}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  />
                  {missingEditErrors.age && (
                    <p className="mt-1 text-xs text-rose-600">{missingEditErrors.age}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Gender</label>
                  <select
                    value={missingEdit.gender}
                    onChange={(e) => setMissingEdit({ ...missingEdit, gender: e.target.value })}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  >
                    <option value="">Prefer not to say</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-binary">Non-binary</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Last seen location *</label>
                  <LocationSuggestInput
                    label=""
                    value={missingEdit.lastSeenLocation}
                    onChange={(v) => setMissingEdit({ ...missingEdit, lastSeenLocation: v })}
                    error={missingEditErrors.lastSeenLocation}
                    inputClassName="h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Date missing *</label>
                  <input
                    type="date"
                    value={missingEdit.dateMissing}
                    onChange={(e) => setMissingEdit({ ...missingEdit, dateMissing: e.target.value })}
                    max={new Date().toISOString().slice(0, 10)}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  />
                  {missingEditErrors.dateMissing && (
                    <p className="mt-1 text-xs text-rose-600">{missingEditErrors.dateMissing}</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Description *</label>
                  <textarea
                    rows={3}
                    value={missingEdit.description}
                    onChange={(e) => setMissingEdit({ ...missingEdit, description: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  />
                  {missingEditErrors.description && (
                    <p className="mt-1 text-xs text-rose-600">{missingEditErrors.description}</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Additional contact (optional)
                  </label>
                  <input
                    type="text"
                    value={missingEdit.contactInfo}
                    onChange={(e) =>
                      setMissingEdit({
                        ...missingEdit,
                        contactInfo: sanitizeAdditionalPhoneInput(e.target.value),
                      })
                    }
                    placeholder="10-digit number (optional)"
                    inputMode="numeric"
                    maxLength={10}
                    autoComplete="tel"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  />
                  {missingEditErrors.contactInfo && (
                    <p className="mt-1 text-xs text-rose-600">{missingEditErrors.contactInfo}</p>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Camera className="h-4 w-4" />
                  Replace photo (optional)
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm hover:bg-slate-100">
                    Choose image
                    <input
                      ref={missingEditPhotoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleMissingEditPhotoChange}
                      className="hidden"
                    />
                  </label>
                  {missingEditPreview ? (
                    <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200">
                      <img src={missingEditPreview} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setMissingEditPhoto(null);
                          setMissingEditPreview(missingEdit.existingPhotoUrl || null);
                          if (missingEditPhotoInputRef.current) missingEditPhotoInputRef.current.value = "";
                        }}
                        className="absolute -right-1 -top-1 rounded-full bg-white p-0.5 text-red-600 shadow"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : null}
                </div>
                {missingEditErrors.photo && (
                  <p className="mt-1 text-xs text-rose-600">{missingEditErrors.photo}</p>
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setMissingEdit(null);
                    setMissingEditPhoto(null);
                    setMissingEditPreview(null);
                    setMissingEditErrors({});
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingMissingEdit}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                >
                  {submittingMissingEdit ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Edit found person */}
      {foundEdit ? (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-found-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
            onClick={() => {
              setFoundEdit(null);
              setFoundEditPhoto(null);
              setFoundEditPreview(null);
              setFoundEditErrors({});
            }}
            aria-label="Close"
          />
          <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-4">
              <h2 id="edit-found-title" className="text-lg font-bold text-white">
                Edit found person report
              </h2>
              <button
                type="button"
                onClick={() => {
                  setFoundEdit(null);
                  setFoundEditPhoto(null);
                  setFoundEditPreview(null);
                  setFoundEditErrors({});
                }}
                className="rounded-full p-1 text-white/90 hover:bg-white/20"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateFound} className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Name (if known)</label>
                  <input
                    type="text"
                    value={foundEdit.name}
                    onChange={(e) =>
                      setFoundEdit({ ...foundEdit, name: sanitizeNameInput(e.target.value) })
                    }
                    placeholder="Leave blank for unknown"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                  {foundEditErrors.name && (
                    <p className="mt-1 text-xs text-rose-600">{foundEditErrors.name}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Gender (optional)</label>
                  <select
                    value={foundEdit.gender}
                    onChange={(e) => setFoundEdit({ ...foundEdit, gender: e.target.value })}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="">Prefer not to say</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-binary">Non-binary</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Estimated age</label>
                  <input
                    type="number"
                    value={foundEdit.age}
                    onChange={(e) =>
                      setFoundEdit({ ...foundEdit, age: sanitizeAgeInput(e.target.value) })
                    }
                    min={0}
                    max={120}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                  {foundEditErrors.age && (
                    <p className="mt-1 text-xs text-rose-600">{foundEditErrors.age}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Location found *</label>
                  <LocationSuggestInput
                    label=""
                    value={foundEdit.locationFound}
                    onChange={(v) => setFoundEdit({ ...foundEdit, locationFound: v })}
                    error={foundEditErrors.locationFound}
                    inputClassName="h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Date found *</label>
                  <input
                    type="date"
                    value={foundEdit.dateFound}
                    onChange={(e) => setFoundEdit({ ...foundEdit, dateFound: e.target.value })}
                    max={new Date().toISOString().slice(0, 10)}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                  {foundEditErrors.dateFound && (
                    <p className="mt-1 text-xs text-rose-600">{foundEditErrors.dateFound}</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Description *</label>
                  <textarea
                    rows={3}
                    value={foundEdit.description}
                    onChange={(e) => setFoundEdit({ ...foundEdit, description: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                  {foundEditErrors.description && (
                    <p className="mt-1 text-xs text-rose-600">{foundEditErrors.description}</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Additional contact (optional)
                  </label>
                  <input
                    type="text"
                    value={foundEdit.contactInfo}
                    onChange={(e) =>
                      setFoundEdit({
                        ...foundEdit,
                        contactInfo: sanitizeAdditionalPhoneInput(e.target.value),
                      })
                    }
                    placeholder="10-digit number (optional)"
                    inputMode="numeric"
                    maxLength={10}
                    autoComplete="tel"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                  {foundEditErrors.contactInfo && (
                    <p className="mt-1 text-xs text-rose-600">{foundEditErrors.contactInfo}</p>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Camera className="h-4 w-4" />
                  Replace photo (optional)
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm hover:bg-slate-100">
                    Choose image
                    <input
                      ref={foundEditPhotoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFoundEditPhotoChange}
                      className="hidden"
                    />
                  </label>
                  {foundEditPreview ? (
                    <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200">
                      <img src={foundEditPreview} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setFoundEditPhoto(null);
                          setFoundEditPreview(foundEdit.existingPhotoUrl || null);
                          if (foundEditPhotoInputRef.current) foundEditPhotoInputRef.current.value = "";
                        }}
                        className="absolute -right-1 -top-1 rounded-full bg-white p-0.5 text-red-600 shadow"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : null}
                </div>
                {foundEditErrors.photo && (
                  <p className="mt-1 text-xs text-rose-600">{foundEditErrors.photo}</p>
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setFoundEdit(null);
                    setFoundEditPhoto(null);
                    setFoundEditPreview(null);
                    setFoundEditErrors({});
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingFoundEdit}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {submittingFoundEdit ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Found Match Modal (unchanged) */}
      {foundMatchModal ? (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="found-match-modal-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm transition-all duration-200"
            onClick={() => setFoundMatchModal(null)}
            aria-label="Close"
          />
          <div className="relative z-10 w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 animate-in zoom-in-95 fade-in duration-200">
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

            <div className="max-h-[calc(85vh-12rem)] overflow-y-auto px-4 py-5 sm:px-6">
              <div className="space-y-5">
                {foundMatchModal.matches.map((person) => (
                  <div
                    key={person.id}
                    className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-emerald-200"
                  >
                    <div className="flex flex-col sm:flex-row gap-4">
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

                        {(person.reporterName || person.ifYouSeePhone || person.contactInfo) && (
                          <div className="mt-3 rounded-lg border border-sky-100 bg-sky-50/50 px-3 py-2 text-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">If you see</p>
                            {person.reporterName && (
                              <p className="mt-1 flex items-center gap-1.5 text-slate-700">
                                <UserCircle className="h-3.5 w-3.5 text-sky-600" />
                                {person.reporterName}
                              </p>
                            )}
                            {(person.ifYouSeePhone || person.contactInfo) && (
                              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 font-medium text-slate-900">
                                <Phone className="h-3.5 w-3.5 text-sky-600" />
                                {formatContactCallDisplay(person.ifYouSeePhone, person.contactInfo)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {person.scoreBreakdown && (
                      <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/30 p-3">
                        <MatchScoreBreakdown breakdown={person.scoreBreakdown} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

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
          className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
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