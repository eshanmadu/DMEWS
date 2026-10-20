const router = require("express").Router();
const { authMiddleware } = require("../middleware/authMiddleware");
const { adminMiddleware } = require("../middleware/adminMiddleware");
const {
  listPrograms,
  adminListPrograms,
  adminCreateProgram,
  adminDeleteProgram,
  submitParticipation,
  adminListParticipations,
  adminListInventory,
  adminCreateInventory,
  adminAddInventoryTransaction,
  adminListInventoryTransactions,
} = require("../controllers/resourcesController");

router.get("/resource-programs", listPrograms);
router.get("/resource-programs/admin/list", adminMiddleware, adminListPrograms);
router.post("/resource-programs/admin", adminMiddleware, adminCreateProgram);
router.delete("/resource-programs/admin/:id", adminMiddleware, adminDeleteProgram);

router.post("/resource-participations", authMiddleware, submitParticipation);
router.get(
  "/resource-participations/admin/list",
  adminMiddleware,
  adminListParticipations
);
router.get("/resource-inventory/admin/list", adminMiddleware, adminListInventory);
router.post("/resource-inventory/admin", adminMiddleware, adminCreateInventory);
router.post("/resource-inventory/admin/:id/transactions", adminMiddleware, adminAddInventoryTransaction);
router.get("/resource-inventory/admin/:id/transactions", adminMiddleware, adminListInventoryTransactions);

module.exports = router;

