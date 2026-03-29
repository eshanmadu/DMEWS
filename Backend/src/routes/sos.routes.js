const router = require("express").Router();

const { authMiddleware } = require("../middleware/authMiddleware");
const { adminMiddleware } = require("../middleware/adminMiddleware");
const {
  submitSos,
  adminListSos,
  adminUpdateSos,
} = require("../controllers/sosController");

router.post("/", authMiddleware, submitSos);
router.get("/admin/list", adminMiddleware, adminListSos);
router.patch("/admin/:id", adminMiddleware, adminUpdateSos);

module.exports = router;
