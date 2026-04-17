const {
  getDistrictWeather,
  getPointWeatherRow,
} = require("../services/weatherDistrictService");

async function getWeatherDistricts(_req, res) {
  try {
    const data = await getDistrictWeather();
    return res.json(data);
  } catch (error) {
    console.error("Google weather districts error", error);
    const status = error?.status || 500;
    const message =
      error?.message || "Failed to load weather data.";
    return res.status(status).json({ message });
  }
}

async function getWeatherPoint(req, res) {
  try {
    const lat = Number(req.query?.lat);
    const lon = Number(req.query?.lon);
    const name = String(req.query?.name || "").trim() || "Location";
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res
        .status(400)
        .json({ message: "Query parameters lat and lon are required numbers." });
    }
    const row = await getPointWeatherRow({ name, lat, lon });
    return res.json(row);
  } catch (error) {
    console.error("Weather point error", error);
    const status = error?.status || 500;
    const message = error?.message || "Failed to load weather for location.";
    return res.status(status).json({ message });
  }
}

module.exports = { getWeatherDistricts, getWeatherPoint };

