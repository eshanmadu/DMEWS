"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import Loader from "@/components/Loader";

// Sri Lanka approximate bounds: [south, west], [north, east]
const SRI_LANKA_BOUNDS = [
  [5.92, 79.52],
  [9.83, 81.88],
];
const SRI_LANKA_CENTER = [7.87, 80.77];
const DEFAULT_ZOOM = 7;

// CartoDB Positron base tiles
const BASE_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

// Simple list of Sri Lankan districts with approximate centroids
// (enough for visualising weather by district)
const DISTRICTS = [
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

// Basic mapping of Open-Meteo weather codes to labels
function describeWeatherCode(code) {
  if (code == null) return "Unknown";
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

// Map weather code to a simple icon (sun / clouds / rain / storm), aware of day/night
function getWeatherIcon(code, isDay) {
  if (code == null) return isDay ? "☁️" : "🌙";
  if (code === 0) return isDay ? "☀️" : "🌙"; // clear sky
  if ([1, 2, 3].includes(code)) return isDay ? "🌤️" : "🌙"; // partly cloudy
  if ([45, 48].includes(code)) return "🌫️"; // fog
  if ([51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return "🌧️"; // drizzle / rain
  }
  if ([95, 96, 99].includes(code)) return "⛈️"; // thunderstorms
  return isDay ? "☁️" : "🌙";
}

// Animated SVG icon for popup (very lightweight), aware of day/night
function getAnimatedWeatherSvg(code, isDay) {
  const baseSize = 40;
  // Clear / sunny
  if (code === 0) {
    if (!isDay) {
      // Night: moon with subtle glow
      return `
        <svg width="${baseSize}" height="${baseSize}" viewBox="0 0 40 40">
          <defs>
            <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#e5e7eb"/>
              <stop offset="100%" stop-color="#9ca3af"/>
            </radialGradient>
          </defs>
          <g transform="translate(20,20)">
            <circle r="9" fill="url(#moonGlow)" opacity="0.9">
              <animate attributeName="opacity" values="0.85;1;0.85" dur="3s" repeatCount="indefinite" />
            </circle>
            <circle r="9" fill="#020617" transform="translate(3,-2)" />
          </g>
        </svg>
      `;
    }

    return `
      <svg width="${baseSize}" height="${baseSize}" viewBox="0 0 40 40">
        <defs>
          <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#fde68a"/>
            <stop offset="100%" stop-color="#f59e0b"/>
          </radialGradient>
        </defs>
        <g transform="translate(20,20)">
          <circle r="8" fill="url(#sunGlow)">
            <animate attributeName="r" values="7;9;7" dur="2.2s" repeatCount="indefinite" />
          </circle>
          <g stroke="#fbbf24" stroke-width="2" stroke-linecap="round">
            <line y1="-13" y2="-17">
              <animate attributeName="y2" values="-17;-19;-17" dur="2.2s" repeatCount="indefinite" />
            </line>
            <line y1="13" y2="17">
              <animate attributeName="y2" values="17;19;17" dur="2.2s" repeatCount="indefinite" />
            </line>
            <line x1="-13" x2="-17">
              <animate attributeName="x2" values="-17;-19;-17" dur="2.2s" repeatCount="indefinite" />
            </line>
            <line x1="13" x2="17">
              <animate attributeName="x2" values="17;19;17" dur="2.2s" repeatCount="indefinite" />
            </line>
          </g>
        </g>
      </svg>
    `;
  }

  // Rain / drizzle / showers
  if (
    [51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)
  ) {
    return `
      <svg width="${baseSize}" height="${baseSize}" viewBox="0 0 40 40">
        <g fill="none" stroke-linecap="round">
          <path d="M10 18c0-3 2.5-5.5 5.5-5.5 1 0 1.9.3 2.7.8C19 11.8 20.9 10.5 23 10.5 26 10.5 28.5 13 28.5 16" stroke="#e5e7eb" stroke-width="2.2" stroke-linejoin="round"/>
          <g stroke="#60a5fa" stroke-width="2">
            <line x1="13" y1="20" x2="11" y2="25">
              <animate attributeName="y1" values="20;22;20" dur="1.2s" repeatCount="indefinite" />
              <animate attributeName="y2" values="25;27;25" dur="1.2s" repeatCount="indefinite" />
            </line>
            <line x1="19" y1="21" x2="17" y2="26">
              <animate attributeName="y1" values="21;23;21" dur="1.2s" begin="0.2s" repeatCount="indefinite" />
              <animate attributeName="y2" values="26;28;26" dur="1.2s" begin="0.2s" repeatCount="indefinite" />
            </line>
            <line x1="25" y1="20" x2="23" y2="25">
              <animate attributeName="y1" values="20;22;20" dur="1.2s" begin="0.4s" repeatCount="indefinite" />
              <animate attributeName="y2" values="25;27;25" dur="1.2s" begin="0.4s" repeatCount="indefinite" />
            </line>
          </g>
        </g>
      </svg>
    `;
  }

  // Thunderstorm
  if ([95, 96, 99].includes(code)) {
    return `
      <svg width="${baseSize}" height="${baseSize}" viewBox="0 0 40 40">
        <g fill="none" stroke-linecap="round">
          <path d="M11 18c0-3 2.4-5.5 5.3-5.5 1 0 1.8.3 2.6.8C19.2 11.8 21 10.5 23 10.5 26 10.5 28.5 13 28.5 16" stroke="#e5e7eb" stroke-width="2.2" stroke-linejoin="round"/>
          <polygon points="18,19 14,27 18.5,27 16,33 23,24.5 18.5,24.5 21,19" fill="#facc15">
            <animate attributeName="opacity" values="1;0.4;1" dur="0.7s" repeatCount="indefinite" />
          </polygon>
        </g>
      </svg>
    `;
  }

  // Default: small breathing cloud
  return `
    <svg width="${baseSize}" height="${baseSize}" viewBox="0 0 40 40">
      <path d="M10 21c0-3 2.5-5.5 5.5-5.5 1.2 0 2.3.4 3.2 1 0.7-2.1 2.7-3.5 4.9-3.5 3 0 5.4 2.4 5.4 5.4" fill="none" stroke="#e5e7eb" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <animate attributeName="d" dur="2.4s" repeatCount="indefinite"
          values="
            M10 21c0-3 2.5-5.5 5.5-5.5 1.2 0 2.3.4 3.2 1 0.7-2.1 2.7-3.5 4.9-3.5 3 0 5.4 2.4 5.4 5.4;
            M10 21c0-2.6 2.3-5 5.1-5 1.3 0 2.5.5 3.4 1.2 0.7-1.8 2.4-3.1 4.4-3.1 2.8 0 4.9 2.1 4.9 4.9;
            M10 21c0-3 2.5-5.5 5.5-5.5 1.2 0 2.3.4 3.2 1 0.7-2.1 2.7-3.5 4.9-3.5 3 0 5.4 2.4 5.4 5.4
          " />
      </path>
    </svg>
  `;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function SriLankaMap({ onData, onHover, onSelect, selectedDistrict } = {}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersByNameRef = useRef({});
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState(null);
  const [districts, setDistricts] = useState([]);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    if (!containerRef.current || typeof window === "undefined") return;

    let isDisposed = false;
    let invalidateTimeoutId = null;

    const L = require("leaflet");

    const map = L.map(containerRef.current, {
      center: SRI_LANKA_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 6,
      maxZoom: 14,
      maxBounds: SRI_LANKA_BOUNDS,
      maxBoundsViscosity: 0.9,
    });

    L.tileLayer(BASE_TILE_URL, {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    const districtsLayer = L.layerGroup().addTo(map);

    // Keep Leaflet sized correctly (fixes alignment issues)
    const ro = new ResizeObserver(() => {
      if (isDisposed) return;
      // Avoid Leaflet invalidation while container is hidden/0-sized.
      const el = containerRef.current;
      if (!el || el.offsetWidth <= 0 || el.offsetHeight <= 0) return;
      try {
        map.invalidateSize();
      } catch {
        // ignore
      }
    });
    ro.observe(containerRef.current);

    async function loadDistrictWeather() {
      try {
        // Bump cache key so old "null weather" cache won't be reused
        const cacheKey = "dmews_weather_districts_v2";
        const cacheTtlMs = 10 * 60 * 1000; // 10 minutes

        function readCache() {
          try {
            const raw = sessionStorage.getItem(cacheKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed?.ts || !parsed?.json) return null;
            if (Date.now() - parsed.ts > cacheTtlMs) return null;
            return parsed.json;
          } catch {
            return null;
          }
        }

        function writeCache(json) {
          try {
            sessionStorage.setItem(
              cacheKey,
              JSON.stringify({ ts: Date.now(), json })
            );
          } catch {
            // ignore
          }
        }

        async function fetchGoogleDistricts() {
          const API_BASE =
            process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
          const res = await fetch(`${API_BASE}/weather/districts`);
          const list = await res.json().catch(() => null);
          if (!res.ok) {
            console.error("Weather API error", res.status, list);
            throw new Error("Failed to load weather");
          }
          return Array.isArray(list) ? list : [];
        }

        // Multi-location responses are inconsistent across Open-Meteo changes.
        // For reliability (and to keep the UI populated), we use the
        // per-district fetch with limited concurrency + short cache.
        const cached = readCache();
        const cachedOk =
          cached &&
          Array.isArray(cached) &&
          cached.length === DISTRICTS.length &&
          cached.every((d) => d && typeof d.name === "string" && d.name.length) &&
          cached.some((d) => typeof d?.weather?.temperature === "number");

        const results = cachedOk ? cached : await fetchGoogleDistricts();
        const normalizedResults =
          Array.isArray(results) && results.length === DISTRICTS.length
            ? results
            : DISTRICTS.map((d) => ({ ...d, weather: null, daily: null }));

        if (!cachedOk && Array.isArray(results) && results.length) {
          writeCache(results);
        }

        setDistricts(normalizedResults);
        if (typeof onData === "function") onData(normalizedResults);

        // Clear and redraw markers
        try {
          districtsLayer.clearLayers();
        } catch {
          // ignore
        }

        normalizedResults.forEach((d) => {
          const temp = d.weather?.temperature;
          const wind = d.weather?.windspeed;
          const code = d.weather?.weathercode;
          const isDay = d.weather?.is_day === 1;
          const todayRain =
            d.daily && Array.isArray(d.daily.precipitation_sum)
              ? d.daily.precipitation_sum[0]
              : null;

          const iconChar = getWeatherIcon(code, isDay);
          const ringColor = "rgba(148,163,184,0.9)"; // neutral ring
          const iconHtml = `
            <div
              style="
                display:flex;
                align-items:center;
                justify-content:center;
                width:28px;
                height:28px;
                border-radius:9999px;
                background:rgba(15,23,42,0.9);
                box-shadow:0 0 0 3px ${ringColor};
                font-size:18px;
              "
            >
              <span>${iconChar}</span>
            </div>
          `;

          const marker = L.marker([d.lat, d.lon], {
            icon: L.divIcon({
              className: "",
              html: iconHtml,
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            }),
          });

          const description = describeWeatherCode(code);

          const animatedSvg = getAnimatedWeatherSvg(code, isDay);

          const popupHtml = `
            <div
              style="
                min-width: 220px;
                max-width: 260px;
                padding: 10px 12px;
                border-radius: 14px;
                background:rgba(15,23,42,0.98);
                color:#e5e7eb;
                font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                box-shadow:0 16px 40px rgba(15,23,42,0.95);
                border:1px solid rgba(148,163,184,0.4);
              "
            >
              <div style="display:flex;gap:10px;align-items:center;">
                <div style="flex-shrink:0;">
                  ${animatedSvg}
                </div>
                <div style="flex-grow:1;">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                    <div>
                      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;">
                        District
                      </div>
                      <div style="font-size:13px;font-weight:600;color:#e5e7eb;">
                        ${d.name}
                      </div>
                    </div>
                    
                  </div>
                  <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:10px;color:#9ca3af;">
                    <div>
                      Temp&nbsp;
                      <span style="color:#e5e7eb;font-weight:500;">
                        ${
                          typeof temp === "number"
                            ? temp.toFixed(1) + "°C"
                            : "—"
                        }
                      </span>
                    </div>
                    <div>
                      Wind&nbsp;
                      <span style="color:#e5e7eb;font-weight:500;">
                        ${
                          typeof wind === "number"
                            ? wind.toFixed(1) + " km/h"
                            : "—"
                        }
                      </span>
                    </div>
                    <div>
                      Rain&nbsp;
                      <span style="color:#e5e7eb;font-weight:500;">
                        ${
                          typeof todayRain === "number"
                            ? todayRain.toFixed(1) + " mm"
                            : "—"
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div
                style="
                  margin-top:4px;
                  padding-top:6px;
                  border-top:1px solid rgba(55,65,81,0.8);
                  font-size:11px;
                  color:#d1d5db;
                "
              >
                ${description}
              </div>
            </div>
          `;

          marker.bindPopup(popupHtml);

          // Hover updates local card, popup, and also notifies parent if provided
          marker.on("mouseover", () => {
            const nextHovered = {
              name: d.name,
              temp,
              wind,
              code,
              todayRain,
            };
            setHovered(nextHovered);
            if (typeof onHover === "function") {
              onHover(nextHovered);
            }
            marker.openPopup();
          });
          marker.on("mouseout", () => {
            setHovered(null);
            if (typeof onHover === "function") {
              onHover(null);
            }
            marker.closePopup();
          });

          markersByNameRef.current[d.name] = marker;

          marker.addTo(districtsLayer);
        });

        // Initial size fix once tiles load
        invalidateTimeoutId = setTimeout(() => {
          try {
            map.invalidateSize();
          } catch {
            // ignore
          }
        }, 50);

        setMounted(true);
      } catch (err) {
        console.error("Failed to load district weather", err);
        setError("District weather data unavailable");
        setMounted(true);
      }
    }

    loadDistrictWeather();

    mapRef.current = map;

    return () => {
      isDisposed = true;
      if (invalidateTimeoutId) {
        clearTimeout(invalidateTimeoutId);
        invalidateTimeoutId = null;
      }
      try {
        ro.disconnect();
      } catch {
        // ignore
      }
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Highlight selected district on the map
  useEffect(() => {
    const markers = markersByNameRef.current;
    Object.keys(markers).forEach((name) => {
      const m = markers[name];
      if (!m || !m._icon) return;
      const active = selectedDistrict && name === selectedDistrict;
      m._icon.style.transform = active ? "scale(1.25)" : "scale(1)";
      m._icon.style.zIndex = active ? "500" : "400";
    });
  }, [selectedDistrict]);

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-xl bg-slate-800">
      <div ref={containerRef} className="h-full min-h-[420px] w-full" />
      {!mounted && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-800 text-slate-400">
          <Loader size="md" />
          <span className="text-sm">Loading district weather…</span>
        </div>
      )}
      {error && mounted && (
        <div className="absolute bottom-2 left-2 right-2 rounded bg-amber-900/80 px-2 py-1 text-center text-xs text-amber-200">
          {error}
        </div>
      )}
      <div className="pointer-events-none absolute left-2 top-2 rounded bg-slate-900/80 px-2 py-1 text-[11px] text-slate-200">
        Hover or click a weather icon
      </div>
      {hovered && (
        <div className="pointer-events-none absolute right-2 top-2 w-60 rounded-xl border border-slate-600/70 bg-slate-900/90 px-3 py-2 text-[11px] text-slate-100 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold truncate">{hovered.name}</div>
            {typeof hovered.temp === "number" && (
              <div className="text-xs text-teal-300">
                {hovered.temp.toFixed(1)}°C
              </div>
            )}
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1.5 text-[10px] text-slate-400">
            <div>
              <div className="uppercase tracking-wide text-slate-500">
                Wind
              </div>
              <div className="text-slate-100">
                {typeof hovered.wind === "number"
                  ? `${hovered.wind.toFixed(1)} km/h`
                  : "—"}
              </div>
            </div>
            <div>
              <div className="uppercase tracking-wide text-slate-500">
                Rain today
              </div>
              <div className="text-slate-100">
                {typeof hovered.todayRain === "number"
                  ? `${hovered.todayRain.toFixed(1)} mm`
                  : "—"}
              </div>
            </div>
            <div className="col-span-2">
              <div className="uppercase tracking-wide text-slate-500">
                Condition
              </div>
              <div className="text-slate-100">
                {describeWeatherCode(hovered.code)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

