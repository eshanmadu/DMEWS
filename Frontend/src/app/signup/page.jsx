"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import Loader from "@/components/Loader";
import { AVATARS } from "@/lib/avatars";
import { SignupLanguageModal } from "@/components/SignupLanguageModal";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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

export default function SignupPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const [langModalOpen, setLangModalOpen] = useState(true);

  const [name, setName] = useState("");
  const [district, setDistrict] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatar, setAvatar] = useState("man1");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const avatars = AVATARS;

  async function handleSubmit(e) {
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
            <h1 className="font-oswald text-3xl font-semibold tracking-wide">
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

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">

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
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-400/60"
                  placeholder={t("signupPage.namePlaceholder")}
                />
              </div>

              {/* District */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {t("signupPage.district")}
                </label>
                <select
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-400/60"
                >
                  <option value="">{t("signupPage.selectDistrict")}</option>
                  {DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {t("signupPage.email")}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-400/60"
                  placeholder={t("loginPage.emailPlaceholder")}
                />
              </div>

              {/* Mobile */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {t("signupPage.mobile")}
                </label>
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-400/60"
                  placeholder={t("signupPage.mobilePlaceholder")}
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {t("signupPage.password")}
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-400/60"
                  placeholder={t("signupPage.passwordPlaceholder")}
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {t("signupPage.confirmPassword")}
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-400/60"
                  placeholder={t("signupPage.confirmPlaceholder")}
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || langModalOpen}
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