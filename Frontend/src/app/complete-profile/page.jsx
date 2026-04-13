"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import Loader from "@/components/Loader";
import i18n from "@/lib/i18n";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const PENDING_TOKEN_KEY = "dmews_pending_token";
const PENDING_USER_KEY = "dmews_pending_user";

const DISTRICTS = [
  "Colombo",
  "Gampaha",
  "Kalutara",
  "Kandy",
  "Matale",
  "Nuwara Eliya",
  "Galle",
  "Matara",
  "Hambantota",
  "Jaffna",
  "Kilinochchi",
  "Mannar",
  "Vavuniya",
  "Mullaitivu",
  "Batticaloa",
  "Ampara",
  "Trincomalee",
  "Kurunegala",
  "Puttalam",
  "Anuradhapura",
  "Polonnaruwa",
  "Badulla",
  "Monaragala",
  "Ratnapura",
  "Kegalle",
];

function setLang(code) {
  const normalized = code === "si" ? "si" : "en";
  i18n.changeLanguage(normalized);
  if (typeof window !== "undefined") {
    window.localStorage.setItem("dmews_lang", normalized);
  }
  return normalized;
}

export default function CompleteProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const tr = (key, fallback) => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  };

  const redirect = useMemo(() => {
    const next = searchParams.get("redirect");
    return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  }, [searchParams]);

  const [mobile, setMobile] = useState("");
  const [district, setDistrict] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("en");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token =
      window.localStorage.getItem(PENDING_TOKEN_KEY) ||
      window.localStorage.getItem("dmews_token");
    if (!token) {
      router.replace(`/login?redirect=${encodeURIComponent("/complete-profile")}`);
      return;
    }
    const savedLang = window.localStorage.getItem("dmews_lang");
    if (savedLang === "si" || savedLang === "en") {
      setPreferredLanguage(savedLang);
    }
  }, [router]);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const token =
        window.localStorage.getItem(PENDING_TOKEN_KEY) ||
        window.localStorage.getItem("dmews_token");
      if (!token) {
        router.replace(`/login?redirect=${encodeURIComponent("/complete-profile")}`);
        return;
      }

      const lang = setLang(preferredLanguage);

      const res = await fetch(`${API_BASE}/auth/complete-profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mobile: String(mobile || "").replace(/\D/g, "").slice(0, 10),
          district,
          preferredLanguage: lang,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Failed to complete profile.");
        return;
      }

      if (data?.token) window.localStorage.setItem("dmews_token", data.token);
      if (data?.user) window.localStorage.setItem("dmews_user", JSON.stringify(data.user));
      if (data?.user?.district)
        window.localStorage.setItem("dmews_user_district", data.user.district);
      window.localStorage.removeItem(PENDING_TOKEN_KEY);
      window.localStorage.removeItem(PENDING_USER_KEY);
      window.dispatchEvent(new Event("dmews-auth-changed"));

      router.replace(redirect);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="w-full rounded-2xl bg-white/80 px-6 py-8 shadow-lg ring-1 ring-slate-200 sm:px-8">
        <h1 className="text-xl font-semibold text-slate-950">
          {tr("completeProfile.title", "Complete your profile")}
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          {tr(
            "completeProfile.subtitle",
            "Before continuing, we need a few more details."
          )}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
              {tr("signupPage.mobile", "Mobile")}
            </label>
            <input
              type="tel"
              required
              value={mobile}
              onChange={(e) =>
                setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-400/60"
              placeholder={tr("signupPage.mobilePlaceholder", "e.g. 0771234567")}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
              {tr("signupPage.district", "District")}
            </label>
            <select
              required
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-400/60"
            >
              <option value="">
                {tr("signupPage.selectDistrict", "Select your district")}
              </option>
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
              {tr("completeProfile.language", "Language")}
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
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
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex w-full items-center justify-center rounded-full disabled:opacity-70"
          >
            {loading && <Loader size="sm" className="mr-2" />}
            <span>
              {loading
                ? tr("completeProfile.saving", "Saving...")
                : tr("completeProfile.continue", "Continue")}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}

