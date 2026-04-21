const router = require("express").Router();
const { authMiddleware } = require("../middleware/authMiddleware");
const { adminMiddleware } = require("../middleware/adminMiddleware");
const {
  listPrograms,
  adminListPrograms,
  adminCreateProgram,
  adminDeleteProgram,
  submitParticipation,
  adminListParticipations,
} = require("../controllers/resourcesController");

router.get("/resource-programs", listPrograms);
router.get("/resource-programs/admin/list", adminMiddleware, adminListPrograms);
router.post("/resource-programs/admin", adminMiddleware, adminCreateProgram);
router.delete("/resource-programs/admin/:id", adminMiddleware, adminDeleteProgram);

router.post("/resource-participations", authMiddleware, submitParticipation);
router.get(
  "/resource-participations/admin/list",
  adminMiddleware,
  adminListParticipations
);

module.exports = router;

