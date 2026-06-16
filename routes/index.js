const express = require('express');
const router = express.Router();
const vendorAuthRoutes = require('./vendor/authRoutes');
const chatRoutes = require('./chatRoutes');
const notificationRoutes = require('./notificationRoutes');

// Namespaced API endpoints
router.use('/vendor/auth', vendorAuthRoutes);
router.use('/chat', chatRoutes);
router.use('/notifications', notificationRoutes);

// Ready for future integration:
// router.use('/admin/auth', adminAuthRoutes);
// router.use('/user/auth', userAuthRoutes);

module.exports = router;
