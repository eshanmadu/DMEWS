const express = require("express");
const { getAlerts, createAlert, updateAlertStatus,getAlertById, updateAlert, deleteAlert } = require("../controllers/alertController");

const router = express.Router();

router.get("/", getAlerts);
router.post("/", createAlert);
router.get("/:id", getAlertById);
router.put("/:id", updateAlert);
router.patch("/:id/status", updateAlertStatus);
router.delete("/:id", deleteAlert);

module.exports = router;