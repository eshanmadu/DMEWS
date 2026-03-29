const router = require("express").Router();

const {
  getRiskLevels,
  upsertRiskLevel,
} = require("../controllers/riskLevelsController");

router.get("/", getRiskLevels);
router.post("/", upsertRiskLevel);

module.exports = router;

