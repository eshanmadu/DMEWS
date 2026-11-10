"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Droplets,
  Info,
  Loader2,
  MapPin,
  Mountain,
  Route as RouteIcon,
  X,
} from "lucide-react";
import "leaflet/dist/leaflet.css";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ROUTER_URL = "https://router.project-osrm.org/route/v1/driving";
const EARTH_RADIUS_KM = 6371;

function distanceKm(a, b) {
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function latestRiverReading(payload) {
  return Object.values(payload?.event_data || {})
    .flatMap((days) =>
      Object.entries(days || {}).flatMap(([date, readings]) =>
        Object.entries(readings || {}).map(([time, value]) => ({
          date,
          time,
          level: Number(value),
        }))
      )
    )
    .filter((reading) => Number.isFinite(reading.level))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .at(-1);
}

function routeSegments(route, hazards) {
  const points = route.geometry.coordinates.map(([longitude, latitude]) => [
    latitude,
    longitude,
  ]);
  return points.slice(0, -1).map((start, index) => {
    const end = points[index + 1];
    const midpoint = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
    const nearby = hazards.filter(
      (hazard) => distanceKm(midpoint, [hazard.latitude, hazard.longitude]) <= 1.5
    );
    return { start, end, dangerous: nearby.length > 0, hazards: nearby };
  });
}

function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}

function riskLabel(score) {
  if (score >= 7) return { label: "High risk", className: "text-red-700 bg-red-50 border-red-200" };
  if (score >= 3) return { label: "Use caution", className: "text-amber-700 bg-amber-50 border-amber-200" };
  return { label: "Lowest observed risk", className: "text-emerald-700 bg-emerald-50 border-emerald-200" };
}

export default function RouteModal({ shelter, userLocation, onClose }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [state, setState] = useState({
    loading: true,
    error: "",
    routes: [],
    selectedIndex: 0,
    alerts: [],
    landslides: [],
    river: null,
    feedErrors: [],
  });

  const destination = useMemo(
    () => [Number(shelter?.latitude), Number(shelter?.longitude)],
    [shelter]
  );

  useEffect(() => {
    if (!mapContainerRef.current || !userLocation || !shelter) return undefined;
    const L = require("leaflet");
    const origin = [userLocation.latitude, userLocation.longitude];
    if (!Number.isFinite(destination[0]) || !Number.isFinite(destination[1])) {
      setState((current) => ({
        ...current,
        loading: false,
        error: "This shelter does not have actual coordinates yet.",
      }));
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
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    L.marker(origin).addTo(map).bindPopup("Your current location");
    L.marker(destination).addTo(map).bindPopup(shelter.name || "Shelter");

    const controller = new AbortController();
    const fetchJson = async (url, fallback, label) => {
      try {
        const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
        const data = await response.json().catch(() => fallback);
        if (!response.ok) throw new Error(`${label} feed returned HTTP ${response.status}.`);
        return data;
      } catch (error) {
        if (error.name === "AbortError") throw error;
        return { value: fallback, error: error.message || `${label} feed unavailable.` };
      }
    };

    setState((current) => ({ ...current, loading: true, error: "", feedErrors: [] }));
    Promise.all([
      fetch(
        `${ROUTER_URL}/${userLocation.longitude},${userLocation.latitude};${destination[1]},${destination[0]}?overview=full&alternatives=true&steps=false&geometries=geojson`,
        { signal: controller.signal }
      ).then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.code !== "Ok") throw new Error("No drivable route was found.");
        return data.routes || [];
      }),
      fetchJson(`${API_BASE}/alerts`, [], "Flood and emergency alert"),
      fetchJson(`${API_BASE}/landslide-warnings`, { warnings: [] }, "Landslide"),
      fetchJson(`${API_BASE}/shelters/river-water-levels`, {}, "River level"),
    ])
      .then(([routes, alertsResult, landslideResult, riverResult]) => {
        const alerts = Array.isArray(alertsResult?.value ?? alertsResult)
          ? alertsResult?.value ?? alertsResult
          : [];
        const landslidePayload = landslideResult?.value ?? landslideResult;
        const river = riverResult?.value ?? riverResult;
        const feedErrors = [alertsResult, landslideResult, riverResult]
          .filter((result) => result?.error)
          .map((result) => result.error);
        const hazards = alerts
          .filter((alert) => String(alert.status || "").toLowerCase() === "active")
          .map((alert) => ({
            latitude: Number(alert.latitude),
            longitude: Number(alert.longitude),
            label: alert.affectedArea || alert.disasterType || "Active warning",
          }))
          .filter((hazard) => Number.isFinite(hazard.latitude) && Number.isFinite(hazard.longitude));
        const warningDistricts = (landslidePayload?.warnings || [])
          .filter((warning) => warning?.district && warning?.divisions?.length)
          .filter((warning) => warning.district.toLowerCase() === String(shelter.district || "").toLowerCase());
        const observedRiver = latestRiverReading(river);
        const builtRoutes = routes.map((route) => {
          const segments = routeSegments(route, hazards);
          const score =
            segments.filter((segment) => segment.dangerous).length * 3 +
            warningDistricts.length * 3 +
            (observedRiver ? 1 : 0);
          return { ...route, segments, score, warningDistricts };
        });
        const selectedIndex = builtRoutes.reduce(
          (best, route, index, list) => (route.score < list[best].score ? index : best),
          0
        );
        setState({
          loading: false,
          error: "",
          routes: builtRoutes,
          selectedIndex,
          alerts,
          landslides: warningDistricts,
          river,
          feedErrors,
        });
        const allPoints = builtRoutes.flatMap((route) =>
          route.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude])
        );
        map.fitBounds(L.latLngBounds([origin, destination, ...allPoints]), { padding: [24, 24] });
        hazards.forEach((hazard) =>
          L.circleMarker([hazard.latitude, hazard.longitude], {
            radius: 8,
            color: "#b91c1c",
            fillColor: "#ef4444",
            fillOpacity: 0.8,
          }).addTo(map).bindPopup(hazard.label)
        );
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setState((current) => ({ ...current, loading: false, error: error.message }));
        }
      });

    return () => {
      controller.abort();
      map.remove();
      mapRef.current = null;
    };
  }, [destination, shelter, userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !state.routes.length) return undefined;
    const L = require("leaflet");
    const layers = [];
    state.routes.forEach((route, routeIndex) => {
      route.segments.forEach((segment) => {
        const isSelected = routeIndex === state.selectedIndex;
        layers.push(
          L.polyline([segment.start, segment.end], {
            color: segment.dangerous ? "#dc2626" : isSelected ? "#059669" : "#64748b",
            weight: isSelected ? 6 : 4,
            opacity: isSelected ? 0.95 : 0.45,
          })
            .addTo(map)
            .bindPopup(segment.dangerous ? "Danger reported near this road segment." : "Road segment")
        );
      });
    });
    return () => layers.forEach((layer) => layer.remove());
  }, [state.routes, state.selectedIndex]);

  const selectedRoute = state.routes[state.selectedIndex];
  const riverReading = latestRiverReading(state.river);
  const selectedRisk = selectedRoute ? riskLabel(selectedRoute.score) : null;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="route-modal-title">
      <button type="button" className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} aria-label="Close route" />
      <div className="relative z-10 w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <RouteIcon className="h-5 w-5 text-emerald-600" />
              <h2 id="route-modal-title" className="text-lg font-bold text-slate-900">Safe to travel?</h2>
            </div>
            <p className="text-xs text-slate-500">Safest observed route to {shelter?.name}; never drive or walk through flood water.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid lg:grid-cols-[1fr_360px]">
          <div className="relative h-[min(70vh,560px)] bg-slate-100">
            <div ref={mapContainerRef} className="h-full w-full" />
            {state.loading && <div className="absolute inset-0 flex items-center justify-center bg-white/70"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>}
            {state.error && <div className="absolute left-4 right-4 top-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><MapPin className="mr-2 inline h-4 w-4" />{state.error}</div>}
            {state.routes.length > 0 && <div className="absolute bottom-4 left-4 rounded-lg bg-white/95 px-3 py-2 text-xs shadow"><span className="mr-3 inline-block h-2 w-6 rounded bg-emerald-600" />Safest route <span className="ml-3 mr-3 inline-block h-2 w-6 rounded bg-red-600" />Danger reported</div>}
          </div>
          <aside className="max-h-[min(70vh,560px)] overflow-y-auto border-l border-slate-200 p-5">
            {selectedRoute && selectedRisk && (
              <div className={`rounded-xl border p-3 ${selectedRisk.className}`}>
                <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5" />{selectedRisk.label}</div>
                <p className="mt-1 text-xs">This compares available road alternatives against the latest feeds. It is not an official clearance.</p>
              </div>
            )}
            <h3 className="mt-5 text-sm font-bold text-slate-900">Suggested routes</h3>
            <div className="mt-2 space-y-2">
              {state.routes.map((route, index) => (
                <button key={`${route.distance}-${index}`} type="button" onClick={() => setState((current) => ({ ...current, selectedIndex: index }))} className={`w-full rounded-xl border p-3 text-left ${index === state.selectedIndex ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                  <div className="flex items-center justify-between text-sm font-semibold text-slate-900"><span>{index === state.selectedIndex ? "Safest observed route" : `Alternative ${index}`}</span><span>{(route.distance / 1000).toFixed(1)} km</span></div>
                  <div className="mt-1 text-xs text-slate-600">{formatDuration(route.duration)} · risk score {route.score}</div>
                </button>
              ))}
            </div>
            <div className="mt-5 space-y-2">
              <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-700"><Droplets className="h-4 w-4 shrink-0 text-cyan-600" /><span><strong>Water levels:</strong> {riverReading ? `latest observation ${riverReading.level.toFixed(2)} m` : "no recent observation available"}</span></div>
              <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-700"><Mountain className="h-4 w-4 shrink-0 text-amber-600" /><span><strong>Landslides:</strong> {state.landslides.length ? `official warning in ${shelter.district}` : "no matching official warning found"}</span></div>
              <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-700"><AlertTriangle className="h-4 w-4 shrink-0 text-red-600" /><span><strong>Mapped alerts:</strong> {state.alerts.filter((alert) => String(alert.status || "").toLowerCase() === "active").length} active alerts loaded</span></div>
            </div>
            {state.feedErrors.length > 0 && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><Info className="mr-1 inline h-4 w-4" />Some official feeds could not be loaded: {state.feedErrors.join(" ")}</div>}
            <p className="mt-5 text-[11px] leading-relaxed text-slate-500">Sources: DMEWS alerts, official DMC landslide warnings, supplied river gauges, and OpenStreetMap/OSRM road geometry. Confirm conditions with DMC and local officials before travelling.</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
