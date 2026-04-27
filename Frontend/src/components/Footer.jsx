"use client";

import Link from "next/link";
import {
  AlertTriangle,
  FileWarning,
  Heart,
  Phone,
  Mail,
  Shield,
  Building2,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  LifeBuoy,
} from "lucide-react";
import { useTranslation } from "react-i18next";

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

export function Footer() {
  const { t } = useTranslation();
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