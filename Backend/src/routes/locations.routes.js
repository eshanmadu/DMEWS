const router = require("express").Router();
const {
  getSriLankaDistricts,
  getSriLankaCities,
  getSriLankaProvinces,
} = require("../controllers/locationsController");

router.get("/sri-lanka/provinces", getSriLankaProvinces);
router.get("/sri-lanka/districts", getSriLankaDistricts);
router.get("/sri-lanka/cities", getSriLankaCities);

module.exports = router;
