const router = require("express").Router();

const {
  getRiskLevels,
  upsertRiskLevel,
  getSmsSetting,
  updateSmsSetting,
} = require("../controllers/riskLevelsController");

router.get("/sms-settings", getSmsSetting);
router.patch("/sms-settings", updateSmsSetting);
router.get("/", getRiskLevels);
router.post("/", upsertRiskLevel);

module.exports = router;
