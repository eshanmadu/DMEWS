export function normalizeDistrictName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\bdistrict\b/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getSeverityFill(severity) {
  if (severity === "High") return "#dc2626";
  if (severity === "Medium") return "#ea580c";
  if (severity === "Low") return "#eab308";
  return "#94a3b8";
}

export function severityRank(severity) {
  if (severity === "High") return 3;
  if (severity === "Medium") return 2;
  if (severity === "Low") return 1;
  return 0;
}