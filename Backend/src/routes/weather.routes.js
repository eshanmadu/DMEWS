const router = require("express").Router();

const { getWeatherDistricts } = require("../controllers/weatherController");

router.get("/districts", getWeatherDistricts);

module.exports = router;

