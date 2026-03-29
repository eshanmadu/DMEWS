const {
  getPublicForecastText,
  getMeteoSlMapImageUrl,
  DEFAULT_SL_MAP_URL,
} = require("../services/publicForecastService");

async function getPublicForecast(_req, res) {
  try {
    const text = await getPublicForecastText();
    return res.json({ text });
  } catch (error) {
    console.error("Public forecast error", error);
    return res
      .status(500)
      .json({ message: "Failed to load public forecast." });
  }
}

/** Sri Lanka map image URL from meteo.gov.lk (via Firecrawl scrape + parse; fallback URL if needed). */
async function getMeteoSlMap(_req, res) {
  try {
    const url = await getMeteoSlMapImageUrl();
    return res.json({
      url,
      source: "Department of Meteorology — Sri Lanka",
    });
  } catch (error) {
    console.error("Meteo SL map error", error);
    return res.json({
      url: DEFAULT_SL_MAP_URL,
      source: "Department of Meteorology — Sri Lanka",
      message: "Using default images/SLMap.jpg; Firecrawl unavailable.",
    });
  }
}

module.exports = { getPublicForecast, getMeteoSlMap };

