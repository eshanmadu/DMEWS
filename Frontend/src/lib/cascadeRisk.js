// Rule-based cascade indicators linking river/flood conditions and DMC landslide warnings.
// These are NOT model predictions: they show where conditions co-occur so officers can
// prioritise checks. All thresholds live here so they are easy to review and adjust.

import { getStationStatus } from "./riverGauges";

export const NEARBY_KM = 15;
export const SHARP_DROP_M = -0.15; // fall since previous reading
export const SHARP_RISE_M = 0.25; // rise since previous reading
export const RISING_M = 0.005; // same definition the Risk management page uses

/* ------------------------------------------------------------------ */
/* Names                                                               */
/* ------------------------------------------------------------------ */

function compact(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\bdistrict\b|\bds division\b|\bdivision\b/g, "")
    .replace(/[^a-z]/g, "");
}

// Loose form for spelling variants between DMC reports and the boundary file,
// e.g. "Thumpane"/"Tumpane", "Pasbage Korale"/"Pasbagekorale", "Ambagamuwa"/"Ambagamuwa Korale".
function loose(name) {
  return compact(name)
    .replace(/korale$/, "")
    .replace(/([tdkgbpc])h/g, "$1")
    .replace(/(.)\1+/g, "$1");
}

export function normalizeDistrict(name) {
  return compact(name);
}

/* ------------------------------------------------------------------ */
/* Geometry (WGS84, small distances)                                   */
/* ------------------------------------------------------------------ */

export function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

function polygonsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInGeometry(lon, lat, geometry) {
  return polygonsOf(geometry).some(
    ([outer, ...holes]) => pointInRing(lon, lat, outer) && !holes.some((h) => pointInRing(lon, lat, h))
  );
}

function bboxOf(geometry) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const polygon of polygonsOf(geometry)) {
    for (const [x, y] of polygon[0] || []) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return [minX, minY, maxX, maxY];
}

// Distance from a point to the edge of an area (0 when the point is inside it).
export function distanceToAreaKm(lat, lon, area) {
  if (pointInGeometry(lon, lat, area.geometry)) return 0;
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180);
  const ky = 110.574;
  let best = Infinity;
  for (const polygon of polygonsOf(area.geometry)) {
    for (const ring of polygon) {
      for (let i = 1; i < ring.length; i += 1) {
        const ax = (ring[i - 1][0] - lon) * kx;
        const ay = (ring[i - 1][1] - lat) * ky;
        const bx = (ring[i][0] - lon) * kx;
        const by = (ring[i][1] - lat) * ky;
        const dx = bx - ax;
        const dy = by - ay;
        const len = dx * dx + dy * dy;
        const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
        const d = Math.hypot(ax + t * dx, ay + t * dy);
        if (d < best) best = d;
      }
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Areas                                                               */
/* ------------------------------------------------------------------ */

/** Build DS division records with their district name from the two boundary files. */
export function buildAreas(dsGeoJson, districtGeoJson) {
  const districtById = new Map(
    (districtGeoJson?.features || []).map((f) => [
      f.properties?.shapeISO,
      String(f.properties?.shapeName || "").replace(/\s*District$/i, ""),
    ])
  );
  return (dsGeoJson?.features || []).map((f) => ({
    id: f.properties?.id,
    name: f.properties?.name || "",
    district: districtById.get(f.properties?.district_id) || "",
    centerLat: Number(f.properties?.center_lat),
    centerLng: Number(f.properties?.center_lng),
    geometry: f.geometry,
    bbox: bboxOf(f.geometry),
  }));
}

function findArea(areas, divisionName, districtName) {
  const district = normalizeDistrict(districtName);
  const inDistrict = areas.filter((a) => normalizeDistrict(a.district) === district);
  const variants = String(divisionName || "")
    .split(/\s+or\s+|\s*\/\s*/i)
    .map((v) => v.trim())
    .filter(Boolean);

  for (const pool of [inDistrict, areas]) {
    for (const variant of variants) {
      const c = compact(variant);
      const l = loose(variant);
      const hit =
        pool.find((a) => compact(a.name) === c) ||
        pool.find((a) => loose(a.name) === l) ||
        pool.find((a) => l.length >= 5 && (loose(a.name).startsWith(l) || l.startsWith(loose(a.name))));
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * Turn DMC warnings into one record per DS division (highest level wins).
 * Divisions that cannot be placed on the boundary file are returned separately, never dropped silently.
 */
export function matchWarningAreas(warnings, areas) {
  const byArea = new Map();
  const unmatched = [];
  for (const warning of warnings || []) {
    for (const division of warning.divisions || []) {
      const area = findArea(areas, division, warning.district);
      if (!area) {
        unmatched.push({ division, district: warning.district, level: warning.level });
        continue;
      }
      const current = byArea.get(area.id);
      if (!current || warning.level > current.level) {
        byArea.set(area.id, { area, level: warning.level, reportedName: division, district: warning.district });
      }
    }
  }
  return { warnedAreas: [...byArea.values()], unmatched };
}

/** The DS division containing a point, or null. */
export function findAreaAt(areas, lat, lon) {
  return (
    areas.find(
      (a) =>
        lon >= a.bbox[0] &&
        lon <= a.bbox[2] &&
        lat >= a.bbox[1] &&
        lat <= a.bbox[3] &&
        pointInGeometry(lon, lat, a.geometry)
    ) || null
  );
}

/** Attach the containing DS division / district to each gauge. */
export function locateGauges(stations, areas) {
  return stations
    .filter((s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude))
    .map((s) => {
      const area = areas.find(
        (a) =>
          s.longitude >= a.bbox[0] &&
          s.longitude <= a.bbox[2] &&
          s.latitude >= a.bbox[1] &&
          s.latitude <= a.bbox[3] &&
          pointInGeometry(s.longitude, s.latitude, a.geometry)
      );
      return { ...s, dsDivision: area?.name || null, district: area?.district || null };
    });
}

function gaugesNear(area, gauges, radiusKm = NEARBY_KM) {
  const pad = radiusKm / 100; // ~degrees, generous prefilter
  return gauges
    .filter(
      (g) =>
        g.longitude >= area.bbox[0] - pad &&
        g.longitude <= area.bbox[2] + pad &&
        g.latitude >= area.bbox[1] - pad &&
        g.latitude <= area.bbox[3] + pad
    )
    .map((g) => ({ gauge: g, distanceKm: distanceToAreaKm(g.latitude, g.longitude, area) }))
    .filter((x) => x.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/* ------------------------------------------------------------------ */
/* Gauge signals                                                       */
/* ------------------------------------------------------------------ */

function statusRank(gauge) {
  if (![gauge.alertLevel, gauge.minorFloodLevel, gauge.majorFloodLevel].every((v) => Number.isFinite(v) && v > 0)) return 0;
  if (gauge.level >= gauge.majorFloodLevel) return 3;
  if (gauge.level >= gauge.minorFloodLevel) return 2;
  if (gauge.level >= gauge.alertLevel) return 1;
  return 0;
}

export function gaugeSignals(gauge) {
  const signals = [];
  if (gauge.change <= SHARP_DROP_M)
    signals.push({
      key: "drop",
      label: `Sharp drop ${gauge.change.toFixed(2)} m`,
      detail: "An unusual fall can mean a blockage upstream. Verify on the ground.",
    });
  if (gauge.change >= SHARP_RISE_M)
    signals.push({
      key: "rise",
      label: `Sudden rise +${gauge.change.toFixed(2)} m`,
      detail: "A sudden rise can follow the release of a blockage upstream.",
    });
  return signals;
}

/* ------------------------------------------------------------------ */
/* Direction 1: flood and river conditions -> landslide                */
/* ------------------------------------------------------------------ */

function sumFinite(values) {
  const nums = (values || []).map(Number).filter(Number.isFinite);
  return nums.length ? nums.reduce((a, b) => a + b, 0) : null;
}

export function scoreBand(score) {
  if (score >= 50) return { label: "High", color: "#b91c1c", fill: "#fecaca" };
  if (score >= 25) return { label: "Elevated", color: "#c2410c", fill: "#fed7aa" };
  if (score > 0) return { label: "Low", color: "#a16207", fill: "#fef9c3" };
  return { label: "None found", color: "#475569", fill: "#e2e8f0" };
}

/**
 * For each warned DS division, list the flood/river conditions that make slope failure more likely.
 * Points: flood status ≤35, rising ≤10, gauge rainfall ≤20, published district risk ≤15,
 * past 3-day rain ≤10, 2-day forecast rain ≤10 (max 100).
 */
export function floodToLandslide({ warnedAreas, gauges, riskLevels = {}, weatherByDistrict = new Map() }) {
  return warnedAreas
    .map((w) => {
      const nearby = gaugesNear(w.area, gauges);
      const factors = [];

      const worst = nearby.reduce((best, x) => (statusRank(x.gauge) > statusRank(best?.gauge || {}) ? x : best), null);
      const rank = worst ? statusRank(worst.gauge) : 0;
      if (rank > 0) {
        const points = [0, 15, 25, 35][rank];
        factors.push({
          points,
          label: `${worst.gauge.station} gauge at ${getStationStatus(worst.gauge).label}`,
          detail: `${worst.gauge.basin}, ${worst.distanceKm.toFixed(1)} km away. High rivers erode banks and undercut slopes.`,
        });
      }

      const rising = nearby.filter((x) => x.gauge.change > RISING_M);
      if (rising.length) {
        factors.push({
          points: 10,
          label: `${rising.length} nearby gauge${rising.length > 1 ? "s" : ""} rising`,
          detail: rising
            .slice(0, 3)
            .map((x) => `${x.gauge.station} +${x.gauge.change.toFixed(2)} m`)
            .join(", "),
        });
      }

      const wettest = nearby
        .filter((x) => Number.isFinite(x.gauge.rainfall))
        .sort((a, b) => b.gauge.rainfall - a.gauge.rainfall)[0];
      if (wettest && wettest.gauge.rainfall >= 25) {
        const rain = wettest.gauge.rainfall;
        factors.push({
          points: rain >= 100 ? 20 : rain >= 50 ? 12 : 6,
          label: `${rain.toFixed(0)} mm rainfall at ${wettest.gauge.station}`,
          detail: "Rainfall reported by the river gauge. Saturated soil weakens slopes.",
        });
      }

      // riskLevels is keyed by normalizeDistrict(name).
      const published = String(
        riskLevels[normalizeDistrict(w.area.district)] || riskLevels[normalizeDistrict(w.district)] || ""
      ).toLowerCase();
      if (published === "high" || published === "medium") {
        factors.push({
          points: published === "high" ? 15 : 8,
          label: `${w.area.district} published flood risk: ${published}`,
          detail: "District level set by DMEWS admins.",
        });
      }

      const weather = weatherByDistrict.get(normalizeDistrict(w.area.district));
      const past3 = sumFinite(weather?.daily?.precipitation_sum_last3days);
      if (past3 != null && past3 >= 75) {
        factors.push({
          points: past3 >= 150 ? 10 : 5,
          label: `${past3.toFixed(0)} mm rain in the past 3 days`,
          detail: `${w.area.district} district (Open-Meteo).`,
        });
      }
      const forecast2 = sumFinite(weather?.daily?.precipitation_sum?.slice(0, 2));
      if (forecast2 != null && forecast2 >= 50) {
        factors.push({
          points: forecast2 >= 100 ? 10 : 5,
          label: `${forecast2.toFixed(0)} mm rain forecast today and tomorrow`,
          detail: `${w.area.district} district forecast.`,
        });
      }

      const score = Math.min(100, factors.reduce((t, f) => t + f.points, 0));
      return { ...w, nearby, factors, score, band: scoreBand(score) };
    })
    .sort((a, b) => b.level - a.level || b.score - a.score);
}

/* ------------------------------------------------------------------ */
/* Direction 2: landslide -> flood                                     */
/* ------------------------------------------------------------------ */

/**
 * Group warned DS divisions by the river basins of gauges within NEARBY_KM.
 * Nearby gauges are the reaches debris could enter; other gauges in the same basin are listed
 * for checking, since the feed does not say which way the river flows between them.
 */
export function landslideToFlood({ warnedAreas, gauges, minLevel = 2 }) {
  const sources = warnedAreas.filter((w) => w.level >= minLevel);
  const basins = new Map();
  const noGauge = [];

  for (const w of sources) {
    const nearby = gaugesNear(w.area, gauges);
    if (!nearby.length) {
      noGauge.push(w);
      continue;
    }
    for (const x of nearby) {
      const key = x.gauge.basin;
      if (!basins.has(key)) basins.set(key, { basin: key, sources: new Map(), nearby: new Map() });
      const b = basins.get(key);
      b.sources.set(w.area.id, w);
      const prev = b.nearby.get(x.gauge.station);
      if (!prev || x.distanceKm < prev.distanceKm)
        b.nearby.set(x.gauge.station, { ...x, from: w.area.name });
    }
  }

  const result = [...basins.values()].map((b) => {
    const sourceList = [...b.sources.values()].sort((a, c) => c.level - a.level);
    const nearbyList = [...b.nearby.values()]
      .map((x) => ({ ...x, signals: gaugeSignals(x.gauge) }))
      .sort((a, c) => a.distanceKm - c.distanceKm);
    const nearbyNames = new Set(nearbyList.map((x) => x.gauge.station));
    const sameBasin = gauges
      .filter((g) => g.basin === b.basin && !nearbyNames.has(g.station))
      .map((g) => ({
        gauge: g,
        signals: gaugeSignals(g),
        distanceKm: Math.min(...sourceList.map((s) => distanceToAreaKm(g.latitude, g.longitude, s.area))),
      }))
      .sort((a, c) => a.distanceKm - c.distanceKm);

    const topLevel = sourceList[0]?.level || 0;
    // Only gauges within NEARBY_KM can escalate to "Act now"; far gauges in the basin raise it to "Watch".
    const nearSignal = nearbyList.some((x) => x.signals.length);
    const farSignal = sameBasin.some((x) => x.signals.length);
    const anyHigh = nearbyList.some((x) => statusRank(x.gauge) > 0);
    const concern =
      topLevel >= 3 && (nearSignal || anyHigh)
        ? { label: "Act now", color: "#b91c1c", fill: "#fecaca" }
        : topLevel >= 3 || nearSignal || farSignal || anyHigh
        ? { label: "Watch closely", color: "#c2410c", fill: "#fed7aa" }
        : { label: "Monitor", color: "#a16207", fill: "#fef9c3" };

    const districts = [...new Set([...nearbyList, ...sameBasin].map((x) => x.gauge.district).filter(Boolean))];
    return { basin: b.basin, sources: sourceList, nearby: nearbyList, sameBasin, concern, districts, topLevel };
  });

  const order = { "Act now": 0, "Watch closely": 1, Monitor: 2 };
  result.sort((a, b) => order[a.concern.label] - order[b.concern.label] || b.topLevel - a.topLevel);
  return { basins: result, noGauge };
}
