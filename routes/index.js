const express = require("express");
const router = express.Router();
const vendorAuthRoutes = require("./vendor/authRoutes");
const vendorChatRoutes = require("./vendor/chatRoutes");
const vendorNotificationRoutes = require("./vendor/notificationRoutes");
const vendorCustomerRoutes = require("./vendor/customerRoutes");
const vendorSpecificationRoutes = require("./vendor/specificationRoutes");
const vendorMobileRoutes = require("./vendor/mobileRoutes");
const vendorTransactionRoutes = require("./vendor/transactionRoutes");
const vendorRepairRoutes = require("./vendor/repairRoutes");
const vendorBlacklistRoutes = require("./vendor/blacklistRoutes");
const vendorRequirementRoutes = require("./vendor/deviceRequirementRoutes");

const adminRoutes = require("./admin/adminRoutes");

// Namespaced API endpoints
router.use("/vendor/auth", vendorAuthRoutes);
router.use("/vendor/chat", vendorChatRoutes);
router.use("/vendor/notifications", vendorNotificationRoutes);
router.use("/vendor/customers", vendorCustomerRoutes);
router.use("/vendor/specifications", vendorSpecificationRoutes);
router.use("/vendor/mobiles", vendorMobileRoutes);
router.use("/vendor/transactions", vendorTransactionRoutes);
router.use("/vendor/repairs", vendorRepairRoutes);
router.use("/vendor/blacklist", vendorBlacklistRoutes);
router.use("/vendor/requirements", vendorRequirementRoutes);

router.use("/admin", adminRoutes);

// Ready for future integration:
// router.use('/user/auth', userAuthRoutes);

module.exports = router;
