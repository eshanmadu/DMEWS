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
import { buildGaugeFeedUrl, getStationStatus, parseArcGISFeed } from "@/lib/riverGauges";
import "leaflet/dist/leaflet.css";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ROUTER_URL = "https://router.project-osrm.org/route/v1/driving";
const EARTH_RADIUS_KM = 6371;
const NO_ADDITIONAL_HAZARDS = [];

const DISTRICT_COORDINATES = {
  Ampara: [7.2833, 81.6667],
  Anuradhapura: [8.3114, 80.4037],
  Badulla: [6.9934, 81.0550],
  Batticaloa: [7.7248, 81.6964],
  Colombo: [6.9271, 79.8612],
  Galle: [6.0329, 80.2170],
  Gampaha: [7.0873, 80.0144],
  Hambantota: [6.1248, 81.1185],
  Jaffna: [9.6615, 80.0255],
  Kalutara: [6.5854, 79.9607],
  Kandy: [7.2906, 80.6337],
  Kegalle: [7.2513, 80.3464],
  Kilinochchi: [9.3803, 80.3770],
  Kurunegala: [7.4863, 80.3623],
  Mannar: [8.9771, 79.9042],
  Matale: [7.4675, 80.6234],
  Matara: [5.9549, 80.5549],
  Monaragala: [6.8728, 81.3507],
  Mullaitivu: [9.2671, 80.8142],
  "Nuwara Eliya": [6.9497, 80.7891],
  Polonnaruwa: [7.9403, 81.0188],
  Puttalam: [8.0408, 79.8394],
  Ratnapura: [6.6828, 80.3992],
  Trincomalee: [8.5874, 81.2152],
  Vavuniya: [8.7514, 80.4971],
};

function getDestination(shelter) {
  const candidates = [
    [shelter?.latitude, shelter?.longitude],
    [shelter?.cityLatitude, shelter?.cityLongitude],
  ];
  for (const [rawLatitude, rawLongitude] of candidates) {
    const latitude = Number(rawLatitude);
    const longitude = Number(rawLongitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return [latitude, longitude];
    }
  }
  const districtCenter = DISTRICT_COORDINATES[String(shelter?.district || "").trim()];
  return districtCenter ? [...districtCenter] : null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function distanceToSegmentKm(point, start, end) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const referenceLatitude = toRadians(point[0]);
  const project = ([latitude, longitude]) => [
    EARTH_RADIUS_KM * toRadians(longitude - point[1]) * Math.cos(referenceLatitude),
    EARTH_RADIUS_KM * toRadians(latitude - point[0]),
  ];
  const [startX, startY] = project(start);
  const [endX, endY] = project(end);
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const segmentLengthSquared = deltaX ** 2 + deltaY ** 2;
  const fraction = segmentLengthSquared
    ? Math.max(0, Math.min(1, -(startX * deltaX + startY * deltaY) / segmentLengthSquared))
    : 0;
  return Math.hypot(startX + fraction * deltaX, startY + fraction * deltaY);
}

async function geocodeWarningLocations(labels) {
  const uniqueLabels = [...new Set(labels.map((label) => String(label || "").trim()).filter(Boolean))];
  const results = await Promise.all(
    uniqueLabels.map(async (label) => {
      try {
        const response = await fetch(
          `${API_BASE}/geocode/suggest?q=${encodeURIComponent(`${label}, Sri Lanka`)}`,
          { cache: "no-store" }
        );
        if (!response.ok) return null;
        const data = await response.json().catch(() => ({}));
        const suggestion = Array.isArray(data?.suggestions)
          ? data.suggestions.find((item) =>
              Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude))
            )
          : null;
        if (!suggestion) return null;
        return {
          latitude: Number(suggestion.latitude),
          longitude: Number(suggestion.longitude),
          label,
        };
      } catch {
        return null;
      }
    })
  );
  return results.filter(Boolean);
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
    const nearby = hazards.filter(
      (hazard) =>
        distanceToSegmentKm([hazard.latitude, hazard.longitude], start, end) <= 2.5
    );
    return { start, end, dangerous: nearby.length > 0, hazards: nearby };
  });
}

function scoreRouteRisk(segments) {
  const exposedHazards = new Map();
  segments.forEach((segment) => {
    segment.hazards.forEach((hazard) => {
      const key = [
        hazard.source,
        hazard.label,
        Number(hazard.latitude).toFixed(4),
        Number(hazard.longitude).toFixed(4),
      ].join(":");
      exposedHazards.set(key, hazard);
    });
  });
  return [...exposedHazards.values()].reduce(
    (score, hazard) => score + (Number(hazard.riskWeight) || 3),
    0
  );
}

function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}

function riskLabel(score) {
  if (score >= 5) return { label: "High risk", className: "text-red-700 bg-red-50 border-red-200" };
  if (score >= 2) return { label: "Use caution", className: "text-amber-700 bg-amber-50 border-amber-200" };
  return { label: "Lowest observed risk", className: "text-emerald-700 bg-emerald-50 border-emerald-200" };
}

export default function RouteModal({
  shelter,
  userLocation,
  onClose,
  originLabel = "Your current location",
  additionalHazards = NO_ADDITIONAL_HAZARDS,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [state, setState] = useState({
    loading: true,
    error: "",
    routes: [],
    selectedIndex: 0,
    alerts: [],
    landslides: [],
    floodWarnings: [],
    floodFeedAvailable: false,
    river: null,
    feedErrors: [],
  });

  const destination = useMemo(() => getDestination(shelter), [shelter]);

  useEffect(() => {
    if (!mapContainerRef.current || !userLocation || !shelter) return undefined;
    const L = require("leaflet");
    const origin = [userLocation.latitude, userLocation.longitude];
    if (!destination || !Number.isFinite(destination[0]) || !Number.isFinite(destination[1])) {
      setState((current) => ({
        ...current,
        loading: false,
        error: "This shelter and district do not have usable coordinates for routing.",
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
    L.marker(origin).addTo(map).bindPopup(originLabel);
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
        `${ROUTER_URL}/${userLocation.longitude},${userLocation.latitude};${destination[1]},${destination[0]}?overview=full&alternatives=3&steps=false&geometries=geojson`,
        { signal: controller.signal }
      ).then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.code !== "Ok") throw new Error("No drivable route was found.");
        return data.routes || [];
      }),
      fetchJson(`${API_BASE}/alerts`, [], "Flood and emergency alert"),
      fetchJson(`${API_BASE}/landslide-warnings`, { warnings: [] }, "Landslide"),
      fetchJson(`${API_BASE}/shelters/river-water-levels`, {}, "River level"),
      fetchJson(buildGaugeFeedUrl(), { features: [] }, "Live river gauge"),
    ])
      .then(async ([routes, alertsResult, landslideResult, riverResult, gaugeResult]) => {
        const alerts = Array.isArray(alertsResult?.value ?? alertsResult)
          ? alertsResult?.value ?? alertsResult
          : [];
        const landslidePayload = landslideResult?.value ?? landslideResult;
        const river = riverResult?.value ?? riverResult;
        const feedErrors = [alertsResult, landslideResult, riverResult]
          .filter((result) => result?.error)
          .map((result) => result.error);
        const gaugePayload = gaugeResult?.value ?? gaugeResult;
        const floodFeedAvailable =
          !gaugeResult?.error && Array.isArray(gaugePayload?.features);
        if (!floodFeedAvailable && !gaugeResult?.error) {
          feedErrors.push("Live river gauge feed returned no gauge data.");
        }
        const floodWarnings = floodFeedAvailable
          ? parseArcGISFeed(gaugePayload).flatMap((station) => {
              const status = getStationStatus(station);
              const riskWeight = {
                Alert: 2,
                "Minor flood": 3,
                "Major flood": 5,
              }[status.label];
              if (!riskWeight || !Number.isFinite(station.latitude) || !Number.isFinite(station.longitude)) {
                return [];
              }
              return [{
                latitude: station.latitude,
                longitude: station.longitude,
                label: `${station.station}: ${status.label}`,
                source: "Irrigation Department flood warning",
                riskWeight,
              }];
            })
          : [];
        const alertsWithCoordinates = alerts
          .filter((alert) => String(alert.status || "").toLowerCase() === "active")
          .map((alert) => ({
            latitude: Number(alert.latitude),
            longitude: Number(alert.longitude),
            label: alert.affectedArea || alert.disasterType || "Active warning",
            source: "Emergency alert",
          }))
          .filter((hazard) => Number.isFinite(hazard.latitude) && Number.isFinite(hazard.longitude));
        const alertsWithoutCoordinates = alerts
          .filter((alert) => String(alert.status || "").toLowerCase() === "active")
          .filter((alert) => !Number.isFinite(Number(alert.latitude)) || !Number.isFinite(Number(alert.longitude)))
          .map((alert) => alert.affectedArea || alert.disasterType)
          .filter(Boolean);
        const allLandslideWarnings = Array.isArray(landslidePayload?.warnings)
          ? landslidePayload.warnings
          : [];
        const warningDistricts = allLandslideWarnings
          .filter((warning) => warning?.district && warning?.divisions?.length)
          .filter((warning) => warning.district.toLowerCase() === String(shelter.district || "").toLowerCase());
        const landslideLabels = allLandslideWarnings.flatMap((warning) =>
          (warning.divisions || []).length
            ? warning.divisions.map((division) => `${division}, ${warning.district}`)
            : [warning.district]
        );
        const geocodedWarnings = await geocodeWarningLocations([
          ...alertsWithoutCoordinates,
          ...landslideLabels,
        ]);
        const alertGeocodes = geocodedWarnings.filter((hazard) =>
          alertsWithoutCoordinates.some((label) =>
            hazard.label.toLowerCase().includes(String(label).trim().toLowerCase())
          )
        ).map((hazard) => ({ ...hazard, source: "Emergency alert" }));
        const landslideGeocodes = geocodedWarnings
          .filter((hazard) =>
            landslideLabels.some((label) =>
              label.toLowerCase().includes(hazard.label.toLowerCase()) ||
              hazard.label.toLowerCase().includes(label.toLowerCase())
            )
          )
          .map((hazard) => ({ ...hazard, source: "Official landslide warning" }));
        const suppliedHazards = additionalHazards
          .map((hazard) => ({
            ...hazard,
            latitude: Number(hazard.latitude),
            longitude: Number(hazard.longitude),
          }))
          .filter((hazard) => Number.isFinite(hazard.latitude) && Number.isFinite(hazard.longitude));
        const hazards = [
          ...alertsWithCoordinates,
          ...alertGeocodes,
          ...landslideGeocodes,
          ...floodWarnings,
          ...suppliedHazards,
        ];
        const builtRoutes = routes.map((route) => {
          const segments = routeSegments(route, hazards);
          return {
            ...route,
            segments,
            score: scoreRouteRisk(segments),
            warningDistricts,
          };
        }).sort(
          (a, b) => a.score - b.score || a.duration - b.duration || a.distance - b.distance
        );
        setState({
          loading: false,
          error: "",
          routes: builtRoutes,
          selectedIndex: 0,
          alerts,
          landslides: warningDistricts,
          floodWarnings,
          floodFeedAvailable,
          river,
          feedErrors,
        });
        const allPoints = builtRoutes.flatMap((route) =>
          route.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude])
        );
        map.fitBounds(L.latLngBounds([origin, destination, ...allPoints]), { padding: [24, 24] });
        hazards.forEach((hazard) =>
          L.circleMarker([hazard.latitude, hazard.longitude], {
            radius: 10,
            color: "#b91c1c",
            weight: 3,
            fillColor: "#ef4444",
            fillOpacity: 0.85,
          }).addTo(map).bindPopup(
            `<strong>${escapeHtml(hazard.source || "Warning")}</strong><br>${escapeHtml(hazard.label)}`
          )
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
  }, [additionalHazards, destination, originLabel, shelter, userLocation]);

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
            .bindPopup(
              segment.dangerous
                ? `<strong>Warning near this road segment</strong><br>${escapeHtml(
                    segment.hazards.map((hazard) => hazard.label).join("; ")
                  )}`
                : "Road segment"
            )
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
            <p className="mt-1 text-xs text-slate-500">
              Routes are ranked by mapped warning exposure, then travel time.
              {state.routes.length === 1
                ? " The routing service returned only one drivable route, so no alternate road was available to compare."
                : ""}
            </p>
            <div className="mt-2 space-y-2">
              {state.routes.map((route, index) => (
                <button key={`${route.distance}-${index}`} type="button" onClick={() => setState((current) => ({ ...current, selectedIndex: index }))} className={`w-full rounded-xl border p-3 text-left ${index === state.selectedIndex ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                  <div className="flex items-center justify-between text-sm font-semibold text-slate-900"><span>{index === state.selectedIndex ? "Safest observed route" : `Alternative ${index}`}</span><span>{(route.distance / 1000).toFixed(1)} km</span></div>
                  <div className="mt-1 text-xs text-slate-600">{formatDuration(route.duration)} · risk score {route.score}</div>
                </button>
              ))}
            </div>
            <div className="mt-5 space-y-2">
              <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-700"><Droplets className="h-4 w-4 shrink-0 text-cyan-600" /><span><strong>Water levels:</strong> {state.floodFeedAvailable ? state.floodWarnings.length ? `${state.floodWarnings.length} active gauge warning${state.floodWarnings.length === 1 ? "" : "s"} included in route scoring` : "no active gauge warnings found" : "live gauge warnings unavailable"}{riverReading ? ` · latest observation ${riverReading.level.toFixed(2)} m` : ""}</span></div>
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
