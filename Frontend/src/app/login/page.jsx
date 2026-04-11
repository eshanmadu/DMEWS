"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useTranslation } from "react-i18next";
import Loader from "@/components/Loader";
import { AuthLanguageStep } from "@/components/AuthLanguageStep";
import welcomeAnimation from "@/img/Welcome.json";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const [step, setStep] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState(null);
  const [forgotInfo, setForgotInfo] = useState(null);

  // New state for success confirmation modal after password reset
  const [showSuccessConfirm, setShowSuccessConfirm] = useState(false);
  const [resetConfirmEmail, setResetConfirmEmail] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("dmews_lang");
    setStep(saved ? "form" : "lang");
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (email === "admin@admin.com" && password === "admin@123") {
        // Dev: get a real JWT from the API so SOS / volunteer admin routes work.
        if (process.env.NODE_ENV === "development") {
          try {
            const devRes = await fetch(`${API_BASE}/auth/dev-admin-token`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            });
            const devData = await devRes.json().catch(() => ({}));
            if (devRes.ok && devData?.token && typeof window !== "undefined") {
              window.localStorage.setItem("dmews_token", devData.token);
              window.localStorage.setItem("dmews_role", "admin");
              const adminUser = devData.user || {
                id: "dev-admin-session",
                name: "Admin",
                email: devData.email || "admin@admin.com",
                district: "Colombo",
              };
              window.localStorage.setItem("dmews_user", JSON.stringify(adminUser));
              window.localStorage.setItem(
                "dmews_user_district",
                adminUser.district || "Colombo"
              );
              window.dispatchEvent(new Event("dmews-auth-changed"));
              router.push("/admin");
              setLoading(false);
              return;
            }
            setError(
              devData?.message ||
                "Dev admin JWT failed. In Backend/.env set ALLOW_DEV_ADMIN_JWT=true, set ADMIN_EMAILS=admin@admin.com (or ALLOW_VOLUNTEER_ADMIN_ANY_USER=true), restart the API, then try again."
            );
            setLoading(false);
            return;
          } catch {
            setError(
              "Cannot reach the API for a dev admin token. Start the backend, then try again."
            );
            setLoading(false);
            return;
          }
        }

        // Production (or if dev path skipped above): legacy shortcut without API token
        if (typeof window !== "undefined") {
          const adminUser = {
            id: "admin",
            name: "Admin",
            email: "admin@admin.com",
            district: "Colombo",
          };
          window.localStorage.setItem("dmews_role", "admin");
          window.localStorage.setItem("dmews_user", JSON.stringify(adminUser));
          window.localStorage.setItem(
            "dmews_user_district",
            adminUser.district
          );
        }
        window.dispatchEvent(new Event("dmews-auth-changed"));
        router.push("/admin");
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || t("loginPage.fail"));
      } else {
        if (data?.token) {
          window.localStorage.setItem("dmews_token", data.token);
        }
        if (data?.user?.district) {
          window.localStorage.setItem("dmews_user_district", data.user.district);
        }
        if (data?.user) {
          window.localStorage.setItem("dmews_user", JSON.stringify(data.user));
        }
        window.dispatchEvent(new Event("dmews-auth-changed"));
        const next = searchParams.get("redirect");
        const safe =
          next && next.startsWith("/") && !next.startsWith("//")
            ? next
            : "/";
        router.push(safe);
      }
    } catch (err) {
      setError(t("loginPage.networkError"));
    } finally {
      setLoading(false);
    }
  }

  function openForgotModal() {
    setForgotEmail(email);
    setForgotStep("email");
    setForgotOtp("");
    setForgotNewPassword("");
    setForgotConfirmPassword("");
    setForgotError(null);
    setForgotInfo(null);
    setForgotOpen(true);
  }

  function closeForgotModal() {
    setForgotOpen(false);
    setForgotError(null);
    setForgotInfo(null);
  }

  async function handleForgotSendCode(e) {
    e.preventDefault();
    setForgotError(null);
    setForgotInfo(null);
    const addr = String(forgotEmail || "").trim();
    if (!addr) {
      setForgotError(t("loginPage.forgotEmailRequired"));
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addr }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setForgotError(data?.message || t("loginPage.networkError"));
        return;
      }
      setForgotInfo(data?.message || t("loginPage.forgotSent"));
      setForgotStep("reset");
    } catch {
      setForgotError(t("loginPage.networkError"));
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleForgotReset(e) {
    e.preventDefault();
    setForgotError(null);
    setForgotInfo(null);
    const addr = String(forgotEmail || "").trim();
    setForgotLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: addr,
          otp: forgotOtp,
          password: forgotNewPassword,
          confirmPassword: forgotConfirmPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setForgotError(data?.message || t("loginPage.networkError"));
        setForgotLoading(false);
        return;
      }
      // Success: close forgot modal and show beautiful confirmation modal
      closeForgotModal();                 // close the forgot password dialog
      setResetConfirmEmail(addr);        // remember email for main form
      setShowSuccessConfirm(true);       // show success confirmation box
      setForgotLoading(false);
    } catch {
      setForgotError(t("loginPage.networkError"));
      setForgotLoading(false);
    }
  }

  function handleConfirmOk() {
    if (resetConfirmEmail) {
      setEmail(resetConfirmEmail);       // pre-fill email on main login form
    }
    setShowSuccessConfirm(false);
    setResetConfirmEmail("");
  }

  if (step === null) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader size="md" />
      </div>
    );
  }

  if (step === "lang") {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="w-full rounded-2xl bg-white/80 px-6 py-8 shadow-lg ring-1 ring-slate-200 sm:px-8">
          <AuthLanguageStep onContinue={() => setStep("form")} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 rounded-2xl bg-white/80 shadow-lg ring-1 ring-slate-200 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.1fr)]">
        <div className="relative hidden flex-col justify-center rounded-l-2xl bg-gradient-to-br from-sky-700 via-sky-600 to-sky-700 px-4 py-4 sm:flex">
          <div className="pointer-events-none absolute inset-0 opacity-70">
            <Lottie
              animationData={welcomeAnimation}
              loop
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </div>

        <div className="px-6 py-8 sm:px-8">
          <h1 className="text-xl font-semibold text-slate-950">{t("loginPage.title")}</h1>
          <p className="mt-1 text-xs text-slate-500">{t("loginPage.subtitle")}</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                {t("loginPage.email")}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-400/60"
                placeholder={t("loginPage.emailPlaceholder")}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                {t("loginPage.password")}
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-400/60"
                placeholder={t("loginPage.passwordPlaceholder")}
              />
            </div>

            {searchParams.get("deleted") === "1" && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                Your account was deleted and all data you had added was removed.
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-start">
              <button
                type="button"
                onClick={openForgotModal}
                className="text-xs font-semibold text-sky-700 underline-offset-2 hover:text-sky-500 hover:underline"
              >
                {t("loginPage.forgotPassword")}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex w-full items-center justify-center rounded-full disabled:opacity-70"
            >
              {loading && <Loader size="sm" className="mr-2" />}
              <span>{loading ? t("loginPage.submitting") : t("loginPage.submit")}</span>
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-500">
            {t("loginPage.noAccount")}{" "}
            <a href="/signup" className="font-semibold text-sky-700 hover:text-sky-500">
              {t("loginPage.signUpLink")}
            </a>
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-dialog-title"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
            <button
              type="button"
              onClick={closeForgotModal}
              className="absolute right-4 top-4 rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              aria-label={t("loginPage.forgotClose")}
            >
              ×
            </button>
            <h2 id="forgot-dialog-title" className="text-lg font-semibold text-slate-950">
              {t("loginPage.forgotTitle")}
            </h2>
            <p className="mt-1 text-xs text-slate-500">{t("loginPage.forgotSubtitle")}</p>

            {forgotStep === "email" ? (
              <form onSubmit={handleForgotSendCode} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {t("loginPage.email")}
                  </label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-400/60"
                    placeholder={t("loginPage.emailPlaceholder")}
                  />
                </div>
                {forgotError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {forgotError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="btn-primary flex w-full items-center justify-center rounded-full disabled:opacity-70"
                >
                  {forgotLoading && <Loader size="sm" className="mr-2" />}
                  <span>
                    {forgotLoading
                      ? t("loginPage.forgotSending")
                      : t("loginPage.forgotSendCode")}
                  </span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleForgotReset} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {t("loginPage.email")}
                  </label>
                  <input
                    type="email"
                    readOnly
                    value={forgotEmail}
                    className="mt-1 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {t("loginPage.forgotOtp")}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    value={forgotOtp}
                    onChange={(e) =>
                      setForgotOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm tracking-widest text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-400/60"
                    placeholder={t("loginPage.forgotOtpPlaceholder")}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {t("loginPage.forgotNewPassword")}
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-400/60"
                    placeholder={t("signupPage.passwordPlaceholder")}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {t("loginPage.forgotConfirmPassword")}
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-400/60"
                    placeholder={t("signupPage.confirmPlaceholder")}
                  />
                </div>
                {forgotError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {forgotError}
                  </div>
                )}
                {forgotInfo && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    {forgotInfo}
                  </div>
                )}
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep("email");
                      setForgotError(null);
                      setForgotInfo(null);
                    }}
                    className="order-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:order-1"
                  >
                    {t("loginPage.forgotBack")}
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="btn-primary order-1 flex flex-1 items-center justify-center rounded-full disabled:opacity-70 sm:order-2"
                  >
                    {forgotLoading && <Loader size="sm" className="mr-2" />}
                    <span>
                      {forgotLoading
                        ? t("loginPage.forgotResetting")
                        : t("loginPage.forgotReset")}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Success Confirmation Modal after password reset */}
      {showSuccessConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl ring-1 ring-slate-200">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <svg
                className="h-8 w-8 text-emerald-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2
              id="confirm-dialog-title"
              className="text-xl font-semibold text-slate-950"
            >
              Password Updated!
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Your password has been reset successfully.
              <br />
              You can now log in with your new password.
            </p>
            <div className="mt-6">
              <button
                onClick={handleConfirmOk}
                className="inline-flex w-full items-center justify-center rounded-full bg-sky-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
              >
                OK
              </button>
            </div>
            <button
              type="button"
              onClick={handleConfirmOk}
              className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <Loader size="md" />
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}