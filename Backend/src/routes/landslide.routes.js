const router = require("express").Router();
const { getLandslideWarnings } = require("../controllers/landslideController");

router.get("/", getLandslideWarnings);

module.exports = router;
