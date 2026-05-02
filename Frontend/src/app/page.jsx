import dynamic from "next/dynamic";

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
import { HomeQuickActions } from "@/components/HomeQuickActions";

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

        <HomeQuickActions />

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