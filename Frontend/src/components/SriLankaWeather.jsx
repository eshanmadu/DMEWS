"use client";

import { useEffect, useMemo, useState } from "react";
import { SriLankaMap } from "@/components/SriLankaMap";
import Loader from "@/components/Loader";
import MapLockFrame from "@/components/MapLockFrame";

function describeWeatherCode(code) {
  if (code == null) return "—";
  if (code === 0) return "Clear sky";
  if ([1, 2, 3].includes(code)) return "Partly cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55].includes(code)) return "Drizzle";
  if ([61, 63, 65].includes(code)) return "Rain";
  if ([66, 67].includes(code)) return "Freezing rain";
  if ([71, 73, 75].includes(code)) return "Snow";
  if ([80, 81, 82].includes(code)) return "Rain showers";
  if ([95].includes(code)) return "Thunderstorm";
  if ([96, 99].includes(code)) return "Thunderstorm with hail";
  return `Code ${code}`;
}

function avg(nums) {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function formatDayLabel(isoDate) {
  if (!isoDate) return "—";
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-LK", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function pickDaily(daily, idx, key) {
  const arr = daily?.[key];
  if (!Array.isArray(arr)) return null;
  const v = arr[idx];
  return typeof v === "number" ? v : null;
}

function getUserDistrictFromStorage() {
  if (typeof window === "undefined") return "";

  const saved =
    (window.localStorage.getItem("dmews_user_district") || "").trim();

  let fromUser = "";
  try {
    const raw = window.localStorage.getItem("dmews_user");
    const parsed = raw ? JSON.parse(raw) : null;
    fromUser = (parsed?.district || "").trim();
  } catch {
    fromUser = "";
  }

  return saved || fromUser || "";
}

function codeToEmoji(code) {
  if (code == null) return "🌡️";
  if (code === 0) return "☀️";
  if ([1, 2, 3].includes(code)) return "🌤️";
  if ([45, 48].includes(code)) return "🌫️";
  if ([51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "🌧️";
  if ([71, 73, 75].includes(code)) return "❄️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  return "☁️";
}

export function SriLankaWeather() {
  const [districts, setDistricts] = useState([]);
  const [selectedName, setSelectedName] = useState("");
  const [hovered, setHovered] = useState(null);
  const [userDistrict, setUserDistrict] = useState("");
  const [lockToUserDistrict, setLockToUserDistrict] = useState(true);
  const [showAllDistricts, setShowAllDistricts] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Read user district once on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const resolved = getUserDistrictFromStorage();
    if (resolved) {
      setUserDistrict(resolved);
      setShowAllDistricts(false); // logged-in: default to own district only
    }
    const token = window.localStorage.getItem("dmews_token");
    setIsLoggedIn(Boolean(token));
  }, []);

  // Keep selection synced to user district (unless user unlocks)
  useEffect(() => {
    if (!lockToUserDistrict) return;
    if (!userDistrict) return;
    if (selectedName === userDistrict) return;
    setSelectedName(userDistrict);
  }, [lockToUserDistrict, userDistrict, selectedName]);

  const nationwide = useMemo(() => {
    const temps = districts
      .map((d) => d.weather?.temperature)
      .filter((v) => typeof v === "number");
    const winds = districts
      .map((d) => d.weather?.windspeed)
      .filter((v) => typeof v === "number");
    const codes = districts
      .map((d) => d.weather?.weathercode)
      .filter((v) => typeof v === "number");
    const todayMax = districts
      .map((d) => pickDaily(d.daily, 0, "temperature_2m_max"))
      .filter((v) => typeof v === "number");
    const todayMin = districts
      .map((d) => pickDaily(d.daily, 0, "temperature_2m_min"))
      .filter((v) => typeof v === "number");
    const todayRain = districts
      .map((d) => pickDaily(d.daily, 0, "precipitation_sum"))
      .filter((v) => typeof v === "number");
    const todayProb = districts
      .map((d) => pickDaily(d.daily, 0, "precipitation_probability_max"))
      .filter((v) => typeof v === "number");
    const todayWindMax = districts
      .map((d) => pickDaily(d.daily, 0, "windspeed_10m_max"))
      .filter((v) => typeof v === "number");

    const tomorrowMax = districts
      .map((d) => pickDaily(d.daily, 1, "temperature_2m_max"))
      .filter((v) => typeof v === "number");
    const tomorrowMin = districts
      .map((d) => pickDaily(d.daily, 1, "temperature_2m_min"))
      .filter((v) => typeof v === "number");
    const tomorrowRain = districts
      .map((d) => pickDaily(d.daily, 1, "precipitation_sum"))
      .filter((v) => typeof v === "number");
    const tomorrowProb = districts
      .map((d) => pickDaily(d.daily, 1, "precipitation_probability_max"))
      .filter((v) => typeof v === "number");
    const tomorrowWindMax = districts
      .map((d) => pickDaily(d.daily, 1, "windspeed_10m_max"))
      .filter((v) => typeof v === "number");

    return {
      currentCode: codes.length ? codes[0] : null,
      currentTemp: avg(temps),
      currentWind: avg(winds),
      today: {
        tMax: avg(todayMax),
        tMin: avg(todayMin),
        rain: avg(todayRain),
        rainProb: avg(todayProb),
        windMax: avg(todayWindMax),
      },
      tomorrow: {
        tMax: avg(tomorrowMax),
        tMin: avg(tomorrowMin),
        rain: avg(tomorrowRain),
        rainProb: avg(tomorrowProb),
        windMax: avg(tomorrowWindMax),
      },
    };
  }, [districts]);

  const selected = useMemo(() => {
    if (!selectedName) return null;
    const target = selectedName.trim().toLowerCase();
    return (
      districts.find((d) => d.name?.trim().toLowerCase() === target) || null
    );
  }, [districts, selectedName]);

  const primaryName =
    (isLoggedIn ? userDistrict : "") || "";

  const day0 = selected?.daily?.time?.[0] || districts?.[0]?.daily?.time?.[0];
  const day1 = selected?.daily?.time?.[1] || districts?.[0]?.daily?.time?.[1];

  const title = selected
    ? `${selected.name} District`
    : "Sri Lanka (Nationwide average)";

  const liveCode =
    typeof selected?.weather?.weathercode === "number"
      ? selected.weather.weathercode
      : typeof nationwide.currentCode === "number"
      ? nationwide.currentCode
      : null;

  const today = selected
    ? {
        tMax: pickDaily(selected.daily, 0, "temperature_2m_max"),
        tMin: pickDaily(selected.daily, 0, "temperature_2m_min"),
        rain: pickDaily(selected.daily, 0, "precipitation_sum"),
        rainProb: pickDaily(selected.daily, 0, "precipitation_probability_max"),
        windMax: pickDaily(selected.daily, 0, "windspeed_10m_max"),
        condition: describeWeatherCode(liveCode),
      }
    : {
        ...nationwide.today,
        condition: describeWeatherCode(nationwide.currentCode),
      };

  const tomorrow = selected
    ? {
        tMax: pickDaily(selected.daily, 1, "temperature_2m_max"),
        tMin: pickDaily(selected.daily, 1, "temperature_2m_min"),
        rain: pickDaily(selected.daily, 1, "precipitation_sum"),
        rainProb: pickDaily(selected.daily, 1, "precipitation_probability_max"),
        windMax: pickDaily(selected.daily, 1, "windspeed_10m_max"),
        condition: describeWeatherCode(liveCode),
      }
    : {
        ...nationwide.tomorrow,
        condition: describeWeatherCode(nationwide.currentCode),
      };

  const hourly = useMemo(() => {
    const src = selected || districts[0];
    const base = src?.hourly || [];
    return base
      .slice(0, 12)
      .filter((h) => typeof h?.time === "number")
      .map((h) => {
        const date = new Date(h.time * 1000);
        const label = date.toLocaleTimeString("en-LK", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
        return {
          label,
          temp: typeof h.temp === "number" ? h.temp : null,
          code: h.code,
        };
      });
  }, [districts, selected]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)]">
      <div className="relative h-[480px] overflow-hidden rounded-xl bg-slate-800">
        <MapLockFrame className="h-full w-full min-h-0">
          <SriLankaMap
            onData={(list) => {
              setDistricts(list);
              const currentUserDistrict = getUserDistrictFromStorage();
              if (currentUserDistrict) {
                setUserDistrict(currentUserDistrict);
                if (lockToUserDistrict) {
                  setSelectedName(currentUserDistrict);
                  setShowAllDistricts(false);
                }
              }
            }}
            onHover={setHovered}
            onSelect={(name) => setSelectedName(name)}
            selectedDistrict={selectedName}
          />
        </MapLockFrame>
      </div>

      <div className="card flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">
              Weather details
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {isLoggedIn && userDistrict
                ? "Overview for your district and nationwide summary."
                : "Nationwide conditions for Sri Lanka."}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50 via-sky-50 to-sky-100 p-3 shadow-inner">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm">
                <span className="text-lg">
                  {isLoggedIn && userDistrict ? "📍" : "🌍"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                  {isLoggedIn && userDistrict ? "Your district" : "Nationwide"}
                </span>
                <span className="text-sm font-semibold text-slate-950">
                  {isLoggedIn && userDistrict ? userDistrict : "Sri Lanka"}
                </span>
              </div>
            </div>
            <div className="text-right text-[11px] text-slate-600">
              {day0 ? `Today · ${formatDayLabel(day0)}` : ""}
              {day1 ? (
                <>
                  <br />
                  {`Tomorrow · ${formatDayLabel(day1)}`}
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-sky-200 bg-white p-3">
            <div className="text-xs font-semibold text-slate-950">
              Today
              <span className="ml-2 text-[11px] font-normal text-slate-500">
                {day0 ? formatDayLabel(day0) : ""}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-[10px] uppercase text-slate-600">
                  Temp (min/max)
                </div>
                <div className="text-sm font-semibold text-slate-950">
                  {today.tMin != null && today.tMax != null
                    ? `${today.tMin.toFixed(1)}° / ${today.tMax.toFixed(1)}°C`
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-600">
                  Wind max
                </div>
                <div className="text-sm font-semibold text-slate-950">
                  {today.windMax != null ? `${today.windMax.toFixed(1)} km/h` : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-600">
                  Rainfall
                </div>
                <div className="text-sm font-semibold text-slate-950">
                  {today.rain != null ? `${today.rain.toFixed(1)} mm` : "—"}
                </div>
                <div className="text-[11px] text-slate-500">
                  Prob: {today.rainProb != null ? `${today.rainProb.toFixed(0)}%` : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-600">
                  Condition
                </div>
                <div className="text-sm font-semibold text-slate-950">
                  {today.condition || "—"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-sky-200 bg-white p-3">
            <div className="text-xs font-semibold text-slate-950">
              Tomorrow
              <span className="ml-2 text-[11px] font-normal text-slate-500">
                {day1 ? formatDayLabel(day1) : ""}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-[10px] uppercase text-slate-600">
                  Temp (min/max)
                </div>
                <div className="text-sm font-semibold text-slate-950">
                  {tomorrow.tMin != null && tomorrow.tMax != null
                    ? `${tomorrow.tMin.toFixed(1)}° / ${tomorrow.tMax.toFixed(1)}°C`
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-600">
                  Wind max
                </div>
                <div className="text-sm font-semibold text-slate-950">
                  {tomorrow.windMax != null ? `${tomorrow.windMax.toFixed(1)} km/h` : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-600">
                  Rainfall
                </div>
                <div className="text-sm font-semibold text-slate-950">
                  {tomorrow.rain != null ? `${tomorrow.rain.toFixed(1)} mm` : "—"}
                </div>
                <div className="text-[11px] text-slate-500">
                  Prob: {tomorrow.rainProb != null ? `${tomorrow.rainProb.toFixed(0)}%` : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-600">
                  Condition
                </div>
                <div className="text-sm font-semibold text-slate-950">
                  {tomorrow.condition || "—"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hour-by-hour strip */}
        <div className="mt-1">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-950">
              Next hours
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {hourly.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader size="sm" />
                <span>Loading hourly forecast…</span>
              </div>
            ) : (
              hourly.map((h, idx) => (
                <div
                  key={`${h.label}-${idx}`}
                  className="flex min-w-[72px] flex-col items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-center text-[11px] text-slate-700 shadow-sm"
                >
                  <div className="text-xs font-semibold text-slate-900">
                    {h.label}
                  </div>
                  <div className="text-lg">{codeToEmoji(h.code)}</div>
                  <div className="text-[11px] text-slate-600">
                    {h.temp != null ? `${h.temp.toFixed(0)}°C` : "—"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="mb-2 text-xs font-semibold text-slate-950">
            District list
          </div>
          <div className="max-h-[240px] overflow-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-sky-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">District</th>
                  <th className="px-3 py-2 font-medium">Today</th>
                  <th className="px-3 py-2 font-medium">Tomorrow</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {districts.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-slate-500" colSpan={3}>
                      <div className="flex items-center justify-center gap-2">
                        <Loader size="sm" />
                        <span>Loading…</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  (showAllDistricts
                    ? districts
                    : districts.filter((d) => {
                        if (!primaryName) return false;
                        return (
                          d.name?.trim().toLowerCase() ===
                          primaryName.trim().toLowerCase()
                        );
                      })
                  ).map((d) => {
                    const t0Min = pickDaily(d.daily, 0, "temperature_2m_min");
                    const t0Max = pickDaily(d.daily, 0, "temperature_2m_max");
                    const r0 = pickDaily(d.daily, 0, "precipitation_sum");
                    const t1Min = pickDaily(d.daily, 1, "temperature_2m_min");
                    const t1Max = pickDaily(d.daily, 1, "temperature_2m_max");
                    const r1 = pickDaily(d.daily, 1, "precipitation_sum");
                    return (
                      <tr key={d.name}>
                        <td className="px-3 py-2">{d.name}</td>
                        <td className="px-3 py-2">
                          <div className="text-slate-950 text-xs sm:text-sm">
                            {t0Min != null && t0Max != null
                              ? `${t0Min.toFixed(0)}°/${t0Max.toFixed(0)}°C`
                              : "—"}
                          </div>
                          <div className="text-[11px] text-slate-600">
                            Rain: {r0 != null ? `${r0.toFixed(1)}mm` : "—"}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-slate-950 text-xs sm:text-sm">
                            {t1Min != null && t1Max != null
                              ? `${t1Min.toFixed(0)}°/${t1Max.toFixed(0)}°C`
                              : "—"}
                          </div>
                          <div className="text-[11px] text-slate-600">
                            Rain: {r1 != null ? `${r1.toFixed(1)}mm` : "—"}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

