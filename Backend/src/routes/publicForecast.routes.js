const router = require("express").Router();

const {
  getPublicForecast,
  getMeteoSlMap,
} = require("../controllers/publicForecastController");

router.get("/public-forecast", getPublicForecast);
router.get("/public-forecast/meteo-sl-map", getMeteoSlMap);

module.exports = router;

