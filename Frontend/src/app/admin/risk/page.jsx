"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Clock3,
  Droplets,
  ExternalLink,
  Gauge,
  Mountain,
  MapPin,
  RefreshCw,
  Search,
  TrendingUp,
  Waves,
  Radio,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const IRRIGATION_SOURCE =
  "https://services3.arcgis.com/J7ZFXmR8rSmQ3FGf/arcgis/rest/services/gauges_2_view/FeatureServer/0/query";
const IRRIGATION_DASHBOARD =
  "https://www.arcgis.com/apps/dashboards/2cffe83c9ff5497d97375498bdf3ff38";
const REFRESH_INTERVAL = 60_000;
const LANDSLIDE_SOURCE =
  "https://www.dmc.gov.lk/index.php?option=com_dmcreports&view=reports&Itemid=276&report_type_id=5&lang=en";

/* ------------------------------------------------------------------ */
/* Data helpers                                                        */
/* ------------------------------------------------------------------ */

function parseArcGISFeed(payload) {
  const stations = new Map();
  for (const feature of payload?.features || []) {
    const attributes = feature?.attributes || {};
    const station = String(attributes.gauge || "").trim();
    const timestamp = new Date(Number(attributes.EditDate || attributes.CreationDate));
    const level = Number(attributes.water_level);
    const latitude = Number(feature?.geometry?.y);
    const longitude = Number(feature?.geometry?.x);
    if (!station || !Number.isFinite(level) || Number.isNaN(timestamp.getTime())) continue;
    if (!stations.has(station)) stations.set(station, []);
    stations.get(station).push({
      station,
      timestamp,
      level,
      basin: String(attributes.basin || "Unknown basin").trim(),
      rainfall: Number(attributes.rain_fall),
      alertLevel: Number(attributes.alertpull),
      minorFloodLevel: Number(attributes.minorpull),
      majorFloodLevel: Number(attributes.majorpull),
      latitude,
      longitude,
    });
  }

  return [...stations.values()]
    .map((observations) => {
      observations.sort((a, b) => a.timestamp - b.timestamp);
      const latest = observations.at(-1);
      const previous = observations.at(-2);
      return {
        ...latest,
        change: previous ? latest.level - previous.level : 0,
        observations: observations.slice(-48),
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp);
}

function getStationStatus(station) {
  if (station.level >= station.majorFloodLevel)
    return { label: "Major flood", color: "#dc2626", badge: "bg-red-50 text-red-700 ring-1 ring-red-200" };
  if (station.level >= station.minorFloodLevel)
    return { label: "Minor flood", color: "#ea580c", badge: "bg-orange-50 text-orange-700 ring-1 ring-orange-200" };
  if (station.level >= station.alertLevel)
    return { label: "Alert", color: "#eab308", badge: "bg-yellow-50 text-yellow-800 ring-1 ring-yellow-200" };
  return { label: "Normal", color: "#16a34a", badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function formatDate(value) {
  return value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Colombo",
      }).format(value)
    : "No reading";
}

function formatAge(value, currentTime = Date.now()) {
  if (!value) return "No timestamp";
  const minutes = Math.max(0, Math.round((currentTime - value.getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
}

function popupHtml(station, status) {
  return `
    <div style="min-width:230px;font-family:inherit">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <strong style="font-size:14px;color:#0f172a">${escapeHtml(station.station)}</strong>
        <span style="background:${status.color}1a;color:${status.color};font-weight:700;font-size:11px;padding:2px 8px;border-radius:9999px">${status.label}</span>
      </div>
      <div style="margin-top:2px;font-size:12px;color:#64748b">${escapeHtml(station.basin)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
        <div style="background:#f0f9ff;border-radius:10px;padding:8px">
          <div style="font-size:10px;color:#0369a1">Water level</div>
          <div style="font-size:15px;font-weight:700;color:#0c4a6e">${formatNumber(station.level)} m</div>
        </div>
        <div style="background:#f8fafc;border-radius:10px;padding:8px">
          <div style="font-size:10px;color:#64748b">Rainfall</div>
          <div style="font-size:15px;font-weight:700;color:#0f172a">${formatNumber(station.rainfall)} mm</div>
        </div>
      </div>
      <div style="margin-top:8px;font-size:11px;color:#64748b">
        Alert ${formatNumber(station.alertLevel)} · Minor ${formatNumber(station.minorFloodLevel)} · Major ${formatNumber(station.majorFloodLevel)} m
      </div>
      <div style="margin-top:2px;font-size:11px;color:#94a3b8">${formatDate(station.timestamp)}</div>
    </div>
  `;
}

function gaugeIcon(L, color, selected) {
  const size = selected ? 24 : 18;
  return L.divIcon({
    className: "dmews-gauge-marker",
    html: `<span class="${selected ? "is-selected" : ""}" style="background:${color}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

/* ------------------------------------------------------------------ */
/* Map                                                                 */
/* ------------------------------------------------------------------ */

function LiveGaugeMap({ stations, selectedStation, onSelectStation }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const markersRef = useRef(new Map());
  const fittedRef = useRef(false);
  const selectedRef = useRef(selectedStation);
  const [wheelZoom, setWheelZoom] = useState(false);

  selectedRef.current = selectedStation;

  useEffect(() => {
    if (!containerRef.current || typeof window === "undefined" || mapRef.current) return;
    const L = require("leaflet");
    const map = L.map(containerRef.current, {
      center: [7.87, 80.77],
      zoom: 7,
      minZoom: 6,
      maxZoom: 12,
      maxBounds: [[5.4, 79.0], [10.4, 82.5]],
      maxBoundsViscosity: 0.8,
      scrollWheelZoom: false,
      dragging: !L.Browser.mobile,
      tap: false,
      zoomControl: false,
    });
    L.control.zoom({ position: "topright" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    map.on("click", () => {
      map.scrollWheelZoom.enable();
      setWheelZoom(true);
    });
    const container = containerRef.current;
    const leave = () => {
      map.scrollWheelZoom.disable();
      setWheelZoom(false);
    };
    container.addEventListener("mouseleave", leave);
    mapRef.current = map;

    return () => {
      container.removeEventListener("mouseleave", leave);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      markersRef.current = new Map();
      fittedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    const L = require("leaflet");
    const valid = stations.filter(
      (station) => Number.isFinite(station.latitude) && Number.isFinite(station.longitude)
    );
    const seen = new Set();

    valid.forEach((station) => {
      const status = getStationStatus(station);
      const isSelected = station.station === selectedRef.current;
      seen.add(station.station);
      const existing = markersRef.current.get(station.station);
      if (existing) {
        existing.marker.setLatLng([station.latitude, station.longitude]);
        existing.marker.setIcon(gaugeIcon(L, status.color, isSelected));
        existing.marker.setPopupContent(popupHtml(station, status));
        existing.color = status.color;
        return;
      }
      const marker = L.marker([station.latitude, station.longitude], {
        icon: gaugeIcon(L, status.color, isSelected),
        title: station.station,
        riseOnHover: true,
      });
      marker.bindPopup(popupHtml(station, status), { closeButton: true, autoPanPadding: [24, 24] });
      marker.on("click", () => onSelectStation(station.station));
      marker.addTo(layer);
      markersRef.current.set(station.station, { marker, color: status.color });
    });

    markersRef.current.forEach((entry, key) => {
      if (!seen.has(key)) {
        layer.removeLayer(entry.marker);
        markersRef.current.delete(key);
      }
    });

    if (valid.length && !fittedRef.current) {
      map.fitBounds(L.latLngBounds(valid.map((s) => [s.latitude, s.longitude])).pad(0.18), { maxZoom: 8 });
      fittedRef.current = true;
    }
  }, [stations, onSelectStation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const L = require("leaflet");
    markersRef.current.forEach((entry, key) => {
      const isSelected = key === selectedStation;
      entry.marker.setIcon(gaugeIcon(L, entry.color, isSelected));
      entry.marker.setZIndexOffset(isSelected ? 1000 : 0);
    });
    const current = markersRef.current.get(selectedStation);
    if (current && !map.getBounds().contains(current.marker.getLatLng())) {
      map.panTo(current.marker.getLatLng());
    }
  }, [selectedStation]);

  return (
    <div className="relative isolate h-[380px] overflow-hidden rounded-2xl ring-1 ring-slate-200 sm:h-[500px]">
      <div ref={containerRef} className="h-full w-full bg-slate-100" />

      <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-md backdrop-blur">
        {wheelZoom ? "Scroll to zoom · move out to resume page scroll" : "Click the map to enable scroll zoom"}
      </div>

      <div className="absolute bottom-3 left-3 z-[500] rounded-xl bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-slate-600">
          {[
            ["#16a34a", "Normal"],
            ["#eab308", "Alert"],
            ["#ea580c", "Minor flood"],
            ["#dc2626", "Major flood"],
          ].map(([color, label]) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small UI pieces                                                     */
/* ------------------------------------------------------------------ */

function StatCard({ icon: Icon, label, value, detail, tone = "sky" }) {
  const tones = {
    sky: "from-sky-500 to-sky-600 shadow-sky-200",
    emerald: "from-emerald-500 to-emerald-600 shadow-emerald-200",
    amber: "from-amber-400 to-amber-500 shadow-amber-200",
    red: "from-red-500 to-red-600 shadow-red-200",
    slate: "from-slate-500 to-slate-600 shadow-slate-200",
  };
  return (
    <div className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-3">
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-lg ${
            tones[tone] || tones.sky
          }`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-2xl font-bold leading-tight tracking-tight text-slate-900 tabular-nums">
            {value}
          </p>
          <p className="truncate text-sm font-semibold text-slate-700">{label}</p>
        </div>
      </div>
      <p className="mt-3 truncate text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function TrendBadge({ change }) {
  const rising = change > 0.005;
  const falling = change < -0.005;
  const Icon = rising ? ArrowUpRight : falling ? ArrowDownRight : ArrowRight;
  const cls = rising
    ? "bg-red-50 text-red-600 ring-1 ring-red-100"
    : falling
    ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"
    : "bg-slate-100 text-slate-500 ring-1 ring-slate-200";
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(change).toFixed(2)} m
    </span>
  );
}

function StationRow({ station, selected, onSelect }) {
  const status = getStationStatus(station);
  return (
    <button
      type="button"
      onClick={() => onSelect(station.station)}
      className={`w-full rounded-xl border p-3 text-left transition ${
        selected
          ? "border-sky-400 bg-sky-50 shadow-sm ring-2 ring-sky-100"
          : "border-slate-200 bg-white hover:border-sky-200 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3 shrink-0">
          <span
            className="absolute inline-flex h-full w-full rounded-full opacity-25"
            style={{ backgroundColor: status.color, animation: "ping 2s cubic-bezier(0,0,.2,1) infinite" }}
          />
          <span className="relative inline-flex h-3 w-3 rounded-full" style={{ backgroundColor: status.color }} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold text-slate-800">{station.station}</span>
            <span className="text-sm font-bold text-slate-900 tabular-nums">
              {station.level.toFixed(2)}
              <span className="ml-0.5 text-[10px] font-medium text-slate-400">m</span>
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="truncate text-[11px] text-slate-500">
              {station.basin} · {formatAge(station.timestamp)}
            </span>
            <TrendBadge change={station.change} />
          </div>
        </div>
      </div>
    </button>
  );
}

/**
 * Bar chart with flood-threshold reference lines so the user can instantly
 * gauge how close the current level is to Alert / Minor / Major.
 */
function LevelChart({ rows, thresholds }) {
  const [hover, setHover] = useState(null);

  if (!rows.length) {
    return (
      <div className="grid h-64 place-items-center rounded-xl bg-slate-50 text-sm text-slate-500">
        No history available for this gauge.
      </div>
    );
  }

  const thresholdValues = [thresholds.alert, thresholds.minor, thresholds.major].filter(Number.isFinite);
  const levels = rows.map((item) => item.level);
  const allValues = [...levels, ...thresholdValues];
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const pad = (rawMax - rawMin) * 0.08 || 0.3;
  const min = rawMin - pad;
  const max = rawMax + pad;
  const range = max - min || 1;

  const active = hover != null ? rows[hover] : null;

  const thresholdLines = [
    { value: thresholds.major, color: "#dc2626", label: "Major" },
    { value: thresholds.minor, color: "#ea580c", label: "Minor" },
    { value: thresholds.alert, color: "#eab308", label: "Alert" },
  ].filter((t) => Number.isFinite(t.value));

  return (
    <div className="relative">
      <div className="relative h-64 rounded-xl border border-slate-200 bg-slate-50/40">
        {/* Bars */}
        <div className="flex h-full items-end gap-1 px-2 pb-1 pt-4">
          {rows.map((row, i) => {
            const height = ((row.level - min) / range) * 100;
            const isLast = i === rows.length - 1;
            return (
              <div
                key={row.timestamp.toISOString()}
                className="relative flex h-full flex-1 items-end"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <div
                  className={`w-full rounded-t-sm transition ${
                    hover === i ? "bg-sky-600" : isLast ? "bg-sky-500" : "bg-sky-300 hover:bg-sky-500"
                  }`}
                  style={{ height: `${Math.max(height, 1.5)}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Threshold reference lines */}
        {thresholdLines.map((t) => {
          const y = ((max - t.value) / range) * 100;
          return (
            <div
              key={t.label}
              className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed"
              style={{ top: `${y}%`, borderColor: t.color }}
            >
              <span
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm"
                style={{ backgroundColor: t.color }}
              >
                {t.label} {t.value.toFixed(1)} m
              </span>
            </div>
          );
        })}

        {active && (
          <div
            className="pointer-events-none absolute -top-3 z-20 -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
            style={{ left: `${((hover + 0.5) / rows.length) * 100}%` }}
          >
            <strong>{active.level.toFixed(2)} m</strong>
            <span className="ml-1.5 text-slate-300">{formatDate(active.timestamp)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ThresholdProximity({ station }) {
  const items = [
    { label: "Alert", value: station.alertLevel, color: "#eab308" },
    { label: "Minor flood", value: station.minorFloodLevel, color: "#ea580c" },
    { label: "Major flood", value: station.majorFloodLevel, color: "#dc2626" },
  ].filter((t) => Number.isFinite(t.value) && t.value > 0);

  if (!items.length) return null;

  return (
    <div className="space-y-2.5">
      {items.map((t) => {
        const ratio = Math.min((station.level / t.value) * 100, 100);
        const crossed = station.level >= t.value;
        return (
          <div key={t.label} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-[11px] font-medium text-slate-500">{t.label}</span>
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all"
                style={{
                  width: `${ratio}%`,
                  backgroundColor: crossed ? t.color : `${t.color}99`,
                }}
              />
            </div>
            <span
              className="w-16 shrink-0 text-right text-[11px] font-semibold tabular-nums"
              style={{ color: crossed ? t.color : "#64748b" }}
            >
              {t.value.toFixed(2)} m
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="h-44 animate-pulse rounded-3xl bg-slate-200" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
      <div className="h-[420px] animate-pulse rounded-2xl bg-slate-200" />
    </div>
  );
}

function formatReportDate(report) {
  if (!report?.date) return "Date unavailable";
  const date = new Date(`${report.date}T${report.time || "00:00"}:00+05:30`);
  if (Number.isNaN(date.getTime())) return report.date;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Colombo",
  }).format(date);
}

function normalizeDistrictName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\bdistrict\b/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getLandslideSeverity(level) {
  if (level >= 3) return { label: "Red", color: "#dc2626", fill: "#fecaca" };
  if (level === 2) return { label: "Amber", color: "#d97706", fill: "#fde68a" };
  return { label: "Yellow", color: "#ca8a04", fill: "#fef3c7" };
}

function LandslideMap({ warnings }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const L = require("leaflet");
    const map = L.map(containerRef.current, {
      center: [7.87, 80.77],
      zoom: 7,
      minZoom: 6,
      maxZoom: 10,
      maxBounds: [[5.88, 79.5], [9.9, 81.9]],
      maxBoundsViscosity: 1,
      attributionControl: false,
    });
    containerRef.current.style.background = "#e2e8f0";
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    const L = require("leaflet");
    const warningByDivision = warnings.reduce((result, warning) => {
      for (const division of warning.divisions || []) {
        const key = normalizeDistrictName(division);
        const current = result.get(key);
        if (!current || warning.level > current.level) {
          result.set(key, { ...warning, division });
        }
      }
      return result;
    }, new Map());

    Promise.all([
      fetch("/sri-lanka-districts.geojson", { cache: "no-store" }).then((r) => r.json()),
      fetch("/sri-lanka-dsds.geojson", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([districtGeoJson, dsGeoJson]) => {
        if (!mapRef.current) return;
        layer.clearLayers();
        const boundary = L.geoJSON(districtGeoJson, {
          interactive: false,
          style: {
            color: "#94a3b8",
            weight: 1.2,
            fillColor: "#ffffff",
            fillOpacity: 1,
            opacity: 0.9,
          },
        }).addTo(layer);

        L.geoJSON(dsGeoJson, {
          style: (feature) => {
            const name = feature?.properties?.name || "";
            const warning = warningByDivision.get(normalizeDistrictName(name));
            const severity = warning ? getLandslideSeverity(warning.level) : null;
            return {
              color: severity?.color || "#cbd5e1",
              weight: severity ? 1.5 : 0.45,
              fillColor: severity?.fill || "#ffffff",
              fillOpacity: severity ? 0.95 : 1,
            };
          },
          onEachFeature: (feature, polygon) => {
            const name = feature?.properties?.name || "";
            const warning = warningByDivision.get(normalizeDistrictName(name));
            if (warning) {
              const severity = getLandslideSeverity(warning.level);
              polygon.bindPopup(
                `<strong>${escapeHtml(name)} DS Division</strong><br>${severity.label} warning<br>${escapeHtml(
                  warning.district
                )}`
              );
            }
          },
        }).addTo(layer);

        map.fitBounds(boundary.getBounds().pad(0.05), { maxZoom: 8 });
      })
      .catch(() => {});
  }, [warnings]);

  return <div ref={containerRef} className="h-[420px] w-full rounded-2xl bg-slate-100" />;
}

function LandslideWarnings({ report, warnings, loading, error, onRetry, fetchedAt }) {
  const highestLevel = warnings.length ? Math.max(...warnings.map((w) => w.level)) : 0;

  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true">
        <div className="h-36 animate-pulse rounded-3xl bg-slate-200" />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-3xl bg-slate-200" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-700 via-orange-600 to-rose-500 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-200" />
              Official DMC early warnings
            </div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Landslide warnings</h2>
            <p className="mt-2 max-w-2xl text-sm text-orange-50/90">
              Areas extracted from the latest Disaster Management Centre warning, shown on the map by warning level.
            </p>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-orange-800 shadow-md transition hover:bg-orange-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh warnings
          </button>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={AlertTriangle}
          label="Districts under warning"
          value={new Set(warnings.map((w) => w.district)).size}
          detail="From latest report"
          tone="amber"
        />
        <StatCard
          icon={Mountain}
          label="Highest warning"
          value={highestLevel ? getLandslideSeverity(highestLevel).label : "—"}
          detail={`${warnings.filter((w) => w.level === 3).length} red-level areas`}
          tone="red"
        />
        <StatCard
          icon={Clock3}
          label="Latest issue"
          value={report ? formatReportDate(report) : "—"}
          detail={report?.validity || "No report data"}
          tone="emerald"
        />
      </div>

      <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Warning map</h3>
            <p className="text-xs text-slate-500">DS Division areas highlighted by warning severity.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[
              [getLandslideSeverity(3).fill, "Red"],
              [getLandslideSeverity(2).fill, "Amber"],
              [getLandslideSeverity(1).fill, "Yellow"],
            ].map(([fill, label]) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600"
              >
                <i className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: fill }} />
                {label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700">
              <Mountain className="h-3.5 w-3.5" />
              {warnings.length} warning areas
            </span>
          </div>
        </div>
        <LandslideMap warnings={warnings} />
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {warnings.map((warning) => {
            const severity = getLandslideSeverity(warning.level);
            return (
              <article
                key={`${warning.district}-${warning.level}`}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <div className="border-l-4 p-4" style={{ borderColor: severity.color }}>
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-semibold text-slate-900">{warning.district}</h4>
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                      style={{ backgroundColor: severity.fill, color: severity.color }}
                    >
                      Level {warning.level} · {severity.label}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">{warning.divisions.join(", ")}</p>
                </div>
              </article>
            );
          })}
        </div>
        {!warnings.length && (
          <p className="mt-4 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
            No warning areas were extracted from the latest report.
          </p>
        )}
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-2 pb-2 text-xs text-slate-500">
        <span>
          Last checked {fetchedAt ? formatDate(new Date(fetchedAt)) : "—"} · Extracted with{" "}
          {report?.extractionMethod || "official report"}.
        </span>
        <a
          href={LANDSLIDE_SOURCE}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-orange-700 hover:text-orange-900"
        >
          Open DMC landslide reports <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AdminRiskPage() {
  const [stations, setStations] = useState([]);
  const [riskLevels, setRiskLevels] = useState({});
  const [activeTab, setActiveTab] = useState("flood");
  const [landslideReport, setLandslideReport] = useState(null);
  const [landslideWarnings, setLandslideWarnings] = useState([]);
  const [landslideLoading, setLandslideLoading] = useState(false);
  const [landslideError, setLandslideError] = useState("");
  const [landslideFetchedAt, setLandslideFetchedAt] = useState(null);
  const [selectedStation, setSelectedStation] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const loadLandslideWarnings = useCallback(async () => {
    setLandslideLoading(true);
    setLandslideError("");
    try {
      const response = await fetch(`${API_BASE}/landslide-warnings`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Could not load landslide warnings.");
      setLandslideReport(data?.report || null);
      setLandslideWarnings(Array.isArray(data?.warnings) ? data.warnings : []);
      setLandslideFetchedAt(data?.fetchedAt || new Date().toISOString());
    } catch (loadError) {
      setLandslideError(loadError?.message || "Could not load landslide warnings.");
    } finally {
      setLandslideLoading(false);
    }
  }, []);

  const loadData = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [feedResponse, riskResponse] = await Promise.all([
        fetch(
          `${IRRIGATION_SOURCE}?where=1%3D1&outFields=basin%2Cgauge%2Cwater_level%2Crain_fall%2Calertpull%2Cminorpull%2Cmajorpull%2CCreationDate%2CEditDate&orderByFields=CreationDate%20DESC&resultRecordCount=1000&returnGeometry=true&f=json&refresh=${Date.now()}`,
          { cache: "no-store" }
        ),
        fetch(`${API_BASE}/risk-levels`, { cache: "no-store" }),
      ]);
      const feed = await feedResponse.json();
      const risk = await riskResponse.json().catch(() => []);
      if (!feedResponse.ok) throw new Error("Irrigation feed is unavailable.");
      if (!riskResponse.ok) throw new Error(risk?.message || "Could not load published risk levels.");
      if (feed?.error) throw new Error(feed.error.message || "Irrigation ArcGIS feed is unavailable.");
      const nextStations = parseArcGISFeed(feed);
      setStations(nextStations);
      setSelectedStation((current) => current || nextStations[0]?.station || "");
      setRiskLevels(
        Object.fromEntries(
          (Array.isArray(risk) ? risk : [])
            .filter((item) => item?.district && item?.level)
            .map((item) => [item.district, String(item.level).toLowerCase()])
        )
      );
      setUpdatedAt(new Date());
    } catch (loadError) {
      setError(loadError?.message || "Could not load live risk data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const timer = window.setInterval(() => loadData(true), REFRESH_INTERVAL);
    const clock = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(clock);
    };
  }, [loadData]);

  useEffect(() => {
    if (activeTab === "landslide" && !landslideReport && !landslideError) {
      loadLandslideWarnings();
    }
  }, [activeTab, landslideError, landslideReport, loadLandslideWarnings]);

  const selected = stations.find((station) => station.station === selectedStation) || stations[0];
  const selectedStatus = selected ? getStationStatus(selected) : null;
  const chartRows = useMemo(() => selected?.observations.slice(-18) || [], [selected]);

  const filteredStations = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter(
      (station) =>
        station.station.toLowerCase().includes(q) || station.basin.toLowerCase().includes(q)
    );
  }, [stations, query]);

  const latestReading = stations.reduce(
    (latest, station) => (!latest || station.timestamp > latest ? station.timestamp : latest),
    null
  );
  const basinCount = new Set(stations.map((station) => station.basin)).size;
  const risingCount = stations.filter((station) => station.change > 0.005).length;
  const highRiskCount = Object.values(riskLevels).filter((level) => level === "high").length;
  const alertOrAbove = stations.filter((s) => s.level >= s.alertLevel).length;

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        .dmews-gauge-marker {
          background: transparent;
          border: 0;
        }
        .dmews-gauge-marker span {
          display: block;
          width: 100%;
          height: 100%;
          border-radius: 9999px;
          border: 3px solid #fff;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.4);
          box-sizing: border-box;
          transition: transform 0.15s ease;
        }
        .dmews-gauge-marker:hover span {
          transform: scale(1.15);
        }
        .dmews-gauge-marker span.is-selected {
          box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.45), 0 2px 10px rgba(15, 23, 42, 0.45);
        }
        .leaflet-popup-content-wrapper {
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.2);
        }
        .leaflet-popup-content {
          margin: 14px 16px;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>

      {/* Hero */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-700 via-sky-600 to-cyan-500 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-48 w-48 rounded-full bg-white/10" />

        <div className="relative">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
            </span>
            Live irrigation department feed
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Risk intelligence centre</h1>
          <p className="mt-2 max-w-2xl text-sm text-sky-50/90">
            Monitor Sri Lankan river gauges and publish the DMEWS district risk level from one operational view.
          </p>

          {/* Inline quick stats */}
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            <span className="inline-flex items-center gap-1.5 text-sky-50">
              <Gauge className="h-3.5 w-3.5" />
              <strong className="font-semibold text-white">{stations.length}</strong> gauges
            </span>
            <span className="inline-flex items-center gap-1.5 text-sky-50">
              <Waves className="h-3.5 w-3.5" />
              <strong className="font-semibold text-white">{basinCount}</strong> basins
            </span>
            <span className="inline-flex items-center gap-1.5 text-sky-50">
              <TrendingUp className="h-3.5 w-3.5" />
              <strong className="font-semibold text-white">{risingCount}</strong> rising
            </span>
            <span className="inline-flex items-center gap-1.5 text-sky-50">
              <AlertTriangle className="h-3.5 w-3.5" />
              <strong className="font-semibold text-white">{alertOrAbove}</strong> at alert or above
            </span>
          </div>
        </div>

        <div className="relative mt-5 flex items-center justify-between gap-4 border-t border-white/15 pt-4">
          <span className="text-xs text-sky-100">
            <Radio className="mr-1 inline h-3 w-3 align-text-bottom" />
            Checked {updatedAt ? formatDate(updatedAt) : "—"}
          </span>
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-sky-800 shadow-md transition hover:bg-sky-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh now
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Risk warning type"
        className="flex w-full gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm sm:w-fit"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "flood"}
          onClick={() => setActiveTab("flood")}
          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:flex-none ${
            activeTab === "flood"
              ? "bg-sky-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Waves className="h-4 w-4" />
          Flood and river risk
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "landslide"}
          onClick={() => setActiveTab("landslide")}
          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:flex-none ${
            activeTab === "landslide"
              ? "bg-orange-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Mountain className="h-4 w-4" />
          Landslide warnings
          {landslideWarnings.length > 0 && (
            <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-bold">
              {landslideWarnings.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "landslide" ? (
        <LandslideWarnings
          report={landslideReport}
          warnings={landslideWarnings}
          loading={landslideLoading}
          error={landslideError}
          fetchedAt={landslideFetchedAt}
          onRetry={loadLandslideWarnings}
        />
      ) : (
        <>
          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error} Existing values remain visible until the next successful refresh.</span>
            </div>
          )}

          {/* Stats */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Gauge}
              label="Reporting stations"
              value={stations.length}
              detail={`Across ${basinCount} river basins`}
            />
            <StatCard
              icon={TrendingUp}
              label="Rising gauges"
              value={risingCount}
              detail="Compared with previous observation"
              tone="amber"
            />
            <StatCard
              icon={AlertTriangle}
              label="High published risk"
              value={highRiskCount}
              detail="DMEWS district levels"
              tone="red"
            />
            <StatCard
              icon={Clock3}
              label="Latest observation"
              value={formatAge(latestReading, now)}
              detail={formatDate(latestReading)}
              tone="emerald"
            />
          </div>

          {/* Map */}
          <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Live gauge map</h2>
                <p className="text-xs text-slate-500">
                  Each dot is a river gauge. Click a dot to see its level, rainfall and flood thresholds.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700">
                <MapPin className="h-3.5 w-3.5" />
                {stations.length} gauges · {basinCount} basins
              </span>
            </div>
            <LiveGaugeMap
              stations={stations}
              selectedStation={selectedStation}
              onSelectStation={setSelectedStation}
            />
          </section>

          {/* Station list + detail */}
          <div className="grid gap-5 xl:grid-cols-[1.1fr_1.9fr]">
            <section className="rounded-3xl border border-slate-200/80 bg-slate-50/70 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-900">River gauge status</h2>
                  <p className="text-xs text-slate-500">
                    {filteredStations.length} of {stations.length} stations
                  </p>
                </div>
                <Waves className="h-5 w-5 text-sky-600" />
              </div>

              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search station or basin"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
                {filteredStations.length ? (
                  filteredStations.map((station) => (
                    <StationRow
                      key={station.station}
                      station={station}
                      selected={station.station === selectedStation}
                      onSelect={setSelectedStation}
                    />
                  ))
                ) : (
                  <p className="rounded-xl bg-white p-5 text-sm text-slate-500">
                    {stations.length
                      ? "No stations match your search."
                      : "No station observations are available."}
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                      Selected gauge
                    </span>
                    {selectedStatus && (
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${selectedStatus.badge}`}>
                        {selectedStatus.label}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-2 truncate text-2xl font-bold tracking-tight text-slate-900">
                    {selected?.station || "No station selected"}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {selected ? `${selected.basin} basin · ` : ""}Water level in metres · Sri Lanka time
                  </p>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-sky-50 to-sky-100 px-4 py-3 text-right">
                  <p className="text-3xl font-bold tracking-tight text-sky-900 tabular-nums">
                    {selected ? selected.level.toFixed(2) : "—"}{" "}
                    <span className="text-lg">m</span>
                  </p>
                  <p className="text-xs text-sky-700">
                    {selected ? formatDate(selected.timestamp) : "No data"}
                  </p>
                </div>
              </div>

              {selected && (
                <>
                  <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      ["Rainfall", `${formatNumber(selected.rainfall)} mm`],
                      ["Alert", `${formatNumber(selected.alertLevel)} m`],
                      ["Minor flood", `${formatNumber(selected.minorFloodLevel)} m`],
                      ["Major flood", `${formatNumber(selected.majorFloodLevel)} m`],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-slate-50 px-3 py-2">
                        <p className="text-[11px] text-slate-500">{label}</p>
                        <p className="text-sm font-bold text-slate-900 tabular-nums">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-800">Recent levels</h3>
                      <span className="text-[11px] text-slate-500">Last {chartRows.length} readings</span>
                    </div>
                    <LevelChart
                      rows={chartRows}
                      thresholds={{
                        alert: selected.alertLevel,
                        minor: selected.minorFloodLevel,
                        major: selected.majorFloodLevel,
                      }}
                    />
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span>{chartRows[0] ? formatDate(chartRows[0].timestamp) : "No history"}</span>
                      <span>{chartRows.at(-1) ? formatDate(chartRows.at(-1).timestamp) : ""}</span>
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl bg-slate-50 p-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Threshold proximity
                    </p>
                    <ThresholdProximity station={selected} />
                  </div>
                </>
              )}

              <div className="mt-5 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
                <Droplets className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                The feed provides observed levels. Flood thresholds are defined by the department; always
                cross-check the source when publishing risk.
              </div>
            </section>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-2 pb-2 text-xs text-slate-500">
            <span>Feed checked {updatedAt ? formatDate(updatedAt) : "—"} · Live ArcGIS gauge records</span>
            <div className="flex items-center gap-4">
              <a
                href={IRRIGATION_DASHBOARD}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:text-sky-900"
              >
                Open department dashboard <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <a
                href={IRRIGATION_SOURCE}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:text-sky-900"
              >
                View live data source <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}