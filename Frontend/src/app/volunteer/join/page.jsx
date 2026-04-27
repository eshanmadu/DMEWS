"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle, Heart, Loader2, Shield, X } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const SKILL_OPTIONS = [
  "First Aid / Medical",
  "Search & Rescue",
  "Disaster Relief Distribution",
  "Technical Support / IT",
  "Drone Operation",
  "Communication / Coordination",
  "Logistics",
  "Counseling / Psychological Support",
  "General Volunteer",
];

const STEPS = [
  { id: 0, name: "Basic Info", shortName: "Info" },
  { id: 1, name: "Skills", shortName: "Skills" },
  { id: 2, name: "Health & Safety", shortName: "Health" },
  { id: 3, name: "Agreement", shortName: "Agree" },
];

const DOB_CUTOFF = "2016-01-01";

function isValidTenDigitPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 10;
}

function isValidEmail(value) {
  const email = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidNic(value) {
  const nic = String(value || "").trim();
  if (!nic) return true;
  return /^\d{1,12}$/.test(nic);
}

export default function VolunteerJoinPage() {
  const { t } = useTranslation();

  const [token, setToken] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [volunteer, setVolunteer] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepError, setStepError] = useState("");

  const [form, setForm] = useState({
    fullName: "",
    dateOfBirth: "",
    gender: "",
    nicIdNumber: "",
    phoneNumber: "",
    emailAddress: "",
    districtCity: "",
    currentLocation: "",
    canTravelOtherDistricts: false,
    skills: [],
    medicalConditions: "",
    emergencyContactPerson: "",
    emergencyContactNumber: "",
    agreeSafetyGuidelines: false,
    agreeEmergencyContact: false,
  });

  const status = String(volunteer?.status || "").toLowerCase();
  const approved = status === "approved";
  const pending = status === "pending";
  const rejected = status === "rejected";

  // Validate current step
  const validateStep = (step) => {
    switch (step) {
      case 0: // Basic Information
        if (!form.fullName.trim()) return "Full name is required.";
        if (!form.dateOfBirth) return "Date of birth is required.";
        if (form.dateOfBirth >= DOB_CUTOFF)
          return "Date of birth must be before 2016-01-01.";
        if (!form.gender) return "Gender is required.";
        if (!isValidNic(form.nicIdNumber))
          return "NIC / ID number must contain digits only and be at most 12 digits.";
        if (!form.phoneNumber.trim()) return "Phone number is required.";
        if (!isValidTenDigitPhone(form.phoneNumber))
          return "Phone number must have exactly 10 digits.";
        if (!form.emailAddress.trim()) return "Email address is required.";
        if (!isValidEmail(form.emailAddress))
          return "Enter a valid email address (example: name@email.com).";
        if (!form.districtCity.trim()) return "District / City is required.";
        if (!form.currentLocation.trim()) return "Current location is required.";
        return "";
      case 1: // Skills & Expertise - optional
        return "";
      case 2: // Health & Safety
        if (!form.emergencyContactPerson.trim()) return "Emergency contact person is required.";
        if (!form.emergencyContactNumber.trim()) return "Emergency contact number is required.";
        if (!isValidTenDigitPhone(form.emergencyContactNumber))
          return "Emergency contact number must have exactly 10 digits.";
        return "";
      case 3: // Agreement
        if (!form.agreeSafetyGuidelines) return "You must agree to follow safety guidelines.";
        if (!form.agreeEmergencyContact) return "You must agree to be contacted during emergencies.";
        return "";
      default:
        return "";
    }
  };

  const handleNext = () => {
    const validationError = validateStep(currentStep);
    if (validationError) {
      setStepError(validationError);
      return;
    }
    setStepError("");
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setStepError("");
    }
  };

  const goToStep = (stepIndex) => {
    // Allow going to previous steps or current step (no skipping forward)
    if (stepIndex <= currentStep) {
      setCurrentStep(stepIndex);
      setStepError("");
    }
  };

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && showConfirmModal) {
        setShowConfirmModal(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showConfirmModal]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showConfirmModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showConfirmModal]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const tok = window.localStorage.getItem("dmews_token");
    setToken(tok || null);
    setAuthChecked(true);

    async function loadVolunteer(tkn) {
      try {
        const res = await fetch(`${API_BASE}/volunteers/me`, {
          headers: { Authorization: `Bearer ${tkn}` },
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.volunteer) {
          setVolunteer(data.volunteer);
          setForm((prev) => ({
            ...prev,
            fullName: data.volunteer.fullName || prev.fullName || "",
            dateOfBirth: data.volunteer.dateOfBirth
              ? String(data.volunteer.dateOfBirth).slice(0, 10)
              : prev.dateOfBirth || "",
            gender: data.volunteer.gender || prev.gender || "",
            nicIdNumber: data.volunteer.nicIdNumber || "",
            phoneNumber: data.volunteer.phoneNumber || prev.phoneNumber || "",
            emailAddress: data.volunteer.emailAddress || prev.emailAddress || "",
            districtCity: data.volunteer.districtCity || prev.districtCity || "",
            currentLocation: data.volunteer.currentLocation || "",
            canTravelOtherDistricts: Boolean(
              data.volunteer.canTravelOtherDistricts
            ),
            skills: Array.isArray(data.volunteer.skills)
              ? data.volunteer.skills
              : [],
            medicalConditions: data.volunteer.medicalConditions || "",
            emergencyContactPerson: data.volunteer.emergencyContactPerson || "",
            emergencyContactNumber: data.volunteer.emergencyContactNumber || "",
            agreeSafetyGuidelines: Boolean(data.volunteer.agreeSafetyGuidelines),
            agreeEmergencyContact: Boolean(data.volunteer.agreeEmergencyContact),
          }));
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }

    if (tok) loadVolunteer(tok);
    else setLoading(false);

    try {
      const rawUser = window.localStorage.getItem("dmews_user");
      const user = rawUser ? JSON.parse(rawUser) : null;
      if (user) {
        setForm((prev) => ({
          ...prev,
          fullName: prev.fullName || user.name || "",
          phoneNumber: prev.phoneNumber || user.mobile || "",
          emailAddress: prev.emailAddress || user.email || "",
          districtCity: prev.districtCity || user.district || "",
        }));
      }
    } catch {
      // ignore
    }
  }, []);

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  const validateEntireForm = () => {
    for (let i = 0; i < STEPS.length; i += 1) {
      const validationError = validateStep(i);
      if (validationError) {
        return { step: i, message: validationError };
      }
    }
    return null;
  };

  function toggleSkill(skill) {
    setForm((prev) => {
      const has = prev.skills.includes(skill);
      return {
        ...prev,
        skills: has
          ? prev.skills.filter((s) => s !== skill)
          : [...prev.skills, skill],
      };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!token) return;
    const formValidation = validateEntireForm();
    if (formValidation) {
      setCurrentStep(formValidation.step);
      setStepError(formValidation.message);
      return;
    }
    setError("");
    setStepError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/volunteers/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Could not submit your request.");
      } else {
        setShowConfirmModal(true);
        if (data?.volunteer) setVolunteer(data.volunteer);
        if (data?.user && typeof window !== "undefined") {
          window.localStorage.setItem("dmews_user", JSON.stringify(data.user));
          window.dispatchEvent(new Event("dmews-auth-changed"));
        }
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-oswald text-2xl font-bold text-slate-900 sm:text-3xl">
            {t("volunteerHub.applyTitle")}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {t("volunteerHub.applyIntro")}
          </p>
        </div>
        <Link
          href="/volunteer"
          className="text-sm font-semibold text-sky-700 hover:underline"
        >
          ← Back
        </Link>
      </div>

      {!token ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-md">
          <p className="text-slate-700">{t("volunteerHub.needLoginApply")}</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/login?redirect=/volunteer/join"
              className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-500"
            >
              {t("volunteerHub.loginToApply")}
            </Link>
            <Link
              href="/signup?redirect=/volunteer/join"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              {t("volunteerHub.signupToApply")}
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-sky-200/80 bg-white shadow-lg">
          <div className="bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 px-6 py-6 text-white">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
                <Heart className="h-7 w-7" />
              </span>
              <div>
                <p className="font-oswald text-lg font-semibold tracking-wide">
                  {t("volunteerHub.applyTitle")}
                </p>
                <p className="mt-0.5 text-sm text-rose-50/95">
                  {t("volunteerHub.applyIntro")}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-6 sm:p-8">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
              </div>
            ) : approved ? (
              <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-emerald-900">
                <CheckCircle className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">You are a verified volunteer</p>
                  <p className="mt-1 text-sm text-emerald-800/90">
                    Thank you. A blue check appears next to your name in the
                    header.
                  </p>
                </div>
              </div>
            ) : pending ? (
              <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-amber-950">
                <Shield className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Application pending</p>
                  <p className="mt-1 text-sm text-amber-900/90">
                    An administrator will approve or reject your request. You
                    can update your details below while waiting.
                  </p>
                </div>
              </div>
            ) : rejected ? (
              <div className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-rose-950">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">
                    Previous request was not approved
                  </p>
                  <p className="mt-1 text-sm text-rose-900/90">
                    You can submit a new application below.
                  </p>
                </div>
              </div>
            ) : null}

            {!approved && (
              <>
                {/* Step Indicator Bar */}
                <div className="mb-6">
                  <div className="flex items-center justify-between">
                    {STEPS.map((step, idx) => (
                      <button
                        key={step.id}
                        onClick={() => goToStep(idx)}
                        disabled={idx > currentStep}
                        className={`relative flex flex-1 flex-col items-center transition-all ${
                          idx > currentStep
                            ? "cursor-not-allowed opacity-50"
                            : "cursor-pointer"
                        }`}
                      >
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                            idx === currentStep
                              ? "border-rose-600 bg-rose-600 text-white"
                              : idx < currentStep
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-slate-300 bg-white text-slate-500"
                          }`}
                        >
                          {idx < currentStep ? (
                            <CheckCircle className="h-5 w-5" />
                          ) : (
                            idx + 1
                          )}
                        </div>
                        <span className="mt-2 hidden text-xs font-medium text-slate-600 sm:block">
                          {step.name}
                        </span>
                        <span className="mt-2 block text-xs font-medium text-slate-600 sm:hidden">
                          {step.shortName}
                        </span>
                        {idx < STEPS.length - 1 && (
                          <div
                            className={`absolute left-1/2 top-5 h-[2px] w-full -translate-y-1/2 ${
                              idx < currentStep
                                ? "bg-emerald-500"
                                : "bg-slate-200"
                            }`}
                            style={{ left: "50%", width: "calc(100% - 2rem)" }}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Step 0: Basic Information */}
                  {currentStep === 0 && (
                    <div className="rounded-xl border border-slate-200 p-4 sm:p-5">
                      <h3 className="text-sm font-bold text-slate-900">
                        1. Basic Information
                      </h3>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Full Name *
                          </label>
                          <input
                            required
                            value={form.fullName}
                            readOnly
                            className="w-full rounded-xl border border-slate-300 bg-slate-100 px-4 py-2.5 text-sm text-slate-700"
                          />
                          <p className="mt-1 text-xs text-slate-500">
                            Name is taken from your profile and cannot be edited here.
                          </p>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Date of Birth *
                          </label>
                          <input
                            required
                            type="date"
                            value={form.dateOfBirth}
                            onChange={(e) => setField("dateOfBirth", e.target.value)}
                            max="2015-12-31"
                            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                          />
                          <p className="mt-1 text-xs text-slate-500">
                            
                          </p>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Gender *
                          </label>
                          <select
                            required
                            value={form.gender}
                            onChange={(e) => setField("gender", e.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                          >
                            <option value="">Select gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                            <option value="Prefer not to say">
                              Prefer not to say
                            </option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            NIC / ID Number (optional)
                          </label>
                          <input
                            value={form.nicIdNumber}
                            onChange={(e) =>
                              setField(
                                "nicIdNumber",
                                e.target.value.replace(/\D/g, "").slice(0, 12)
                              )
                            }
                            inputMode="numeric"
                            maxLength={12}
                            placeholder="Maximum 12 digits"
                            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                          />
                          <p className="mt-1 text-xs text-slate-500">
                            Enter digits only (up to 12).
                          </p>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Phone Number *
                          </label>
                          <input
                            required
                            type="tel"
                            value={form.phoneNumber}
                            onChange={(e) => setField("phoneNumber", e.target.value)}
                            inputMode="numeric"
                            maxLength={10}
                            placeholder="0712345678"
                            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                          />
                          <p className="mt-1 text-xs text-slate-500">
                           
                          </p>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Email Address *
                          </label>
                          <input
                            required
                            type="email"
                            value={form.emailAddress}
                            readOnly
                            placeholder="name@email.com"
                            className="w-full rounded-xl border border-slate-300 bg-slate-100 px-4 py-2.5 text-sm text-slate-700"
                          />
                          <p className="mt-1 text-xs text-slate-500">
                            Email is taken from your account and cannot be edited here.
                          </p>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            District / City *
                          </label>
                          <input
                            required
                            value={form.districtCity}
                            onChange={(e) => setField("districtCity", e.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Current Location *
                          </label>
                          <input
                            required
                            value={form.currentLocation}
                            onChange={(e) => setField("currentLocation", e.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                          />
                        </div>
                      </div>
                      <div className="mt-4">
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Can you travel to other districts?
                        </label>
                        <select
                          value={String(form.canTravelOtherDistricts)}
                          onChange={(e) =>
                            setField("canTravelOtherDistricts", e.target.value === "true")
                          }
                          className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm sm:w-60"
                        >
                          <option value="false">No</option>
                          <option value="true">Yes</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Step 1: Skills & Expertise */}
                  {currentStep === 1 && (
                    <div className="rounded-xl border border-slate-200 p-4 sm:p-5">
                      <h3 className="text-sm font-bold text-slate-900">
                        2. Skills & Expertise
                      </h3>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {SKILL_OPTIONS.map((skill) => (
                          <label
                            key={skill}
                            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={form.skills.includes(skill)}
                              onChange={() => toggleSkill(skill)}
                            />
                            <span>{skill}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 2: Health & Safety */}
                  {currentStep === 2 && (
                    <div className="rounded-xl border border-slate-200 p-4 sm:p-5">
                      <h3 className="text-sm font-bold text-slate-900">
                        3. Health & Safety
                      </h3>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Do you have any medical conditions? (optional)
                          </label>
                          <textarea
                            rows={3}
                            value={form.medicalConditions}
                            onChange={(e) => setField("medicalConditions", e.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Emergency Contact Person *
                          </label>
                          <input
                            required
                            value={form.emergencyContactPerson}
                            onChange={(e) => setField("emergencyContactPerson", e.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Emergency Contact Number *
                          </label>
                          <input
                            required
                            type="tel"
                            value={form.emergencyContactNumber}
                            onChange={(e) => setField("emergencyContactNumber", e.target.value)}
                            inputMode="numeric"
                            maxLength={10}
                            placeholder="0712345678"
                            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                          />
                          <p className="mt-1 text-xs text-slate-500">
                            Enter exactly 10 digits.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Agreement */}
                  {currentStep === 3 && (
                    <div className="rounded-xl border border-slate-200 p-4 sm:p-5">
                      <h3 className="text-sm font-bold text-slate-900">
                        4. Agreement
                      </h3>
                      <div className="mt-3 space-y-2 text-sm">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={form.agreeSafetyGuidelines}
                            onChange={(e) => setField("agreeSafetyGuidelines", e.target.checked)}
                          />
                          <span>
                            I agree to follow DisasterWatch safety guidelines. *
                          </span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={form.agreeEmergencyContact}
                            onChange={(e) => setField("agreeEmergencyContact", e.target.checked)}
                          />
                          <span>
                            I agree to be contacted during emergencies. *
                          </span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Step Error Display */}
                  {stepError && (
                    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {stepError}
                    </div>
                  )}

                  {/* Navigation Buttons */}
                  <div className="flex justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handlePrev}
                      disabled={currentStep === 0}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    {currentStep < STEPS.length - 1 ? (
                      <button
                        type="button"
                        onClick={handleNext}
                        className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500"
                      >
                        Next
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting…
                          </>
                        ) : pending ? (
                          "Update application"
                        ) : (
                          "Submit volunteer application"
                        )}
                      </button>
                    )}
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          aria-modal="true"
          role="dialog"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setShowConfirmModal(false)}
          />
          <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
            <div className="bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    Application Submitted
                  </h3>
                </div>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="rounded-full p-1 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="px-6 py-5">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle className="h-8 w-8 text-emerald-600" />
                </div>
              </div>
              <p className="text-center text-slate-700">
                {volunteer?.status === "pending"
                  ? "Your volunteer application has been successfully submitted. An administrator will review it and update the status shortly."
                  : "Your volunteer information has been saved successfully."}
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Continue Browsing
                </button>
                <Link
                  href="/volunteer"
                  onClick={() => setShowConfirmModal(false)}
                  className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500"
                >
                  View My Status
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}