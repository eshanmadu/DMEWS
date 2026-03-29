"use client";

import { useTranslation } from "react-i18next";

export function RiskMapStripHeader() {
  const { t } = useTranslation();
  const title = t("home.riskStripTitle");
  const subtitle = t("home.riskStripSubtitle");

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

export function WeatherMapSectionHeader() {
  const { t } = useTranslation();
  const title = t("home.weatherStripTitle");
  const subtitle = t("home.weatherStripSubtitle");

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

