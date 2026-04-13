const router = require("express").Router();

const {
  signup,
  login,
  googleAuth,
  forgotPassword,
  resetPasswordWithOtp,
  me,
  updateProfile,
  completeProfile,
  changePassword,
  deleteAccount,
  devAdminToken,
} = require("../controllers/authController");
const { authMiddleware } = require("../middleware/authMiddleware");

router.post("/signup", signup);
router.post("/login", login);
router.post("/google", googleAuth);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password-otp", resetPasswordWithOtp);
router.post("/dev-admin-token", devAdminToken);

router.get("/me", authMiddleware, me);
router.patch("/profile", authMiddleware, updateProfile);
router.post("/complete-profile", authMiddleware, completeProfile);
router.post("/change-password", authMiddleware, changePassword);
router.delete("/account", authMiddleware, deleteAccount);

module.exports = router;

