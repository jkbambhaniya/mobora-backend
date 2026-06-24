const express = require("express");
const router = express.Router();
const transactionController = require("../../controllers/vendor/TransactionController");
const invoiceController = require("../../controllers/vendor/InvoiceController");
const {
	authenticateToken,
	requireRole,
} = require("../../middleware/authMiddleware");

// Protected endpoints
router.get(
	"/",
	authenticateToken,
	requireRole("vendor"),
	transactionController.getTransactions,
);

router.post(
	"/",
	authenticateToken,
	requireRole("vendor"),
	transactionController.createTransaction,
);

router.put(
	"/:id",
	authenticateToken,
	requireRole("vendor"),
	transactionController.updateTransaction,
);

router.get(
	"/:id/invoice",
	authenticateToken,
	requireRole(["vendor", "admin"]),
	invoiceController.getTransactionInvoice,
);

module.exports = router;
