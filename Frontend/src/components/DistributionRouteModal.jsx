"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Navigation, X } from "lucide-react";
import "leaflet/dist/leaflet.css";

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

export default function DistributionRouteModal({ origin, destination, resourceType, destinationLabel, onClose }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const points = useMemo(() => ({
    from: [Number(origin?.latitude), Number(origin?.longitude)],
    to: [Number(destination?.latitude), Number(destination?.longitude)],
  }), [origin, destination]);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    if (!points.from.every(Number.isFinite) || !points.to.every(Number.isFinite)) {
      setLoading(false);
      setError("A valid source and affected-area location are required.");
      return undefined;
    }

    const L = require("leaflet");
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
    const map = L.map(containerRef.current).fitBounds([points.from, points.to], { padding: [30, 30] });
    mapRef.current = map;
    L.tileLayer(TILE_URL, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    L.marker(points.from).addTo(map).bindPopup(origin.label || "Stock location");
    L.marker(points.to).addTo(map).bindPopup(destinationLabel || "Affected area");

    const controller = new AbortController();
    fetch(
      `https://router.project-osrm.org/route/v1/driving/${points.from[1]},${points.from[0]};${points.to[1]},${points.to[0]}?overview=full&geometries=geojson&steps=false`,
      { signal: controller.signal }
    )
      .then((response) => response.json())
      .then((data) => {
        if (data.code !== "Ok" || !data.routes?.length) throw new Error("No drivable route was found.");
        const route = data.routes[0];
        const coordinates = route.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude]);
        L.polyline(coordinates, { color: "#2563eb", weight: 7, opacity: 0.9 }).addTo(map);
        map.fitBounds(L.latLngBounds(coordinates), { padding: [30, 30] });
        setLoading(false);
      })
      .catch((caught) => {
        if (caught.name !== "AbortError") {
          setError(caught.message || "Could not calculate the distribution route.");
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
      map.remove();
      mapRef.current = null;
    };
  }, [points, origin, destinationLabel]);

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/70" onClick={onClose} aria-label="Close route" />
      <div className="relative z-10 w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Navigation className="h-5 w-5 text-sky-700" />
              Distribution route
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {resourceType || "Resource"}: {origin?.label || "Stock location"} to {destinationLabel || "Affected area"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="relative h-[min(70vh,560px)]">
          <div ref={containerRef} className="h-full w-full" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <Loader2 className="h-8 w-8 animate-spin text-sky-700" />
            </div>
          )}
          {error && (
            <div className="absolute left-4 right-4 top-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
