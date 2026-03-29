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

        // Production (or if dev path above skipped): legacy shortcut without API token
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
