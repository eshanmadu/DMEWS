const router = require("express").Router();

const { authMiddleware } = require("../middleware/authMiddleware");
const { adminMiddleware } = require("../middleware/adminMiddleware");
const {
  register,
  me,
  leave,
  adminList,
  adminSetStatus,
} = require("../controllers/volunteerController");

// Logged-in users (signup required)
router.post("/register", authMiddleware, register);
router.get("/me", authMiddleware, me);
router.delete("/me", authMiddleware, leave);

// Admin
router.get("/admin/list", adminMiddleware, adminList);
router.patch("/admin/:id", adminMiddleware, adminSetStatus);

module.exports = router;
