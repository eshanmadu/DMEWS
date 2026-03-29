"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

const SRI_LANKA_BOUNDS = [
  [5.92, 79.52],
  [9.83, 81.88],
];
const SRI_LANKA_CENTER = [7.87, 80.77];
const DEFAULT_ZOOM = 7;

const BASE_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

export function AdminSriLankaEditor() {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const drawnGroupRef = useRef(null);
  const [geoJsonText, setGeoJsonText] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!containerRef.current || typeof window === "undefined") return;

    const L = require("leaflet");
    require("leaflet-draw");

    // Fix Leaflet default icon in bundled env (Next.js) so marker icon has createIcon
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      shadowUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

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

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnGroupRef.current = drawnItems;

    const drawControl = new L.Control.Draw({
      position: "topright",
      edit: {
        featureGroup: drawnItems,
      },
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
          shapeOptions: {
            color: "#22c55e",
          },
        },
        polyline: {
          shapeOptions: {
            color: "#0ea5e9",
          },
        },
        rectangle: {
          shapeOptions: {
            color: "#22c55e",
          },
        },
        circle: false,
        marker: true,
        circlemarker: false,
      },
    });

    map.addControl(drawControl);

    function updateTextFromLayers() {
      try {
        const geojson = drawnItems.toGeoJSON();
        setGeoJsonText(JSON.stringify(geojson, null, 2));
      } catch (err) {
        console.error("Failed to export GeoJSON", err);
      }
    }

    map.on(L.Draw.Event.CREATED, (e) => {
      const layer = e.layer;
      drawnItems.addLayer(layer);
      updateTextFromLayers();
    });

    map.on(L.Draw.Event.EDITED, () => {
      updateTextFromLayers();
    });

    map.on(L.Draw.Event.DELETED, () => {
      updateTextFromLayers();
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      drawnGroupRef.current = null;
    };
  }, []);

  function loadGeoJsonIntoMap(geojson) {
    if (!mapRef.current || !drawnGroupRef.current) return;
    const L = require("leaflet");

    const drawnItems = drawnGroupRef.current;
    drawnItems.clearLayers();

    const layer = L.geoJSON(geojson, {
      style: {
        color: "#22c55e",
        weight: 2,
        fillColor: "#22c55e",
        fillOpacity: 0.2,
      },
      onEachFeature: (_feature, lyr) => {
        drawnItems.addLayer(lyr);
      },
    });

    try {
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds.pad(0.1));
      }
    } catch {
      // ignore
    }
  }

  function handleApplyFromText() {
    setError(null);
    if (!geoJsonText.trim()) {
      setError("Paste GeoJSON first.");
      return;
    }
    try {
      const parsed = JSON.parse(geoJsonText);
      loadGeoJsonIntoMap(parsed);
    } catch (e) {
      setError("Invalid GeoJSON: " + e.message);
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result?.toString() || "";
        setGeoJsonText(text);
        const parsed = JSON.parse(text);
        loadGeoJsonIntoMap(parsed);
      } catch (err) {
        setError("Invalid GeoJSON file: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  function handleClear() {
    setGeoJsonText("");
    setError(null);
    if (drawnGroupRef.current) {
      drawnGroupRef.current.clearLayers();
    }
    if (mapRef.current) {
      mapRef.current.setView(SRI_LANKA_CENTER, DEFAULT_ZOOM);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)]">
      <div className="relative min-h-[420px] overflow-hidden rounded-xl bg-slate-800">
        <div ref={containerRef} className="h-full min-h-[420px] w-full" />
      </div>
      <div className="card flex h-full flex-col gap-3 p-4">
        <h2 className="text-sm font-semibold text-slate-100">
          Sri Lanka map editor
        </h2>
        <p className="text-xs text-slate-400">
          Draw and edit areas directly on the map (districts, risk zones,
          evacuation areas, etc.). The GeoJSON representation appears below.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 text-slate-200 hover:bg-slate-700">
            <input
              type="file"
              accept=".geojson,application/json"
              className="hidden"
              onChange={handleFileChange}
            />
            <span>Upload GeoJSON</span>
          </label>
          <button
            type="button"
            onClick={handleApplyFromText}
            className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-500"
          >
            Apply from text
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
          >
            Clear
          </button>
        </div>
        <textarea
          value={geoJsonText}
          onChange={(e) => setGeoJsonText(e.target.value)}
          className="mt-1 h-40 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-teal-500/0 transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
          placeholder="Draw on the map or paste GeoJSON here."
        />
        {error && (
          <div className="rounded-lg bg-red-900/60 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        )}
        <p className="mt-auto text-[11px] text-slate-500">
          Note: Changes are visual only for now (not yet saved to the backend).
        </p>
      </div>
    </div>
  );
}

