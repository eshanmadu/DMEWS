"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, X } from "lucide-react";
import "leaflet/dist/leaflet.css";

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

export default function RouteModal({ shelter, userLocation, onClose }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [state, setState] = useState({ loading: true, error: "" });

  useEffect(() => {
    if (!mapContainerRef.current || !userLocation || !shelter) return undefined;
    const L = require("leaflet");
    const origin = [userLocation.latitude, userLocation.longitude];
    const destination = [Number(shelter.latitude), Number(shelter.longitude)];
    if (!Number.isFinite(destination[0]) || !Number.isFinite(destination[1])) {
      setState({ loading: false, error: "This shelter does not have actual coordinates yet." });
      return undefined;
    }

    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

    const map = L.map(mapContainerRef.current, { center: origin, zoom: 12 });
    mapRef.current = map;
    L.tileLayer(TILE_URL, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    L.marker(origin).addTo(map).bindPopup("Your current location");
    L.marker(destination).addTo(map).bindPopup(shelter.name || "Shelter");

    const controller = new AbortController();
    setState({ loading: true, error: "" });
    fetch(`https://router.project-osrm.org/route/v1/driving/${userLocation.longitude},${userLocation.latitude};${shelter.longitude},${shelter.latitude}?overview=full&geometries=geojson`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        if (!data.code || data.code !== "Ok" || !data.routes?.[0]?.geometry?.coordinates) throw new Error("No drivable route was found.");
        const points = data.routes[0].geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude]);
        L.polyline(points, { color: "#4f46e5", weight: 5, opacity: 0.85 }).addTo(map);
        map.fitBounds(L.latLngBounds([origin, destination, ...points]), { padding: [24, 24] });
        setState({ loading: false, error: "" });
      })
      .catch((error) => {
        if (error.name !== "AbortError") setState({ loading: false, error: error.message || "Could not load the road route." });
      });

    return () => {
      controller.abort();
      map.remove();
      mapRef.current = null;
    };
  }, [shelter, userLocation]);

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="route-modal-title">
      <button type="button" className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} aria-label="Close route" />
      <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div><h2 id="route-modal-title" className="text-lg font-bold text-slate-900">Route to {shelter?.name}</h2><p className="text-xs text-slate-500">Browser GPS to shelter via OSRM road geometry</p></div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="relative h-[min(70vh,560px)] bg-slate-100">
          <div ref={mapContainerRef} className="h-full w-full" />
          {state.loading && <div className="absolute inset-0 flex items-center justify-center bg-white/70"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>}
          {state.error && <div className="absolute left-4 right-4 top-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><MapPin className="mr-2 inline h-4 w-4" />{state.error}</div>}
        </div>
      </div>
    </div>
  );
}
