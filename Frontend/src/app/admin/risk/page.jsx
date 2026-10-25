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
  MapPin,
  RefreshCw,
  Search,
  TrendingUp,
  Waves,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const IRRIGATION_SOURCE =
  "https://services3.arcgis.com/J7ZFXmR8rSmQ3FGf/arcgis/rest/services/gauges_2_view/FeatureServer/0/query";
const IRRIGATION_DASHBOARD =
  "https://www.arcgis.com/apps/dashboards/2cffe83c9ff5497d97375498bdf3ff38";
const REFRESH_INTERVAL = 60_000;

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
    return { label: "Major flood", color: "#dc2626", badge: "bg-red-100 text-red-700" };
  if (station.level >= station.minorFloodLevel)
    return { label: "Minor flood", color: "#ea580c", badge: "bg-orange-100 text-orange-700" };
  if (station.level >= station.alertLevel)
    return { label: "Alert", color: "#eab308", badge: "bg-yellow-100 text-yellow-800" };
  return { label: "Normal", color: "#16a34a", badge: "bg-emerald-100 text-emerald-700" };
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
    <div style="min-width:220px;font-family:inherit">
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
        Alert ${formatNumber(station.alertLevel)} m · Minor ${formatNumber(station.minorFloodLevel)} m · Major ${formatNumber(station.majorFloodLevel)} m
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

  // Create the map once.
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
      // Page scrolling must win: the wheel only zooms after the map is clicked.
      scrollWheelZoom: false,
      // On touch screens, one finger scrolls the page; two fingers move the map.
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

  // Add / update / remove station dots. Existing markers are reused so open popups survive refreshes.
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

    // Fit once on first load; never re-zoom on background refreshes.
    if (valid.length && !fittedRef.current) {
      map.fitBounds(L.latLngBounds(valid.map((s) => [s.latitude, s.longitude])).pad(0.18), { maxZoom: 8 });
      fittedRef.current = true;
    }
  }, [stations, onSelectStation]);

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
    <div className="relative isolate h-[380px] overflow-hidden rounded-2xl ring-1 ring-slate-200 sm:h-[500px]">
      <div ref={containerRef} className="h-full w-full bg-slate-100" />

      <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-md backdrop-blur">
        {wheelZoom ? "Scroll to zoom · move the mouse out to scroll the page" : "Click the map to zoom with the scroll wheel"}
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
  const colors = {
    sky: "from-sky-500 to-sky-600 shadow-sky-200",
    emerald: "from-emerald-500 to-emerald-600 shadow-emerald-200",
    amber: "from-amber-400 to-amber-500 shadow-amber-200",
    red: "from-red-500 to-red-600 shadow-red-200",
  };
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-center gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-lg ${colors[tone] || colors.sky}`}>
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

function TrendBadge({ change }) {
  const rising = change > 0.005;
  const falling = change < -0.005;
  const Icon = rising ? ArrowUpRight : falling ? ArrowDownRight : ArrowRight;
  const cls = rising
    ? "bg-red-50 text-red-600"
    : falling
    ? "bg-emerald-50 text-emerald-600"
    : "bg-slate-100 text-slate-500";
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
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: status.color }} />
          <span className="truncate font-semibold text-slate-800">{station.station}</span>
        </span>
        <span className="text-base font-bold text-slate-900">
          {station.level.toFixed(2)} <small className="text-xs font-medium text-slate-500">m</small>
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
        <span className="truncate">{station.basin} · {formatDate(station.timestamp)}</span>
        <TrendBadge change={station.change} />
      </div>
    </button>
  );
}

function LevelChart({ rows }) {
  const [hover, setHover] = useState(null);
  if (!rows.length) {
    return (
      <div className="grid h-56 place-items-center rounded-xl bg-slate-50 text-sm text-slate-500">
        No history available for this gauge.
      </div>
    );
  }
  const levels = rows.map((item) => item.level);
  const min = Math.min(...levels);
  const max = Math.max(...levels);
  const active = hover != null ? rows[hover] : null;

  return (
    <div className="relative">
      <div className="flex h-56 items-end gap-1 border-b border-l border-slate-200 px-2 pb-0">
        {rows.map((row, i) => {
          const height = max === min ? 55 : 16 + ((row.level - min) / (max - min)) * 84;
          const isLast = i === rows.length - 1;
          return (
            <div
              key={row.timestamp.toISOString()}
              className="relative flex h-full flex-1 items-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div
                className={`w-full rounded-t-md transition ${
                  hover === i
                    ? "bg-sky-600"
                    : isLast
                    ? "bg-sky-500"
                    : "bg-sky-300 hover:bg-sky-500"
                }`}
                style={{ height: `${height}%` }}
                title={`${row.level.toFixed(2)} m · ${formatDate(row.timestamp)}`}
              />
            </div>
          );
        })}
      </div>
      {active && (
        <div
          className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
          style={{ left: `${((hover + 0.5) / rows.length) * 100}%` }}
        >
          <strong>{active.level.toFixed(2)} m</strong>
          <span className="ml-1.5 text-slate-300">{formatDate(active.timestamp)}</span>
        </div>
      )}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="h-40 animate-pulse rounded-3xl bg-slate-200" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
      <div className="h-[420px] animate-pulse rounded-2xl bg-slate-200" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AdminRiskPage() {
  const [stations, setStations] = useState([]);
  const [riskLevels, setRiskLevels] = useState({});
  const [selectedStation, setSelectedStation] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

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

  const selected = stations.find((station) => station.station === selectedStation) || stations[0];
  const selectedStatus = selected ? getStationStatus(selected) : null;
  const chartRows = useMemo(() => selected?.observations.slice(-18) || [], [selected]);
  const filteredStations = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter(
      (station) => station.station.toLowerCase().includes(q) || station.basin.toLowerCase().includes(q)
    );
  }, [stations, query]);
  const latestReading = stations.reduce(
    (latest, station) => (!latest || station.timestamp > latest ? station.timestamp : latest),
    null
  );
  const basinCount = new Set(stations.map((station) => station.basin)).size;
  const risingCount = stations.filter((station) => station.change > 0.005).length;
  const highRiskCount = Object.values(riskLevels).filter((level) => level === "high").length;

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <style jsx global>{`
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
      `}</style>

      {/* Hero */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-700 via-sky-600 to-cyan-500 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-48 w-48 rounded-full bg-white/10" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
              Live irrigation department feed
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Risk intelligence centre</h1>
            <p className="mt-2 max-w-2xl text-sm text-sky-50/90">
              Monitor Sri Lankan river gauges and publish the DMEWS district risk level from one operational view.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-sky-800 shadow-md transition hover:bg-sky-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh now
            </button>
            <span className="text-xs text-sky-100">Checked {updatedAt ? formatDate(updatedAt) : "—"}</span>
          </div>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error} Existing values remain visible until the next successful refresh.</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Gauge} label="Reporting stations" value={stations.length} detail={`Across ${basinCount} river basins`} />
        <StatCard icon={TrendingUp} label="Rising gauges" value={risingCount} detail="Compared with previous observation" tone="amber" />
        <StatCard icon={AlertTriangle} label="High published risk" value={highRiskCount} detail="DMEWS district levels" tone="red" />
        <StatCard icon={Clock3} label="Latest observation" value={formatAge(latestReading, now)} detail={formatDate(latestReading)} tone="emerald" />
      </div>

      {/* Map */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Live gauge map</h2>
            <p className="text-xs text-slate-500">Each dot is a river gauge. Click a dot to see its level, rainfall and flood thresholds.</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700">
            <MapPin className="h-3.5 w-3.5" />
            {stations.length} gauges · {basinCount} basins
          </span>
        </div>
        <LiveGaugeMap stations={stations} selectedStation={selectedStation} onSelectStation={setSelectedStation} />
      </section>

      {/* Station list + detail */}
      <div className="grid gap-5 xl:grid-cols-[1.1fr_1.9fr]">
        <section className="rounded-3xl border border-slate-200/80 bg-slate-50/70 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">River gauge status</h2>
              <p className="text-xs text-slate-500">{filteredStations.length} of {stations.length} stations</p>
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
                <StationRow key={station.station} station={station} selected={station.station === selectedStation} onSelect={setSelectedStation} />
              ))
            ) : (
              <p className="rounded-xl bg-white p-5 text-sm text-slate-500">
                {stations.length ? "No stations match your search." : "No station observations are available."}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">Selected gauge</span>
                {selectedStatus && (
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${selectedStatus.badge}`}>{selectedStatus.label}</span>
                )}
              </div>
              <h2 className="mt-2 truncate text-2xl font-bold tracking-tight text-slate-900">{selected?.station || "No station selected"}</h2>
              <p className="mt-1 text-xs text-slate-500">
                {selected ? `${selected.basin} basin · ` : ""}Water level in metres · Sri Lanka time
              </p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-sky-50 to-sky-100 px-4 py-3 text-right">
              <p className="text-3xl font-bold tracking-tight text-sky-900">{selected ? selected.level.toFixed(2) : "—"} <span className="text-lg">m</span></p>
              <p className="text-xs text-sky-700">{selected ? formatDate(selected.timestamp) : "No data"}</p>
            </div>
          </div>

          {selected && (
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Rainfall", `${formatNumber(selected.rainfall)} mm`],
                ["Alert", `${formatNumber(selected.alertLevel)} m`],
                ["Minor flood", `${formatNumber(selected.minorFloodLevel)} m`],
                ["Major flood", `${formatNumber(selected.majorFloodLevel)} m`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[11px] text-slate-500">{label}</p>
                  <p className="text-sm font-bold text-slate-900">{value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5">
            <LevelChart rows={chartRows} />
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>{chartRows[0] ? formatDate(chartRows[0].timestamp) : "No history"}</span>
              <span>{chartRows.at(-1) ? formatDate(chartRows.at(-1).timestamp) : ""}</span>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
            <Droplets className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
            The feed provides observed levels. Flood thresholds are not inferred here; use the department source for threshold interpretation.
          </div>
        </section>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 pb-2 text-xs text-slate-500">
        <span>Feed checked {updatedAt ? formatDate(updatedAt) : "—"} · Live ArcGIS gauge records</span>
        <div className="flex items-center gap-4">
          <a href={IRRIGATION_DASHBOARD} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:text-sky-900">
            Open department dashboard <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a href={IRRIGATION_SOURCE} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:text-sky-900">
            View live data source <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </footer>
    </div>
  );
}