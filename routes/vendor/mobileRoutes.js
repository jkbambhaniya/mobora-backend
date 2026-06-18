const express = require("express");
const router = express.Router();
const mobileController = require("../../controllers/vendor/MobileController");
const {
	authenticateToken,
	requireRole,
} = require("../../middleware/authMiddleware");
const { validateBody } = require("../../middleware/validationMiddleware");
const {
	createMobileSchema,
	updateMobileSchema,
} = require("../../validation/vendor/mobileValidation");

// Protected endpoints (requires valid JWT token and 'vendor' role)
router.get(
	"/",
	authenticateToken,
	requireRole("vendor"),
	mobileController.getMobiles,
);

router.get(
	"/metrics",
	authenticateToken,
	requireRole("vendor"),
	mobileController.getMetrics,
);

router.get(
	"/:id",
	authenticateToken,
	requireRole("vendor"),
	mobileController.getMobile,
);

router.post(
	"/",
	authenticateToken,
	requireRole("vendor"),
	validateBody(createMobileSchema),
	mobileController.createMobile,
);

router.put(
	"/:id",
	authenticateToken,
	requireRole("vendor"),
	validateBody(updateMobileSchema),
	mobileController.updateMobile,
);

router.delete(
	"/:id",
	authenticateToken,
	requireRole("vendor"),
	mobileController.deleteMobile,
);

module.exports = router;
