"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import Loader from "@/components/Loader";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const SRI_LANKA_BOUNDS = [
  [5.92, 79.52],
  [9.83, 81.88],
];
const WORLD_RING = [
  [-180, -90],
  [180, -90],
  [180, 90],
  [-180, 90],
  [-180, -90],
];

function normalizeDistrictName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\bdistrict\b/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchRiskLevelsOnly() {
  const res = await fetch(`${API_BASE}/risk-levels`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message || "Failed to load risk levels");
  const riskMap = {};
  (json || []).forEach((r) => {
    if (r?.district && r?.level) {
      riskMap[normalizeDistrictName(r.district)] = String(r.level).toLowerCase();
    }
  });
  return riskMap;
}

// Simple helper to fetch risk levels and district polygons
async function fetchRiskAndGeo() {
  const [riskRes, geoRes] = await Promise.all([
    fetch(`${API_BASE}/risk-levels`),
    fetch("/sri-lanka-districts.geojson", { cache: "no-store" }),
  ]);
  const riskJson = await riskRes.json();
  const geoJson = await geoRes.json();
  const riskMap = {};
  (riskJson || []).forEach((r) => {
    if (r?.district && r?.level) {
      riskMap[normalizeDistrictName(r.district)] = String(
        r.level
      ).toLowerCase();
    }
  });
  return { riskMap, geoJson };
}

function getFillForRisk(level) {
  if (level === "high") return "#dc2626"; // red
  if (level === "medium") return "#ea580c"; // orange
  if (level === "low") return "#eab308"; // yellow
  return "#22c55e"; // safe / default
}

function toLngLatRing(coordRing) {
  return coordRing.map(([lng, lat]) => [lng, lat]);
}

function buildMaskGeoJson(districtGeoJson) {
  const holes = [];
  const features = Array.isArray(districtGeoJson?.features) ? districtGeoJson.features : [];
  features.forEach((feature) => {
    const geom = feature?.geometry;
    if (!geom) return;
    if (geom.type === "Polygon" && Array.isArray(geom.coordinates)) {
      geom.coordinates.forEach((ring) => {
        if (Array.isArray(ring) && ring.length >= 4) holes.push(toLngLatRing(ring));
      });
    } else if (geom.type === "MultiPolygon" && Array.isArray(geom.coordinates)) {
      geom.coordinates.forEach((poly) => {
        if (!Array.isArray(poly)) return;
        poly.forEach((ring) => {
          if (Array.isArray(ring) && ring.length >= 4) holes.push(toLngLatRing(ring));
        });
      });
    }
  });
  if (!holes.length) return null;
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [WORLD_RING, ...holes],
    },
  };
}

/** Keep in sync with getFillForRisk — used for the public legend under the map */
const RISK_LEGEND_ITEMS = [
  { key: "safe", label: "Safe", hint: "normal conditions", color: "#22c55e" },
  { key: "low", label: "Low", hint: "stay informed", color: "#eab308" },
  { key: "medium", label: "Medium", hint: "elevated risk", color: "#ea580c" },
  { key: "high", label: "High", hint: "severe — take precautions", color: "#dc2626" },
];

function RiskMapLegend() {
  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        District risk colors
      </p>
      <ul className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
        {RISK_LEGEND_ITEMS.map((item) => (
          <li key={item.key} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
            <span
              className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/50 shadow-sm ring-1 ring-black/5"
              style={{ backgroundColor: item.color }}
              aria-hidden
            />
            <span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{item.label}</span>
              <span className="text-slate-500 dark:text-slate-400"> — {item.hint}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
        Districts without a published level use the safe (green) color. Select a district on the map for details.
      </p>
    </div>
  );
}

export function RiskMap() {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const geoLayerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!containerRef.current || typeof window === "undefined") return;
    if (mapRef.current) return;

    const L = require("leaflet");

    // React Strict Mode can mount/unmount/mount quickly in dev.
    // If Leaflet left an internal id on the container, clear it.
    try {
      if (containerRef.current && containerRef.current._leaflet_id) {
        delete containerRef.current._leaflet_id;
      }
    } catch {
      // ignore
    }

    const map = L.map(containerRef.current, {
      center: [7.87, 80.77],
      zoom: 9,
      minZoom: 6,
      maxZoom: 10,
      maxBounds: SRI_LANKA_BOUNDS,
      maxBoundsViscosity: 1,
    });

    // Set immediately to prevent double-init
    mapRef.current = map;
    let cancelled = false;
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }
    ).addTo(map);

    map.createPane("sl-mask-pane");
    map.getPane("sl-mask-pane").style.zIndex = "360";
    map.getPane("sl-mask-pane").style.pointerEvents = "none";

    map.createPane("sl-boundary-pane");
    map.getPane("sl-boundary-pane").style.zIndex = "370";
    map.getPane("sl-boundary-pane").style.pointerEvents = "none";

    (async () => {
      try {
        const { riskMap, geoJson } = await fetchRiskAndGeo();
        if (cancelled) return;
        if (!mapRef.current || mapRef.current !== map) return;

        const maskFeature = buildMaskGeoJson(geoJson);
        if (maskFeature) {
          L.geoJSON(maskFeature, {
            pane: "sl-mask-pane",
            interactive: false,
            style: {
              stroke: false,
              fillColor: "#ffffff",
              fillOpacity: 1,
            },
          }).addTo(map);
        }

        L.geoJSON(geoJson, {
          pane: "sl-boundary-pane",
          interactive: false,
          style: {
            color: "#ffffff",
            weight: 1.2,
            opacity: 1,
            fill: false,
          },
        }).addTo(map);

        const layer = L.geoJSON(geoJson, {
          style: (feature) => {
            const name =
              feature?.properties?.shapeName ||
              feature?.properties?.name ||
              feature?.properties?.NAME_2 ||
              "";
            const key = normalizeDistrictName(name);
            const level = riskMap[key] || "safe";
            return {
              color: "#ffffff",
              weight: 1,
              fillColor: getFillForRisk(level),
              fillOpacity: 0.7,
            };
          },
          onEachFeature: (feature, lyr) => {
            const name =
              feature?.properties?.shapeName ||
              feature?.properties?.name ||
              feature?.properties?.NAME_2 ||
              "District";
            const key = normalizeDistrictName(name);
            const level = riskMap[key] || "safe";
            const label =
              level === "high"
                ? "High"
                : level === "medium"
                ? "Medium"
                : level === "low"
                ? "Low"
                : "Safe";
            lyr._districtKey = key;
            lyr.bindPopup(
              `<strong>${name}</strong><br/>Risk level: ${label}`
            );
          },
        });
        if (cancelled) return;
        if (!mapRef.current || mapRef.current !== map) return;
        layer.addTo(map);
        geoLayerRef.current = layer;

        try {
          if (mapRef.current === map) {
            map.fitBounds(layer.getBounds().pad(0.01), { maxZoom: 8 });
          }
        } catch {
          // ignore
        }

        setLoading(false);
      } catch (e) {
        console.error("Risk map error", e);
        setError("Failed to load risk map.");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      geoLayerRef.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Live refresh when admin updates risk
  useEffect(() => {
    if (typeof window === "undefined") return;
    async function refresh() {
      try {
        const map = mapRef.current;
        const layer = geoLayerRef.current;
        if (!map || !layer) return;
        const riskMap = await fetchRiskLevelsOnly();
        layer.setStyle((feature) => {
          const name =
            feature?.properties?.DIST_NAME || feature?.properties?.district || "";
          const key = normalizeDistrictName(name);
          const level = riskMap[key] || "safe";
          return {
            color: "#ffffff",
            weight: 1,
            fillColor: getFillForRisk(level),
            fillOpacity: 0.7,
          };
        });
        layer.eachLayer((lyr) => {
          const feature = lyr?.feature;
          const name =
            feature?.properties?.DIST_NAME ||
            feature?.properties?.district ||
            "District";
          const key = normalizeDistrictName(name);
          const level = riskMap[key] || "safe";
          const label =
            level === "high"
              ? "High"
              : level === "medium"
              ? "Medium"
              : level === "low"
              ? "Low"
              : "Safe";
          try {
            lyr.bindPopup(`<strong>${name}</strong><br/>Risk level: ${label}`);
          } catch {
            // ignore
          }
        });
      } catch (e) {
        console.warn("Risk map refresh failed", e?.message || e);
      }
    }
    window.addEventListener("dmews-risk-changed", refresh);
    return () => window.removeEventListener("dmews-risk-changed", refresh);
  }, []);

  return (
    <div className="w-full">
      {/* Outer card with glass effect */}
      <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/70 backdrop-blur-lg shadow-xl dark:bg-slate-800/80 dark:border-slate-700/30">
        {/* Map header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            🗺️ Risk Map Overview
          </h2>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Click a district for details
          </span>
        </div>

        {/* Map container */}
        <div className="relative mx-4 mb-4 h-[400px] overflow-hidden rounded-xl bg-slate-800 shadow-inner">
          <div ref={containerRef} className="h-full w-full" />

          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/60 backdrop-blur-sm">
              <Loader size="md" />
              <span className="text-sm font-medium text-white/90">
                Loading risk map…
              </span>
            </div>
          )}

          {/* Error toast */}
          {error && !loading && (
            <div className="absolute bottom-4 left-4 right-4 rounded-lg bg-red-500/90 px-4 py-2.5 text-center text-xs font-medium text-white shadow-lg backdrop-blur-sm">
              {error}
            </div>
          )}
        </div>

        {/* Legend inside the card footer */}
        <div className="border-t border-slate-200/60 px-5 pb-4 dark:border-slate-700/40">
          <RiskMapLegend />
        </div>
      </div>
    </div>
  );
}