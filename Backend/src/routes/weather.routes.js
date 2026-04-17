const router = require("express").Router();

const {
  getWeatherDistricts,
  getWeatherPoint,
} = require("../controllers/weatherController");

router.get("/districts", getWeatherDistricts);
router.get("/point", getWeatherPoint);

module.exports = router;

