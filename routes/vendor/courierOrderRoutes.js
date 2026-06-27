const express = require("express");
const router = express.Router();
const courierOrderController = require("../../controllers/vendor/CourierOrderController");
const { authenticateToken, requireRole } = require("../../middleware/authMiddleware");

// Protected vendor endpoints
router.get(
	"/",
	authenticateToken,
	requireRole("vendor"),
	courierOrderController.getCourierOrders
);

router.post(
	"/order",
	authenticateToken,
	requireRole("vendor"),
	courierOrderController.createCourierOrder
);

router.post(
	"/order/:id/ship",
	authenticateToken,
	requireRole("vendor"),
	courierOrderController.shipCourierOrder
);

router.post(
	"/order/:id/receive",
	authenticateToken,
	requireRole("vendor"),
	courierOrderController.receiveCourierOrder
);

router.post(
	"/order/:id/cancel",
	authenticateToken,
	requireRole("vendor"),
	courierOrderController.cancelCourierOrder
);

module.exports = router;
