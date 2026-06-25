const express = require("express");
const router = express.Router();
const deviceRequirementController = require("../../controllers/vendor/DeviceRequirementController");
const { authenticateToken, requireRole } = require("../../middleware/authMiddleware");

// Protected endpoints (requires valid JWT token and 'vendor' role)
router.use(authenticateToken, requireRole("vendor"));

router.get("/", deviceRequirementController.getRequirements);
router.get("/matches", deviceRequirementController.getMatchingDevices);
router.post("/", deviceRequirementController.createRequirement);
router.delete("/:id", deviceRequirementController.deleteRequirement);

module.exports = router;
