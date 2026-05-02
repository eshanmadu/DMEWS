"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ArrowRight, HeartHandshake, MapPin, UserPlus } from "lucide-react";

export function HomeQuickActions() {
  const { t } = useTranslation();

  return (
    <section className="mb-8" aria-label={t("homeQuickActions.sectionTitle")}>
      <div className="rounded-3xl bg-white/80 backdrop-blur-xl p-5 shadow-lg ring-1 ring-slate-200/80">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">{t("homeQuickActions.sectionTitle")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("homeQuickActions.sectionSubtitle")}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Link
            href="/incidents?open=report"
            className="group flex flex-col justify-between gap-4 rounded-2xl border border-rose-200/60 bg-white/70 p-5 shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-1 hover:border-rose-300 hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-inner shadow-white/20">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold leading-tight text-slate-900">
                  {t("homeQuickActions.reportIncident")}
                </h3>
                <p className="mt-1 text-xs text-slate-500">{t("homeQuickActions.reportIncidentHint")}</p>
              </div>
            </div>
            <div className="flex items-center text-xs font-medium text-rose-600">
              {t("homeQuickActions.startNow")}{" "}
              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>

          <Link
            href="/incidents/missing-persons?open=missing"
            className="group flex flex-col justify-between gap-4 rounded-2xl border border-violet-200/60 bg-white/70 p-5 shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-1 hover:border-violet-300 hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-inner shadow-white/20">
                <UserPlus className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold leading-tight text-slate-900">
                  {t("homeQuickActions.reportMissing")}
                </h3>
                <p className="mt-1 text-xs text-slate-500">{t("homeQuickActions.reportMissingHint")}</p>
              </div>
            </div>
            <div className="flex items-center text-xs font-medium text-violet-600">
              {t("homeQuickActions.startNow")}{" "}
              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>

          <Link
            href="/shelters#shelters-list"
            className="group flex flex-col justify-between gap-4 rounded-2xl border border-sky-200/60 bg-white/70 p-5 shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-1 hover:border-sky-300 hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-inner shadow-white/20">
                <MapPin className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold leading-tight text-slate-900">
                  {t("homeQuickActions.findShelter")}
                </h3>
                <p className="mt-1 text-xs text-slate-500">{t("homeQuickActions.findShelterHint")}</p>
              </div>
            </div>
            <div className="flex items-center text-xs font-medium text-sky-600">
              {t("homeQuickActions.startNow")}{" "}
              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>

          <Link
            href="/volunteer/join"
            className="group flex flex-col justify-between gap-4 rounded-2xl border border-emerald-200/60 bg-white/70 p-5 shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-inner shadow-white/20">
                <HeartHandshake className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold leading-tight text-slate-900">{t("homeQuickActions.volunteer")}</h3>
                <p className="mt-1 text-xs text-slate-500">{t("homeQuickActions.volunteerHint")}</p>
              </div>
            </div>
            <div className="flex items-center text-xs font-medium text-emerald-600">
              {t("homeQuickActions.startNow")}{" "}
              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
