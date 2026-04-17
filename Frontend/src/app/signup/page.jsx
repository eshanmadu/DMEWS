"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import Loader from "@/components/Loader";
import { AVATARS } from "@/lib/avatars";
import { SignupLanguageModal } from "@/components/SignupLanguageModal";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { formatLkCityLabel } from "@/lib/lkLocations";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const PENDING_TOKEN_KEY = "dmews_pending_token";
const PENDING_USER_KEY = "dmews_pending_user";

const BASIC_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Modern validation indicator — subtle, animated, integrated
function ValidIndicator() {
  return (
    <span
      className="pointer-events-none absolute right-3 top-1/2 z-10 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-emerald-500 animate-in fade-in slide-in-from-right-1 duration-200"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 16 16"
        className="h-4 w-4 drop-shadow-sm"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M3 8L6.5 11.5L13 5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function FieldWrap({ children, valid }) {
  // Clone child to add valid-specific styling
  const enhancedChild = valid
    ? React.cloneElement(children, {
        className: `${children.props.className || ""} 
          border-emerald-300 bg-emerald-50/30 
          focus:border-emerald-400 focus:ring-emerald-300/60 
          transition-all duration-200`,
      })
    : children;

  return (
    <div className="relative">
      {enhancedChild}
      {valid ? <ValidIndicator /> : null}
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const redirectPath = useMemo(() => {
    const next = searchParams.get("redirect");
    return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  }, [searchParams]);

  const [langModalOpen, setLangModalOpen] = useState(false);

  // Method: null | "email" | "google"
  const [method, setMethod] = useState(null);
  // Google flow: step 0 = sign-in, step 1 = profile completion
  const [googleStep, setGoogleStep] = useState(0);
  const [googleUser, setGoogleUser] = useState(null);
  const [googleAvatarMode, setGoogleAvatarMode] = useState("google");
  const [preferredLanguage, setPreferredLanguage] = useState("en");

  // Email flow fields
  const [name, setName] = useState("");
  const [districtsList, setDistrictsList] = useState([]);
  const [citiesList, setCitiesList] = useState([]);
  const [districtId, setDistrictId] = useState("");
  const [district, setDistrict] = useState("");
  const [cityRowId, setCityRowId] = useState("");
  const [city, setCity] = useState("");
  const [cityLatitude, setCityLatitude] = useState(null);
  const [cityLongitude, setCityLongitude] = useState(null);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsError, setLocationsError] = useState(null);
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatar, setAvatar] = useState("man1");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const avatars = AVATARS;
  const selectedAvatarSrc = useMemo(() => {
    const a = avatars.find((x) => x.id === avatar);
    return a?.src;
  }, [avatars, avatar]);

  const mobileDigits = mobile.replace(/\D/g, "");
  const emailValid = {
    name: ((name || "").match(/\S/g) || []).length >= 2,
    email: BASIC_EMAIL_RE.test((email || "").trim()),
    mobile: mobileDigits.length >= 9,
    password: (password || "").length >= 6,
    confirmPassword:
      (confirmPassword || "").length >= 6 && confirmPassword === password,
    district: Boolean(districtId),
    city: Boolean(cityRowId),
  };
  const googleValid = {
    district: Boolean(districtId),
    city: Boolean(cityRowId),
    mobile: mobileDigits.length >= 9,
    language: preferredLanguage === "en" || preferredLanguage === "si",
  };

  // Restore pending Google profile (when returning from OAuth redirect)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mode = searchParams.get("mode");
    if (mode !== "google-profile") return;

    const rawPending = window.localStorage.getItem(PENDING_USER_KEY);
    let pendingUser = null;
    try {
      pendingUser = rawPending ? JSON.parse(rawPending) : null;
    } catch {
      pendingUser = null;
    }

    setMethod("google");
    setGoogleStep(1);
    setGoogleUser(pendingUser);
    setName(pendingUser?.name || "");
    setEmail(pendingUser?.email || "");
    setMobile(pendingUser?.mobile || "");
    setDistrict(pendingUser?.district || "");
    setPreferredLanguage(window.localStorage.getItem("dmews_lang") || "en");
    setCity(pendingUser?.city || "");
    setCityLatitude(
      typeof pendingUser?.cityLatitude === "number" ? pendingUser.cityLatitude : null
    );
    setCityLongitude(
      typeof pendingUser?.cityLongitude === "number" ? pendingUser.cityLongitude : null
    );
    setCityRowId("");
  }, [searchParams]);

  useEffect(() => {
    const need = method === "email" || (method === "google" && googleStep === 1);
    if (!need) return;
    let cancelled = false;
    (async () => {
      setLocationsLoading(true);
      setLocationsError(null);
      try {
        const res = await fetch(`${API_BASE}/locations/sri-lanka/districts`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.message || "Failed to load districts.");
        }
        const list = Array.isArray(data?.districts) ? data.districts : [];
        const sorted = [...list].sort((a, b) =>
          String(a.name_en || "").localeCompare(String(b.name_en || ""))
        );
        if (!cancelled) setDistrictsList(sorted);
      } catch (e) {
        if (!cancelled) setLocationsError(e?.message || "Failed to load districts.");
      } finally {
        if (!cancelled) setLocationsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [method, googleStep]);

  useEffect(() => {
    if (!districtId) {
      setCitiesList([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLocationsLoading(true);
      setLocationsError(null);
      try {
        const res = await fetch(
          `${API_BASE}/locations/sri-lanka/cities?district=${encodeURIComponent(districtId)}`
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.message || "Failed to load cities.");
        }
        const list = Array.isArray(data?.cities) ? data.cities : [];
        const sorted = [...list].sort((a, b) =>
          String(a.name_en || "").localeCompare(String(b.name_en || ""))
        );
        if (!cancelled) setCitiesList(sorted);
      } catch (e) {
        if (!cancelled) setLocationsError(e?.message || "Failed to load cities.");
        if (!cancelled) setCitiesList([]);
      } finally {
        if (!cancelled) setLocationsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [districtId]);

  useEffect(() => {
    if (!districtsList.length || !district || districtId) return;
    const match = districtsList.find((d) => d.name_en === district);
    if (match) setDistrictId(String(match.id));
  }, [districtsList, district, districtId]);

  useEffect(() => {
    if (!citiesList.length || !city || cityLatitude == null) return;
    const match = citiesList.find(
      (c) =>
        formatLkCityLabel(c) === city &&
        typeof c.latitude === "number" &&
        Math.abs(c.latitude - cityLatitude) < 1e-5
    );
    if (match) setCityRowId(String(match.id));
  }, [citiesList, city, cityLatitude]);

  function resetAll() {
    setError(null);
    setLoading(false);
    setGoogleLoading(false);
    setMethod(null);
    setGoogleStep(0);
    setGoogleUser(null);
    setGoogleAvatarMode("google");
    setPreferredLanguage("en");
    setName("");
    setDistrictId("");
    setDistrict("");
    setCityRowId("");
    setCity("");
    setCityLatitude(null);
    setCityLongitude(null);
    setLocationsError(null);
    setEmail("");
    setMobile("");
    setPassword("");
    setConfirmPassword("");
    setAvatar("man1");
  }

  async function handleGoogleIdToken(idToken) {
    setError(null);
    setGoogleLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Google sign-in failed.");
        return;
      }

      if (typeof window !== "undefined") {
        if (data?.profileComplete) {
          if (data?.token) window.localStorage.setItem("dmews_token", data.token);
          if (data?.user) window.localStorage.setItem("dmews_user", JSON.stringify(data.user));
          if (data?.user?.district)
            window.localStorage.setItem("dmews_user_district", data.user.district);
          window.localStorage.removeItem(PENDING_TOKEN_KEY);
          window.localStorage.removeItem(PENDING_USER_KEY);
          window.dispatchEvent(new Event("dmews-auth-changed"));
          router.push(redirectPath);
          return;
        } else {
          if (data?.token) window.localStorage.setItem(PENDING_TOKEN_KEY, data.token);
          if (data?.user) window.localStorage.setItem(PENDING_USER_KEY, JSON.stringify(data.user));
          window.localStorage.removeItem("dmews_token");
          window.localStorage.removeItem("dmews_user");
          window.localStorage.removeItem("dmews_user_district");
        }
      }

      setGoogleUser(data?.user || null);
      setName(data?.user?.name || "");
      setEmail(data?.user?.email || "");
      setMobile(data?.user?.mobile || "");
      setDistrict(data?.user?.district || "");
      setCity(data?.user?.city || "");
      setCityLatitude(
        typeof data?.user?.cityLatitude === "number" ? data.user.cityLatitude : null
      );
      setCityLongitude(
        typeof data?.user?.cityLongitude === "number" ? data.user.cityLongitude : null
      );
      setCityRowId("");
      setDistrictId("");
      setPreferredLanguage(
        (typeof window !== "undefined" && window.localStorage.getItem("dmews_lang")) || "en"
      );
      setMethod("google");
      setGoogleStep(1);
    } catch {
      setError(t("signupPage.networkError"));
    } finally {
      setGoogleLoading(false);
    }
  }

  async function submitGoogleProfile(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem(PENDING_TOKEN_KEY) ||
            window.localStorage.getItem("dmews_token")
          : null;
      if (!token) {
        setError("Session expired. Please sign in with Google again.");
        setMethod(null);
        setGoogleStep(0);
        return;
      }

      const payload = {
        mobile: String(mobile || "").replace(/\D/g, "").slice(0, 10),
        district,
        city,
        cityLatitude,
        cityLongitude,
        preferredLanguage,
        avatar:
          googleAvatarMode === "google"
            ? (googleUser?.avatar || "")
            : (selectedAvatarSrc ? selectedAvatarSrc : ""),
      };

      const res = await fetch(`${API_BASE}/auth/complete-profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Failed to complete profile.");
        return;
      }

      if (typeof window !== "undefined") {
        if (data?.token) window.localStorage.setItem("dmews_token", data.token);
        if (data?.user) window.localStorage.setItem("dmews_user", JSON.stringify(data.user));
        if (data?.user?.district)
          window.localStorage.setItem("dmews_user_district", data.user.district);
        window.localStorage.removeItem(PENDING_TOKEN_KEY);
        window.localStorage.removeItem(PENDING_USER_KEY);
        if (preferredLanguage) window.localStorage.setItem("dmews_lang", preferredLanguage);
        window.dispatchEvent(new Event("dmews-auth-changed"));
      }

      router.push(redirectPath);
    } catch {
      setError(t("signupPage.networkError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSubmit(e) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t("signupPage.passwordMismatch"));
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          district,
          city,
          cityLatitude,
          cityLongitude,
          email,
          mobile: mobile.trim() || undefined,
          password,
          avatar,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message || t("signupPage.fail"));
      } else {
        router.push("/login");
      }
    } catch {
      setError(t("signupPage.networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SignupLanguageModal
        open={langModalOpen}
        onSelected={() => setLangModalOpen(false)}
      />

      <div
        className={`mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center px-4 transition-[filter,opacity] duration-300 sm:px-6 lg:px-8 ${
          langModalOpen
            ? "pointer-events-none select-none opacity-40 blur-[3px]"
            : "opacity-100 blur-0"
        }`}
        aria-hidden={langModalOpen}
      >
        <div className="grid w-full gap-6 rounded-2xl bg-white/80 shadow-lg ring-1 ring-slate-200 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.1fr)]">
          {/* Left Panel */}
          <div className="hidden flex-col justify-center rounded-l-2xl bg-gradient-to-br from-sky-700 via-sky-600 to-sky-700 px-6 py-8 text-sky-50 sm:flex">
            <h1 className="font-oswald font-bold text-3xl tracking-wide">
              {t("signupPage.heroTitle")}
            </h1>
            <h2 className="mt-2 text-sm font-semibold uppercase tracking-wide text-sky-100">
              {t("signupPage.heroSubtitle")}
            </h2>
            <p className="mt-3 text-sm text-sky-100/90">
              {t("signupPage.heroBody")}
            </p>
          </div>

          {/* Right Panel */}
          <div className="px-6 py-8 sm:px-8">
            <h1 className="text-xl font-semibold text-slate-950">
              {t("signupPage.title")}
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              {t("signupPage.subtitle")}
            </p>

            {/* Step Indicator (only for Google flow) */}
            {method === "google" && (
              <div className="mt-5 flex items-center gap-2">
                <div className="flex flex-1 items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold ${
                      googleStep === 1
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-sky-400 bg-sky-50 text-sky-700"
                    }`}
                  >
                    1
                  </div>
                  <div
                    className={`text-xs font-semibold ${
                      googleStep === 1 ? "text-slate-500" : "text-slate-900"
                    }`}
                  >
                    Sign in with Google
                  </div>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
                <div className="flex flex-1 items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold ${
                      googleStep === 1
                        ? "border-sky-400 bg-sky-50 text-sky-700"
                        : "border-slate-200 bg-white text-slate-400"
                    }`}
                  >
                    2
                  </div>
                  <div
                    className={`text-xs font-semibold ${
                      googleStep === 1 ? "text-slate-900" : "text-slate-500"
                    }`}
                  >
                    Complete profile
                  </div>
                </div>
              </div>
            )}

            {/* Initial method selection */}
            {method === null && (
              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMethod("google");
                    setGoogleStep(0);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:border-sky-300 hover:bg-sky-50/60"
                >
                  <span className="inline-flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                      <path
                        fill="#EA4335"
                        d="M12 10.2v3.9h5.5c-.2 1.2-1.4 3.5-5.5 3.5-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C17 2.9 14.7 2 12 2 6.9 2 2.8 6.1 2.8 11.2S6.9 20.4 12 20.4c6.9 0 9.1-4.8 9.1-7.3 0-.5 0-.8-.1-1.2H12z"
                      />
                    </svg>
                    <span>Sign up with Google</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMethod("email");
                    setLangModalOpen(true);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:border-sky-300 hover:bg-sky-50/60"
                >
                  <span className="inline-flex items-center gap-2">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-5 w-5 text-slate-700"
                      aria-hidden="true"
                    >
                      <path
                        d="M4 6.5h16A1.5 1.5 0 0 1 21.5 8v8A1.5 1.5 0 0 1 20 17.5H4A1.5 1.5 0 0 1 2.5 16V8A1.5 1.5 0 0 1 4 6.5Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <path
                        d="m3 8 8.1 5.4a1.5 1.5 0 0 0 1.8 0L21 8"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    </svg>
                    <span>Sign up with Email & Password</span>
                  </span>
                </button>
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {error}
                  </div>
                )}
              </div>
            )}

            {/* Google Step 0: Sign in with Google */}
            {method === "google" && googleStep === 0 && (
              <div className="mt-6 space-y-3">
                <GoogleSignInButton
                  disabled={googleLoading || loading || langModalOpen}
                  onIdToken={handleGoogleIdToken}
                />
                {googleLoading && (
                  <div className="flex items-center justify-center text-xs text-slate-500">
                    <Loader size="sm" className="mr-2" /> Signing up with Google...
                  </div>
                )}
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {error}
                  </div>
                )}
                <button
                  type="button"
                  onClick={resetAll}
                  className="w-full rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Back
                </button>
              </div>
            )}

            {/* Google Step 1: Complete profile */}
            {method === "google" && googleStep === 1 && (
              <form onSubmit={submitGoogleProfile} className="mt-6 space-y-4">
                {/* Avatar selector */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        Profile photo
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        Choose your profile picture
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setGoogleAvatarMode("google")}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                          googleAvatarMode === "google"
                            ? "border-sky-500 bg-sky-50 text-sky-800"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        Google photo
                      </button>
                      <button
                        type="button"
                        onClick={() => setGoogleAvatarMode("avatar")}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                          googleAvatarMode === "avatar"
                            ? "border-sky-500 bg-sky-50 text-sky-800"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        Avatar
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <div className="relative h-14 w-14 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                      {googleAvatarMode === "google" && googleUser?.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={googleUser.avatar}
                          alt="Google profile"
                          className="h-full w-full object-cover"
                        />
                      ) : selectedAvatarSrc ? (
                        <Image
                          src={selectedAvatarSrc}
                          alt="Selected avatar"
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-slate-200" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {googleUser?.name || name || "User"}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {googleUser?.email || email}
                      </div>
                    </div>
                  </div>

                  {googleAvatarMode === "avatar" && (
                    <div className="mt-4 grid grid-cols-4 gap-3">
                      {avatars.map((a) => {
                        const selected = avatar === a.id;
                        return (
                          <button
                            key={a.id}
                            type="button"
                            title={a.label}
                            onClick={() => setAvatar(a.id)}
                            className={`flex items-center justify-center rounded-xl border p-2 transition ${
                              selected
                                ? "border-sky-500 bg-sky-50 shadow-sm"
                                : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/60"
                            }`}
                          >
                            <div className="relative h-10 w-10 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                              <Image
                                src={a.src}
                                alt={a.label}
                                fill
                                sizes="40px"
                                className="object-cover"
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* District & city */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {t("signupPage.district")}
                  </label>
                  <FieldWrap valid={googleValid.district}>
                    <select
                      required
                      value={districtId}
                      disabled={locationsLoading || !!locationsError}
                      onChange={(e) => {
                        const id = e.target.value;
                        setDistrictId(id);
                        setCityRowId("");
                        setCity("");
                        setCityLatitude(null);
                        setCityLongitude(null);
                        if (!id) {
                          setDistrict("");
                          return;
                        }
                        const d = districtsList.find((x) => String(x.id) === String(id));
                        setDistrict(d?.name_en || "");
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-10 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-400/60 disabled:opacity-60"
                    >
                      <option value="">{t("signupPage.selectDistrict")}</option>
                      {districtsList.map((d) => (
                        <option key={d.id} value={String(d.id)}>
                          {d.name_en}
                        </option>
                      ))}
                    </select>
                  </FieldWrap>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {t("signupPage.city")}
                  </label>
                  <FieldWrap valid={googleValid.city}>
                    <select
                      required
                      value={cityRowId}
                      disabled={
                        !districtId || locationsLoading || !!locationsError || citiesList.length === 0
                      }
                      onChange={(e) => {
                        const id = e.target.value;
                        setCityRowId(id);
                        if (!id) {
                          setCity("");
                          setCityLatitude(null);
                          setCityLongitude(null);
                          return;
                        }
                        const c = citiesList.find((x) => String(x.id) === String(id));
                        if (!c) return;
                        setCity(formatLkCityLabel(c));
                        setCityLatitude(
                          typeof c.latitude === "number" ? c.latitude : null
                        );
                        setCityLongitude(
                          typeof c.longitude === "number" ? c.longitude : null
                        );
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-10 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-400/60 disabled:opacity-60"
                    >
                      <option value="">{t("signupPage.selectCity")}</option>
                      {citiesList.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {formatLkCityLabel(c)}
                        </option>
                      ))}
                    </select>
                  </FieldWrap>
                </div>
                {locationsLoading && (
                  <p className="text-xs text-slate-500">{t("signupPage.loadingLocations")}</p>
                )}
                {locationsError && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    {locationsError}
                  </div>
                )}

                {/* Language */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Language
                  </label>
                  <FieldWrap valid={googleValid.language}>
                    <div className="mt-2 grid gap-2 pr-10 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setPreferredLanguage("en")}
                        className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                          preferredLanguage === "en"
                            ? "border-sky-500 bg-sky-50 text-sky-900"
                            : "border-slate-200 bg-white text-slate-800 hover:border-sky-300 hover:bg-sky-50/60"
                        }`}
                      >
                        English
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreferredLanguage("si")}
                        className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                          preferredLanguage === "si"
                            ? "border-sky-500 bg-sky-50 text-sky-900"
                            : "border-slate-200 bg-white text-slate-800 hover:border-sky-300 hover:bg-sky-50/60"
                        }`}
                      >
                        සිංහල
                      </button>
                    </div>
                  </FieldWrap>
                </div>

                {/* Phone number */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {t("signupPage.mobile")}
                  </label>
                  <FieldWrap valid={googleValid.mobile}>
                    <input
                      type="tel"
                      required
                      value={mobile}
                      onChange={(e) =>
                        setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-10 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-400/60"
                      placeholder={t("signupPage.mobilePlaceholder")}
                    />
                  </FieldWrap>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || locationsLoading || !!locationsError}
                  className="btn-primary flex w-full items-center justify-center rounded-full disabled:opacity-70"
                >
                  {loading && <Loader size="sm" className="mr-2" />}
                  <span>{loading ? "Saving..." : "Complete signup"}</span>
                </button>

                <button
                  type="button"
                  onClick={resetAll}
                  className="w-full rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Start over
                </button>
              </form>
            )}

            {/* Email & Password flow */}
            {method === "email" && (
              <>
                <div className="mt-5 flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Email signup
                  </div>
                  <button
                    type="button"
                    onClick={resetAll}
                    className="text-xs font-semibold text-sky-700 hover:text-sky-500"
                  >
                    Change method
                  </button>
                </div>

                <form onSubmit={handleEmailSubmit} className="mt-6 space-y-4">
                  {/* Avatar Selection */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {t("signupPage.profilePicture")}
                    </label>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {t("signupPage.avatarHint")}
                    </p>
                    <div className="mt-3 grid grid-cols-4 gap-3">
                      {avatars.map((a) => {
                        const selected = avatar === a.id;
                        return (
                          <button
                            key={a.id}
                            type="button"
                            title={a.label}
                            onClick={() => setAvatar(a.id)}
                            className={`flex items-center justify-center rounded-xl border p-2 transition ${
                              selected
                                ? "border-sky-500 bg-sky-50 shadow-sm"
                                : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/60"
                            }`}
                          >
                            <div className="relative h-12 w-12 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                              <Image
                                src={a.src}
                                alt={a.label}
                                fill
                                sizes="48px"
                                className="object-cover"
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {t("signupPage.name")}
                    </label>
                    <FieldWrap valid={emailValid.name}>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-10 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-400/60"
                        placeholder={t("signupPage.namePlaceholder")}
                      />
                    </FieldWrap>
                  </div>

                  {/* District & city */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {t("signupPage.district")}
                    </label>
                    <FieldWrap valid={emailValid.district}>
                      <select
                        required
                        value={districtId}
                        disabled={locationsLoading || !!locationsError}
                        onChange={(e) => {
                          const id = e.target.value;
                          setDistrictId(id);
                          setCityRowId("");
                          setCity("");
                          setCityLatitude(null);
                          setCityLongitude(null);
                          if (!id) {
                            setDistrict("");
                            return;
                          }
                          const d = districtsList.find((x) => String(x.id) === String(id));
                          setDistrict(d?.name_en || "");
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-10 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-400/60 disabled:opacity-60"
                      >
                        <option value="">{t("signupPage.selectDistrict")}</option>
                        {districtsList.map((d) => (
                          <option key={d.id} value={String(d.id)}>
                            {d.name_en}
                          </option>
                        ))}
                      </select>
                    </FieldWrap>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {t("signupPage.city")}
                    </label>
                    <FieldWrap valid={emailValid.city}>
                      <select
                        required
                        value={cityRowId}
                        disabled={
                          !districtId ||
                          locationsLoading ||
                          !!locationsError ||
                          citiesList.length === 0
                        }
                        onChange={(e) => {
                          const id = e.target.value;
                          setCityRowId(id);
                          if (!id) {
                            setCity("");
                            setCityLatitude(null);
                            setCityLongitude(null);
                            return;
                          }
                          const c = citiesList.find((x) => String(x.id) === String(id));
                          if (!c) return;
                          setCity(formatLkCityLabel(c));
                          setCityLatitude(
                            typeof c.latitude === "number" ? c.latitude : null
                          );
                          setCityLongitude(
                            typeof c.longitude === "number" ? c.longitude : null
                          );
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-10 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-400/60 disabled:opacity-60"
                      >
                        <option value="">{t("signupPage.selectCity")}</option>
                        {citiesList.map((c) => (
                          <option key={c.id} value={String(c.id)}>
                            {formatLkCityLabel(c)}
                          </option>
                        ))}
                      </select>
                    </FieldWrap>
                  </div>
                  {locationsLoading && (
                    <p className="text-xs text-slate-500">{t("signupPage.loadingLocations")}</p>
                  )}
                  {locationsError && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      {locationsError}
                    </div>
                  )}

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {t("signupPage.email")}
                    </label>
                    <FieldWrap valid={emailValid.email}>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-10 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-400/60"
                        placeholder={t("loginPage.emailPlaceholder")}
                      />
                    </FieldWrap>
                  </div>

                  {/* Mobile */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {t("signupPage.mobile")}
                    </label>
                    <FieldWrap valid={emailValid.mobile}>
                      <input
                        type="tel"
                        value={mobile}
                        onChange={(e) =>
                          setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-10 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-400/60"
                        placeholder={t("signupPage.mobilePlaceholder")}
                      />
                    </FieldWrap>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {t("signupPage.password")}
                    </label>
                    <FieldWrap valid={emailValid.password}>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-10 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-400/60"
                        placeholder={t("signupPage.passwordPlaceholder")}
                      />
                    </FieldWrap>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {t("signupPage.confirmPassword")}
                    </label>
                    <FieldWrap valid={emailValid.confirmPassword}>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-10 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-400/60"
                        placeholder={t("signupPage.confirmPlaceholder")}
                      />
                    </FieldWrap>
                  </div>

                  {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || langModalOpen || locationsLoading || !!locationsError}
                    className="btn-primary flex w-full items-center justify-center rounded-full disabled:opacity-70"
                  >
                    {loading && <Loader size="sm" className="mr-2" />}
                    <span>
                      {loading
                        ? t("signupPage.submitting")
                        : t("signupPage.submit")}
                    </span>
                  </button>
                </form>
              </>
            )}

            <p className="mt-4 text-center text-xs text-slate-500">
              {t("signupPage.hasAccount")}{" "}
              <a
                href="/login"
                className="font-semibold text-sky-700 hover:text-sky-500"
              >
                {t("signupPage.loginLink")}
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}