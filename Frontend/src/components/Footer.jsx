"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  FileWarning,
  Heart,
  Phone,
  Mail,
  Shield,
  Building2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { GB, LK } from "country-flag-icons/react/3x2";

const quickLinks = [
  {
    href: "/alerts",
    labelKey: "nav.alerts",
    icon: AlertTriangle,
  },
  {
    href: "/incidents",
    labelKey: "nav.incidents",
    icon: FileWarning,
  },
  {
    href: "/shelters",
    labelKey: "nav.shelters",
    icon: Building2,
  },
];

function FooterLanguageSwitch() {
  const { t, i18n: i18nInstance } = useTranslation();
  const current = i18nInstance.language === "si" ? "si" : "en";
  const [flagsReady, setFlagsReady] = useState(false);

  useEffect(() => {
    setFlagsReady(true);
  }, []);

  function setLang(code) {
    const normalized = code === "si" ? "si" : "en";
    i18n.changeLanguage(normalized);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("dmews_lang", normalized);
    }
  }

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-2 sm:justify-end"
      role="group"
      aria-label={t("footer.language")}
    >
      <span className="text-xs font-medium text-sky-300/90">
        {t("footer.language")}
      </span>
      <button
        type="button"
        onClick={() => setLang("en")}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
          current === "en"
            ? "border-amber-400/60 bg-amber-500/20 text-amber-200"
            : "border-sky-600/50 bg-sky-900/40 text-sky-200 hover:border-sky-500 hover:bg-sky-800/50"
        }`}
      >
        {flagsReady ? (
          <GB title="" className="h-3 w-5 rounded-sm" />
        ) : (
          <span className="h-3 w-5 rounded-sm bg-sky-700" aria-hidden />
        )}
        {t("footer.english")}
      </button>
      <button
        type="button"
        onClick={() => setLang("si")}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
          current === "si"
            ? "border-amber-400/60 bg-amber-500/20 text-amber-200"
            : "border-sky-600/50 bg-sky-900/40 text-sky-200 hover:border-sky-500 hover:bg-sky-800/50"
        }`}
      >
        {flagsReady ? (
          <LK title="" className="h-3 w-5 rounded-sm" />
        ) : (
          <span className="h-3 w-5 rounded-sm bg-sky-700" aria-hidden />
        )}
        {t("footer.sinhala")}
      </button>
    </div>
  );
}

export function Footer() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");
  const year = new Date().getFullYear();

  const brandDesc = t("footer.brandDesc");
  const builtForCommunities = t("footer.builtForCommunities");
  const quickLinksTitle = t("footer.quickLinksTitle");
  const getHelpTitle = t("footer.getHelpTitle");
  const emergencyText = t("footer.emergency");
  const helpText = t("footer.helpText");
  const adminLoginLabel = t("footer.adminLogin");
  const footerBottomText = t("footer.copyright", { year });

  return (
    <footer className="relative mt-auto border-t border-sky-200/80 bg-gradient-to-b from-sky-800 via-sky-900 to-slate-900 text-sky-50">
      {/* Decorative wave */}
      <div className="absolute inset-x-0 top-0 h-12 overflow-hidden">
        <svg
          className="absolute h-full w-full"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M0,64 C300,120 600,0 900,64 C1050,96 1150,80 1200,64 L1200,120 L0,120 Z"
            fill="url(#footer-wave)"
          />
          <defs>
            <linearGradient id="footer-wave" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgb(226, 232, 240)" />
              <stop offset="50%" stopColor="rgb(14, 165, 233)" />
              <stop offset="100%" stopColor="rgb(2, 132, 199)" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pt-16 pb-8 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link
              href="/"
              className="inline-flex items-center gap-2 font-oswald text-xl font-semibold tracking-wide text-white"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                <Shield className="h-5 w-5 text-amber-300" />
              </span>
              DisasterWatch
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-sky-200/90">
              {brandDesc}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-200">
                <Heart className="h-3.5 w-3.5" />
                {builtForCommunities}
              </span>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="font-oswald text-sm font-semibold uppercase tracking-wider text-white">
              {quickLinksTitle}
            </h3>
            <ul className="mt-4 space-y-2">
              {quickLinks.map(({ href, labelKey, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="flex items-center gap-2 text-sm text-sky-200/90 transition hover:text-amber-300"
                  >
                    <Icon className="h-4 w-4 flex-shrink-0 opacity-80" />
                    {t(labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Get help */}
          <div>
            <h3 className="font-oswald text-sm font-semibold uppercase tracking-wider text-white">
              {getHelpTitle}
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-sky-200/90">
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 flex-shrink-0 text-amber-400/80" />
                <span>{emergencyText}</span>
              </li>
              <li className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400/80" />
                <span>{helpText}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center gap-6 border-t border-sky-700/60 pt-8 lg:flex-row lg:items-center lg:justify-between">
          <p className="order-2 text-center text-xs text-sky-300/80 lg:order-1 lg:text-left">
            {footerBottomText}
          </p>
          {!isAdminRoute && (
            <div className="order-1 w-full lg:order-2 lg:w-auto">
              <FooterLanguageSwitch />
            </div>
          )}
          <div className="order-3 flex items-center gap-6 text-xs">
            <Link
              href="/login"
              className="text-sky-300/80 transition hover:text-amber-300"
            >
              {adminLoginLabel}
            </Link>
            <span className="text-sky-600">·</span>
            <span className="text-sky-400/70">Sri Lanka</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
