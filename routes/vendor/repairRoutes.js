const express = require("express");
const router = express.Router();
const RepairController = require("../../controllers/vendor/RepairController");
const { authenticateToken, requireRole } = require("../../middleware/authMiddleware");

router.get("/", authenticateToken, requireRole("vendor"), RepairController.getRepairs);
router.post("/", authenticateToken, requireRole("vendor"), RepairController.createRepair);
router.put("/:id", authenticateToken, requireRole("vendor"), RepairController.updateRepair);
router.delete("/:id", authenticateToken, requireRole("vendor"), RepairController.deleteRepair);

module.exports = router;
