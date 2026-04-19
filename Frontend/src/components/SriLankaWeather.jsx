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

const WEATHER_API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getUserLocationFromStorage() {
  if (typeof window === "undefined") {
    return {
      district: "",
      city: "",
      cityLatitude: null,
      cityLongitude: null,
    };
  }
  const saved = (window.localStorage.getItem("dmews_user_district") || "").trim();
  let fromUser = "";
  let city = "";
  let cityLatitude = null;
  let cityLongitude = null;
  try {
    const raw = window.localStorage.getItem("dmews_user");
    const parsed = raw ? JSON.parse(raw) : null;
    fromUser = (parsed?.district || "").trim();
    city = (parsed?.city || "").trim();
    if (typeof parsed?.cityLatitude === "number") cityLatitude = parsed.cityLatitude;
    if (typeof parsed?.cityLongitude === "number") cityLongitude = parsed.cityLongitude;
  } catch {
    fromUser = "";
  }
  const district = saved || fromUser || "";
  return { district, city, cityLatitude, cityLongitude };
}

function codeToEmoji(code, isDay = true) {
  if (code == null) return "🌡️";
  if (code === 0) return isDay ? "☀️" : "🌕";
  if ([1, 2, 3].includes(code)) return isDay ? "🌤️" : "☁️";
  if ([45, 48].includes(code)) return "🌫️";
  if ([51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "🌧️";
  if ([71, 73, 75].includes(code)) return "❄️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  return isDay ? "☁️" : "🌙";
}

function getIsDayInSriLanka(unixSeconds) {
  if (typeof unixSeconds !== "number") return true;
  const date = new Date(unixSeconds * 1000);
  const hourText = date.toLocaleString("en-GB", {
    timeZone: "Asia/Colombo",
    hour: "2-digit",
    hour12: false,
  });
  const hour = Number(hourText);
  return Number.isFinite(hour) ? hour >= 6 && hour < 18 : true;
}

function pickWeatherMetrics(d) {
  const w = d?.weather;
  if (!w) return null;
  return {
    feelslike: typeof w.feelslike_c === "number" ? w.feelslike_c : null,
    humidity: typeof w.humidity === "number" ? w.humidity : null,
    pressure: typeof w.pressure_mb === "number" ? w.pressure_mb : null,
    uv: typeof w.uv === "number" ? w.uv : null,
    vis: typeof w.vis_km === "number" ? w.vis_km : null,
    cloud: typeof w.cloud === "number" ? w.cloud : null,
    gust: typeof w.gust_kph === "number" ? w.gust_kph : null,
    precip: typeof w.precip_mm === "number" ? w.precip_mm : null,
    windDir: w.wind_dir ? String(w.wind_dir) : null,
    icon: w.condition_icon ? String(w.condition_icon) : null,
  };
}

export function SriLankaWeather() {
  const [districts, setDistricts] = useState([]);
  const [selectedName, setSelectedName] = useState("");
  const [hovered, setHovered] = useState(null);
  const [userDistrict, setUserDistrict] = useState("");
  const [userCityLabel, setUserCityLabel] = useState("");
  const [userCityWeather, setUserCityWeather] = useState(null);
  const [lockToUserDistrict, setLockToUserDistrict] = useState(true);
  const [showAllDistricts, setShowAllDistricts] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sourceNotice, setSourceNotice] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    function refreshUserLocation() {
      const loc = getUserLocationFromStorage();
      if (loc.district) {
        setUserDistrict(loc.district);
        setShowAllDistricts(false);
      } else {
        setUserDistrict("");
      }
      setUserCityLabel(loc.city || "");
      const token = window.localStorage.getItem("dmews_token");
      setIsLoggedIn(Boolean(token));
    }
    refreshUserLocation();
    window.addEventListener("dmews-auth-changed", refreshUserLocation);
    return () => window.removeEventListener("dmews-auth-changed", refreshUserLocation);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const loc = getUserLocationFromStorage();
    const lat = loc.cityLatitude;
    const lon = loc.cityLongitude;
    const token = window.localStorage.getItem("dmews_token");
    if (!token || lat == null || lon == null) {
      setUserCityWeather(null);
      return;
    }
    let cancelled = false;
    const name = loc.city || "My location";
    (async () => {
      try {
        const res = await fetch(
          `${WEATHER_API_BASE}/weather/point?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&name=${encodeURIComponent(name)}`
        );
        const row = await res.json().catch(() => null);
        if (!res.ok || !row || cancelled) {
          if (!cancelled) setUserCityWeather(null);
          return;
        }
        if (!cancelled) setUserCityWeather(row);
      } catch {
        if (!cancelled) setUserCityWeather(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userCityLabel, userDistrict]);

  useEffect(() => {
    if (!lockToUserDistrict) return;
    if (!userDistrict) return;
    if (selectedName === userDistrict) return;
    setSelectedName(userDistrict);
  }, [lockToUserDistrict, userDistrict, selectedName]);

  const nationwide = useMemo(() => {
    const temps = districts.map((d) => d.weather?.temperature).filter((v) => typeof v === "number");
    const winds = districts.map((d) => d.weather?.windspeed).filter((v) => typeof v === "number");
    const codes = districts.map((d) => d.weather?.weathercode).filter((v) => typeof v === "number");
    const todayMax = districts.map((d) => pickDaily(d.daily, 0, "temperature_2m_max")).filter((v) => typeof v === "number");
    const todayMin = districts.map((d) => pickDaily(d.daily, 0, "temperature_2m_min")).filter((v) => typeof v === "number");
    const todayRain = districts.map((d) => pickDaily(d.daily, 0, "precipitation_sum")).filter((v) => typeof v === "number");
    const todayProb = districts.map((d) => pickDaily(d.daily, 0, "precipitation_probability_max")).filter((v) => typeof v === "number");
    const todayWindMax = districts.map((d) => pickDaily(d.daily, 0, "windspeed_10m_max")).filter((v) => typeof v === "number");

    const tomorrowMax = districts.map((d) => pickDaily(d.daily, 1, "temperature_2m_max")).filter((v) => typeof v === "number");
    const tomorrowMin = districts.map((d) => pickDaily(d.daily, 1, "temperature_2m_min")).filter((v) => typeof v === "number");
    const tomorrowRain = districts.map((d) => pickDaily(d.daily, 1, "precipitation_sum")).filter((v) => typeof v === "number");
    const tomorrowProb = districts.map((d) => pickDaily(d.daily, 1, "precipitation_probability_max")).filter((v) => typeof v === "number");
    const tomorrowWindMax = districts.map((d) => pickDaily(d.daily, 1, "windspeed_10m_max")).filter((v) => typeof v === "number");

    const feels = districts.map((d) => d.weather?.feelslike_c).filter((v) => typeof v === "number");
    const hums = districts.map((d) => d.weather?.humidity).filter((v) => typeof v === "number");
    const pres = districts.map((d) => d.weather?.pressure_mb).filter((v) => typeof v === "number");
    const uvs = districts.map((d) => d.weather?.uv).filter((v) => typeof v === "number");
    const viss = districts.map((d) => d.weather?.vis_km).filter((v) => typeof v === "number");
    const clouds = districts.map((d) => d.weather?.cloud).filter((v) => typeof v === "number");
    const gusts = districts.map((d) => d.weather?.gust_kph).filter((v) => typeof v === "number");
    const precs = districts.map((d) => d.weather?.precip_mm).filter((v) => typeof v === "number");

    return {
      currentCode: codes.length ? codes[0] : null,
      currentTemp: avg(temps),
      currentWind: avg(winds),
      wa: {
        feelslike: feels.length ? avg(feels) : null,
        humidity: hums.length ? avg(hums) : null,
        pressure: pres.length ? avg(pres) : null,
        uv: uvs.length ? avg(uvs) : null,
        vis: viss.length ? avg(viss) : null,
        cloud: clouds.length ? avg(clouds) : null,
        gust: gusts.length ? avg(gusts) : null,
        precip: precs.length ? avg(precs) : null,
      },
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
    return districts.find((d) => d.name?.trim().toLowerCase() === target) || null;
  }, [districts, selectedName]);

  const effectiveSelected = useMemo(() => {
    const locked =
      lockToUserDistrict &&
      userDistrict &&
      selectedName?.trim().toLowerCase() === userDistrict.trim().toLowerCase();
    if (
      locked &&
      userCityWeather &&
      userCityWeather.weather?.provider === "weatherapi"
    ) {
      return userCityWeather;
    }
    return selected;
  }, [lockToUserDistrict, userDistrict, selectedName, selected, userCityWeather]);

  const primaryName = (isLoggedIn ? userDistrict : "") || "";
  const day0 = effectiveSelected?.daily?.time?.[0] || districts?.[0]?.daily?.time?.[0];
  const day1 = effectiveSelected?.daily?.time?.[1] || districts?.[0]?.daily?.time?.[1];

  const liveCode = typeof effectiveSelected?.weather?.weathercode === "number"
    ? effectiveSelected.weather.weathercode
    : typeof nationwide.currentCode === "number"
    ? nationwide.currentCode
    : null;

  const todayCode = typeof effectiveSelected?.daily?.weathercode?.[0] === "number" ? effectiveSelected.daily.weathercode[0] : liveCode;
  const tomorrowCode = typeof effectiveSelected?.daily?.weathercode?.[1] === "number" ? effectiveSelected.daily.weathercode[1] : liveCode;

  const today = effectiveSelected
    ? {
        tMax: pickDaily(effectiveSelected.daily, 0, "temperature_2m_max"),
        tMin: pickDaily(effectiveSelected.daily, 0, "temperature_2m_min"),
        rain: pickDaily(effectiveSelected.daily, 0, "precipitation_sum"),
        rainProb: pickDaily(effectiveSelected.daily, 0, "precipitation_probability_max"),
        windMax: pickDaily(effectiveSelected.daily, 0, "windspeed_10m_max"),
        condition: describeWeatherCode(todayCode),
      }
    : {
        ...nationwide.today,
        condition: describeWeatherCode(nationwide.currentCode),
      };

  const tomorrow = effectiveSelected
    ? {
        tMax: pickDaily(effectiveSelected.daily, 1, "temperature_2m_max"),
        tMin: pickDaily(effectiveSelected.daily, 1, "temperature_2m_min"),
        rain: pickDaily(effectiveSelected.daily, 1, "precipitation_sum"),
        rainProb: pickDaily(effectiveSelected.daily, 1, "precipitation_probability_max"),
        windMax: pickDaily(effectiveSelected.daily, 1, "windspeed_10m_max"),
        condition: describeWeatherCode(tomorrowCode),
      }
    : {
        ...nationwide.tomorrow,
        condition: describeWeatherCode(nationwide.currentCode),
      };

  const metrics = useMemo(() => {
    if (effectiveSelected) return pickWeatherMetrics(effectiveSelected);
    const wa = nationwide.wa;
    if (!wa) return null;
    return {
      feelslike: wa.feelslike,
      humidity: wa.humidity,
      pressure: wa.pressure,
      uv: wa.uv,
      vis: wa.vis,
      cloud: wa.cloud,
      gust: wa.gust,
      precip: wa.precip,
      windDir: null,
      icon: null,
    };
  }, [effectiveSelected, nationwide]);

  const isWeatherApi = effectiveSelected?.weather?.provider === "weatherapi" ||
    (!effectiveSelected && districts.length > 0 && districts.every((d) => d?.weather?.provider === "weatherapi"));

  const hourly = useMemo(() => {
    const src = effectiveSelected || districts[0];
    const base = src?.hourly || [];
    return base
      .slice(0, 12)
      .filter((h) => typeof h?.time === "number")
      .map((h) => {
        const date = new Date(h.time * 1000);
        const label = date.toLocaleTimeString("en-LK", {
          timeZone: "Asia/Colombo",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
        return {
          label,
          temp: typeof h.temp === "number" ? h.temp : null,
          code: h.code,
          isDay: getIsDayInSriLanka(h.time),
        };
      });
  }, [districts, effectiveSelected]);

  const currentTempVal = typeof effectiveSelected?.weather?.temperature === "number"
    ? effectiveSelected.weather.temperature
    : typeof nationwide.currentTemp === "number"
    ? nationwide.currentTemp
    : null;
  const currentWindVal = typeof effectiveSelected?.weather?.windspeed === "number"
    ? effectiveSelected.weather.windspeed
    : typeof nationwide.currentWind === "number"
    ? nationwide.currentWind
    : null;

  const showCityHeading =
    Boolean(userCityLabel) &&
    lockToUserDistrict &&
    userDistrict &&
    selectedName?.trim().toLowerCase() === userDistrict.trim().toLowerCase() &&
    Boolean(userCityWeather);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Left Column - Map */}
      <div className="relative h-[500px] lg:h-[600px] overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl ring-1 ring-white/10">
        <MapLockFrame className="h-full w-full">
          <SriLankaMap
            onData={(list) => {
              const arr = Array.isArray(list) ? list : [];
              const weatherApiRows = arr.filter(
                (d) => d?.weather?.provider === "weatherapi"
              );
              if (weatherApiRows.length > 0) {
                setDistricts(weatherApiRows);
                setSourceNotice("");
              } else {
                setDistricts(arr);
                setSourceNotice("WeatherAPI district data unavailable right now.");
              }
              const loc = getUserLocationFromStorage();
              if (loc.district) {
                setUserDistrict(loc.district);
                setUserCityLabel(loc.city || "");
                if (lockToUserDistrict) {
                  setSelectedName(loc.district);
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

      {/* Right Column - Weather Details */}
      <div className="flex flex-col gap-5 overflow-y-auto max-h-[600px] pr-1">
        {/* Main weather card */}
        <div className="rounded-2xl bg-white/80 backdrop-blur-sm shadow-lg border border-white/30 p-5 transition-all">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-slate-800">Weather Details</h3>
              <p className="mt-1 text-xs text-slate-500">
                {isWeatherApi
                  ? "Current conditions and forecast from WeatherAPI."
                  : isLoggedIn && userDistrict
                  ? userCityLabel
                    ? "Overview for your city (when your district is selected) and nationwide summary."
                    : "Overview for your district and nationwide summary."
                  : "Nationwide conditions for Sri Lanka."}
              </p>
            </div>
          </div>

          {sourceNotice ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {sourceNotice}
            </div>
          ) : null}

          {/* Current weather block */}
          <div className="mt-4 overflow-hidden rounded-xl bg-gradient-to-br from-sky-50 via-white to-sky-50/80 p-4 shadow-inner">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                {metrics?.icon ? (
                  <img src={metrics.icon} alt="" width={56} height={56} className="h-14 w-14 shrink-0 object-contain" />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/60 text-3xl shadow-sm">
                    {codeToEmoji(liveCode, true)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-700">
                    {effectiveSelected
                      ? showCityHeading
                        ? `${userCityLabel}`
                        : `${effectiveSelected.name} · district`
                      : isLoggedIn && userDistrict
                      ? userCityLabel
                        ? `${userCityLabel}`
                        : `${userDistrict} · your district`
                      : "Sri Lanka · nationwide average"}
                  </p>
                  <div className="mt-1 flex flex-wrap items-baseline gap-2">
                    <span className="text-4xl font-bold tabular-nums text-slate-950">
                      {currentTempVal != null ? `${currentTempVal.toFixed(1)}°C` : "—"}
                    </span>
                    {metrics?.feelslike != null && (
                      <span className="text-sm text-slate-600">Feels {metrics.feelslike.toFixed(1)}°C</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-snug text-slate-800">
                    {effectiveSelected?.weather?.text || (liveCode != null ? describeWeatherCode(liveCode) : "—")}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-600">
                    Wind {currentWindVal != null ? `${currentWindVal.toFixed(1)} km/h` : "—"}
                    {metrics?.windDir ? ` · ${metrics.windDir}` : ""}
                  </p>
                </div>
              </div>
              <div className="text-right text-[11px] leading-relaxed text-slate-600">
                {day0 && <div>Today · {formatDayLabel(day0)}</div>}
                {day1 && <div className="mt-0.5">Tomorrow · {formatDayLabel(day1)}</div>}
              </div>
            </div>

            {/* Metrics grid */}
            {metrics && (metrics.humidity != null || metrics.pressure != null || metrics.uv != null || metrics.vis != null || metrics.cloud != null || metrics.gust != null) && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {metrics.humidity != null && (
                  <div className="rounded-xl border border-sky-100 bg-white/80 px-3 py-2 text-[11px] shadow-sm">
                    <div className="font-semibold text-slate-600">Humidity</div>
                    <div className="mt-0.5 text-base tabular-nums text-slate-950">{metrics.humidity.toFixed(0)}%</div>
                  </div>
                )}
                {metrics.pressure != null && (
                  <div className="rounded-xl border border-sky-100 bg-white/80 px-3 py-2 text-[11px] shadow-sm">
                    <div className="font-semibold text-slate-600">Pressure</div>
                    <div className="mt-0.5 text-base tabular-nums text-slate-950">{metrics.pressure.toFixed(0)} mb</div>
                  </div>
                )}
                {metrics.uv != null && (
                  <div className="rounded-xl border border-sky-100 bg-white/80 px-3 py-2 text-[11px] shadow-sm">
                    <div className="font-semibold text-slate-600">UV index</div>
                    <div className="mt-0.5 text-base tabular-nums text-slate-950">{metrics.uv.toFixed(1)}</div>
                  </div>
                )}
                {metrics.vis != null && (
                  <div className="rounded-xl border border-sky-100 bg-white/80 px-3 py-2 text-[11px] shadow-sm">
                    <div className="font-semibold text-slate-600">Visibility</div>
                    <div className="mt-0.5 text-base tabular-nums text-slate-950">{metrics.vis.toFixed(1)} km</div>
                  </div>
                )}
                {metrics.cloud != null && (
                  <div className="rounded-xl border border-sky-100 bg-white/80 px-3 py-2 text-[11px] shadow-sm">
                    <div className="font-semibold text-slate-600">Cloud cover</div>
                    <div className="mt-0.5 text-base tabular-nums text-slate-950">{metrics.cloud.toFixed(0)}%</div>
                  </div>
                )}
                {metrics.gust != null && (
                  <div className="rounded-xl border border-sky-100 bg-white/80 px-3 py-2 text-[11px] shadow-sm">
                    <div className="font-semibold text-slate-600">Wind gust</div>
                    <div className="mt-0.5 text-base tabular-nums text-slate-950">{metrics.gust.toFixed(0)} km/h</div>
                  </div>
                )}
              </div>
            )}

            {/* Rain info */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2">
                <div className="font-semibold text-emerald-900">Precip (recent)</div>
                <div className="mt-0.5 text-base tabular-nums">{metrics?.precip != null ? `${metrics.precip.toFixed(1)} mm` : "—"}</div>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2">
                <div className="font-semibold text-emerald-900">Today total (forecast)</div>
                <div className="mt-0.5 text-base tabular-nums">{today.rain != null ? `${today.rain.toFixed(1)} mm` : "—"}</div>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2">
                <div className="font-semibold text-emerald-900">Rain chance (today)</div>
                <div className="mt-0.5 text-base tabular-nums">{today.rainProb != null ? `${today.rainProb.toFixed(0)}%` : "—"}</div>
              </div>
            </div>
          </div>

          {/* Today & Tomorrow cards */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-sky-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-950">Today</div>
                <div className="text-2xl">{codeToEmoji(todayCode, true)}</div>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">{day0 ? formatDayLabel(day0) : ""}</div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[10px] uppercase text-slate-600">Temp (min/max)</div>
                  <div className="text-sm font-semibold text-slate-950">
                    {today.tMin != null && today.tMax != null ? `${today.tMin.toFixed(1)}° / ${today.tMax.toFixed(1)}°C` : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-600">Wind max</div>
                  <div className="text-sm font-semibold text-slate-950">{today.windMax != null ? `${today.windMax.toFixed(1)} km/h` : "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-600">Rainfall</div>
                  <div className="text-sm font-semibold text-slate-950">{today.rain != null ? `${today.rain.toFixed(1)} mm` : "—"}</div>
                  <div className="text-[11px] text-slate-500">Prob: {today.rainProb != null ? `${today.rainProb.toFixed(0)}%` : "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-600">Condition</div>
                  <div className="text-sm font-semibold text-slate-950">{today.condition || "—"}</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-sky-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-950">Tomorrow</div>
                <div className="text-2xl">{codeToEmoji(tomorrowCode, true)}</div>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">{day1 ? formatDayLabel(day1) : ""}</div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[10px] uppercase text-slate-600">Temp (min/max)</div>
                  <div className="text-sm font-semibold text-slate-950">
                    {tomorrow.tMin != null && tomorrow.tMax != null ? `${tomorrow.tMin.toFixed(1)}° / ${tomorrow.tMax.toFixed(1)}°C` : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-600">Wind max</div>
                  <div className="text-sm font-semibold text-slate-950">{tomorrow.windMax != null ? `${tomorrow.windMax.toFixed(1)} km/h` : "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-600">Rainfall</div>
                  <div className="text-sm font-semibold text-slate-950">{tomorrow.rain != null ? `${tomorrow.rain.toFixed(1)} mm` : "—"}</div>
                  <div className="text-[11px] text-slate-500">Prob: {tomorrow.rainProb != null ? `${tomorrow.rainProb.toFixed(0)}%` : "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-600">Condition</div>
                  <div className="text-sm font-semibold text-slate-950">{tomorrow.condition || "—"}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Hourly forecast */}
          <div className="mt-5">
            <div className="mb-2 text-xs font-semibold text-slate-950">Next Hours</div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {hourly.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader size="sm" />
                  <span>Loading hourly forecast…</span>
                </div>
              ) : (
                hourly.map((h, idx) => (
                  <div key={idx} className="flex min-w-[80px] flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-[11px] shadow-sm">
                    <div className="text-xs font-semibold text-slate-900">{h.label}</div>
                    <div className="text-xl">{codeToEmoji(h.code, h.isDay)}</div>
                    <div className="text-[11px] font-medium text-slate-600">{h.temp != null ? `${h.temp.toFixed(0)}°C` : "—"}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* District table */}
          <div className="mt-5 overflow-hidden">
            <div className="mb-2 text-xs font-semibold text-slate-950">District Forecasts</div>
            <div className="max-h-[280px] overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-sky-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2 font-semibold">District</th>
                    <th className="px-4 py-2 font-semibold">Today</th>
                    <th className="px-4 py-2 font-semibold">Tomorrow</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {districts.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan={3}>
                        <div className="flex items-center justify-center gap-2">
                          <Loader size="sm" />
                          <span>Loading districts…</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    (showAllDistricts ? districts : districts.filter((d) => {
                        if (!primaryName) return false;
                        return d.name?.trim().toLowerCase() === primaryName.trim().toLowerCase();
                      })).map((d) => {
                        const t0Min = pickDaily(d.daily, 0, "temperature_2m_min");
                        const t0Max = pickDaily(d.daily, 0, "temperature_2m_max");
                        const r0 = pickDaily(d.daily, 0, "precipitation_sum");
                        const t1Min = pickDaily(d.daily, 1, "temperature_2m_min");
                        const t1Max = pickDaily(d.daily, 1, "temperature_2m_max");
                        const r1 = pickDaily(d.daily, 1, "precipitation_sum");
                        return (
                          <tr key={d.name} className="cursor-pointer transition-colors hover:bg-sky-50/50" onClick={() => setSelectedName(d.name)}>
                            <td className="px-4 py-2 font-medium text-slate-800">{d.name}</td>
                            <td className="px-4 py-2">
                              <div className="text-slate-950 text-xs sm:text-sm">
                                {t0Min != null && t0Max != null ? `${t0Min.toFixed(0)}°/${t0Max.toFixed(0)}°C` : "—"}
                              </div>
                              <div className="text-[11px] text-slate-500">Rain: {r0 != null ? `${r0.toFixed(1)}mm` : "—"}</div>
                            </td>
                            <td className="px-4 py-2">
                              <div className="text-slate-950 text-xs sm:text-sm">
                                {t1Min != null && t1Max != null ? `${t1Min.toFixed(0)}°/${t1Max.toFixed(0)}°C` : "—"}
                              </div>
                              <div className="text-[11px] text-slate-500">Rain: {r1 != null ? `${r1.toFixed(1)}mm` : "—"}</div>
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
    </div>
  );
}