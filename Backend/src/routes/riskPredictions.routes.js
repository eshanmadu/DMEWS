const router = require("express").Router();

const { listRiskPredictions } = require("../controllers/riskPredictionsController");

router.get("/", listRiskPredictions);

module.exports = router;

