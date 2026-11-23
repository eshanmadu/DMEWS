// Shared helpers for the Irrigation Department live river gauge feed (ArcGIS).
// Used by the admin Risk management page and the Cascade risk page.

export const IRRIGATION_SOURCE =
  "https://services3.arcgis.com/J7ZFXmR8rSmQ3FGf/arcgis/rest/services/gauges_2_view/FeatureServer/0/query";
export const IRRIGATION_DASHBOARD =
  "https://www.arcgis.com/apps/dashboards/2cffe83c9ff5497d97375498bdf3ff38";

export function buildGaugeFeedUrl() {
  return `${IRRIGATION_SOURCE}?where=1%3D1&outFields=basin%2Cgauge%2Cwater_level%2Crain_fall%2Calertpull%2Cminorpull%2Cmajorpull%2CCreationDate%2CEditDate&orderByFields=CreationDate%20DESC&resultRecordCount=1000&returnGeometry=true&f=json&refresh=${Date.now()}`;
}

// The feed sends null for gauges with no published thresholds; Number(null) would be 0,
// which made a 0 m reading look like a major flood.
function toNumber(value) {
  return value === null || value === undefined || value === "" ? NaN : Number(value);
}

function hasThresholds(station) {
  return [station.alertLevel, station.minorFloodLevel, station.majorFloodLevel].every(
    (v) => Number.isFinite(v) && v > 0
  );
}

export function parseArcGISFeed(payload) {
  const stations = new Map();
  for (const feature of payload?.features || []) {
    const attributes = feature?.attributes || {};
    const station = String(attributes.gauge || "").trim();
    const timestamp = new Date(Number(attributes.EditDate || attributes.CreationDate));
    const level = Number(attributes.water_level);
    const latitude = Number(feature?.geometry?.y);
    const longitude = Number(feature?.geometry?.x);
    if (!station || !Number.isFinite(level) || Number.isNaN(timestamp.getTime())) continue;
    if (!stations.has(station)) stations.set(station, []);
    stations.get(station).push({
      station,
      timestamp,
      level,
      basin: String(attributes.basin || "Unknown basin").trim(),
      rainfall: toNumber(attributes.rain_fall),
      alertLevel: toNumber(attributes.alertpull),
      minorFloodLevel: toNumber(attributes.minorpull),
      majorFloodLevel: toNumber(attributes.majorpull),
      latitude,
      longitude,
    });
  }

  return [...stations.values()]
    .map((observations) => {
      observations.sort((a, b) => a.timestamp - b.timestamp);
      const latest = observations.at(-1);
      const previous = observations.at(-2);
      return {
        ...latest,
        change: previous ? latest.level - previous.level : 0,
        observations: observations.slice(-48),
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function getStationStatus(station) {
  if (!hasThresholds(station))
    return { label: "No flood levels", color: "#94a3b8", badge: "bg-slate-100 text-slate-600 ring-1 ring-slate-200" };
  if (station.level >= station.majorFloodLevel)
    return { label: "Major flood", color: "#dc2626", badge: "bg-red-50 text-red-700 ring-1 ring-red-200" };
  if (station.level >= station.minorFloodLevel)
    return { label: "Minor flood", color: "#ea580c", badge: "bg-orange-50 text-orange-700 ring-1 ring-orange-200" };
  if (station.level >= station.alertLevel)
    return { label: "Alert", color: "#eab308", badge: "bg-yellow-50 text-yellow-800 ring-1 ring-yellow-200" };
  return { label: "Normal", color: "#16a34a", badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" };
}
