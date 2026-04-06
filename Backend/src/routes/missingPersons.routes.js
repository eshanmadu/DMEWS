const router = require("express").Router();
const multer = require("multer");
const { authMiddleware, optionalAuthMiddleware } = require("../middleware/authMiddleware");
const { adminMiddleware } = require("../middleware/adminMiddleware");
const {
  listPersonReports,
  adminPersonOverview,
  createMissingReport,
  createFoundReport,
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

router.get("/", listPersonReports);
router.get("/admin/overview", adminMiddleware, adminPersonOverview);
router.post("/missing", optionalAuthMiddleware, upload.single("photo"), createMissingReport);
router.post("/found", optionalAuthMiddleware, upload.single("photo"), createFoundReport);
router.delete("/missing/:id", authMiddleware, deleteMissingReport);
router.delete("/found/:id", authMiddleware, deleteFoundReport);

module.exports = router;
