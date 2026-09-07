const router = require("express").Router();

const {
  getShelters,
  createShelter,
  updateShelter,
  updateShelterStatus,
  updateShelterManagement,
  deleteShelter,
} = require("../controllers/sheltersController");
const { authMiddleware } = require("../middleware/authMiddleware");

router.get("/", getShelters);
router.post("/", createShelter);
router.put("/:id", updateShelter);
router.patch("/:id/status", authMiddleware, updateShelterStatus);
router.patch("/:id/management", authMiddleware, updateShelterManagement);
router.delete("/:id", deleteShelter);

module.exports = router;

