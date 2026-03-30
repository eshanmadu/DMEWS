const router = require("express").Router();

const multer = require("multer");
const { authMiddleware } = require("../middleware/authMiddleware");
const {
  getIncidents,
  getMyIncidents,
  createUserIncident,
  updateUserIncident,
  deleteUserIncident,
} = require("../controllers/incidentsController");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

router.get("/", getIncidents);
router.get("/my", authMiddleware, getMyIncidents);
router.post("/report", authMiddleware, upload.single("media"), createUserIncident);
router.delete("/report/:id", authMiddleware, deleteUserIncident);
router.put("/report/:id", authMiddleware, upload.single("media"), updateUserIncident);

module.exports = router;

