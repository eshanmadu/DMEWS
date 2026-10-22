const router = require("express").Router();

const {
  getShelters,
  getRiverWaterLevels,
  getSafeCentres,
  createShelter,
  updateShelter,
  updateShelterStatus,
  updateShelterManagement,
  updateShelterCapacityMeasurement,
  getShelterCapacityVotes,
  deleteShelter,
} = require("../controllers/sheltersController");
const { authMiddleware } = require("../middleware/authMiddleware");

router.get("/", getShelters);
router.get("/river-water-levels", getRiverWaterLevels);
router.get("/safe-centres", getSafeCentres);
router.post("/", createShelter);
router.put("/:id", updateShelter);
router.patch("/:id/status", authMiddleware, updateShelterStatus);
router.patch("/:id/management", authMiddleware, updateShelterManagement);
router.patch("/:id/capacity-measurement", authMiddleware, updateShelterCapacityMeasurement);
router.get("/:id/capacity-votes", authMiddleware, getShelterCapacityVotes);
router.delete("/:id", deleteShelter);

module.exports = router;
