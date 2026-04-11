"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import Loader from "@/components/Loader";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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

/** Keep in sync with getFillForRisk — used for the public legend under the map */
const RISK_LEGEND_ITEMS = [
  { key: "safe", label: "Safe", hint: "normal conditions", color: "#22c55e" },
  { key: "low", label: "Low", hint: "stay informed", color: "#eab308" },
  { key: "medium", label: "Medium", hint: "elevated risk", color: "#ea580c" },
  { key: "high", label: "High", hint: "severe — take precautions", color: "#dc2626" },
];

function RiskMapLegend() {
  return (
    <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        District risk colors
      </p>
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {RISK_LEGEND_ITEMS.map((item) => (
          <li key={item.key} className="flex items-center gap-2 text-xs text-slate-700">
            <span
              className="h-3.5 w-3.5 shrink-0 rounded-sm border border-slate-300/80 shadow-sm ring-1 ring-black/5"
              style={{ backgroundColor: item.color }}
              aria-hidden
            />
            <span>
              <span className="font-semibold text-slate-800">{item.label}</span>
              <span className="text-slate-500"> — {item.hint}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] leading-snug text-slate-500">
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
      zoom: 7,
      minZoom: 6,
      maxZoom: 10,
     
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

    (async () => {
      try {
        const { riskMap, geoJson } = await fetchRiskAndGeo();
        if (cancelled) return;
        if (!mapRef.current || mapRef.current !== map) return;

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
            map.fitBounds(layer.getBounds().pad(0.1));
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
      <div className="relative h-[320px] w-full overflow-hidden rounded-xl bg-slate-800">
        <div ref={containerRef} className="h-full w-full" />
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/70 text-sky-50">
            <Loader size="md" />
            <span className="text-xs">Loading risk map…</span>
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-x-4 bottom-4 rounded-lg bg-red-900/80 px-3 py-2 text-center text-xs text-red-50">
            {error}
          </div>
        )}
      </div>
      <RiskMapLegend />
    </div>
  );
}

