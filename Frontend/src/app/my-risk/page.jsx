"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  CloudRain,
  Construction,
  Copy,
  DoorClosed,
  Droplets,
  Info,
  Link2,
  ListChecks,
  Loader2,
  LocateFixed,
  MapPin,
  Megaphone,
  MessageCircle,
  Mountain,
  Navigation,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  TreePine,
  TrendingUp,
  Volume2,
  Waves,
  X,
} from "lucide-react";
import RouteModal from "@/components/RouteModal";
import { EmergencyNumbers } from "@/components/EmergencyNumbers";
import { buildGaugeFeedUrl, getStationStatus, parseArcGISFeed } from "@/lib/riverGauges";
import { buildAreas, locateGauges, matchWarningAreas, normalizeDistrict } from "@/lib/cascadeRisk";
import {
  LEVELS,
  SEVERITY_STYLE,
  assessPersonalRisk,
  buildNationalRisks,
  floodCloseness,
  groupByDistrict,
  nearestShelters,
  shareText,
} from "@/lib/personalRisk";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const HERO_BG = "/disasters/landslide.jpg";
const AUTO_CHECK_MS = 10 * 60_000;
const FAR_SHELTER_KM = 50;

const WARNING_SIGNS = {
  landslide: [
    { icon: Construction, text: "New cracks in the ground, walls or floors" },
    { icon: TreePine, text: "Trees, poles or walls starting to tilt" },
    { icon: Droplets, text: "Springs or wells turning muddy, or new springs appearing" },
    { icon: Volume2, text: "Rumbling or cracking sounds from the slope" },
    { icon: DoorClosed, text: "Doors and windows suddenly jamming" },
  ],
  flood: [
    { icon: TrendingUp, text: "River or canal rising quickly" },
    { icon: CloudRain, text: "Heavy rain for several hours" },
    { icon: Waves, text: "Water turning muddy and carrying debris" },
    { icon: Megaphone, text: "Announcements from police, DMC or the Grama Niladhari" },
  ],
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatDate(value) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Colombo",
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function km(value) {
  if (!Number.isFinite(value)) return "—";
  return value < 1 ? "under 1 km" : `${value.toFixed(1)} km`;
}

const REQUEST_TIMEOUT_MS = 20_000;

// Each request gives up after 20 s so one slow source cannot keep the whole page loading.
function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function getJson(url) {
  const response = await fetchWithTimeout(url, { cache: "no-store" });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || `Request failed (${response.status})`);
  return data;
}

async function loadSharedData() {
  const [boundaries, feed, landslide, alerts, shelters, risk] = await Promise.allSettled([
    Promise.all([
      fetchWithTimeout("/sri-lanka-dsds.geojson").then((r) => r.json()),
      fetchWithTimeout("/sri-lanka-districts.geojson").then((r) => r.json()),
    ]),
    fetchWithTimeout(buildGaugeFeedUrl(), { cache: "no-store" }).then(async (r) => {
      const data = await r.json();
      if (!r.ok || data?.error) throw new Error("River gauge feed is unavailable.");
      return data;
    }),
    getJson(`${API_BASE}/landslide-warnings`),
    getJson(`${API_BASE}/alerts`),
    getJson(`${API_BASE}/shelters`),
    getJson(`${API_BASE}/risk-levels`),
  ]);

  const missing = [];
  const areas = boundaries.status === "fulfilled" ? buildAreas(boundaries.value[0], boundaries.value[1]) : [];
  if (!areas.length) missing.push("area boundaries");
  const stations = feed.status === "fulfilled" ? parseArcGISFeed(feed.value) : [];
  if (feed.status !== "fulfilled") missing.push("river levels");
  const warnings = landslide.status === "fulfilled" ? landslide.value?.warnings || [] : [];
  if (landslide.status !== "fulfilled") missing.push("landslide warnings");
  if (alerts.status !== "fulfilled") missing.push("official alerts");
  if (shelters.status !== "fulfilled") missing.push("relief camps");

  const gauges = locateGauges(stations, areas);
  const { warnedAreas } = matchWarningAreas(warnings, areas);
  const riskLevels =
    risk.status === "fulfilled"
      ? Object.fromEntries(
          (Array.isArray(risk.value) ? risk.value : [])
            .filter((item) => item?.district && item?.level)
            .map((item) => [normalizeDistrict(item.district), String(item.level).toLowerCase()])
        )
      : {};

  const latestGauge = stations.reduce((t, s) => (!t || s.timestamp > t ? s.timestamp : t), null);
  return {
    areas,
    gauges,
    warnedAreas,
    riskLevels,
    alerts: alerts.status === "fulfilled" && Array.isArray(alerts.value) ? alerts.value : [],
    shelters: shelters.status === "fulfilled" && Array.isArray(shelters.value) ? shelters.value : [],
    report: landslide.status === "fulfilled" ? landslide.value?.report || null : null,
    latestGauge,
    missing,
    loadedAt: new Date(),
  };
}

/* ------------------------------------------------------------------ */
/* UI pieces                                                           */
/* ------------------------------------------------------------------ */

function LevelPill({ level }) {
  const info = LEVELS[level] || LEVELS[0];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${info.soft}`}>
      {info.label}
    </span>
  );
}

function LevelScale({ current }) {
  return (
    <div className="grid grid-cols-4 gap-1.5" aria-label={`Risk scale, current level ${LEVELS[current].label}`}>
      {LEVELS.map((l, i) => (
        <div key={l.key} className="text-center">
          <div
            className={`h-2.5 rounded-full transition ${i === current ? "ring-2 ring-white ring-offset-2 ring-offset-transparent" : "opacity-40"}`}
            style={{ backgroundColor: i === 0 ? "#22c55e" : i === 1 ? "#facc15" : i === 2 ? "#f97316" : "#dc2626" }}
          />
          <p className={`mt-1.5 text-[11px] font-semibold ${i === current ? "text-white" : "text-white/60"}`}>{l.label}</p>
        </div>
      ))}
    </div>
  );
}

function RiskCard({ icon: Icon, title, level, heading, children }) {
  return (
    <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700">
            <Icon className="h-5 w-5" />
          </span>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        </div>
        <LevelPill level={level} />
      </div>
      <h3 className="text-base font-bold leading-snug text-slate-900">{heading}</h3>
      <div className="mt-2 flex-1 text-sm leading-6 text-slate-600">{children}</div>
    </article>
  );
}

function FloodBar({ gauge }) {
  const c = floodCloseness(gauge);
  const status = getStationStatus(gauge);
  if (c.percent == null) return null;
  return (
    <div className="mt-3">
      <div className="relative h-3 rounded-full bg-slate-100">
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${c.percent}%`, backgroundColor: status.color }} />
        {c.marks.map((m) => (
          <span key={m.label} className="absolute -top-1 h-5 w-0.5" style={{ left: `calc(${Math.min(m.at, 100)}% - 1px)`, backgroundColor: m.color }} />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
        <span>Normal</span>
        <span>Alert · Minor · Major flood</span>
      </div>
      <p className="mt-2 text-sm text-slate-700">
        Water is <strong>{c.sentence}</strong> and is <strong>{c.trend}</strong>.
      </p>
    </div>
  );
}

function ShareButtons({ text }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/my-risk` : "";
  const full = `${text} Check yours: ${url}`;
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={`https://wa.me/?text=${encodeURIComponent(full)}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
      >
        <MessageCircle className="h-4 w-4" /> WhatsApp
      </a>
      <a
        href={`sms:?&body=${encodeURIComponent(full)}`}
        className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
      >
        <MessageCircle className="h-4 w-4" /> SMS
      </a>
      {canNativeShare && (
        <button
          type="button"
          onClick={() => navigator.share({ title: "My disaster risk", text: full }).catch(() => {})}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <Share2 className="h-4 w-4" /> More
        </button>
      )}
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied" : "Copy text"}
      </button>
    </div>
  );
}

function PlaceSearch({ onPick, disabled }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const search = async (event) => {
    event.preventDefault();
    const q = query.trim();
    if (q.length < 3) {
      setMessage("Type at least 3 letters.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const data = await getJson(`${API_BASE}/geocode/suggest?q=${encodeURIComponent(q)}`);
      const list = Array.isArray(data?.suggestions) ? data.suggestions : [];
      setResults(list);
      if (!list.length) setMessage("No places found. Try a nearby town name.");
    } catch {
      setMessage("Place search is not available right now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={search} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Or type a town or village"
            disabled={disabled}
            className="w-full rounded-xl border border-white/30 bg-white py-3 pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-amber-300"
          />
        </div>
        <button
          type="submit"
          disabled={disabled || busy}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-white/40 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </button>
      </form>
      {message && <p className="mt-2 text-sm text-amber-100">{message}</p>}
      {results.length > 0 && (
        <ul className="mt-2 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-black/5">
          {results.map((r) => (
            <li key={`${r.id}-${r.latitude}`}>
              <button
                type="button"
                onClick={() => {
                  onPick({ lat: r.latitude, lon: r.longitude, label: r.name.split(",")[0], source: "search" });
                  setResults([]);
                  setQuery(r.name.split(",")[0]);
                }}
                className="flex w-full items-start gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Nationwide high-risk areas                                          */
/* ------------------------------------------------------------------ */

const TYPE_FILTERS = [
  ["all", "All"],
  ["landslide", "Landslide"],
  ["flood", "Flood"],
  ["alert", "Official alerts"],
  ["rain", "Rain"],
];

const TYPE_ICON = {
  landslide: Mountain,
  flood: Waves,
  link: Link2,
  alert: Megaphone,
  district: ShieldCheck,
  rain: CloudRain,
};

function NationalRiskMap({ items, point }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [wheelZoom, setWheelZoom] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    const L = require("leaflet");
    const map = L.map(containerRef.current, {
      center: [7.87, 80.77],
      zoom: 7,
      minZoom: 7,
      maxZoom: 13,
      zoomSnap: 0.25,
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
    const sriLanka = [[5.92, 79.65], [9.84, 81.88]];
    map.fitBounds(sriLanka);
    // Re-fit when the map's size settles (layout, window resize) unless the user has moved it.
    let userMoved = false;
    map.on("dragstart", () => {
      userMoved = true;
    });
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
      if (!userMoved) map.fitBounds(sriLanka);
    });
    observer.observe(containerRef.current);
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
      observer.disconnect();
      container.removeEventListener("mouseleave", leave);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const L = require("leaflet");
    layer.clearLayers();

    const popup = (item) =>
      `<strong>${escapeHtml(item.title)}</strong><br>${escapeHtml(item.district)} district<br><span style="color:#64748b">${escapeHtml(
        item.detail
      )}</span>`;

    for (const item of items) {
      const color = SEVERITY_STYLE[item.severity].color;
      if (item.type === "landslide") {
        for (const area of item.areas) {
          L.geoJSON(
            { type: "Feature", geometry: area.geometry },
            { style: { color, weight: 1.5, fillColor: color, fillOpacity: item.severity >= 3 ? 0.45 : 0.3 } }
          )
            .bindPopup(`<strong>${escapeHtml(area.name)}</strong><br>${popup(item)}`)
            .addTo(layer);
        }
      } else if (item.type === "flood") {
        L.circleMarker([item.lat, item.lon], { radius: 8, color: "#ffffff", weight: 2, fillColor: color, fillOpacity: 1 })
          .bindPopup(popup(item))
          .addTo(layer);
      } else if (item.type === "alert") {
        L.marker([item.lat, item.lon], {
          icon: L.divIcon({
            className: "",
            html: `<div style="width:26px;height:26px;border-radius:9999px;background:${color};color:#fff;font-weight:800;display:grid;place-items:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">!</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          }),
        })
          .bindPopup(popup(item))
          .addTo(layer);
      } else if (item.type === "rain" && Number.isFinite(item.lat)) {
        L.circle([item.lat, item.lon], { radius: 12000, color: "#0284c7", weight: 1, fillColor: "#38bdf8", fillOpacity: 0.25 })
          .bindPopup(popup(item))
          .addTo(layer);
      }
    }

    if (point) {
      L.circleMarker([point.lat, point.lon], { radius: 9, color: "#ffffff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 })
        .bindTooltip("You are here", { permanent: true, direction: "top", offset: [0, -8] })
        .addTo(layer);
    }
  }, [items, point]);

  return (
    <div className="relative isolate h-[440px] overflow-hidden rounded-2xl ring-1 ring-slate-200 sm:h-[560px]">
      <div ref={containerRef} className="h-full w-full bg-slate-100" />
      <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-md">
        {wheelZoom ? "Scroll to zoom · move out to resume page scroll" : "Click the map to enable scroll zoom"}
      </div>
      <div className="absolute bottom-3 left-3 z-[500] rounded-xl bg-white/95 px-3 py-2 text-[11px] text-slate-600 shadow-lg">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SEVERITY_STYLE[3].color }} />Act now</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SEVERITY_STYLE[2].color }} />High</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SEVERITY_STYLE[1].color }} />Lower</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-sky-400" />Heavy rain</span>
          {point && <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-blue-600" />You</span>}
        </div>
        <p className="mt-1 text-slate-500">Shaded areas: landslide · dots: rivers · “!”: official alerts</p>
      </div>
    </div>
  );
}

function NationalRisks({ items, point, rainLoaded, onCheckArea }) {
  const [showLower, setShowLower] = useState(false);
  const [type, setType] = useState("all");
  const groups = useMemo(() => groupByDistrict(items, { showLower, type, point }), [items, showLower, type, point]);
  const mapItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const lowerCount = items.filter((i) => i.severity < 2).length;

  const count = (fn) => items.filter(fn).length;
  const summary = [
    [items.filter((i) => i.type === "landslide" && i.level >= 3).reduce((n, i) => n + i.areas.length, 0), "red landslide area", "red landslide areas"],
    [items.filter((i) => i.type === "landslide" && i.level === 2).reduce((n, i) => n + i.areas.length, 0), "amber landslide area", "amber landslide areas"],
    [count((i) => i.type === "flood" && i.severity >= 2), "river flooding", "rivers flooding"],
    [count((i) => i.type === "alert" && i.severity >= 3), "high official alert", "high official alerts"],
    [count((i) => i.type === "rain" && i.severity >= 2), "district with very heavy rain", "districts with very heavy rain"],
  ];

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="national-risks-title">
      <div>
        <h2 id="national-risks-title" className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <AlertTriangle className="h-5 w-5 text-red-600" /> High-risk areas in Sri Lanka right now
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Every serious warning across the country, wherever you are. Use “Check this area” to see the risk for a family member’s area.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {summary.map(([n, one, many]) => (
            <span
              key={many}
              className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                n ? "bg-red-50 text-red-800 ring-red-200" : "bg-slate-50 text-slate-500 ring-slate-200"
              }`}
            >
              {n} {n === 1 ? one : many}
            </span>
          ))}
          {!rainLoaded && <span className="rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-500 ring-1 ring-slate-200">Loading rain forecast…</span>}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 text-sm font-semibold">
          {TYPE_FILTERS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setType(value)}
              className={`rounded-lg px-3 py-1.5 transition ${type === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={showLower} onChange={(e) => setShowLower(e.target.checked)} className="h-4 w-4" />
          Show lower risks{lowerCount ? ` (${lowerCount})` : ""}
        </label>
      </div>

      <NationalRiskMap items={mapItems} point={point} />

      {groups.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((g) => {
            const style = SEVERITY_STYLE[g.severity];
            const top = g.items[0];
            return (
              <article key={g.district} className="flex flex-col rounded-2xl border border-slate-200 border-l-4 p-5" style={{ borderLeftColor: style.color }}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-bold text-slate-900">{g.district} district</h3>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${style.soft}`}>{style.label}</span>
                </div>
                <ul className="mt-3 flex-1 space-y-2.5">
                  {g.items.map((item) => {
                    const Icon = TYPE_ICON[item.type] || AlertTriangle;
                    return (
                      <li key={item.id} className="flex gap-2.5 text-sm">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: SEVERITY_STYLE[item.severity].color }} />
                        <span>
                          {item.alertId ? (
                            <a href={`/alerts/${item.alertId}`} className="font-semibold text-sky-700 hover:underline">
                              {item.title}
                            </a>
                          ) : (
                            <span className="font-semibold text-slate-800">{item.title}</span>
                          )}
                          {item.detail && <span className="block text-slate-600">{item.detail}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <span className="text-sm text-slate-500">
                    {g.distanceKm != null ? (
                      <>
                        <MapPin className="mr-1 inline h-3.5 w-3.5" />
                        {g.distanceKm === 0 ? "You are in this area" : `${km(g.distanceKm)} from you`}
                      </>
                    ) : (
                      ""
                    )}
                  </span>
                  {Number.isFinite(top.lat) && (
                    <button
                      type="button"
                      onClick={() => onCheckArea({ lat: top.lat, lon: top.lon, label: top.placeLabel, source: "area" })}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                    >
                      <Search className="h-4 w-4" /> Check this area
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl bg-emerald-50 p-5 text-sm text-emerald-800">
          {showLower
            ? "No risks of this type in Sri Lanka right now."
            : "No high-risk areas in Sri Lanka right now."}
          {!showLower && lowerCount > 0 && (
            <button type="button" onClick={() => setShowLower(true)} className="ml-2 font-semibold underline">
              Show {lowerCount} lower risk{lowerCount > 1 ? "s" : ""}
            </button>
          )}
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function MyRiskPage() {
  const [data, setData] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [weatherByDistrict, setWeatherByDistrict] = useState(new Map());
  const [rainLoaded, setRainLoaded] = useState(false);
  const [point, setPoint] = useState(null);
  const [pointWeather, setPointWeather] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [riseNotice, setRiseNotice] = useState(null);
  const [routeShelter, setRouteShelter] = useState(null);
  const previousLevelRef = useRef(null);
  const resultRef = useRef(null);

  const refreshData = useCallback(async () => {
    const next = await loadSharedData();
    setData(next);
    return next;
  }, []);

  // Base data on first load; district weather is slower, so it loads separately.
  useEffect(() => {
    refreshData().finally(() => setDataLoading(false));
    getJson(`${API_BASE}/weather/districts`)
      .then((rows) =>
        setWeatherByDistrict(new Map((Array.isArray(rows) ? rows : []).map((row) => [normalizeDistrict(row.name), row])))
      )
      .catch(() => {})
      .finally(() => setRainLoaded(true));
  }, [refreshData]);

  // Rain forecast for the chosen point.
  useEffect(() => {
    if (!point) return;
    setPointWeather(null);
    getJson(`${API_BASE}/weather/point?lat=${point.lat}&lon=${point.lon}&name=${encodeURIComponent(point.label || "Location")}`)
      .then(setPointWeather)
      .catch(() => setPointWeather(null));
  }, [point]);

  const result = useMemo(() => {
    if (!point || !data) return null;
    return assessPersonalRisk(point, { ...data, weather: pointWeather, weatherByDistrict });
  }, [point, data, pointWeather, weatherByDistrict]);

  const nationalItems = useMemo(
    () => (data ? buildNationalRisks({ ...data, weatherByDistrict }) : []),
    [data, weatherByDistrict]
  );

  const shelters = useMemo(() => (point && data ? nearestShelters(point, data.shelters) : []), [point, data]);

  // Auto-check every 10 minutes while a location is set; tell the user if their level goes up.
  useEffect(() => {
    if (!point) return undefined;
    const timer = window.setInterval(() => {
      refreshData().catch(() => {});
    }, AUTO_CHECK_MS);
    return () => window.clearInterval(timer);
  }, [point, refreshData]);

  // Only an automatic/manual data refresh for the same place can raise the "went up" notice,
  // not the rain forecast arriving a moment after the first check.
  useEffect(() => {
    if (!result || !point || !data) return;
    const key = `${point.lat},${point.lon}`;
    const previous = previousLevelRef.current;
    if (previous && previous.key === key && previous.loadedAt !== data.loadedAt && result.overall > previous.level) {
      setRiseNotice({ from: LEVELS[previous.level].label, to: result.level.label, at: new Date() });
    }
    previousLevelRef.current = { key, level: result.overall, loadedAt: data.loadedAt };
  }, [result, point, data]);

  const choosePoint = (next) => {
    setPoint(next);
    setRiseNotice(null);
    setLocationError("");
    window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  };

  const detectMe = () => {
    if (!navigator.geolocation) {
      setLocationError("Your browser cannot share location. Type a town instead.");
      return;
    }
    setLocating(true);
    setLocationError("");

    const onSuccess = (pos) => {
      setLocating(false);
      choosePoint({ lat: pos.coords.latitude, lon: pos.coords.longitude, label: "Your location", source: "gps" });
    };
    const onFinalError = (err) => {
      setLocating(false);
      if (err.code === 1) {
        setLocationError(
          "Location permission was blocked. Click the lock or location icon in the address bar, allow location, then try again. Or type a town instead."
        );
      } else if (err.code === 2) {
        setLocationError(
          "Your device could not work out where you are. On a computer, turn on location for your browser (Mac: System Settings → Privacy & Security → Location Services; Windows: Settings → Privacy → Location), then try again. Or type a town instead."
        );
      } else {
        setLocationError("Finding your location took too long. Try again, or type a town instead.");
      }
    };

    // GPS-level accuracy first; computers without GPS often fail or time out on that,
    // so fall back to normal (Wi-Fi/network) accuracy before giving up.
    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err) => {
        if (err.code === 1) {
          onFinalError(err);
          return;
        }
        navigator.geolocation.getCurrentPosition(onSuccess, onFinalError, {
          enableHighAccuracy: false,
          timeout: 20000,
          maximumAge: 10 * 60_000,
        });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  const manualRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } finally {
      setRefreshing(false);
    }
  };

  const placeName = result?.place
    ? `${result.place.dsDivision}, ${result.place.district} district`
    : point?.label || "";
  const outsideSriLanka = point && data?.areas?.length && !result?.place;

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Hero */}
      <section className="relative isolate overflow-hidden border-b border-slate-900/20" aria-labelledby="my-risk-title">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${HERO_BG})` }} />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-sky-950/85 to-amber-900/75" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-100">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Landslide · Flood · Rain
            </p>
            <h1 id="my-risk-title" className="mt-5 font-oswald text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              What is my risk right now?
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-sky-100/95">
              Find out if there is a landslide or flood risk where you are, how close it is, and what you should do.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-start">
              <button
                type="button"
                onClick={detectMe}
                disabled={locating || dataLoading}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 py-3.5 text-base font-bold text-sky-950 shadow-lg shadow-black/20 transition hover:bg-amber-300 disabled:opacity-70"
              >
                {locating || dataLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}
                {dataLoading ? "Loading data…" : locating ? "Finding you…" : "Detect me"}
              </button>
              <PlaceSearch onPick={choosePoint} disabled={dataLoading} />
            </div>
            {locationError && (
              <p className="mt-3 inline-flex items-start gap-2 rounded-xl bg-red-500/20 px-3 py-2 text-sm text-red-50">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {locationError}
              </p>
            )}
            <p className="mt-4 text-xs text-sky-100/70">
              Your location is used only on this device to check your risk. It is not saved.
            </p>
          </div>
        </div>
      </section>

      <div ref={resultRef} className="mx-auto max-w-7xl scroll-mt-20 space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {data?.missing?.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Some information could not be loaded ({data.missing.join(", ")}). Your result may be incomplete.
          </div>
        )}

        {!point && (
          <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-3">
            {[
              [LocateFixed, "1. Tap “Detect me”", "Or type the name of your town or village."],
              [ShieldCheck, "2. See your risk", "Landslide, flood, rain and official alerts near you, with distances."],
              [ListChecks, "3. Know what to do", "Simple steps, warning signs and your nearest relief camps."],
            ].map(([Icon, title, text]) => (
              <div key={title} className="flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-slate-900">{title}</p>
                  <p className="text-sm text-slate-600">{text}</p>
                </div>
              </div>
            ))}
          </section>
        )}

        {!point && data && (
          <NationalRisks items={nationalItems} point={null} rainLoaded={rainLoaded} onCheckArea={choosePoint} />
        )}

        {point && !result && (
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin" /> Checking your risk…
          </div>
        )}

        {result && (
          <>
            {riseNotice && (
              <div role="alert" className="flex items-start justify-between gap-3 rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-3 text-red-900">
                <span className="flex items-start gap-2 text-sm">
                  <Bell className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <strong>Your risk went up</strong> from {riseNotice.from} to {riseNotice.to} at {formatDate(riseNotice.at)}.
                    Read the steps below.
                  </span>
                </span>
                <button type="button" onClick={() => setRiseNotice(null)} aria-label="Dismiss" className="text-red-700 hover:text-red-900">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {outsideSriLanka && (
              <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                This location seems to be outside Sri Lanka, so most information here will not apply.
              </div>
            )}

            {/* Overall result */}
            <section className={`overflow-hidden rounded-3xl bg-gradient-to-br ${result.level.bg} p-6 text-white shadow-lg sm:p-8`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="inline-flex items-center gap-1.5 text-sm font-medium text-white/85">
                    <MapPin className="h-4 w-4" />
                    {placeName}
                    {point.source === "gps" ? " (detected)" : ""}
                  </p>
                  <p className="mt-3 text-sm font-semibold uppercase tracking-wider text-white/80">Your risk level</p>
                  <h2 className="font-oswald text-4xl font-bold tracking-tight sm:text-5xl">{result.level.label}</h2>
                  <p className="mt-2 max-w-2xl text-lg text-white/95">{result.level.headline}</p>
                </div>
                <button
                  type="button"
                  onClick={manualRefresh}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/25 disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  Check again
                </button>
              </div>
              <div className="mt-6 max-w-xl">
                <LevelScale current={result.overall} />
              </div>
              <p className="mt-5 inline-flex items-center gap-1.5 text-xs text-white/80">
                <Clock3 className="h-3.5 w-3.5" />
                Checked {formatDate(data.loadedAt)} · rechecks automatically every 10 minutes while this page is open
              </p>
            </section>

            {/* Risk cards */}
            <section>
              <h2 className="mb-4 text-xl font-bold text-slate-900">What is near you</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <RiskCard icon={Mountain} title="Landslide" level={result.landslide.level} heading={result.landslide.title}>
                  <p>{result.landslide.detail}</p>
                  {result.landslide.distanceKm != null && result.landslide.status !== "inside" && (
                    <p className="mt-2 font-semibold text-slate-800">Distance: {km(result.landslide.distanceKm)}</p>
                  )}
                </RiskCard>

                <RiskCard icon={Waves} title="Flood and rivers" level={result.flood.level} heading={result.flood.title}>
                  <p>{result.flood.detail}</p>
                  {result.flood.focus && <FloodBar gauge={result.flood.focus.gauge} />}
                </RiskCard>

                <RiskCard icon={Link2} title="Flood + landslide together" level={result.combined.level} heading={result.combined.title}>
                  {result.combined.reasons.length ? (
                    <ul className="list-disc space-y-1.5 pl-5">
                      {result.combined.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>Floods and landslides can trigger each other. Nothing links them near you right now.</p>
                  )}
                </RiskCard>

                <RiskCard icon={Megaphone} title="Official alerts" level={result.alerts.level} heading={result.alerts.title}>
                  {result.alerts.items.length ? (
                    <ul className="space-y-2">
                      {result.alerts.items.slice(0, 3).map(({ alert, distanceKm }) => (
                        <li key={alert._id}>
                          <a href={`/alerts/${alert._id}`} className="font-semibold text-sky-700 hover:underline">
                            {alert.disasterType} ({alert.severity})
                          </a>{" "}
                          · {km(distanceKm)} away
                          {alert.safetyInstructions && <span className="block text-xs text-slate-500">{alert.safetyInstructions}</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No active DMEWS alerts within 20 km.</p>
                  )}
                </RiskCard>

                <RiskCard icon={CloudRain} title="Rain" level={result.rain.level} heading={result.rain.title}>
                  <p>{result.rain.detail || (pointWeather ? "" : "Loading the forecast for your location…")}</p>
                </RiskCard>
              </div>
            </section>

            {/* What to do + warning signs */}
            <section className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" /> What should I do?
                </h2>
                <ul className="mt-4 space-y-3">
                  {result.actions.map((a) => (
                    <li key={a} className="flex gap-3 text-sm leading-6 text-slate-700">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                  <AlertTriangle className="h-5 w-5 text-amber-600" /> Danger signs to watch for
                </h2>
                {[
                  ["Landslide", WARNING_SIGNS.landslide],
                  ["Flood", WARNING_SIGNS.flood],
                ].map(([label, signs]) => (
                  <div key={label} className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {signs.map(({ icon: Icon, text }) => (
                        <div key={text} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-amber-600 shadow-sm">
                            <Icon className="h-4 w-4" />
                          </span>
                          {text}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="mt-4 text-sm font-semibold text-red-700">If you see any of these, move away and call 117.</p>
              </div>
            </section>

            {/* Shelters */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <Navigation className="h-5 w-5 text-sky-600" /> Nearest relief camps
              </h2>
              {shelters.length ? (
                <>
                  {shelters[0].distanceKm > FAR_SHELTER_KM && (
                    <p className="mt-2 text-sm text-amber-800">
                      No listed relief camp is close to you. In an emergency call 117 or ask your Grama Niladhari for the nearest safe place.
                    </p>
                  )}
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {shelters.map(({ shelter, distanceKm }) => (
                      <div key={shelter.id} className="flex flex-col rounded-xl border border-slate-200 p-4">
                        <p className="font-semibold text-slate-900">{shelter.name}</p>
                        <p className="text-sm text-slate-500">
                          {[shelter.city || shelter.location, shelter.district].filter(Boolean).join(", ")}
                        </p>
                        <p className="mt-2 text-sm text-slate-700">
                          <strong>{km(distanceKm)}</strong> away
                          {Number.isFinite(shelter.availableSpaces) ? ` · ${shelter.availableSpaces} spaces free` : ""}
                        </p>
                        <button
                          type="button"
                          onClick={() => setRouteShelter(shelter)}
                          className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                        >
                          <Navigation className="h-4 w-4" /> Get directions
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-600">No relief camps are listed right now. In an emergency call 117.</p>
              )}
            </section>

            {/* Share */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <Share2 className="h-5 w-5 text-emerald-600" /> Tell your family
              </h2>
              <p className="mt-1 text-sm text-slate-600">Send them your result so they know you have checked.</p>
              <p className="my-4 rounded-xl bg-slate-50 p-3 text-sm italic text-slate-700">
                “{shareText(result, result.place?.dsDivision || point.label)}”
              </p>
              <ShareButtons text={shareText(result, result.place?.dsDivision || point.label)} />
              <p className="mt-3 text-xs text-slate-500">Your exact location is not included in the message.</p>
            </section>

            <NationalRisks items={nationalItems} point={point} rainLoaded={rainLoaded} onCheckArea={choosePoint} />
          </>
        )}

        <EmergencyNumbers />

        {/* Last updated */}
        {data && (
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
              <Clock3 className="h-4 w-4" /> How up to date is this?
            </h2>
            <ul className="grid gap-2 sm:grid-cols-3">
              <li>
                <span className="block text-xs text-slate-500">Landslide warnings (DMC)</span>
                {data.report?.date ? `Issued ${data.report.date} ${data.report.time || ""}` : "Not available"}
              </li>
              <li>
                <span className="block text-xs text-slate-500">River levels (Irrigation Dept.)</span>
                {data.latestGauge ? `Latest reading ${formatDate(data.latestGauge)}` : "Not available"}
              </li>
              <li>
                <span className="block text-xs text-slate-500">This page</span>
                Checked {formatDate(data.loadedAt)}
              </li>
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              This is a guide based on official warnings and live river data. Always follow instructions from the DMC, police and
              local officials.
            </p>
          </section>
        )}
      </div>

      {routeShelter && point && (
        <RouteModal
          shelter={routeShelter}
          userLocation={{ latitude: point.lat, longitude: point.lon }}
          onClose={() => setRouteShelter(null)}
        />
      )}
    </div>
  );
}
