const router = require("express").Router();

const {
  signup,
  login,
  me,
  updateProfile,
  changePassword,
  devAdminToken,
} = require("../controllers/authController");
const { authMiddleware } = require("../middleware/authMiddleware");

router.post("/signup", signup);
router.post("/login", login);
router.post("/dev-admin-token", devAdminToken);

router.get("/me", authMiddleware, me);
router.patch("/profile", authMiddleware, updateProfile);
router.post("/change-password", authMiddleware, changePassword);

module.exports = router;

