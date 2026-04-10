const router = require("express").Router();

const {
  signup,
  login,
  forgotPassword,
  resetPasswordWithOtp,
  me,
  updateProfile,
  changePassword,
  devAdminToken,
} = require("../controllers/authController");
const { authMiddleware } = require("../middleware/authMiddleware");

router.post("/signup", signup);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password-otp", resetPasswordWithOtp);
router.post("/dev-admin-token", devAdminToken);

router.get("/me", authMiddleware, me);
router.patch("/profile", authMiddleware, updateProfile);
router.post("/change-password", authMiddleware, changePassword);

module.exports = router;

