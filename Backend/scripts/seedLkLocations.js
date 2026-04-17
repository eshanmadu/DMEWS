/**
 * One-off: fetch Sri Lankan districts + all cities from RapidAPI and write
 * Backend/data/districts.json and Backend/data/cities.json.
 *
 * Requires RAPIDAPI_LK_LOCATIONS_KEY in Backend/.env
 * Usage: npm run seed:lk-locations
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const fs = require("fs");
const path = require("path");

const HOST = "sri-lankan-provinces-districts-and-cities1.p.rapidapi.com";
const BASE = `https://${HOST}`;

async function main() {
  const key = process.env.RAPIDAPI_LK_LOCATIONS_KEY;
  if (!key) {
    console.error("Set RAPIDAPI_LK_LOCATIONS_KEY in Backend/.env first.");
    process.exit(1);
  }

  const headers = {
    "x-rapidapi-host": HOST,
    "x-rapidapi-key": key,
    "Content-Type": "application/json",
  };

  const outDir = path.join(__dirname, "..", "data");
  fs.mkdirSync(outDir, { recursive: true });

  const dRes = await fetch(`${BASE}/api/v1/locations/districts`, { headers });
  const dJson = await dRes.json().catch(() => ({}));
  if (!dRes.ok || !Array.isArray(dJson.districts)) {
    console.error("Districts fetch failed", dRes.status, dJson);
    process.exit(1);
  }

  fs.writeFileSync(
    path.join(outDir, "districts.json"),
    JSON.stringify({ success: true, districts: dJson.districts }, null, 2),
    "utf8"
  );
  console.log(`Wrote ${dJson.districts.length} districts`);

  const allCities = [];
  for (const dist of dJson.districts) {
    const id = dist.id;
    const cRes = await fetch(`${BASE}/api/v1/locations/city?district=${id}`, {
      headers,
    });
    const cJson = await cRes.json().catch(() => ({}));
    const arr = Array.isArray(cJson.cities) ? cJson.cities : [];
    allCities.push(...arr);
    console.log(`District ${id} ${dist.name_en}: ${arr.length} cities`);
    if (!cRes.ok) {
      console.warn("  warning: non-OK status", cRes.status);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  fs.writeFileSync(
    path.join(outDir, "cities.json"),
    JSON.stringify({ cities: allCities }, null, 2),
    "utf8"
  );
  console.log(`Wrote ${allCities.length} cities total`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
