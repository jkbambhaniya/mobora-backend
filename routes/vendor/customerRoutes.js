const express = require("express");
const router = express.Router();
const customerController = require("../../controllers/vendor/CustomerController");
const {
	authenticateToken,
	requireRole,
} = require("../../middleware/authMiddleware");
const { validateBody } = require("../../middleware/validationMiddleware");
const {
	createCustomerSchema,
	updateCustomerSchema,
} = require("../../validation/vendor/customerValidation");

// Protected endpoints (requires valid JWT token and 'vendor' role)
router.get(
	"/",
	authenticateToken,
	requireRole("vendor"),
	customerController.getCustomers,
);
router.get(
	"/:id",
	authenticateToken,
	requireRole("vendor"),
	customerController.getCustomer,
);
router.post(
	"/",
	authenticateToken,
	requireRole("vendor"),
	validateBody(createCustomerSchema),
	customerController.createCustomer,
);
router.put(
	"/:id",
	authenticateToken,
	requireRole("vendor"),
	validateBody(updateCustomerSchema),
	customerController.updateCustomer,
);
router.post(
	"/:id/kyc",
	authenticateToken,
	requireRole("vendor"),
	customerController.updateCustomerKyc,
);
router.post(
	"/:id/kyc/approve",
	authenticateToken,
	requireRole("vendor"),
	customerController.approveCustomerKyc,
);
router.post(
	"/:id/kyc/reject",
	authenticateToken,
	requireRole("vendor"),
	customerController.rejectCustomerKyc,
);
router.delete(
	"/:id",
	authenticateToken,
	requireRole("vendor"),
	customerController.deleteCustomer,
);
router.post(
	"/bulk-delete",
	authenticateToken,
	requireRole("vendor"),
	customerController.bulkDelete,
);
router.post(
	"/bulk-status",
	authenticateToken,
	requireRole("vendor"),
	customerController.bulkUpdateStatus,
);

module.exports = router;
