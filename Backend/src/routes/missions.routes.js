const router = require("express").Router();

const { authMiddleware } = require("../middleware/authMiddleware");
const { adminMiddleware } = require("../middleware/adminMiddleware");
const {
  publicActive,
  adminList,
  adminCreate,
  adminClose,
  adminOpen,
  joinMission,
  myMissions,
} = require("../controllers/missionsController");

// Public: active missions shown on the volunteer hub.
router.get("/active", publicActive);

// Admin: create / list / close / reopen missions.
router.get("/admin/list", adminMiddleware, adminList);
router.post("/admin", adminMiddleware, adminCreate);
router.patch("/admin/:id/close", adminMiddleware, adminClose);
router.patch("/admin/:id/open", adminMiddleware, adminOpen);

// Volunteer: join and list your missions.
router.post("/:id/join", authMiddleware, joinMission);
router.get("/my", authMiddleware, myMissions);

module.exports = router;

