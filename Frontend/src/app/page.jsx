import dynamic from "next/dynamic";

import Link from "next/link";
import { fetchRiskLevels } from "@/lib/api";
import { RiskMap } from "@/components/RiskMap";
import PublicForecastPanel from "@/components/PublicForecastPanel";
import { FloodWarningBanner } from "@/components/FloodWarningBanner";
import { EmergencyNumbers } from "@/components/EmergencyNumbers";
import { HomeSlideshow } from "@/components/HomeSlideshow";
import { HomeSosButton } from "@/components/HomeSosButton";
import {
  RiskMapStripHeader,
  WeatherMapSectionHeader,
} from "@/components/HomeMapHeaders";
import MapLockFrame from "@/components/MapLockFrame";
import { AlertTriangle, ArrowRight, HeartHandshake, MapPin, UserPlus } from "lucide-react";

const SriLankaWeather = dynamic(
  () =>
    import("@/components/SriLankaWeather").then((m) => ({
      default: m.SriLankaWeather,
    })),
  { ssr: false }
);

async function getDashboardData() {
  const riskLevels = await fetchRiskLevels();
  const highDistricts = (riskLevels || [])
    .filter((r) => r.level === "high" && r.district)
    .map((r) => r.district);
  const mediumDistricts = (riskLevels || [])
    .filter((r) => r.level === "medium" && r.district)
    .map((r) => r.district);
  return { highDistricts, mediumDistricts };
}

export default async function DashboardPage() {
  const { highDistricts, mediumDistricts } = await getDashboardData();

  return (
    <>
      <HomeSosButton />
      <FloodWarningBanner highDistricts={highDistricts} mediumDistricts={mediumDistricts} />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <HomeSlideshow />

        {/* Quick actions – equal-width grid, modern UI, no View all */}
        <section className="mb-8" aria-label="Quick actions">
          <div className="rounded-3xl bg-white/80 backdrop-blur-xl p-5 shadow-lg ring-1 ring-slate-200/80">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900">Quick actions</h2>
              <p className="mt-1 text-sm text-slate-500">
                Report, volunteer, and find shelter fast.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {/* Report incident */}
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
                      Report incident
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Open incident report form
                    </p>
                  </div>
                </div>
                <div className="flex items-center text-xs font-medium text-rose-600">
                  Start now <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>

              {/* Report missing person */}
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
                      Report missing person
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Open missing person report form
                    </p>
                  </div>
                </div>
                <div className="flex items-center text-xs font-medium text-violet-600">
                  Start now <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>

              {/* Find nearest shelter */}
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
                      Find nearest shelter
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Jump to shelter list
                    </p>
                  </div>
                </div>
                <div className="flex items-center text-xs font-medium text-sky-600">
                  Start now <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>

              {/* Volunteer */}
              <Link
                href="/volunteer/join"
                className="group flex flex-col justify-between gap-4 rounded-2xl border border-emerald-200/60 bg-white/70 p-5 shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-inner shadow-white/20">
                    <HeartHandshake className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold leading-tight text-slate-900">
                      Volunteer
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Open volunteer form
                    </p>
                  </div>
                </div>
                <div className="flex items-center text-xs font-medium text-emerald-600">
                  Start now <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* Public forecast + risk map strip */}
        <div id="risk-map" className="mb-8 scroll-mt-24 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)]">
          <PublicForecastPanel />
          <section className="card overflow-hidden p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <RiskMapStripHeader />
            </div>
            <MapLockFrame className="w-full">
              <RiskMap />
            </MapLockFrame>
          </section>
        </div>

        <EmergencyNumbers />

        <div id="weather-map" className="mt-10 scroll-mt-24">
          <section className="card overflow-hidden p-0">
            <div className="border-b border-slate-200 bg-sky-50 px-5 py-3">
              <WeatherMapSectionHeader />
            </div>
            <div className="p-4">
              <SriLankaWeather />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}