"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function invalidateWeatherMapAndMarkers(map, districtsLayer, L) {
  if (!map || !map.getContainer()) return;
  try {
    map.invalidateSize({ animate: false });
    if (districtsLayer && L) {
      districtsLayer.eachLayer((lyr) => {
        try {
          if (lyr instanceof L.Marker) lyr.update();
        } catch {
          // ignore
        }
      });
    }
  } catch {
    // ignore
  }
}

function scheduleWeatherMapRelayout(map, districtsLayer, L, timeoutBucket) {
  const bump = () => invalidateWeatherMapAndMarkers(map, districtsLayer, L);
  bump();
  queueMicrotask(bump);
  requestAnimationFrame(() => {
    bump();
    requestAnimationFrame(bump);
  });
  if (timeoutBucket) {
    [0, 50, 120, 280, 600].forEach((ms) => {
      timeoutBucket.push(window.setTimeout(bump, ms));
    });
  }
}

export function SriLankaMap({ onData, onHover, onSelect, selectedDistrict } = {}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersByNameRef = useRef({});
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState(null);
  const [districts, setDistricts] = useState([]);
  const [hovered, setHovered] = useState(null);

  useLayoutEffect(() => {
    if (!containerRef.current || typeof window === "undefined") return;

    let isDisposed = false;
    let initRaf = null;
    const relayoutTimeouts = [];
    let map = null;
    let districtsLayer = null;
    let ro = null;

    const L = require("leaflet");

    function attachMap() {
      const el = containerRef.current;
      if (isDisposed || !el) return;

      if (el.offsetWidth <= 0 || el.offsetHeight <= 0) {
        initRaf = requestAnimationFrame(attachMap);
        return;
      }
      initRaf = null;

      map = L.map(el, {
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

      districtsLayer = L.layerGroup().addTo(map);

      map.whenReady(() => {
        if (isDisposed || !map) return;
        invalidateWeatherMapAndMarkers(map, districtsLayer, L);
      });

      ro = new ResizeObserver(() => {
        if (isDisposed || !map) return;
        const obsEl = containerRef.current;
        if (!obsEl || obsEl.offsetWidth <= 0 || obsEl.offsetHeight <= 0) return;
        invalidateWeatherMapAndMarkers(map, districtsLayer, L);
      });
      ro.observe(el);

      mapRef.current = map;

      loadDistrictWeather();
    }

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

        async function fetchDistrictsWeather() {
          const API_BASE =
            process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
          const res = await fetch(`${API_BASE}/weather/districts`);
          const list = await res.json().catch(() => null);
          if (!res.ok) {
            console.error("Weather API error", res.status, list);
            throw new Error("Failed to load weather");
          }
          if (!Array.isArray(list)) return [];
          return list.filter((row) => row?.weather?.provider === "weatherapi");
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
          cached.some((d) => d?.weather?.provider === "weatherapi");

        const results = cachedOk ? cached : await fetchDistrictsWeather();
        if (isDisposed || !map || !districtsLayer) return;

        // Prefer WeatherAPI rows when present, keyed by district name.
        const list = Array.isArray(results) ? results : [];
        const byName = new Map(
          list
            .filter((r) => r?.name)
            .map((r) => [String(r.name).trim().toLowerCase(), r])
        );

        const normalizedResults = DISTRICTS.map((d) => {
          const key = d.name.trim().toLowerCase();
          const row = byName.get(key);
          if (!row) return { ...d, weather: null, daily: null };
          return {
            ...d,
            ...row,
            weather:
              row?.weather?.provider === "weatherapi"
                ? row.weather
                : row?.weather || null,
          };
        });

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
          const conditionText = d.weather?.text || "WeatherAPI condition unavailable";
          const conditionIcon = d.weather?.condition_icon;
          const todayRain =
            d.daily && Array.isArray(d.daily.precipitation_sum)
              ? d.daily.precipitation_sum[0]
              : null;

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
                overflow:hidden;
              "
            >
              ${
                conditionIcon
                  ? `<img src="${conditionIcon}" alt="" style="width:24px;height:24px;object-fit:contain;" />`
                  : `<span style="font-size:14px;color:#e2e8f0;">W</span>`
              }
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

          const popupIcon = conditionIcon
            ? `<img src="${conditionIcon}" alt="" style="width:40px;height:40px;object-fit:contain;" />`
            : `<div style="width:40px;height:40px;border-radius:9999px;display:flex;align-items:center;justify-content:center;background:#1e293b;color:#e2e8f0;font-size:11px;">N/A</div>`;

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
                  ${popupIcon}
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
                ${conditionText}
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
              conditionText,
              todayRain,
            };
            setHovered(nextHovered);
            if (typeof onHover === "function") {
              onHover(nextHovered);
            }
            marker.openPopup();
          });
          marker.on("click", () => {
            if (typeof onSelect === "function") {
              onSelect(d.name);
            }
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

        if (isDisposed || !map || !districtsLayer) return;
        scheduleWeatherMapRelayout(map, districtsLayer, L, relayoutTimeouts);

        setMounted(true);
      } catch (err) {
        console.error("Failed to load district weather", err);
        setError("District weather data unavailable");
        setMounted(true);
      }
    }

    attachMap();

    return () => {
      isDisposed = true;
      if (initRaf != null) cancelAnimationFrame(initRaf);
      relayoutTimeouts.forEach((id) => clearTimeout(id));
      relayoutTimeouts.length = 0;
      try {
        ro?.disconnect();
      } catch {
        // ignore
      }
      try {
        map?.remove();
      } catch {
        // ignore
      }
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
    <div className="relative h-full min-h-0 w-full overflow-hidden rounded-xl bg-slate-800">
      <div ref={containerRef} className="h-full min-h-0 w-full" />
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
                {hovered.conditionText || "—"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

