const router = require("express").Router();
const { adminMiddleware } = require("../middleware/adminMiddleware");
const {
  adminListUsers,
  adminGetUser,
  adminDeleteInactiveUser,
} = require("../controllers/adminUsersController");

router.get("/", adminMiddleware, adminListUsers);
router.get("/:id", adminMiddleware, adminGetUser);
router.delete("/:id", adminMiddleware, adminDeleteInactiveUser);

module.exports = router;
