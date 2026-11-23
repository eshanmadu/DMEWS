"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  ExternalLink,
  Gauge,
  Info,
  Mountain,
  RefreshCw,
  Waves,
} from "lucide-react";
import { IRRIGATION_DASHBOARD, buildGaugeFeedUrl, getStationStatus, parseArcGISFeed } from "@/lib/riverGauges";
import {
  NEARBY_KM,
  SHARP_DROP_M,
  SHARP_RISE_M,
  buildAreas,
  floodToLandslide,
  landslideToFlood,
  locateGauges,
  matchWarningAreas,
  normalizeDistrict,
} from "@/lib/cascadeRisk";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const REFRESH_INTERVAL = 5 * 60_000;
const LANDSLIDE_SOURCE =
  "https://www.dmc.gov.lk/index.php?option=com_dmcreports&view=reports&Itemid=276&report_type_id=5&lang=en";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
    : "—";
}

function landslideSeverity(level) {
  if (level >= 3) return { label: "Red", color: "#dc2626", fill: "#fecaca" };
  if (level === 2) return { label: "Amber", color: "#d97706", fill: "#fde68a" };
  return { label: "Yellow", color: "#ca8a04", fill: "#fef3c7" };
}

async function getJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || `Request failed (${response.status})`);
  return data;
}

/* ------------------------------------------------------------------ */
/* Map                                                                 */
/* ------------------------------------------------------------------ */

function CascadeMap({ areaResults, gauges, mode }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const fittedRef = useRef(false);
  const [wheelZoom, setWheelZoom] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const L = require("leaflet");
    const map = L.map(containerRef.current, {
      center: [7.3, 80.6],
      zoom: 8,
      minZoom: 6,
      maxZoom: 12,
      maxBounds: [[5.4, 79.0], [10.4, 82.5]],
      maxBoundsViscosity: 0.8,
      scrollWheelZoom: false,
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
      fittedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    const L = require("leaflet");
    layer.clearLayers();

    const areaGroup = L.featureGroup().addTo(layer);
    for (const r of areaResults) {
      const style = mode === "score" ? r.band : landslideSeverity(r.level);
      L.geoJSON(
        { type: "Feature", geometry: r.area.geometry },
        { style: { color: style.color, weight: 1.6, fillColor: style.fill, fillOpacity: 0.65 } }
      )
        .bindPopup(
          `<strong>${escapeHtml(r.area.name)} DS Division</strong><br>${escapeHtml(r.area.district)} district<br>` +
            `Landslide warning: level ${r.level} (${landslideSeverity(r.level).label})<br>` +
            `Flood and river factors: ${r.score}/100 (${r.band.label})`
        )
        .addTo(areaGroup);

      // Dashed links from the warned area to gauges within the radius.
      for (const x of r.nearby) {
        if (!Number.isFinite(r.area.centerLat)) continue;
        L.polyline(
          [
            [r.area.centerLat, r.area.centerLng],
            [x.gauge.latitude, x.gauge.longitude],
          ],
          { color: "#475569", weight: 1.2, opacity: 0.7, dashArray: "4 4", interactive: false }
        ).addTo(layer);
      }
    }

    for (const g of gauges) {
      const status = getStationStatus(g);
      L.circleMarker([g.latitude, g.longitude], {
        radius: 6,
        color: "#ffffff",
        weight: 2,
        fillColor: status.color,
        fillOpacity: 1,
      })
        .bindPopup(
          `<strong>${escapeHtml(g.station)}</strong><br>${escapeHtml(g.basin)}${
            g.district ? ` · ${escapeHtml(g.district)}` : ""
          }<br>${g.level.toFixed(2)} m · ${status.label}<br>Change ${g.change >= 0 ? "+" : ""}${g.change.toFixed(2)} m`
        )
        .addTo(layer);
    }

    if (!fittedRef.current && areaResults.length) {
      map.fitBounds(areaGroup.getBounds().pad(0.6), { maxZoom: 9 });
      fittedRef.current = true;
    }
  }, [areaResults, gauges, mode]);

  return (
    <div className="relative isolate h-[420px] overflow-hidden rounded-2xl ring-1 ring-slate-200 sm:h-[520px]">
      <div ref={containerRef} className="h-full w-full bg-slate-100" />
      <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-md">
        {wheelZoom ? "Scroll to zoom · move out to resume page scroll" : "Click the map to enable scroll zoom"}
      </div>
      <div className="absolute bottom-3 left-3 z-[500] max-w-[90%] rounded-xl bg-white/95 px-3 py-2 text-xs shadow-lg">
        <p className="mb-1 font-semibold text-slate-700">
          {mode === "score" ? "Areas: flood and river factors" : "Areas: DMC landslide level"}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-slate-600">
          {(mode === "score"
            ? [
                ["#fecaca", "High"],
                ["#fed7aa", "Elevated"],
                ["#fef9c3", "Low"],
                ["#e2e8f0", "None found"],
              ]
            : [
                ["#fecaca", "Red"],
                ["#fde68a", "Amber"],
                ["#fef3c7", "Yellow"],
              ]
          ).map(([fill, label]) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-sm ring-1 ring-slate-300" style={{ backgroundColor: fill }} />
              {label}
            </span>
          ))}
        </div>
        <p className="mt-1 text-slate-500">Dots are river gauges coloured by flood status. Dashed lines link gauges within {NEARBY_KM} km.</p>
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
    amber: "from-amber-400 to-amber-500 shadow-amber-200",
    red: "from-red-500 to-red-600 shadow-red-200",
    emerald: "from-emerald-500 to-emerald-600 shadow-emerald-200",
  };
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-lg ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-2xl font-bold leading-tight tracking-tight text-slate-900 tabular-nums">{value}</p>
          <p className="truncate text-sm font-semibold text-slate-700">{label}</p>
        </div>
      </div>
      <p className="mt-3 truncate text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function Pill({ style, children }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{ backgroundColor: style.fill, color: style.color }}
    >
      {children}
    </span>
  );
}

function SourceNotice({ errors }) {
  const entries = Object.entries(errors).filter(([, message]) => message);
  if (!entries.length) return null;
  return (
    <div role="alert" className="space-y-1 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {entries.map(([source, message]) => (
        <p key={source} className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>{source}:</strong> {message}
          </span>
        </p>
      ))}
    </div>
  );
}

function GaugeLine({ gauge, distanceKm, signals = [] }) {
  const status = getStationStatus(gauge);
  return (
    <li className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
          {gauge.station}
          <span className="text-xs font-normal text-slate-500">
            {gauge.district || "—"} · {distanceKm === 0 ? "inside area" : `${distanceKm.toFixed(1)} km`}
          </span>
        </span>
        <span className="flex items-center gap-2 text-xs tabular-nums">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${status.badge}`}>{status.label}</span>
          <span className="font-semibold text-slate-800">{gauge.level.toFixed(2)} m</span>
          <span className={gauge.change > 0.005 ? "text-red-600" : gauge.change < -0.005 ? "text-emerald-600" : "text-slate-500"}>
            {gauge.change >= 0 ? "+" : ""}
            {gauge.change.toFixed(2)}
          </span>
        </span>
      </div>
      {signals.map((s) => (
        <p key={s.key} className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-red-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {s.label}. {s.detail}
        </p>
      ))}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function FloodToLandslideSection({ results, unmatched, gaugesAvailable }) {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-700">
            <Waves className="h-4 w-4" /> River <ArrowRight className="h-3 w-3" /> <Mountain className="h-4 w-4" /> Landslide
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">1. How flood and river conditions raise landslide risk</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            For each DS division under a DMC landslide warning, this lists flood and river conditions within {NEARBY_KM} km.
            High rivers erode banks and undercut slopes, and heavy rain saturates soil.
          </p>
        </div>
      </div>

      {!gaugesAvailable && (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          River gauge data is unavailable, so gauge factors are missing below.
        </p>
      )}

      {results.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {results.map((r) => (
            <article key={r.area.id} className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="border-l-4 p-4" style={{ borderColor: r.band.color }}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-slate-900">{r.area.name}</h3>
                    <p className="text-xs text-slate-500">
                      {r.area.district} district
                      {r.reportedName !== r.area.name ? ` · reported as "${r.reportedName}"` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Pill style={landslideSeverity(r.level)}>Landslide L{r.level}</Pill>
                    <Pill style={r.band}>
                      River factors {r.score}/100 · {r.band.label}
                    </Pill>
                  </div>
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${r.score}%`, backgroundColor: r.band.color }} />
                </div>

                {r.factors.length ? (
                  <ul className="mt-3 space-y-1.5">
                    {r.factors.map((f) => (
                      <li key={f.label} className="flex gap-2 text-sm">
                        <span className="w-9 shrink-0 text-right font-semibold tabular-nums text-slate-500">+{f.points}</span>
                        <span>
                          <span className="font-medium text-slate-800">{f.label}</span>
                          <span className="block text-xs text-slate-500">{f.detail}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    {r.nearby.length
                      ? "No flood or river factors found right now. The landslide warning still applies."
                      : `No river gauge within ${NEARBY_KM} km, so river conditions cannot be checked here.`}
                  </p>
                )}
                <p className="mt-3 text-xs text-slate-400">
                  {r.nearby.length} gauge{r.nearby.length === 1 ? "" : "s"} within {NEARBY_KM} km
                  {r.nearby.length ? `: ${r.nearby.map((x) => x.gauge.station).join(", ")}` : ""}
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">No DS divisions are under a landslide warning in the latest report.</p>
      )}

      {unmatched.length > 0 && (
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          Not placed on the map (name not found in the boundary file):{" "}
          {unmatched.map((u) => `${u.division} (${u.district}, L${u.level})`).join(", ")}.
        </p>
      )}
    </section>
  );
}

function LandslideToFloodSection({ basins, noGauge, includeYellow, onToggleYellow }) {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-orange-700">
            <Mountain className="h-4 w-4" /> Landslide <ArrowRight className="h-3 w-3" /> <Waves className="h-4 w-4" /> Flood
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">2. How landslides could affect flooding</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Landslide debris can block a river and form a temporary dam. When it breaks, a surge can travel downstream.
            Basins are found from gauges within {NEARBY_KM} km of warned areas.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
          <input type="checkbox" checked={includeYellow} onChange={(e) => onToggleYellow(e.target.checked)} />
          Include level 1 (yellow) warnings
        </label>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-xl bg-orange-50 px-3 py-2.5 text-xs text-orange-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Warning signs on a gauge: a sharp drop (≤ {SHARP_DROP_M} m since the previous reading) can mean the river is blocked upstream;
          a sudden rise (≥ +{SHARP_RISE_M} m) can follow a blockage releasing. Always verify on the ground.
        </span>
      </div>

      {basins.length ? (
        <div className="space-y-4">
          {basins.map((b) => (
            <article key={b.basin} className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="border-l-4 p-4" style={{ borderColor: b.concern.color }}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-slate-900">{b.basin}</h3>
                    <p className="text-xs text-slate-500">
                      Gauge districts in this basin: {b.districts.join(", ") || "—"}
                    </p>
                  </div>
                  <Pill style={b.concern}>{b.concern.label}</Pill>
                </div>

                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Warned areas feeding this basin</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {b.sources.map((s) => (
                    <Pill key={s.area.id} style={landslideSeverity(s.level)}>
                      {s.area.name} · L{s.level}
                    </Pill>
                  ))}
                </div>

                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Gauges within {NEARBY_KM} km (where debris could enter)
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {b.nearby.map((x) => (
                    <GaugeLine key={x.gauge.station} gauge={x.gauge} distanceKm={x.distanceKm} signals={x.signals} />
                  ))}
                </ul>

                {b.sameBasin.length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-600">
                      {b.sameBasin.length} more gauge{b.sameBasin.length === 1 ? "" : "s"} in {b.basin}: check whether downstream
                    </summary>
                    <ul className="mt-1.5 space-y-1.5">
                      {b.sameBasin.map((x) => (
                        <GaugeLine key={x.gauge.station} gauge={x.gauge} distanceKm={x.distanceKm} signals={x.signals} />
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
          {includeYellow
            ? "No warned areas have a river gauge nearby."
            : "No amber or red (level 2–3) landslide warnings right now. Tick the box above to include level 1."}
        </p>
      )}

      {noGauge.length > 0 && (
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          No gauge within {NEARBY_KM} km, so river impact cannot be assessed:{" "}
          {noGauge.map((w) => `${w.area.name} (L${w.level})`).join(", ")}.
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function CascadeRiskPage() {
  const [areas, setAreas] = useState([]);
  const [stations, setStations] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [report, setReport] = useState(null);
  const [riskLevels, setRiskLevels] = useState({});
  const [weatherByDistrict, setWeatherByDistrict] = useState(new Map());
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [mapMode, setMapMode] = useState("score");
  const [includeYellow, setIncludeYellow] = useState(false);
  const [activeSection, setActiveSection] = useState("flood-to-landslide");

  const loadData = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);

    const [boundaries, feed, landslide, risk, weather] = await Promise.allSettled([
      Promise.all([
        fetch("/sri-lanka-dsds.geojson").then((r) => r.json()),
        fetch("/sri-lanka-districts.geojson").then((r) => r.json()),
      ]),
      fetch(buildGaugeFeedUrl(), { cache: "no-store" }).then(async (r) => {
        const data = await r.json();
        if (!r.ok || data?.error) throw new Error(data?.error?.message || "Irrigation feed is unavailable.");
        return data;
      }),
      getJson(`${API_BASE}/landslide-warnings`),
      getJson(`${API_BASE}/risk-levels`),
      getJson(`${API_BASE}/weather/districts`),
    ]);

    const nextErrors = {};
    if (boundaries.status === "fulfilled") setAreas(buildAreas(boundaries.value[0], boundaries.value[1]));
    else nextErrors["Map boundaries"] = "Could not load DS division boundaries.";

    if (feed.status === "fulfilled") setStations(parseArcGISFeed(feed.value));
    else nextErrors["River gauges"] = feed.reason?.message || "Irrigation feed is unavailable.";

    if (landslide.status === "fulfilled") {
      setWarnings(Array.isArray(landslide.value?.warnings) ? landslide.value.warnings : []);
      setReport(landslide.value?.report || null);
    } else nextErrors["Landslide warnings"] = landslide.reason?.message || "DMC feed is unavailable.";

    if (risk.status === "fulfilled") {
      setRiskLevels(
        Object.fromEntries(
          (Array.isArray(risk.value) ? risk.value : [])
            .filter((item) => item?.district && item?.level)
            .map((item) => [normalizeDistrict(item.district), String(item.level).toLowerCase()])
        )
      );
    } else nextErrors["Published risk levels"] = risk.reason?.message || "Could not load.";

    if (weather.status === "fulfilled") {
      setWeatherByDistrict(
        new Map((Array.isArray(weather.value) ? weather.value : []).map((row) => [normalizeDistrict(row.name), row]))
      );
    } else nextErrors["Weather"] = `${weather.reason?.message || "Could not load."} Rain factors are skipped.`;

    setErrors(nextErrors);
    setUpdatedAt(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadData();
    const timer = window.setInterval(() => loadData(true), REFRESH_INTERVAL);
    return () => window.clearInterval(timer);
  }, [loadData]);

  const gauges = useMemo(() => locateGauges(stations, areas), [stations, areas]);
  const { warnedAreas, unmatched } = useMemo(() => matchWarningAreas(warnings, areas), [warnings, areas]);
  const direction1 = useMemo(
    () => floodToLandslide({ warnedAreas, gauges, riskLevels, weatherByDistrict }),
    [warnedAreas, gauges, riskLevels, weatherByDistrict]
  );
  const direction2 = useMemo(
    () => landslideToFlood({ warnedAreas, gauges, minLevel: includeYellow ? 1 : 2 }),
    [warnedAreas, gauges, includeYellow]
  );

  if (loading) {
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

  const highFactorAreas = direction1.filter((r) => r.score >= 25).length;
  const actNow = direction2.basins.filter((b) => b.concern.label === "Act now").length;

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-700 via-teal-600 to-orange-500 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="relative">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
            <Waves className="h-3.5 w-3.5" /> <ArrowRight className="h-3 w-3" /> <Mountain className="h-3.5 w-3.5" />
            Flood and landslide links
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Cascade risk</h1>
          <p className="mt-2 max-w-3xl text-sm text-white/90">
            Combines live river gauges, the latest DMC landslide warnings, published district risk and rainfall to show
            where one hazard could make the other worse.
          </p>
        </div>
        <div className="relative mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-4">
          <span className="text-xs text-white/85">
            Checked {formatDate(updatedAt)}
            {report?.date ? ` · DMC report ${report.date} ${report.time || ""}` : ""}
          </span>
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-teal-800 shadow-md transition hover:bg-teal-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh now
          </button>
        </div>
      </header>

      <div className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
        <span>
          These are rule-based indicators, not model predictions. They show where conditions occur together so officers can
          prioritise checks. River flow direction between gauges is not known, so &quot;same basin&quot; gauges are for checking,
          not confirmed downstream.
        </span>
      </div>

      <SourceNotice errors={errors} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Mountain} label="Warned DS divisions" value={warnedAreas.length} detail={report?.validity || "Latest DMC report"} tone="amber" />
        <StatCard icon={Waves} label="With river factors ≥ 25" value={highFactorAreas} detail="Elevated or high in section 1" tone="red" />
        <StatCard icon={Gauge} label="Basins to watch" value={direction2.basins.length} detail={`${actNow} marked "Act now"`} tone="sky" />
        <StatCard icon={Clock3} label="Gauges reporting" value={gauges.length} detail={`Linked within ${NEARBY_KM} km`} tone="emerald" />
      </div>

      <div
        role="tablist"
        aria-label="Cascade direction"
        className="flex w-full flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm sm:w-fit sm:flex-row"
      >
        {[
          {
            id: "flood-to-landslide",
            label: "1. Flood and river → landslide",
            icon: Waves,
            active: "bg-sky-600 text-white shadow-sm",
            count: highFactorAreas,
          },
          {
            id: "landslide-to-flood",
            label: "2. Landslide → flooding",
            icon: Mountain,
            active: "bg-orange-600 text-white shadow-sm",
            count: direction2.basins.length,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeSection === tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeSection === tab.id ? tab.active : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  activeSection === tab.id ? "bg-white/25" : "bg-slate-100 text-slate-600"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Cascade map</h2>
            <p className="text-xs text-slate-500">Warned DS divisions and the river gauges linked to them.</p>
          </div>
          <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
            {[
              ["score", "Colour by river factors"],
              ["level", "Colour by landslide level"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMapMode(value)}
                className={`rounded-lg px-3 py-1.5 transition ${mapMode === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <CascadeMap areaResults={direction1} gauges={gauges} mode={mapMode} />
      </section>

      {activeSection === "flood-to-landslide" ? (
        <FloodToLandslideSection results={direction1} unmatched={unmatched} gaugesAvailable={!errors["River gauges"]} />
      ) : (
        <LandslideToFloodSection
          basins={direction2.basins}
          noGauge={direction2.noGauge}
          includeYellow={includeYellow}
          onToggleYellow={setIncludeYellow}
        />
      )}

      <footer className="flex flex-wrap items-center justify-between gap-2 pb-2 text-xs text-slate-500">
        <span>Sources: Irrigation Department gauges, DMC landslide reports, DMEWS risk levels, district weather.</span>
        <div className="flex items-center gap-4">
          <a href={IRRIGATION_DASHBOARD} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:text-sky-900">
            Irrigation dashboard <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a href={LANDSLIDE_SOURCE} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-orange-700 hover:text-orange-900">
            DMC landslide reports <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </footer>
    </div>
  );
}
