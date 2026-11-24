const router = require("express").Router();
const multer = require("multer");
const { authMiddleware } = require("../middleware/authMiddleware");
const { adminMiddleware } = require("../middleware/adminMiddleware");
const { victimIdentificationMiddleware } = require("../middleware/victimIdentificationMiddleware");
const { submit, me, adminList, adminSetStatus } = require("../controllers/victimAccessController");
const { createCase, listMyCases, listAllCases } = require("../controllers/victimCasesController");
const {
  createScan,
  submitScan,
  listMyScans,
  listAllScans,
  getScanPhoto,
  getScanForReview,
  decideMatch,
  deleteCase,
} = require("../controllers/victimIdentificationController");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const type = String(file.mimetype || "").toLowerCase();
    if (type.startsWith("image/") || type === "application/pdf") return cb(null, true);
    return cb(new Error("Only image or PDF documents are allowed."));
  },
});

router.post("/request", authMiddleware, upload.single("document"), submit);
router.get("/me", authMiddleware, me);
router.get("/admin/list", adminMiddleware, adminList);
router.patch("/admin/:id", adminMiddleware, adminSetStatus);
router.get("/admin/cases", adminMiddleware, listAllCases);
router.get("/protected", victimIdentificationMiddleware, (_req, res) => res.json({ allowed: true }));
router.post("/cases", victimIdentificationMiddleware, upload.single("evidence"), createCase);
router.get("/cases", victimIdentificationMiddleware, listMyCases);
router.post("/scans", victimIdentificationMiddleware, upload.array("images", 4), createScan);
router.post("/scans/:id/submit", victimIdentificationMiddleware, submitScan);
router.get("/scans", victimIdentificationMiddleware, listMyScans);
router.get("/scans/:id/photos/:index", victimIdentificationMiddleware, getScanPhoto);
router.get("/admin/scans", adminMiddleware, listAllScans);
router.get("/admin/scans/:id", adminMiddleware, getScanForReview);
router.post("/admin/scans/:id/matches/:personId/decision", adminMiddleware, decideMatch);
router.delete("/admin/scans/:id", adminMiddleware, deleteCase);

module.exports = router;