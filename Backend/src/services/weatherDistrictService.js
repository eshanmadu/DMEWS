// Weather data for all Sri Lanka districts.
// This module keeps a short in-memory cache to avoid hammering the external APIs.

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || "";

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

let weatherCache = { ts: 0, data: null };

async function getDistrictWeather() {
  if (!OPENWEATHER_API_KEY) {
    const err = new Error("OPENWEATHER_API_KEY is not configured.");
    err.status = 500;
    throw err;
  }

  const ttlMs = 10 * 60 * 1000;
  if (weatherCache.data && Date.now() - weatherCache.ts < ttlMs) {
    return weatherCache.data;
  }

  const concurrency = 4;
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
        let isDay = true;
        let maxArr = [null, null];
        let minArr = [null, null];
        let rainArr = [null, null];
        let probArr = [null, null];
        let windMaxArr = [null, null];
        let codeArr = [null, null];
        let hourlyArr = [];

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

        const code = openWeatherIdToOpenMeteoCode(weatherId);

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
          },
          daily: {
            temperature_2m_max: maxArr,
            temperature_2m_min: minArr,
            precipitation_sum: rainArr,
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

