const { getDistrictWeather } = require("../services/weatherDistrictService");

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

module.exports = { getWeatherDistricts };

