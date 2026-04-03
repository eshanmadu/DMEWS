// Weather data for all Sri Lanka districts.
// This module keeps a short in-memory cache to avoid hammering the external APIs.

const ACCUWEATHER_API_KEY = process.env.ACCUWEATHER_API_KEY || "";
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || "";
const GOOGLE_WEATHER_API_KEY = process.env.GOOGLE_WEATHER_API_KEY || "";

const DISTRICTS_WEATHER = [
  { name: "Colombo", lat: 6.9271, lon: 79.8612 },
  { name: "Gampaha", lat: 7.0897, lon: 79.9999 },
  { name: "Kalutara", lat: 6.5854, lon: 80.107 },
  { name: "Kandy", lat: 7.2906, lon: 80.6337 },
  { name: "Matale", lat: 7.4675, lon: 80.6234 },
  { name: "Nuwara Eliya", lat: 6.9497, lon: 80.7891 },
  { name: "Galle", lat: 6.0535, lon: 80.221 },
  { name: "Matara", lat: 5.9549, lon: 80.555 },
  { name: "Hambantota", lat: 6.124, lon: 81.1185 },
  { name: "Jaffna", lat: 9.6615, lon: 80.0255 },
  { name: "Kilinochchi", lat: 9.3958, lon: 80.399 },
  { name: "Mannar", lat: 8.977, lon: 79.9046 },
  { name: "Vavuniya", lat: 8.751, lon: 80.497 },
  { name: "Mullaitivu", lat: 9.2671, lon: 80.814 },
  { name: "Batticaloa", lat: 7.73, lon: 81.7 },
  { name: "Ampara", lat: 7.2833, lon: 81.6667 },
  { name: "Trincomalee", lat: 8.5874, lon: 81.2152 },
  { name: "Kurunegala", lat: 7.4863, lon: 80.3647 },
  { name: "Puttalam", lat: 8.0408, lon: 79.8395 },
  { name: "Anuradhapura", lat: 8.3114, lon: 80.4037 },
  { name: "Polonnaruwa", lat: 7.9403, lon: 81.0037 },
  { name: "Badulla", lat: 6.9934, lon: 81.0544 },
  { name: "Monaragala", lat: 6.87, lon: 81.35 },
  { name: "Ratnapura", lat: 6.7056, lon: 80.3847 },
  { name: "Kegalle", lat: 7.2513, lon: 80.3464 },
];

function googleConditionToOpenMeteoCode(type) {
  const t = String(type || "").toUpperCase();
  if (!t) return null;
  if (t === "CLEAR") return 0;
  if (["MOSTLY_CLEAR", "PARTLY_CLOUDY"].includes(t)) return 2;
  if (["CLOUDY", "OVERCAST"].includes(t)) return 3;
  if (["FOG", "MIST", "HAZE"].includes(t)) return 45;
  if (t.includes("DRIZZLE")) return 53;
  if (t.includes("SHOWERS")) return 81;
  if (t.includes("THUNDER")) return 95;
  if (t.includes("SNOW")) return 73;
  if (t.includes("RAIN")) return 63;
  return 2;
}

function openWeatherIdToOpenMeteoCode(id) {
  const n = Number(id);
  if (!Number.isFinite(n)) return null;
  // https://openweathermap.org/weather-conditions
  if (n === 800) return 0; // clear
  if (n >= 801 && n <= 803) return 2; // partly cloudy
  if (n === 804) return 3; // overcast
  if (n >= 200 && n <= 232) return 95; // thunderstorm
  if (n >= 300 && n <= 321) return 53; // drizzle
  if (n >= 500 && n <= 531) return 63; // rain
  if (n >= 600 && n <= 622) return 73; // snow
  if (n >= 700 && n <= 781) return 45; // atmosphere (mist/fog/etc.)
  return 2;
}

function accuPhraseToOpenMeteoCode(phrase) {
  const p = String(phrase || "").toLowerCase();
  if (!p) return null;

  if (p.includes("thunder")) return 95;
  if (p.includes("snow") || p.includes("ice") || p.includes("sleet")) return 73;
  if (p.includes("fog") || p.includes("mist") || p.includes("haze")) return 45;
  if (p.includes("drizzle")) return 53;
  if (p.includes("rain") || p.includes("showers")) return 63;
  if (p.includes("clear") || p.includes("sunny")) return 0;
  if (p.includes("partly") || p.includes("mostly")) return 2;
  if (p.includes("overcast") || p.includes("cloudy")) return 3;

  return null;
}

function pickAccuMetricValue(obj) {
  const v = obj?.Metric?.Value ?? obj?.Value ?? null;
  return typeof v === "number" ? v : null;
}

function getAccuRainMm(part) {
  const rain = pickAccuMetricValue(part?.Rain) ?? pickAccuMetricValue(part?.PrecipitationIntensity);
  return typeof rain === "number" ? rain : null;
}

function getAccuPrecipProb(part) {
  const pp = part?.PrecipitationProbability;
  if (pp && typeof pp === "object") {
    const v = typeof pp?.Value === "number" ? pp.Value : null;
    return typeof v === "number" ? v : null;
  }
  return typeof pp === "number" ? pp : null;
}

function getAccuWindKmh(part) {
  const wind = pickAccuMetricValue(part?.Wind?.Speed);
  return typeof wind === "number" ? wind : null;
}

async function fetchJsonWithTimeout(url, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function getGoogleRainForDistrict(d) {
  if (!GOOGLE_WEATHER_API_KEY) return null;
  const url = `https://weather.googleapis.com/v1/currentConditions:lookup?key=${encodeURIComponent(
    GOOGLE_WEATHER_API_KEY
  )}&location.latitude=${encodeURIComponent(d.lat)}&location.longitude=${encodeURIComponent(
    d.lon
  )}&unitsSystem=METRIC&languageCode=en`;

  const data = await fetchJsonWithTimeout(url, 5000);
  const lastHourMm = data?.precipitation?.qpf?.quantity;
  const probPct = data?.precipitation?.probability?.percent;
  const last24hMm = data?.currentConditionsHistory?.qpf?.quantity;

  return {
    lastHourMm: typeof lastHourMm === "number" ? lastHourMm : null,
    last24hMm: typeof last24hMm === "number" ? last24hMm : null,
    probPct: typeof probPct === "number" ? probPct : null,
    source: "google_weather_currentConditions",
  };
}

const locationKeyCache = new Map();
async function getAccuLocationKey(d) {
  const cacheKey = `name:${String(d.name || "").toLowerCase()}`;
  if (locationKeyCache.has(cacheKey)) return locationKeyCache.get(cacheKey);

  // Prefer searching by city/district name so the chosen LocationKey matches
  // what AccuWeather shows for that place (more consistent than geoposition).
  const searchUrl = `https://dataservice.accuweather.com/locations/v1/cities/search?apikey=${encodeURIComponent(
    ACCUWEATHER_API_KEY
  )}&q=${encodeURIComponent(d.name)}&language=en&details=false`;

  const geoUrl = `https://dataservice.accuweather.com/locations/v1/cities/geoposition/search?apikey=${encodeURIComponent(
    ACCUWEATHER_API_KEY
  )}&q=${encodeURIComponent(`${d.lat},${d.lon}`)}&language=en&details=false`;

  const p = (async () => {
    // 1) cities/search
    try {
      const list = await fetch(searchUrl).then((r) => r.json());
      if (Array.isArray(list) && list.length) {
        // Pick best candidate: prefer Sri Lanka, then city-like results, then highest rank.
        const picked = list
          .filter((it) => String(it?.Country?.ID || "").toUpperCase() === "LK")
          .sort((a, b) => (Number(b?.Rank) || 0) - (Number(a?.Rank) || 0))[0] || list[0];
        if (picked?.Key) return picked.Key;
      }
    } catch {
      // fall through to geoposition
    }

    // 2) geoposition/search fallback
    const data = await fetch(geoUrl).then((r) => r.json());
    const key = data?.Key;
    if (!key) throw new Error("AccuWeather location lookup failed.");
    return key;
  })();

  // Cache the in-flight promise too.
  locationKeyCache.set(cacheKey, p);
  return p;
}

async function getAccuWeatherForDistrict(d) {
  const locKey = await getAccuLocationKey(d);

  const currentUrl = `https://dataservice.accuweather.com/currentconditions/v1/${encodeURIComponent(
    locKey
  )}?apikey=${encodeURIComponent(ACCUWEATHER_API_KEY)}&language=en&details=true`;

  const dailyUrl = `https://dataservice.accuweather.com/forecasts/v1/daily/5day/${encodeURIComponent(
    locKey
  )}?apikey=${encodeURIComponent(ACCUWEATHER_API_KEY)}&language=en&metric=true&details=true`;

  const hourlyUrl = `https://dataservice.accuweather.com/forecasts/v1/hourly/12hour/${encodeURIComponent(
    locKey
  )}?apikey=${encodeURIComponent(ACCUWEATHER_API_KEY)}&language=en&metric=true&details=true`;

  const [curArr, dailyObj, hourlyObj] = await Promise.all([
    fetch(currentUrl).then((r) => r.json()),
    fetch(dailyUrl).then((r) => r.json()),
    fetch(hourlyUrl).then((r) => r.json()),
  ]);

  const cur = Array.isArray(curArr) ? curArr[0] : null;
  const isDay = cur?.IsDayTime ? 1 : 0;
  const temp = pickAccuMetricValue(cur?.Temperature);
  const windspeedKmh = pickAccuMetricValue(cur?.Wind?.Speed);
  const weatherText =
    String(cur?.WeatherText || cur?.IconPhrase || cur?.WeatherIconPhrase || "").trim() ||
    null;
  // The frontend expects an Open-Meteo-like numeric code.
  const weatherCode = accuPhraseToOpenMeteoCode(
    weatherText
  );

  const forecasts = Array.isArray(dailyObj?.DailyForecasts)
    ? dailyObj.DailyForecasts
    : [];
  const today = forecasts[0] || null;
  const tomorrow = forecasts[1] || null;

  const todayMax = pickAccuMetricValue(today?.Temperature?.Maximum);
  const todayMin = pickAccuMetricValue(today?.Temperature?.Minimum);
  const tomorrowMax = pickAccuMetricValue(tomorrow?.Temperature?.Maximum);
  const tomorrowMin = pickAccuMetricValue(tomorrow?.Temperature?.Minimum);

  const rainToday = (() => {
    const r0 = getAccuRainMm(today?.Day);
    const r1 = getAccuRainMm(today?.Night);
    if (typeof r0 !== "number" && typeof r1 !== "number") return null;
    return (r0 ?? 0) + (r1 ?? 0);
  })();
  const rainTomorrow = (() => {
    const r0 = getAccuRainMm(tomorrow?.Day);
    const r1 = getAccuRainMm(tomorrow?.Night);
    if (typeof r0 !== "number" && typeof r1 !== "number") return null;
    return (r0 ?? 0) + (r1 ?? 0);
  })();

  const probToday = (() => {
    const p0 = getAccuPrecipProb(today?.Day);
    const p1 = getAccuPrecipProb(today?.Night);
    if (typeof p0 !== "number" && typeof p1 !== "number") return null;
    return Math.max(p0 ?? 0, p1 ?? 0);
  })();
  const probTomorrow = (() => {
    const p0 = getAccuPrecipProb(tomorrow?.Day);
    const p1 = getAccuPrecipProb(tomorrow?.Night);
    if (typeof p0 !== "number" && typeof p1 !== "number") return null;
    return Math.max(p0 ?? 0, p1 ?? 0);
  })();

  const windTodayKmh = (() => {
    const w0 = getAccuWindKmh(today?.Day);
    const w1 = getAccuWindKmh(today?.Night);
    if (typeof w0 !== "number" && typeof w1 !== "number") return null;
    return Math.max(w0 ?? 0, w1 ?? 0);
  })();
  const windTomorrowKmh = (() => {
    const w0 = getAccuWindKmh(tomorrow?.Day);
    const w1 = getAccuWindKmh(tomorrow?.Night);
    if (typeof w0 !== "number" && typeof w1 !== "number") return null;
    return Math.max(w0 ?? 0, w1 ?? 0);
  })();

  const codeToday = accuPhraseToOpenMeteoCode(today?.Day?.IconPhrase || today?.IconPhrase);
  const codeTomorrow = accuPhraseToOpenMeteoCode(
    tomorrow?.Day?.IconPhrase || tomorrow?.IconPhrase
  );

  // AccuWeather hourly endpoint can return either:
  // - an array of hourly forecast objects, or
  // - an object wrapper containing `HourlyForecasts`.
  const hourlyForecasts = Array.isArray(hourlyObj)
    ? hourlyObj
    : Array.isArray(hourlyObj?.HourlyForecasts)
    ? hourlyObj.HourlyForecasts
    : [];

  const hourlyArr = hourlyForecasts.slice(0, 12).map((h) => {
    const tMs = new Date(h?.DateTime).getTime();
    const time = Number.isFinite(tMs) ? Math.floor(tMs / 1000) : 0;
    const t = pickAccuMetricValue(h?.Temperature);
    const code = accuPhraseToOpenMeteoCode(
      h?.IconPhrase || h?.WeatherIconPhrase || h?.WeatherText
    );
    return {
      time,
      temp: typeof t === "number" ? t : null,
      code: typeof code === "number" ? code : null,
    };
  });

  // Backend currently assumes `windMs` is m/s and multiplies by 3.6 in the response.
  const windMs = typeof windspeedKmh === "number" ? windspeedKmh / 3.6 : null;

  return {
    temp: typeof temp === "number" ? temp : null,
    windMs,
    isDay: isDay ? 1 : 0,
    weatherCode: typeof weatherCode === "number" ? weatherCode : null,
    weatherText,
    maxArr: [typeof todayMax === "number" ? todayMax : null, typeof tomorrowMax === "number" ? tomorrowMax : null],
    minArr: [typeof todayMin === "number" ? todayMin : null, typeof tomorrowMin === "number" ? tomorrowMin : null],
    rainArr: [rainToday, rainTomorrow],
    probArr: [typeof probToday === "number" ? probToday : null, typeof probTomorrow === "number" ? probTomorrow : null],
    windMaxArr: [typeof windTodayKmh === "number" ? windTodayKmh : null, typeof windTomorrowKmh === "number" ? windTomorrowKmh : null],
    codeArr: [
      typeof codeToday === "number" ? codeToday : null,
      typeof codeTomorrow === "number" ? codeTomorrow : null,
    ],
    hourlyArr,
  };
}

async function getAccuRainForecastForDistrict(d) {
  const locKey = await getAccuLocationKey(d);
  const dailyUrl = `https://dataservice.accuweather.com/forecasts/v1/daily/5day/${encodeURIComponent(
    locKey
  )}?apikey=${encodeURIComponent(ACCUWEATHER_API_KEY)}&language=en&metric=true&details=true`;

  const dailyObj = await fetchJsonWithTimeout(dailyUrl, 5000);
  const forecasts = Array.isArray(dailyObj?.DailyForecasts)
    ? dailyObj.DailyForecasts
    : [];

  const today = forecasts[0] || null;
  const tomorrow = forecasts[1] || null;

  const rainToday = (() => {
    const r0 = getAccuRainMm(today?.Day);
    const r1 = getAccuRainMm(today?.Night);
    if (typeof r0 !== "number" && typeof r1 !== "number") return null;
    return (r0 ?? 0) + (r1 ?? 0);
  })();
  const rainTomorrow = (() => {
    const r0 = getAccuRainMm(tomorrow?.Day);
    const r1 = getAccuRainMm(tomorrow?.Night);
    if (typeof r0 !== "number" && typeof r1 !== "number") return null;
    return (r0 ?? 0) + (r1 ?? 0);
  })();

  const probToday = (() => {
    const p0 = getAccuPrecipProb(today?.Day);
    const p1 = getAccuPrecipProb(today?.Night);
    if (typeof p0 !== "number" && typeof p1 !== "number") return null;
    return Math.max(p0 ?? 0, p1 ?? 0);
  })();
  const probTomorrow = (() => {
    const p0 = getAccuPrecipProb(tomorrow?.Day);
    const p1 = getAccuPrecipProb(tomorrow?.Night);
    if (typeof p0 !== "number" && typeof p1 !== "number") return null;
    return Math.max(p0 ?? 0, p1 ?? 0);
  })();

  return {
    rainArr: [rainToday, rainTomorrow],
    probArr: [probToday, probTomorrow],
  };
}

let weatherCache = { ts: 0, data: null };

async function getDistrictWeather() {
  if (!ACCUWEATHER_API_KEY && !OPENWEATHER_API_KEY) {
    const err = new Error(
      "Weather API key is not configured. Set ACCUWEATHER_API_KEY (preferred) or OPENWEATHER_API_KEY."
    );
    err.status = 500;
    throw err;
  }

  const ttlMs = 10 * 60 * 1000;
  if (weatherCache.data && Date.now() - weatherCache.ts < ttlMs) {
    return weatherCache.data;
  }

  const concurrency = ACCUWEATHER_API_KEY ? 2 : 4;
  let cursor = 0;
  const out = new Array(DISTRICTS_WEATHER.length);

  async function worker() {
    while (cursor < DISTRICTS_WEATHER.length) {
      const i = cursor++;
      const d = DISTRICTS_WEATHER[i];
      try {
        let temp = null;
        let windMs = null;
        let weatherId = null;
        let weatherCode = null; // Open-Meteo-like numeric code
        let isDay = true;
        let maxArr = [null, null];
        let minArr = [null, null];
        let rainArr = [null, null];
        let probArr = [null, null];
        let windMaxArr = [null, null];
        let codeArr = [null, null];
        let hourlyArr = [];
        let googleRain = null;

        let providerName = "openweather";
        let providerText = null;
        let rainProvider = providerName;
        let needOpenWeather = true;

        if (ACCUWEATHER_API_KEY) {
          try {
            const accu = await getAccuWeatherForDistrict(d);
            temp = accu.temp;
            windMs = accu.windMs; // m/s (backend multiplies by 3.6)
            isDay = accu.isDay ? 1 : 0;
            maxArr = accu.maxArr;
            minArr = accu.minArr;
            rainArr = accu.rainArr;
            probArr = accu.probArr;
            windMaxArr = accu.windMaxArr;
            codeArr = accu.codeArr;
            hourlyArr = accu.hourlyArr;
            weatherCode = accu.weatherCode;
            providerName = "accuweather";
            providerText = accu.weatherText;
            rainProvider = "accuweather";
            needOpenWeather = false;
          } catch (_accuErr) {
            // Fallback to OpenWeather per district when AccuWeather fails or rate-limits.
            needOpenWeather = true;
          }
        }

        if (needOpenWeather) {
          // Try OpenWeather One Call 3.0 first (must INCLUDE hourly).
          try {
          const onecallUrl = `https://api.openweathermap.org/data/3.0/onecall?lat=${d.lat}&lon=${d.lon}&exclude=minutely,alerts&units=metric&appid=${encodeURIComponent(
            OPENWEATHER_API_KEY
          )}`;

          const one = await fetch(onecallUrl).then((r) => r.json());
          if (one?.cod && Number(one.cod) >= 400) {
            throw new Error(one?.message || "OpenWeather One Call error");
          }

          const cur = one?.current || {};
          temp = cur?.temp ?? null;
          windMs = cur?.wind_speed ?? null;
          weatherId = cur?.weather?.[0]?.id ?? null;

          const sunrise = Number(cur?.sunrise) || 0;
          const sunset = Number(cur?.sunset) || 0;
          const dt = Number(cur?.dt) || 0;
          isDay =
            sunrise && sunset && dt ? dt >= sunrise && dt < sunset : true;

          const daily = Array.isArray(one?.daily) ? one.daily : [];
          const hourly = Array.isArray(one?.hourly) ? one.hourly : [];
          maxArr = daily.slice(0, 2).map((day) => {
            const v = day?.temp?.max;
            return typeof v === "number" ? v : null;
          });
          minArr = daily.slice(0, 2).map((day) => {
            const v = day?.temp?.min;
            return typeof v === "number" ? v : null;
          });
          rainArr = daily.slice(0, 2).map((day) => {
            const v = day?.rain;
            return typeof v === "number" ? v : 0;
          });
          probArr = daily.slice(0, 2).map((day) => {
            const v = day?.pop;
            return typeof v === "number" ? Math.round(v * 100) : null;
          });
          windMaxArr = daily.slice(0, 2).map((day) => {
            const v = day?.wind_speed;
            return typeof v === "number" ? v * 3.6 : null; // m/s -> km/h
          });
          codeArr = daily.slice(0, 2).map((day) => {
            const wid = day?.weather?.[0]?.id;
            const c = openWeatherIdToOpenMeteoCode(wid);
            return typeof c === "number" ? c : null;
          });

          hourlyArr = hourly.slice(0, 12).map((h) => {
            const t = h?.temp;
            const wid = h?.weather?.[0]?.id;
            const c = openWeatherIdToOpenMeteoCode(wid);
            return {
              time: Number(h?.dt) || 0,
              temp: typeof t === "number" ? t : null,
              code: typeof c === "number" ? c : null,
            };
          });
          } catch (_oneCallErr) {
          // Fallback: OpenWeather free endpoints (2.5 weather + forecast).
          const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${d.lat}&lon=${d.lon}&units=metric&appid=${encodeURIComponent(
            OPENWEATHER_API_KEY
          )}`;
          const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${d.lat}&lon=${d.lon}&units=metric&appid=${encodeURIComponent(
            OPENWEATHER_API_KEY
          )}`;

          const [curJ, fcJ] = await Promise.all([
            fetch(currentUrl).then((r) => r.json()),
            fetch(forecastUrl).then((r) => r.json()),
          ]);

          if (curJ?.cod && Number(curJ.cod) >= 400) {
            throw new Error(curJ?.message || "OpenWeather current error");
          }
          if (fcJ?.cod && Number(fcJ.cod) >= 400) {
            throw new Error(fcJ?.message || "OpenWeather forecast error");
          }

          temp = curJ?.main?.temp ?? null;
          windMs = curJ?.wind?.speed ?? null;
          weatherId = curJ?.weather?.[0]?.id ?? null;

          const sunrise = Number(curJ?.sys?.sunrise) || 0;
          const sunset = Number(curJ?.sys?.sunset) || 0;
          const dt = Number(curJ?.dt) || 0;
          isDay =
            sunrise && sunset && dt ? dt >= sunrise && dt < sunset : true;

          const tz = Number(fcJ?.city?.timezone) || 0; // seconds
          const now = Date.now();
          const localToday = new Date(now + tz * 1000)
            .toISOString()
            .slice(0, 10);
          const localTomorrow = new Date(now + tz * 1000 + 24 * 3600 * 1000)
            .toISOString()
            .slice(0, 10);

          const list = Array.isArray(fcJ?.list) ? fcJ.list : [];
          const groups = { [localToday]: [], [localTomorrow]: [] };

          for (const item of list) {
            const ts = (Number(item?.dt) || 0) * 1000;
            if (!ts) continue;
            const dayKey = new Date(ts + tz * 1000).toISOString().slice(0, 10);
            if (groups[dayKey]) groups[dayKey].push(item);
          }

          function summarize(items) {
            if (!items.length) {
              return {
                tMin: null,
                tMax: null,
                rain: null,
                pop: null,
                windMax: null,
                code: null,
              };
            }

            let tMin = null;
            let tMax = null;
            let rain = 0;
            let pop = null;
            let windMax = null;
            const counts = new Map();

            for (const it of items) {
              const mn = it?.main?.temp_min;
              const mx = it?.main?.temp_max;
              if (typeof mn === "number")
                tMin = tMin == null ? mn : Math.min(tMin, mn);
              if (typeof mx === "number")
                tMax = tMax == null ? mx : Math.max(tMax, mx);

              const r3 = it?.rain?.["3h"];
              if (typeof r3 === "number") rain += r3;

              const p = it?.pop;
              if (typeof p === "number") pop = pop == null ? p : Math.max(pop, p);

              const ws = it?.wind?.speed;
              if (typeof ws === "number")
                windMax = windMax == null ? ws : Math.max(windMax, ws);

              const wid = it?.weather?.[0]?.id;
              if (wid != null) {
                const k = String(wid);
                counts.set(k, (counts.get(k) || 0) + 1);
              }
            }

            let mostId = null;
            let mostCount = -1;
            for (const [k, c] of counts.entries()) {
              if (c > mostCount) {
                mostCount = c;
                mostId = Number(k);
              }
            }

            const code = openWeatherIdToOpenMeteoCode(mostId);
            return {
              tMin,
              tMax,
              rain,
              pop: typeof pop === "number" ? Math.round(pop * 100) : null,
              windMax:
                typeof windMax === "number" ? windMax * 3.6 : null,
              code: typeof code === "number" ? code : null,
            };
          }

          const s0 = summarize(groups[localToday]);
          const s1 = summarize(groups[localTomorrow]);

          maxArr = [s0.tMax, s1.tMax];
          minArr = [s0.tMin, s1.tMin];
          rainArr = [s0.rain, s1.rain];
          probArr = [s0.pop, s1.pop];
          windMaxArr = [s0.windMax, s1.windMax];
          codeArr = [s0.code, s1.code];

          // Build ~12 future points (3h step) from forecast list.
          hourlyArr = list.slice(0, 12).map((it) => {
            const t = it?.main?.temp;
            const wid = it?.weather?.[0]?.id;
            const c = openWeatherIdToOpenMeteoCode(wid);
            return {
              time: Number(it?.dt) || 0,
              temp: typeof t === "number" ? t : null,
              code: typeof c === "number" ? c : null,
            };
          });
          }
        }

        // Google Weather rainfall (current conditions): last hour + last 24h
        try {
          googleRain = await getGoogleRainForDistrict(d);
        } catch {
          googleRain = null;
        }

        // Always prefer AccuWeather for rainfall fields when key is available,
        // even if the district used OpenWeather for other weather values.
        if (ACCUWEATHER_API_KEY && providerName === "openweather") {
          try {
            const accuRain = await getAccuRainForecastForDistrict(d);
            if (Array.isArray(accuRain?.rainArr)) {
              rainArr = accuRain.rainArr;
              rainProvider = "accuweather";
            }
            if (Array.isArray(accuRain?.probArr)) probArr = accuRain.probArr;
          } catch {
            // Enforce AccuWeather-only rainfall when key is configured.
            // If AccuWeather rain fails, prefer unavailable values over OpenWeather rain.
            rainArr = [null, null];
            probArr = [null, null];
            rainProvider = "accuweather_unavailable";
          }
        }

        const code =
          typeof weatherCode === "number"
            ? weatherCode
            : openWeatherIdToOpenMeteoCode(weatherId);

        // Last 3 days rainfall (2 days ago, yesterday, today) from Open-Meteo for admin.
        let precipitation_sum_last3days = null;
        let time_last3days = null;
        try {
          const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${d.lat}&longitude=${d.lon}&daily=precipitation_sum&timezone=Asia/Colombo&past_days=2`;
          const om = await fetch(omUrl).then((r) => r.json());
          const omRain = om?.daily?.precipitation_sum;
          const omTime = om?.daily?.time;
          if (
            Array.isArray(omRain) &&
            Array.isArray(omTime) &&
            omRain.length >= 3 &&
            omTime.length >= 3
          ) {
            precipitation_sum_last3days = omRain.slice(0, 3);
            time_last3days = omTime.slice(0, 3);
          }
        } catch (_omErr) {
          // leave null
        }

        out[i] = {
          ...d,
          weather: {
            temperature: typeof temp === "number" ? temp : null,
            windspeed: typeof windMs === "number" ? windMs * 3.6 : null, // m/s -> km/h
            weathercode: typeof code === "number" ? code : null,
            is_day: isDay ? 1 : 0,
            provider: providerName,
            text: providerText,
            google_rain_last_hour_mm: googleRain?.lastHourMm ?? null,
            google_rain_last_24h_mm: googleRain?.last24hMm ?? null,
            google_rain_probability_percent: googleRain?.probPct ?? null,
            google_rain_source: googleRain?.source ?? null,
          },
          daily: {
            temperature_2m_max: maxArr,
            temperature_2m_min: minArr,
            precipitation_sum: rainArr,
            precipitation_provider: rainProvider,
            precipitation_sum_last3days,
            time_last3days,
            precipitation_probability_max: probArr,
            windspeed_10m_max: windMaxArr,
            weathercode: codeArr,
          },
          hourly: hourlyArr,
        };
      } catch (_e) {
        out[i] = { ...d, weather: null, daily: null };
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  weatherCache = { ts: Date.now(), data: out };
  return out;
}

module.exports = {
  getDistrictWeather,
};

