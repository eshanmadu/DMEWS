const router = require("express").Router();
const multer = require("multer");
const { authMiddleware } = require("../middleware/authMiddleware");
const { adminMiddleware } = require("../middleware/adminMiddleware");
const { victimIdentificationMiddleware } = require("../middleware/victimIdentificationMiddleware");
const { submit, me, adminList, adminSetStatus } = require("../controllers/victimAccessController");
const { createCase, listMyCases } = require("../controllers/victimCasesController");

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
router.get("/protected", victimIdentificationMiddleware, (_req, res) => res.json({ allowed: true }));
router.post("/cases", victimIdentificationMiddleware, upload.single("evidence"), createCase);
router.get("/cases", victimIdentificationMiddleware, listMyCases);

module.exports = router;