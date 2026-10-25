"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle2,
  Clock3,
  Droplets,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Waves,
  Zap,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const IRRIGATION_SOURCE =
  "https://services3.arcgis.com/J7ZFXmR8rSmQ3FGf/arcgis/rest/services/gauges_2_view/FeatureServer/0/query";
const DISTRICTS_GEOJSON = "/sri-lanka-districts.geojson";
const REFRESH_INTERVAL = 60_000;

const LEVELS = {
  safe: { label: "Safe", color: "#16a34a", fill: "#bbf7d0" },
  low: { label: "Low", color: "#ca8a04", fill: "#fef08a" },
  medium: { label: "Medium", color: "#ea580c", fill: "#fed7aa" },
  high: { label: "High", color: "#dc2626", fill: "#fecaca" },
};

// Static class names so Tailwind can see them.
const RISK_STYLES = {
  safe: { active: "bg-emerald-600 text-white shadow-sm", dot: "bg-emerald-500", card: "border-emerald-200 bg-emerald-50/40" },
  low: { active: "bg-yellow-500 text-white shadow-sm", dot: "bg-yellow-500", card: "border-yellow-200 bg-yellow-50/40" },
  medium: { active: "bg-orange-500 text-white shadow-sm", dot: "bg-orange-500", card: "border-orange-200 bg-orange-50/40" },
  high: { active: "bg-red-600 text-white shadow-sm", dot: "bg-red-600", card: "border-red-200 bg-red-50/40" },
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function normalizeDistrict(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\bdistrict\b/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function districtName(feature) {
  return (
    feature?.properties?.shapeName ||
    feature?.properties?.NAME_2 ||
    feature?.properties?.name ||
    ""
  );
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

function parseStations(payload) {
  const byGauge = new Map();
  for (const feature of payload?.features || []) {
    const a = feature?.attributes || {};
    const name = String(a.gauge || "").trim();
    const level = Number(a.water_level);
    if (!name || !Number.isFinite(level)) continue;
    const reading = {
      name,
      basin: String(a.basin || "Unknown basin").trim(),
      level,
      rainfall: Number(a.rain_fall),
      alert: Number(a.alertpull),
      minor: Number(a.minorpull),
      major: Number(a.majorpull),
      timestamp: new Date(Number(a.EditDate || a.CreationDate)),
      lat: Number(feature?.geometry?.y),
      lng: Number(feature?.geometry?.x),
    };
    const previous = byGauge.get(name);
    if (!previous || reading.timestamp > previous.timestamp) byGauge.set(name, reading);
  }
  return [...byGauge.values()].sort((a, b) => b.timestamp - a.timestamp);
}

function stationStatus(station) {
  if (station.level >= station.major)
    return { label: "Major flood", color: "#dc2626", badge: "bg-red-100 text-red-700" };
  if (station.level >= station.minor)
    return { label: "Minor flood", color: "#ea580c", badge: "bg-orange-100 text-orange-700" };
  if (station.level >= station.alert)
    return { label: "Alert", color: "#eab308", badge: "bg-yellow-100 text-yellow-800" };
  return { label: "Normal", color: "#16a34a", badge: "bg-emerald-100 text-emerald-700" };
}

function pointInRing(point, ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [x, y] = ring[index];
    const [previousX, previousY] = ring[previous];
    const intersects =
      y > point[1] !== previousY > point[1] &&
      point[0] < ((previousX - x) * (point[1] - y)) / (previousY - y) + x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInGeometry(point, geometry) {
  if (!geometry) return false;
  if (geometry.type === "Polygon") {
    return geometry.coordinates[0]?.length > 3 && pointInRing(point, geometry.coordinates[0]);
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some(
      (polygon) => polygon[0]?.length > 3 && pointInRing(point, polygon[0])
    );
  }
  return false;
}

function inferDistrictLevels(geoJson, stations) {
  const inferred = {};
  const rank = { safe: 0, low: 1, medium: 2, high: 3 };
  for (const station of stations) {
    if (!Number.isFinite(station.lat) || !Number.isFinite(station.lng)) continue;
    const feature = geoJson?.features?.find((item) =>
      pointInGeometry([station.lng, station.lat], item.geometry)
    );
    if (!feature) continue;
    const name = districtName(feature);
    if (!name) continue;
    const key = normalizeDistrict(name);
    const status = stationStatus(station);
    const level =
      status.label === "Major flood"
        ? "high"
        : status.label === "Minor flood"
          ? "medium"
          : status.label === "Alert"
            ? "low"
            : "safe";
    const currentRank = rank[inferred[key]] ?? -1;
    if (rank[level] > currentRank) inferred[key] = level;
  }
  return inferred;
}

function formatDate(value) {
  if (!value || Number.isNaN(value.getTime())) return "No reading";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Colombo",
  }).format(value);
}

function gaugePopup(station, status) {
  return `
    <div style="min-width:220px;font-family:inherit">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <strong style="font-size:14px;color:#0f172a">${escapeHtml(station.name)}</strong>
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
        Alert ${formatNumber(station.alert)} · Minor ${formatNumber(station.minor)} · Major ${formatNumber(station.major)} m
      </div>
      <div style="margin-top:2px;font-size:11px;color:#94a3b8">${formatDate(station.timestamp)}</div>
    </div>
  `;
}

function gaugeIcon(L, color, selected) {
  const size = selected ? 24 : 18;
  return L.divIcon({
    className: "dmews-prediction-gauge",
    html: `<span class="${selected ? "is-selected" : ""}" style="background:${color}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

/* ------------------------------------------------------------------ */
/* Map                                                                 */
/* ------------------------------------------------------------------ */

function DistrictGaugeMap({ geoJson, riskLevels, stations, selectedStation, onSelectStation }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const geoLayerRef = useRef(null);
  const markerLayerRef = useRef(null);
  const markersRef = useRef(new Map());
  const fittedRef = useRef(false);
  const riskRef = useRef(riskLevels);
  const selectedRef = useRef(selectedStation);
  const selectRef = useRef(onSelectStation);
  const [wheelZoom, setWheelZoom] = useState(false);

  riskRef.current = riskLevels;
  selectedRef.current = selectedStation;
  selectRef.current = onSelectStation;

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const L = require("leaflet");
    const map = L.map(containerRef.current, {
      center: [7.87, 80.77],
      zoom: 7,
      minZoom: 6,
      maxZoom: 12,
      maxBounds: [[5.4, 79.0], [10.4, 82.5]],
      maxBoundsViscosity: 0.8,
      // Page scrolling must win: the wheel only zooms after the map is clicked.
      scrollWheelZoom: false,
      // On touch screens one finger scrolls the page; two fingers move the map.
      dragging: !L.Browser.mobile,
      tap: false,
      zoomControl: false,
    });
    L.control.zoom({ position: "topright" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);

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
      geoLayerRef.current = null;
      markerLayerRef.current = null;
      markersRef.current = new Map();
      fittedRef.current = false;
    };
  }, []);

  // District polygons: built once per GeoJSON; later risk changes only restyle them.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geoJson) return;
    const L = require("leaflet");
    if (geoLayerRef.current) map.removeLayer(geoLayerRef.current);

    const styleFor = (feature) => {
      const level = riskRef.current[normalizeDistrict(districtName(feature))] || "safe";
      return { color: "#ffffff", weight: 1.2, fillColor: LEVELS[level].fill, fillOpacity: 0.72 };
    };

    const geoLayer = L.geoJSON(geoJson, {
      style: styleFor,
      onEachFeature: (feature, layer) => {
        layer.bindPopup(() => {
          const name = districtName(feature) || "District";
          const level = riskRef.current[normalizeDistrict(name)] || "safe";
          const info = LEVELS[level];
          return `
            <div style="min-width:170px;font-family:inherit">
              <strong style="font-size:14px;color:#0f172a">${escapeHtml(name)}</strong>
              <div style="margin-top:6px;display:inline-block;background:${info.fill};color:${info.color};font-weight:700;font-size:11px;padding:2px 10px;border-radius:9999px;border:1px solid ${info.color}55">
                ${info.label} risk
              </div>
              <div style="margin-top:6px;font-size:11px;color:#64748b">Published DMEWS level</div>
            </div>`;
        });
        layer.on("mouseover", () => layer.setStyle({ weight: 2.5, fillOpacity: 0.88 }));
        layer.on("mouseout", () => geoLayer.resetStyle(layer));
      },
    }).addTo(map);
    geoLayer.bringToBack();
    geoLayerRef.current = geoLayer;

    // Fit once on first load; never re-zoom on background refreshes.
    if (!fittedRef.current && geoLayer.getBounds().isValid()) {
      map.fitBounds(geoLayer.getBounds().pad(0.04), { maxZoom: 8 });
      fittedRef.current = true;
    }
  }, [geoJson]);

  useEffect(() => {
    if (geoLayerRef.current) {
      geoLayerRef.current.setStyle((feature) => {
        const level = riskLevels[normalizeDistrict(districtName(feature))] || "safe";
        return { color: "#ffffff", weight: 1.2, fillColor: LEVELS[level].fill, fillOpacity: 0.72 };
      });
    }
  }, [riskLevels, geoJson]);

  // Station dots: reuse markers so open popups survive refreshes.
  useEffect(() => {
    const layer = markerLayerRef.current;
    if (!layer) return;
    const L = require("leaflet");
    const valid = stations.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
    const seen = new Set();

    valid.forEach((station) => {
      const status = stationStatus(station);
      const isSelected = station.name === selectedRef.current;
      seen.add(station.name);
      const existing = markersRef.current.get(station.name);
      if (existing) {
        existing.marker.setLatLng([station.lat, station.lng]);
        existing.marker.setIcon(gaugeIcon(L, status.color, isSelected));
        existing.marker.setPopupContent(gaugePopup(station, status));
        existing.color = status.color;
        return;
      }
      const marker = L.marker([station.lat, station.lng], {
        icon: gaugeIcon(L, status.color, isSelected),
        title: station.name,
        riseOnHover: true,
      });
      marker.bindPopup(gaugePopup(station, status), { autoPanPadding: [24, 24] });
      marker.on("click", () => selectRef.current(station.name));
      marker.addTo(layer);
      markersRef.current.set(station.name, { marker, color: status.color });
    });

    markersRef.current.forEach((entry, key) => {
      if (!seen.has(key)) {
        layer.removeLayer(entry.marker);
        markersRef.current.delete(key);
      }
    });
  }, [stations]);

  // Highlight the selected dot and bring it into view.
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
    // `isolate` keeps Leaflet's high z-index panes from overlapping page headers and menus.
    <div className="relative isolate h-[400px] overflow-hidden rounded-2xl ring-1 ring-slate-200 sm:h-[540px]">
      <div ref={containerRef} className="h-full w-full bg-slate-100" />
      <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-md backdrop-blur">
        {wheelZoom ? "Scroll to zoom · move the mouse out to scroll the page" : "Click the map to zoom with the scroll wheel"}
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
    green: "from-emerald-500 to-emerald-600 shadow-emerald-200",
    amber: "from-amber-400 to-amber-500 shadow-amber-200",
    red: "from-red-500 to-red-600 shadow-red-200",
  };
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-center gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-lg ${tones[tone] || tones.sky}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-2xl font-bold leading-tight tracking-tight text-slate-900">{value}</p>
          <p className="truncate text-sm font-semibold text-slate-700">{label}</p>
        </div>
      </div>
      <p className="mt-3 truncate text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function Toggle({ checked, onChange, disabled, label, description, icon: Icon, onColor = "bg-indigo-600" }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon className={`h-4 w-4 shrink-0 ${checked ? "text-indigo-600" : "text-slate-400"}`} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">{label}</p>
          <p className="truncate text-[11px] text-slate-500" title={description}>{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={onChange}
        className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60 ${checked ? onColor : "bg-slate-300"}`}
      >
        <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="h-36 animate-pulse rounded-3xl bg-slate-200" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
      <div className="h-[460px] animate-pulse rounded-2xl bg-slate-200" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AdminRiskPredictionPage() {
  const [geoJson, setGeoJson] = useState(null);
  const [riskLevels, setRiskLevels] = useState({});
  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState("");
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingRisk, setSavingRisk] = useState("");
  const [savingSms, setSavingSms] = useState(false);
  const [autoUpdatedDistricts, setAutoUpdatedDistricts] = useState([]);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);

  const loadData = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [geoResponse, riskResponse, smsResponse, stationResponse] = await Promise.all([
        fetch(DISTRICTS_GEOJSON, { cache: "no-store" }),
        fetch(`${API_BASE}/risk-levels`, { cache: "no-store" }),
        fetch(`${API_BASE}/risk-levels/sms-settings`, { cache: "no-store" }),
        fetch(
          `${IRRIGATION_SOURCE}?where=1%3D1&outFields=basin%2Cgauge%2Cwater_level%2Crain_fall%2Calertpull%2Cminorpull%2Cmajorpull%2CCreationDate%2CEditDate&orderByFields=CreationDate%20DESC&resultRecordCount=1000&returnGeometry=true&f=json&refresh=${Date.now()}`,
          { cache: "no-store" }
        ),
      ]);
      const [geo, risk, sms, stationFeed] = await Promise.all([
        geoResponse.json(),
        riskResponse.json(),
        smsResponse.json(),
        stationResponse.json(),
      ]);
      if (!geoResponse.ok || !Array.isArray(geo?.features)) throw new Error("District map is unavailable.");
      if (!riskResponse.ok) throw new Error(risk?.message || "Could not load district risk.");
      if (!smsResponse.ok) throw new Error(sms?.message || "Could not load SMS setting.");
      if (!stationResponse.ok || stationFeed?.error) throw new Error("Irrigation gauge feed is unavailable.");
      setGeoJson((current) => current || geo);
      setSmsEnabled(sms?.enabled !== false);
      const publishedLevels = Object.fromEntries(
        (Array.isArray(risk) ? risk : [])
          .filter((item) => item?.district && item?.level)
          .map((item) => [normalizeDistrict(item.district), String(item.level).toLowerCase()])
      );
      const nextStations = parseStations(stationFeed);
      const inferredLevels = inferDistrictLevels(geo, nextStations);
      const changed = [];
      if (autoUpdateEnabled) {
        await Promise.all(
          Object.entries(inferredLevels)
            .filter(([district, level]) => publishedLevels[district] !== level)
            .map(async ([district, level]) => {
              const feature = geo.features.find(
                (item) => normalizeDistrict(districtName(item)) === district
              );
              const original = districtName(feature);
              if (!original) return;
              const response = await fetch(`${API_BASE}/risk-levels`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ district: original, level }),
              });
              if (!response.ok) throw new Error(`Could not automatically update ${original}.`);
              changed.push(original);
              publishedLevels[district] = level;
            })
        );
      }
      setAutoUpdatedDistricts(changed);
      setRiskLevels(publishedLevels);
      setStations(nextStations);
      setSelectedStation((current) => current || nextStations[0]?.name || "");
      setUpdatedAt(new Date());
    } catch (loadError) {
      setError(loadError?.message || "Could not load risk prediction data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [autoUpdateEnabled]);

  useEffect(() => {
    loadData();
    const timer = window.setInterval(() => loadData(true), REFRESH_INTERVAL);
    return () => window.clearInterval(timer);
  }, [loadData]);

  async function updateRisk(district, level) {
    setSavingRisk(district);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/risk-levels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ district, level }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Could not update district risk.");
      setRiskLevels((current) => ({ ...current, [normalizeDistrict(district)]: data.level }));
    } catch (updateError) {
      setError(updateError?.message || "Could not update district risk.");
    } finally {
      setSavingRisk("");
    }
  }

  async function toggleSms() {
    setSavingSms(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/risk-levels/sms-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !smsEnabled }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Could not update SMS setting.");
      setSmsEnabled(data.enabled !== false);
    } catch (toggleError) {
      setError(toggleError?.message || "Could not update SMS setting.");
    } finally {
      setSavingSms(false);
    }
  }

  const selected = stations.find((station) => station.name === selectedStation) || stations[0];
  const selectedState = selected ? stationStatus(selected) : null;
  const highDistricts = Object.values(riskLevels).filter((level) => level === "high").length;
  const floodStations = stations.filter((station) => station.level >= station.minor).length;
  const alertStations = stations.filter((station) => station.level >= station.alert).length;

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <style jsx global>{`
        .dmews-prediction-gauge {
          background: transparent;
          border: 0;
        }
        .dmews-prediction-gauge span {
          display: block;
          width: 100%;
          height: 100%;
          border: 3px solid #fff;
          border-radius: 9999px;
          box-sizing: border-box;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.4);
          transition: transform 0.15s ease;
        }
        .dmews-prediction-gauge:hover span {
          transform: scale(1.15);
        }
        .dmews-prediction-gauge span.is-selected {
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.5), 0 2px 10px rgba(15, 23, 42, 0.45);
        }
        .leaflet-popup-content-wrapper {
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.2);
        }
        .leaflet-popup-content {
          margin: 14px 16px;
        }
      `}</style>

      {/* Hero */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-sky-500 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-48 w-48 rounded-full bg-white/10" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
              <ShieldAlert className="h-3.5 w-3.5" /> District risk prediction
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">District risk command map</h1>
            <p className="mt-2 max-w-3xl text-sm text-indigo-50/90">
              Live river gauge conditions over the published district alert map. Districts are adjusted provisionally from the highest live gauge threshold found inside each one.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-indigo-800 shadow-md transition hover:bg-indigo-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
            </button>
            <span className="inline-flex items-center gap-1 text-xs text-indigo-100">
              <Clock3 className="h-3.5 w-3.5" /> Checked {updatedAt ? formatDate(updatedAt) : "—"}
            </span>
          </div>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ShieldAlert} label="High-risk districts" value={highDistricts} detail="Published DMEWS levels" tone="red" />
        <StatCard icon={Waves} label="Live gauge stations" value={stations.length} detail="From Irrigation Department" />
        <StatCard icon={AlertTriangle} label="Gauge alerts" value={alertStations} detail={`${floodStations} at minor flood or above`} tone="amber" />
        <StatCard icon={autoUpdateEnabled ? CheckCircle2 : Clock3} label="Automatic adjustment" value={autoUpdateEnabled ? "On" : "Off"} detail="Rule-based live district updates" tone={autoUpdateEnabled ? "green" : "amber"} />
      </div>

      {/* Compact automation controls */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
        <div className="grid gap-2 md:grid-cols-2">
          <Toggle
            icon={Zap}
            label="Automatic adjustment"
            description="Updates district levels from live gauges on every refresh. No SMS is sent by this alone."
            checked={autoUpdateEnabled}
            onChange={() => setAutoUpdateEnabled((current) => !current)}
          />
          <Toggle
            icon={smsEnabled ? Bell : BellOff}
            label="Automatic high-risk SMS"
            description="SMS registered users in a district when it changes to High."
            checked={smsEnabled}
            disabled={savingSms}
            onChange={toggleSms}
            onColor="bg-emerald-600"
          />
        </div>
        {autoUpdatedDistricts.length > 0 && (
          <p className="mt-2 rounded-lg bg-indigo-50 px-3 py-1.5 text-[11px] text-indigo-800">
            Updated automatically: {autoUpdatedDistricts.join(", ")}
          </p>
        )}
      </section>

      {/* Map */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Sri Lanka district alert map</h2>
            <p className="text-xs text-slate-500">District fills show published alerts. Dots are live gauges — click one for details.</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-600">
            {Object.entries(LEVELS).map(([key, item]) => (
              <span key={key} className="inline-flex items-center gap-1.5">
                <i className="h-3 w-3 rounded-sm" style={{ background: item.fill, border: `2px solid ${item.color}` }} />
                {item.label}
              </span>
            ))}
          </div>
        </div>
        <DistrictGaugeMap
          geoJson={geoJson}
          riskLevels={riskLevels}
          stations={stations}
          selectedStation={selectedStation}
          onSelectStation={setSelectedStation}
        />
      </section>

      {/* Selected gauge */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Selected live gauge</h2>
              {selectedState && (
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${selectedState.badge}`}>{selectedState.label}</span>
              )}
            </div>
            <p className="text-xs text-slate-500">Click any map dot or pick a station.</p>
          </div>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              value={selected?.name || ""}
              onChange={(event) => setSelectedStation(event.target.value)}
              className="max-w-[220px] appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm font-medium text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              {stations.map((station) => (
                <option key={station.name} value={station.name}>{station.name}</option>
              ))}
            </select>
          </div>
        </div>

        {selected ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Gauge", selected.name],
              ["River basin", selected.basin],
              ["Water level", `${formatNumber(selected.level)} m`],
              ["Rainfall", `${formatNumber(selected.rainfall)} mm`],
              ["Alert threshold", `${formatNumber(selected.alert)} m`],
              ["Minor flood", `${formatNumber(selected.minor)} m`],
              ["Major flood", `${formatNumber(selected.major)} m`],
              ["Updated", formatDate(selected.timestamp)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 truncate text-sm font-bold text-slate-900" title={String(value)}>{value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-slate-500">No live gauge records available.</p>
        )}
      </section>

      {/* Publish risk */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Publish district risk levels</h2>
            <p className="mt-1 text-xs text-slate-500">Review or manually override the levels shown on the map. Automatic adjustment updates these from live gauge thresholds.</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${smsEnabled ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
            {smsEnabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
            SMS {smsEnabled ? "enabled" : "disabled"}
          </span>
        </div>

        {Object.keys(riskLevels).length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">No district risk levels have been published yet.</p>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Object.entries(riskLevels).map(([district, level]) => {
              const style = RISK_STYLES[level] || RISK_STYLES.safe;
              const saving = savingRisk === district;
              return (
                <div key={district} className={`rounded-2xl border p-3.5 transition ${style.card}`}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <i className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} />
                      <span className="truncate text-sm font-semibold capitalize text-slate-800">{district}</span>
                    </span>
                    {level === "high" ? (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    )}
                  </div>
                  <div role="group" aria-label={`Risk level for ${district}`} className="grid grid-cols-4 gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200">
                    {Object.entries(LEVELS).map(([value, item]) => (
                      <button
                        key={value}
                        type="button"
                        disabled={saving}
                        aria-pressed={level === value}
                        onClick={() => level !== value && updateRisk(district, value)}
                        className={`rounded-lg px-1 py-1.5 text-[11px] font-semibold transition disabled:opacity-60 ${
                          level === value ? RISK_STYLES[value].active : "text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  {saving && <p className="mt-2 text-[11px] text-slate-500">Saving…</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1"><Droplets className="h-3.5 w-3.5 text-sky-600" /> Live water levels refresh every 60 seconds.</span>
        <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Rule-based automation with admin-controlled SMS.</span>
      </div>
    </div>
  );
}