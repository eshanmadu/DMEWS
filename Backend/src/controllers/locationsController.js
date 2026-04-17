const fs = require("fs");
const path = require("path");

const DISTRICTS_PATH = path.join(__dirname, "..", "..", "data", "districts.json");
const CITIES_PATH = path.join(__dirname, "..", "..", "data", "cities.json");

let districtsDocCache = null;
let citiesListCache = null;

function readDistrictsDoc() {
  if (districtsDocCache) return districtsDocCache;
  const raw = fs.readFileSync(DISTRICTS_PATH, "utf8");
  districtsDocCache = JSON.parse(raw);
  return districtsDocCache;
}

function readAllCities() {
  if (citiesListCache) return citiesListCache;
  const raw = fs.readFileSync(CITIES_PATH, "utf8");
  const doc = JSON.parse(raw);
  citiesListCache = Array.isArray(doc.cities) ? doc.cities : [];
  return citiesListCache;
}

function getSriLankaDistricts(_req, res) {
  try {
    const data = readDistrictsDoc();
    return res.json(data);
  } catch (error) {
    console.error("locations districts", error);
    return res.status(500).json({
      message:
        error?.message ||
        "Failed to load districts. Run `npm run seed:lk-locations` if data files are missing.",
    });
  }
}

function getSriLankaCities(req, res) {
  try {
    const district = req.query?.district;
    if (district == null || String(district).trim() === "") {
      return res.status(400).json({
        message: "Query parameter `district` is required (district id from the API).",
      });
    }
    const id = String(district).trim();
    const all = readAllCities();
    const filtered = all.filter((c) => String(c.district_id) === id);
    return res.json({ success: true, cities: filtered });
  } catch (error) {
    console.error("locations cities", error);
    return res.status(500).json({
      message:
        error?.message ||
        "Failed to load cities. Run `npm run seed:lk-locations` if data files are missing.",
    });
  }
}

module.exports = { getSriLankaDistricts, getSriLankaCities };
