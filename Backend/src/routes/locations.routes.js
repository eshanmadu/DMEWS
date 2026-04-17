const router = require("express").Router();
const {
  getSriLankaDistricts,
  getSriLankaCities,
} = require("../controllers/locationsController");

router.get("/sri-lanka/districts", getSriLankaDistricts);
router.get("/sri-lanka/cities", getSriLankaCities);

module.exports = router;
