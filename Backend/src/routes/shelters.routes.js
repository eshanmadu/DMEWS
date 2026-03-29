const router = require("express").Router();

const {
  getShelters,
  createShelter,
  updateShelter,
  deleteShelter,
} = require("../controllers/sheltersController");

router.get("/", getShelters);
router.post("/", createShelter);
router.put("/:id", updateShelter);
router.delete("/:id", deleteShelter);

module.exports = router;

