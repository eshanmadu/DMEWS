const router = require("express").Router();

const { getPredictAggregate } = require("../controllers/predictController");

router.get("/", getPredictAggregate);

module.exports = router;
