const express = require("express");
const router = express.Router();
const blacklistController = require("../../controllers/vendor/BlacklistController");
const { authenticateToken, requireRole } = require("../../middleware/authMiddleware");

// Protected endpoints (requires valid JWT token and 'vendor' role)
router.get(
	"/",
	authenticateToken,
	requireRole("vendor"),
	blacklistController.getBlacklistedDevices,
);

router.post(
	"/",
	authenticateToken,
	requireRole("vendor"),
	blacklistController.blacklistDevice,
);

router.get(
	"/check/:imei",
	authenticateToken,
	requireRole("vendor"),
	blacklistController.checkBlacklist,
);

module.exports = router;
