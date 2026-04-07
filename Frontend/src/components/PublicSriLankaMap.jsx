"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import Loader from "@/components/Loader";
import {
  normalizeDistrictName,
  getSeverityFill,
} from "@/lib/publicAlertDistrictUtils";

function buildDistrictAlertMap(alerts = []) {
  const districtMap = {};

  for (const alert of alerts) {
    if (!alert?.affectedArea || alert?.status !== "Active") continue;

    const key = normalizeDistrictName(alert.affectedArea);
    if (!key) continue;

    const current = districtMap[key];

    const nextRank =
      alert?.severity === "High"
        ? 3
        : alert?.severity === "Medium"
        ? 2
        : alert?.severity === "Low"
        ? 1
        : 0;

    const currentRank =
      current?.severity === "High"
        ? 3
        : current?.severity === "Medium"
        ? 2
        : current?.severity === "Low"
        ? 1
        : 0;

    if (!current || nextRank > currentRank) {
      districtMap[key] = {
        severity: alert.severity,
        disasterType: alert.disasterType,
        affectedArea: alert.affectedArea,
        description: alert.description,
      };
    }
  }

  return districtMap;
}

export function PublicSriLankaMap({
  alerts = [],
  selectedDistrict = "All",
  onSelectDistrict,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const geoLayerRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // first render
  useEffect(() => {
    if (!containerRef.current || typeof window === "undefined") return;
    if (mapRef.current) return;

    const L = require("leaflet");

    try {
      if (containerRef.current && containerRef.current._leaflet_id) {
        delete containerRef.current._leaflet_id;
      }
    } catch {}

    const map = L.map(containerRef.current, {
      center: [7.87, 80.77],
      zoom: 7,
      minZoom: 6,
      maxZoom: 10,
    });

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
        const res = await fetch("/sri-lanka-districts.geojson", {
          cache: "no-store",
        });
        const geoJson = await res.json();

        if (!res.ok) {
          throw new Error("Failed to load Sri Lanka district map.");
        }

        const districtAlertMap = buildDistrictAlertMap(alerts);

        const layer = L.geoJSON(geoJson, {
          style: (feature) => {
            const name =
              feature?.properties?.shapeName ||
              feature?.properties?.name ||
              feature?.properties?.NAME_2 ||
              feature?.properties?.DIST_NAME ||
              feature?.properties?.district ||
              "";

            const key = normalizeDistrictName(name);
            const info = districtAlertMap[key];

            const isSelected =
              selectedDistrict !== "All" &&
              normalizeDistrictName(selectedDistrict) === key;

            return {
              color: isSelected ? "#0f172a" : "#ffffff",
              weight: isSelected ? 2.2 : 1,
              fillColor: getSeverityFill(info?.severity),
              fillOpacity: info ? 0.78 : 0.45,
            };
          },
          onEachFeature: (feature, lyr) => {
            const name =
              feature?.properties?.shapeName ||
              feature?.properties?.name ||
              feature?.properties?.NAME_2 ||
              feature?.properties?.DIST_NAME ||
              feature?.properties?.district ||
              "District";

            const key = normalizeDistrictName(name);
            const info = districtAlertMap[key];

            lyr.on("click", () => {
              if (!onSelectDistrict) return;

              if (
                selectedDistrict !== "All" &&
                normalizeDistrictName(selectedDistrict) === key
              ) {
                onSelectDistrict("All");
              } else {
                onSelectDistrict(name);
              }
            });

            lyr.bindPopup(
              info
                ? `<strong>${name}</strong><br/>Severity: ${info.severity}<br/>Type: ${info.disasterType}`
                : `<strong>${name}</strong><br/>No active alerts`
            );
          },
        });

        if (cancelled) return;
        if (!mapRef.current || mapRef.current !== map) return;

        layer.addTo(map);
        geoLayerRef.current = layer;

        try {
          map.fitBounds(layer.getBounds().pad(0.08));
        } catch {}

        setLoading(false);
      } catch (e) {
        console.error("Public alerts map error", e);
        setError(e?.message || "Failed to load alerts map.");
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

  // live style refresh when alerts or district filter change
  useEffect(() => {
    const layer = geoLayerRef.current;
    if (!layer) return;

    const districtAlertMap = buildDistrictAlertMap(alerts);

    layer.setStyle((feature) => {
      const name =
        feature?.properties?.shapeName ||
        feature?.properties?.name ||
        feature?.properties?.NAME_2 ||
        feature?.properties?.DIST_NAME ||
        feature?.properties?.district ||
        "";

      const key = normalizeDistrictName(name);
      const info = districtAlertMap[key];

      const isSelected =
        selectedDistrict !== "All" &&
        normalizeDistrictName(selectedDistrict) === key;

      return {
        color: isSelected ? "#0f172a" : "#ffffff",
        weight: isSelected ? 2.2 : 1,
        fillColor: getSeverityFill(info?.severity),
        fillOpacity: info ? 0.78 : 0.45,
      };
    });

    layer.eachLayer((lyr) => {
      const feature = lyr?.feature;
      const name =
        feature?.properties?.shapeName ||
        feature?.properties?.name ||
        feature?.properties?.NAME_2 ||
        feature?.properties?.DIST_NAME ||
        feature?.properties?.district ||
        "District";

      const key = normalizeDistrictName(name);
      const info = districtAlertMap[key];

      try {
        lyr.bindPopup(
          info
            ? `<strong>${name}</strong><br/>Severity: ${info.severity}<br/>Type: ${info.disasterType}`
            : `<strong>${name}</strong><br/>No active alerts`
        );
      } catch {}
    });
  }, [alerts, selectedDistrict]);

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-xl bg-slate-800">
      <div ref={containerRef} className="h-full w-full" />

      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/70 text-sky-50">
          <Loader size="md" />
          <span className="text-xs">Loading alerts map…</span>
        </div>
      )}

      {error && !loading && (
        <div className="absolute inset-x-4 bottom-4 rounded-lg bg-red-900/80 px-3 py-2 text-center text-xs text-red-50">
          {error}
        </div>
      )}
    </div>
  );
}