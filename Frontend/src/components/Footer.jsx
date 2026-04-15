"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  FileWarning,
  Heart,
  Phone,
  Mail,
  Shield,
  Building2,
  Globe,
  ChevronDown,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  LifeBuoy,
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
  {
    href: "/help-support",
    labelKey: "nav.helpSupport",
    icon: LifeBuoy,
  },
];

const socialLinks = [
  {
    href: "https://facebook.com/disasterwatch",
    label: "Facebook",
    icon: Facebook,
  },
  {
    href: "https://twitter.com/disasterwatch",
    label: "Twitter",
    icon: Twitter,
  },
  {
    href: "https://instagram.com/disasterwatch",
    label: "Instagram",
    icon: Instagram,
  },
  {
    href: "https://linkedin.com/company/disasterwatch",
    label: "LinkedIn",
    icon: Linkedin,
  },
];

function FooterLanguageSwitch() {
  const { t, i18n: i18nInstance } = useTranslation();
  const current = i18nInstance.language === "si" ? "si" : "en";
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function setLang(code) {
    const normalized = code === "si" ? "si" : "en";
    i18n.changeLanguage(normalized);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("dmews_lang", normalized);
    }
    setIsOpen(false);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-sky-600/50 bg-sky-900/40 px-3 py-1.5 text-sm font-medium text-sky-200 transition hover:border-sky-500 hover:bg-sky-800/50"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Globe className="h-4 w-4" />
        <span>{current === "en" ? "English" : "සිංහල"}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 min-w-[140px] rounded-lg border border-sky-700/50 bg-sky-900/95 shadow-lg backdrop-blur-sm z-20">
          <button
            onClick={() => setLang("en")}
            className={`flex w-full items-center gap-2 px-3 py-2 text-sm ${
              current === "en"
                ? "bg-amber-500/20 text-amber-200"
                : "text-sky-200 hover:bg-sky-800/70"
            }`}
            role="menuitem"
          >
            <GB className="h-4 w-5" />
            English
          </button>
          <button
            onClick={() => setLang("si")}
            className={`flex w-full items-center gap-2 px-3 py-2 text-sm ${
              current === "si"
                ? "bg-amber-500/20 text-amber-200"
                : "text-sky-200 hover:bg-sky-800/70"
            }`}
            role="menuitem"
          >
            <LK className="h-4 w-5" />
            සිංහල
          </button>
        </div>
      )}
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
  const socialsTitle = t("footer.socialsTitle") || "Follow us";
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
          <div>
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

          {/* Socials */}
          <div>
            <h3 className="font-oswald text-sm font-semibold uppercase tracking-wider text-white">
              {socialsTitle}
            </h3>
            <ul className="mt-4 space-y-2">
              {socialLinks.map(({ href, label, icon: Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-sky-200/90 transition hover:text-amber-300"
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {label}
                  </a>
                </li>
              ))}
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