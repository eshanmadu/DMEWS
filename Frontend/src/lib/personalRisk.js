// Turns the public data feeds into a plain-language risk summary for one location.
// Rule-based only. Thresholds are kept here so they are easy to review.

import { getStationStatus } from "./riverGauges";
import {
  NEARBY_KM,
  distanceToAreaKm,
  findAreaAt,
  floodToLandslide,
  haversineKm,
  landslideToFlood,
} from "./cascadeRisk";

export const ALERT_RADIUS_KM = 20;
const VERY_CLOSE_KM = 5;
// A landslide on the same river only counts for people within this distance of the warned area.
const SAME_RIVER_KM = 30;

export const LEVELS = [
  {
    key: "low",
    label: "Low",
    headline: "No warnings near you right now.",
    color: "#15803d",
    bg: "from-emerald-600 to-teal-600",
    soft: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
  {
    key: "aware",
    label: "Be aware",
    headline: "There is a risk near you. Stay alert and keep checking.",
    color: "#a16207",
    bg: "from-yellow-500 to-amber-500",
    soft: "bg-yellow-50 text-yellow-800 ring-yellow-200",
  },
  {
    key: "prepare",
    label: "Be prepared",
    headline: "You could be affected. Get ready to move to a safe place.",
    color: "#c2410c",
    bg: "from-orange-500 to-red-500",
    soft: "bg-orange-50 text-orange-800 ring-orange-200",
  },
  {
    key: "act",
    label: "Act now",
    headline: "High danger where you are. Move to a safe place if told to, or if you see danger signs.",
    color: "#b91c1c",
    bg: "from-red-600 to-rose-700",
    soft: "bg-red-50 text-red-800 ring-red-200",
  },
];

const LANDSLIDE_NAMES = { 1: "Yellow (watch)", 2: "Amber (alert)", 3: "Red (evacuate)" };

function rankOf(gauge) {
  if (![gauge.alertLevel, gauge.minorFloodLevel, gauge.majorFloodLevel].every((v) => Number.isFinite(v) && v > 0)) return 0;
  if (gauge.level >= gauge.majorFloodLevel) return 3;
  if (gauge.level >= gauge.minorFloodLevel) return 2;
  if (gauge.level >= gauge.alertLevel) return 1;
  return 0;
}

function km(value) {
  return value < 1 ? "less than 1 km" : `${value.toFixed(1)} km`;
}

/* ------------------------------------------------------------------ */

function assessLandslide(point, warnedAreas) {
  const withDistance = warnedAreas
    .map((w) => ({ ...w, distanceKm: distanceToAreaKm(point.lat, point.lon, w.area) }))
    .sort((a, b) => a.distanceKm - b.distanceKm || b.level - a.level);
  const inside = withDistance.filter((w) => w.distanceKm === 0).sort((a, b) => b.level - a.level)[0];
  const nearby = withDistance.filter((w) => w.distanceKm > 0 && w.distanceKm <= NEARBY_KM);
  const nearest = withDistance[0] || null;

  if (inside) {
    return {
      level: inside.level,
      status: "inside",
      title: `You are inside a ${LANDSLIDE_NAMES[inside.level]} landslide warning area`,
      detail: `${inside.area.name} DS division, ${inside.area.district} district, is on the latest DMC warning.`,
      distanceKm: 0,
      warning: inside,
      nearby,
    };
  }
  if (nearby.length) {
    const top = nearby.reduce((a, b) => (b.level > a.level ? b : a), nearby[0]);
    return {
      level: 1,
      status: "near",
      title: `Landslide warning ${km(nearest.distanceKm)} from you`,
      detail: `Nearest: ${nearest.area.name} (${LANDSLIDE_NAMES[nearest.level]}). ${
        nearby.length > 1 ? `${nearby.length} warning areas within ${NEARBY_KM} km; highest is ${LANDSLIDE_NAMES[top.level]}.` : ""
      }`.trim(),
      distanceKm: nearest.distanceKm,
      warning: nearest,
      nearby,
    };
  }
  return {
    level: 0,
    status: "clear",
    title: "No landslide warning near you",
    detail: nearest
      ? `The nearest warning area is ${nearest.area.name}, ${km(nearest.distanceKm)} away.`
      : "There are no landslide warnings in the latest DMC report.",
    distanceKm: nearest?.distanceKm ?? null,
    warning: nearest,
    nearby: [],
  };
}

function assessFlood(point, gauges) {
  const withDistance = gauges
    .map((g) => ({ gauge: g, distanceKm: haversineKm(point.lat, point.lon, g.latitude, g.longitude) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
  const nearest = withDistance[0] || null;
  const nearby = withDistance.filter((x) => x.distanceKm <= NEARBY_KM);
  const worst = nearby.reduce((a, b) => (rankOf(b.gauge) > rankOf(a?.gauge || {}) ? b : a), null);
  const worstRank = worst ? rankOf(worst.gauge) : 0;

  let level = 0;
  if (worstRank === 3) level = worst.distanceKm <= VERY_CLOSE_KM ? 3 : 2;
  else if (worstRank === 2) level = worst.distanceKm <= VERY_CLOSE_KM ? 2 : 1;
  else if (worstRank === 1) level = 1;

  const focus = worstRank > 0 ? worst : nearest;
  const status = focus ? getStationStatus(focus.gauge) : null;
  let title = "No river gauge data";
  if (focus && worstRank > 0) title = `${focus.gauge.station} river gauge is at ${status.label}`;
  else if (focus && focus.distanceKm <= NEARBY_KM) title = "Rivers near you are normal";
  else if (focus) title = `No river gauge within ${NEARBY_KM} km`;

  return {
    level,
    title,
    detail: focus
      ? `${focus.gauge.station} (${focus.gauge.basin}) is ${km(focus.distanceKm)} from you.`
      : "River gauge data is not available right now.",
    focus,
    nearby,
  };
}

/** How close a gauge is to flooding, for a simple bar and sentence. */
export function floodCloseness(gauge) {
  const top = Number.isFinite(gauge.majorFloodLevel) && gauge.majorFloodLevel > 0 ? gauge.majorFloodLevel : null;
  const percent = top ? Math.max(0, Math.min(100, (gauge.level / top) * 100)) : null;
  if (!top || !(gauge.alertLevel > 0) || !(gauge.minorFloodLevel > 0)) {
    return { percent: null, sentence: "not comparable, because this gauge has no published flood levels", trend: "unknown", marks: [] };
  }
  let sentence;
  if (gauge.level >= gauge.majorFloodLevel) sentence = `${(gauge.level - gauge.majorFloodLevel).toFixed(2)} m above major flood level`;
  else if (gauge.level >= gauge.minorFloodLevel) sentence = `${(gauge.majorFloodLevel - gauge.level).toFixed(2)} m below major flood level`;
  else if (gauge.level >= gauge.alertLevel) sentence = `${(gauge.minorFloodLevel - gauge.level).toFixed(2)} m below minor flood level`;
  else sentence = `${(gauge.alertLevel - gauge.level).toFixed(2)} m below the alert level`;
  const trend =
    gauge.change > 0.005 ? `rising (+${gauge.change.toFixed(2)} m)` : gauge.change < -0.005 ? `falling (${gauge.change.toFixed(2)} m)` : "steady";
  return {
    percent,
    sentence,
    trend,
    marks: top
      ? [
          { label: "Alert", at: (gauge.alertLevel / top) * 100, color: "#eab308" },
          { label: "Minor", at: (gauge.minorFloodLevel / top) * 100, color: "#ea580c" },
          { label: "Major", at: 100, color: "#dc2626" },
        ].filter((m) => Number.isFinite(m.at))
      : [],
  };
}

function assessCombined(point, { warnedAreas, gauges, riskLevels, weatherByDistrict, floodNearby }) {
  const reasons = [];
  let level = 0;

  const scored = floodToLandslide({ warnedAreas, gauges, riskLevels, weatherByDistrict });
  for (const r of scored) {
    const d = distanceToAreaKm(point.lat, point.lon, r.area);
    if (d > NEARBY_KM || r.score < 25) continue;
    level = Math.max(level, d === 0 ? 2 : 1);
    reasons.push(
      `High rivers or heavy rain near ${r.area.name} make a landslide there more likely${
        d === 0 ? ", and you are in that area" : ` (${km(d)} from you)`
      }.`
    );
  }

  const nearGaugeNames = new Set(floodNearby.map((x) => x.gauge.station));
  const { basins } = landslideToFlood({ warnedAreas, gauges, minLevel: 2 });
  for (const b of basins) {
    const touches = [...b.nearby, ...b.sameBasin].some((x) => nearGaugeNames.has(x.gauge.station));
    const closest = Math.min(...b.sources.map((s) => distanceToAreaKm(point.lat, point.lon, s.area)));
    if (!touches || closest > SAME_RIVER_KM) continue;
    level = Math.max(level, 1);
    const names = b.sources.map((s) => s.area.name).join(", ");
    reasons.push(
      `There is an amber or red landslide warning (${names}) on the ${b.basin}, the same river system as near you. A landslide can block a river and then release a sudden flood.`
    );
    const signal = [...b.nearby, ...b.sameBasin].find((x) => x.signals.length && nearGaugeNames.has(x.gauge.station));
    if (signal) {
      level = Math.max(level, 2);
      reasons.push(`${signal.gauge.station} gauge shows a warning sign: ${signal.signals[0].label.toLowerCase()}.`);
    }
  }

  return {
    level,
    title: reasons.length ? "Flood and landslide risks are linked near you" : "No combined flood and landslide risk found",
    reasons,
  };
}

function assessAlerts(point, alerts, now) {
  const active = (alerts || [])
    .filter((a) => String(a.status || "").toLowerCase() === "active")
    .filter((a) => !a.expectedEndTime || new Date(a.expectedEndTime).getTime() > now)
    .filter((a) => Number.isFinite(Number(a.latitude)) && Number.isFinite(Number(a.longitude)))
    .map((a) => ({ alert: a, distanceKm: haversineKm(point.lat, point.lon, Number(a.latitude), Number(a.longitude)) }))
    .filter((x) => x.distanceKm <= ALERT_RADIUS_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm);
  const level = active.reduce(
    (max, x) => Math.max(max, String(x.alert.severity).toLowerCase() === "high" ? 2 : 1),
    0
  );
  return {
    level,
    title: active.length ? `${active.length} official alert${active.length > 1 ? "s" : ""} near you` : "No official alerts near you",
    items: active,
  };
}

function sum(values) {
  const nums = (values || []).map(Number).filter(Number.isFinite);
  return nums.length ? nums.reduce((a, b) => a + b, 0) : null;
}

function assessRain(weather) {
  const next2 = sum(weather?.daily?.precipitation_sum?.slice(0, 2));
  const past3 = sum(weather?.daily?.precipitation_sum_last3days);
  if (next2 == null) return { level: 0, title: "Rain forecast not available", detail: "", next2, past3 };
  const level = next2 >= 100 ? 2 : next2 >= 50 ? 1 : 0;
  const words = next2 >= 100 ? "Very heavy rain expected" : next2 >= 50 ? "Heavy rain expected" : next2 >= 10 ? "Some rain expected" : "Little or no rain expected";
  return {
    level,
    title: `${words} today and tomorrow`,
    detail: `About ${next2.toFixed(0)} mm forecast${past3 != null ? `; ${past3.toFixed(0)} mm fell in the past 3 days` : ""}.`,
    next2,
    past3,
  };
}

/* ------------------------------------------------------------------ */

function buildActions(overall, parts) {
  const landslide = parts.landslide.level > 0 || parts.combined.level > 0;
  const flood = parts.flood.level > 0 || parts.combined.level > 0 || parts.rain.level > 0;
  const actions = [];

  if (overall === 0) {
    actions.push("No action needed right now.");
    actions.push("Check again if heavy rain starts or continues for several hours.");
    actions.push("Know where your nearest relief camp is (see below).");
    return actions;
  }

  if (overall >= 3) actions.push("If officials tell you to leave, go immediately. Do not wait to collect belongings.");
  if (landslide) {
    if (parts.landslide.level >= 3) actions.push("If you live on or below a slope, move to a safe place or relief camp now.");
    else if (parts.landslide.level >= 2) actions.push("Be ready to leave quickly. Avoid sleeping in rooms facing a slope tonight.");
    actions.push("Stay away from the foot of slopes, cuttings and river banks.");
    actions.push("Leave at once if you see new cracks, tilting trees or poles, or muddy water from springs.");
  }
  if (flood) {
    actions.push("Move documents, medicine and valuables to a high place.");
    actions.push("Never walk or drive through flowing water. Knee-deep water can knock you down.");
    if (overall >= 2) actions.push("If water comes into the house, switch off electricity at the main switch.");
  }
  actions.push("Pack a bag: ID, medicines, water, dry food, torch, phone charger and power bank.");
  actions.push("Keep your phone charged and follow official news.");
  return actions;
}

/**
 * Main entry. point = { lat, lon }.
 * data = { areas, warnedAreas, gauges, alerts, weather, riskLevels, weatherByDistrict }.
 */
export function assessPersonalRisk(point, data, now = Date.now()) {
  const place = findAreaAt(data.areas || [], point.lat, point.lon);
  const landslide = assessLandslide(point, data.warnedAreas || []);
  const flood = assessFlood(point, data.gauges || []);
  const combined = assessCombined(point, {
    warnedAreas: data.warnedAreas || [],
    gauges: data.gauges || [],
    riskLevels: data.riskLevels || {},
    weatherByDistrict: data.weatherByDistrict || new Map(),
    floodNearby: flood.nearby,
  });
  const alerts = assessAlerts(point, data.alerts, now);
  const rain = assessRain(data.weather);
  const parts = { landslide, flood, combined, alerts, rain };

  const overall = Math.min(3, Math.max(landslide.level, flood.level, combined.level, alerts.level, rain.level));
  return {
    place: place ? { dsDivision: place.name, district: place.district } : null,
    overall,
    level: LEVELS[overall],
    ...parts,
    actions: buildActions(overall, parts),
  };
}

export function nearestShelters(point, shelters, limit = 3) {
  return (shelters || [])
    .map((s) => {
      const lat = Number(s.latitude ?? s.cityLatitude);
      const lon = Number(s.longitude ?? s.cityLongitude);
      return { ...s, latitude: lat, longitude: lon };
    })
    .filter((s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude))
    .filter((s) => s.status !== "inactive" && s.availability !== "closed")
    .map((s) => ({ shelter: s, distanceKm: haversineKm(point.lat, point.lon, s.latitude, s.longitude) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

export function shareText(result, placeName) {
  const where = placeName ? ` for ${placeName}` : "";
  const reason = [result.landslide, result.flood, result.combined, result.alerts, result.rain]
    .filter((p) => p.level > 0)
    .map((p) => p.title)[0];
  return `I checked my disaster risk on DisasterWatch${where}: ${result.level.label}. ${reason ? `${reason}.` : result.level.headline}`;
}

/* ------------------------------------------------------------------ */
/* Nationwide high-risk areas                                          */
/* ------------------------------------------------------------------ */

// severity: 3 = most serious (red), 2 = serious (orange), 1 = lower risk (shown only with "Show lower risks").
export const SEVERITY_STYLE = {
  3: { label: "Act now", color: "#b91c1c", soft: "bg-red-50 text-red-800 ring-red-200" },
  2: { label: "High", color: "#c2410c", soft: "bg-orange-50 text-orange-800 ring-orange-200" },
  1: { label: "Lower", color: "#a16207", soft: "bg-yellow-50 text-yellow-800 ring-yellow-200" },
};

function districtCenters(areas) {
  const sums = new Map();
  for (const a of areas) {
    if (!a.district || !Number.isFinite(a.centerLat)) continue;
    const s = sums.get(a.district) || { lat: 0, lon: 0, n: 0 };
    s.lat += a.centerLat;
    s.lon += a.centerLng;
    s.n += 1;
    sums.set(a.district, s);
  }
  return new Map([...sums].map(([d, s]) => [d, { lat: s.lat / s.n, lon: s.lon / s.n }]));
}

/**
 * Every current risk in the country as plain-language items, grouped by district.
 * data = { areas, warnedAreas, gauges, alerts, riskLevels, weatherByDistrict }.
 */
export function buildNationalRisks(data, now = Date.now()) {
  const areas = data.areas || [];
  const centers = districtCenters(areas);
  const districtNameByKey = new Map([...centers.keys()].map((d) => [compactKey(d), d]));
  const items = [];

  // Landslide warnings: one item per district and level.
  const byDistrictLevel = new Map();
  for (const w of data.warnedAreas || []) {
    const key = `${w.area.district}|${w.level}`;
    if (!byDistrictLevel.has(key)) byDistrictLevel.set(key, []);
    byDistrictLevel.get(key).push(w);
  }
  for (const [key, list] of byDistrictLevel) {
    const [district, levelText] = key.split("|");
    const level = Number(levelText);
    const names = list.map((w) => w.area.name).join(", ");
    items.push({
      id: `landslide-${key}`,
      type: "landslide",
      severity: level >= 3 ? 3 : level === 2 ? 2 : 1,
      district,
      title: `${LANDSLIDE_NAMES[level]} landslide warning`,
      detail: names,
      areas: list.map((w) => w.area),
      level,
      lat: list[0].area.centerLat,
      lon: list[0].area.centerLng,
      placeLabel: list[0].area.name,
    });
  }

  // River gauges at alert level or above.
  for (const g of data.gauges || []) {
    const rank = rankOf(g);
    if (!rank) continue;
    const status = getStationStatus(g);
    const trend = g.change > 0.005 ? "and rising" : g.change < -0.005 ? "and falling" : "and steady";
    items.push({
      id: `flood-${g.station}`,
      type: "flood",
      severity: rank === 3 ? 3 : rank === 2 ? 2 : 1,
      district: g.district || "Unknown district",
      title: `${g.station} river at ${status.label}`,
      detail: `${g.basin}, ${g.level.toFixed(2)} m ${trend}.`,
      gauge: g,
      lat: g.latitude,
      lon: g.longitude,
      placeLabel: g.station,
    });
  }

  // Active official alerts.
  for (const a of data.alerts || []) {
    if (String(a.status || "").toLowerCase() !== "active") continue;
    if (a.expectedEndTime && new Date(a.expectedEndTime).getTime() <= now) continue;
    const lat = Number(a.latitude);
    const lon = Number(a.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const high = String(a.severity).toLowerCase() === "high";
    const area = findAreaAt(areas, lat, lon);
    items.push({
      id: `alert-${a._id}`,
      type: "alert",
      severity: high ? 3 : 1,
      district: area?.district || String(a.affectedArea || "").split(",")[0] || "Unknown district",
      title: `Official alert: ${a.disasterType} (${a.severity})`,
      detail: a.safetyInstructions || a.description || a.affectedArea || "",
      alertId: a._id,
      lat,
      lon,
      placeLabel: area?.name || String(a.affectedArea || "").split(",")[0],
    });
  }

  // District risk levels published by DMEWS admins.
  for (const [key, level] of Object.entries(data.riskLevels || {})) {
    if (level !== "high" && level !== "medium") continue;
    const district = districtNameByKey.get(key);
    const c = district && centers.get(district);
    if (!c) continue;
    items.push({
      id: `district-${key}`,
      type: "district",
      severity: level === "high" ? 2 : 1,
      district,
      title: `${district} district flood risk set to ${level}`,
      detail: "Published by DMEWS.",
      lat: c.lat,
      lon: c.lon,
      placeLabel: `${district} district`,
    });
  }

  // Flood and landslide links (same logic as the admin Cascade risk page).
  const { basins } = landslideToFlood({ warnedAreas: data.warnedAreas || [], gauges: data.gauges || [], minLevel: 2 });
  for (const b of basins) {
    if (b.concern.label === "Monitor") continue;
    const source = b.sources[0];
    items.push({
      id: `link-${b.basin}`,
      type: "link",
      severity: b.concern.label === "Act now" ? 3 : 2,
      district: source.area.district,
      title: `${b.basin}: a landslide could block the river`,
      detail: `Landslide warning at ${b.sources.map((s) => s.area.name).join(", ")}. People living along this river${
        b.districts.length ? ` (${b.districts.join(", ")} districts)` : ""
      } should watch for a sudden drop or rise in the water.`,
      lat: source.area.centerLat,
      lon: source.area.centerLng,
      placeLabel: source.area.name,
    });
  }

  // Heavy rain forecast by district.
  for (const [, row] of data.weatherByDistrict || new Map()) {
    const next2 = sum(row?.daily?.precipitation_sum?.slice(0, 2));
    if (next2 == null || next2 < 50) continue;
    const lat = Number(row.lat);
    const lon = Number(row.lon);
    items.push({
      id: `rain-${row.name}`,
      type: "rain",
      severity: next2 >= 100 ? 2 : 1,
      district: row.name,
      title: `${next2 >= 100 ? "Very heavy" : "Heavy"} rain forecast`,
      detail: `About ${next2.toFixed(0)} mm today and tomorrow.`,
      lat,
      lon,
      placeLabel: `${row.name} district`,
    });
  }

  return items;
}

function compactKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\bdistrict\b/g, "")
    .replace(/[^a-z]/g, "");
}

/** Distance in km from a point to an item (0 inside a landslide area). */
export function distanceToItemKm(point, item) {
  if (item.areas?.length) return Math.min(...item.areas.map((a) => distanceToAreaKm(point.lat, point.lon, a)));
  if (!Number.isFinite(item.lat) || !Number.isFinite(item.lon)) return null;
  return haversineKm(point.lat, point.lon, item.lat, item.lon);
}

/** Filter items and group them by district, most serious first. */
export function groupByDistrict(items, { showLower = false, type = "all", point = null } = {}) {
  const visible = items.filter(
    (i) =>
      (showLower || i.severity >= 2) &&
      (type === "all" ||
        i.type === type ||
        (i.type === "link" && (type === "flood" || type === "landslide")) ||
        (i.type === "district" && type === "flood"))
  );
  const groups = new Map();
  for (const item of visible) {
    if (!groups.has(item.district)) groups.set(item.district, []);
    groups.get(item.district).push(item);
  }
  return [...groups]
    .map(([district, list]) => {
      list.sort((a, b) => b.severity - a.severity);
      const distances = point ? list.map((i) => distanceToItemKm(point, i)).filter((d) => d != null) : [];
      return {
        district,
        items: list,
        severity: list[0].severity,
        distanceKm: distances.length ? Math.min(...distances) : null,
      };
    })
    .sort((a, b) => b.severity - a.severity || b.items.length - a.items.length || a.district.localeCompare(b.district));
}
