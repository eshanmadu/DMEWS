function getApiUrl() {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
}

async function safeFetch(path) {
  try {
    const res = await fetch(`${getApiUrl()}${path}`, { cache: "no-store" });
    if (!res.ok) {
      console.error("API request failed", path, res.status);
      return [];
    }
    return res.json();
  } catch (error) {
    console.error("API request error", path, error);
    return [];
  }
}

export async function fetchAlerts() {
  return safeFetch("/alerts");
}

export async function fetchIncidents() {
  return safeFetch("/incidents");
}

export async function fetchRiskLevels() {
  const data = await safeFetch("/risk-levels");
  return Array.isArray(data) ? data : [];
}

/** Placeholder — no resources API in backend yet; keeps admin dashboard build working. */
export async function fetchResources() {
  return [];
}

