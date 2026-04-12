const router = require("express").Router();
const multer = require("multer");
const { authMiddleware, optionalAuthMiddleware } = require("../middleware/authMiddleware");
const { adminMiddleware } = require("../middleware/adminMiddleware");
const {
  listPersonReports,
  listMyPersonReports,
  adminPersonOverview,
  suggestLocationQuery,
  createMissingReport,
  updateMissingReport,
  createFoundReport,
  updateFoundReport,
  deleteMissingReport,
  deleteFoundReport,
} = require("../controllers/missingPersonsController");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (String(file.mimetype || "").toLowerCase().startsWith("image/")) {
      return cb(null, true);
    }
    cb(new Error("Only image uploads are allowed."));
  },
});

router.get("/location-suggest", suggestLocationQuery);
router.get("/my", authMiddleware, listMyPersonReports);
router.get("/", listPersonReports);
router.get("/admin/overview", adminMiddleware, adminPersonOverview);
router.post("/missing", optionalAuthMiddleware, upload.single("photo"), createMissingReport);
router.patch("/missing/:id", authMiddleware, upload.single("photo"), updateMissingReport);
router.post("/found", optionalAuthMiddleware, upload.single("photo"), createFoundReport);
router.patch("/found/:id", authMiddleware, upload.single("photo"), updateFoundReport);
router.delete("/missing/:id", authMiddleware, deleteMissingReport);
router.delete("/found/:id", authMiddleware, deleteFoundReport);

module.exports = router;
