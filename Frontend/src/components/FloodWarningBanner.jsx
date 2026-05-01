"use client";

import { useTranslation } from "react-i18next";

function TickerBar({ text, isHigh }) {
  return (
    <div
      className="marquee-wrap overflow-hidden py-2.5 text-sm font-semibold shadow-md"
      style={{
        background: isHigh
          ? "linear-gradient(90deg, #b91c1c 0%, #dc2626 50%, #b91c1c 100%)"
          : "linear-gradient(90deg, #eab308 0%, #facc15 50%, #eab308 100%)",
        color: isHigh ? "white" : "#422006",
      }}
      role="alert"
    >
      <div className="marquee-inner flex whitespace-nowrap">
        <span className="inline-block w-[100vw] min-w-[100vw] shrink-0 px-4">
          {text}
        </span>
        <span className="inline-block w-[100vw] min-w-[100vw] shrink-0 px-4">
          {text}
        </span>
      </div>
    </div>
  );
}

export function FloodWarningBanner({ highDistricts = [], mediumDistricts = [] }) {
  const { t } = useTranslation();
  const hasHigh = highDistricts.length > 0;
  const hasMedium = mediumDistricts.length > 0;
  if (!hasHigh && !hasMedium) return null;

  const highText = t("flood.high", { districts: highDistricts.join(", ") });
  const mediumText = t("flood.medium", { districts: mediumDistricts.join(", ") });

  return (
    <div className="space-y-0">
      {hasHigh && <TickerBar text={highText} isHigh />}
      {!hasHigh && hasMedium && <TickerBar text={mediumText} isHigh={false} />}
    </div>
  );
}
