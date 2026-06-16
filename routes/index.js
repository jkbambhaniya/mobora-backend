const express = require('express');
const router = express.Router();
const vendorAuthRoutes = require('./vendor/authRoutes');
const chatRoutes = require('./chatRoutes');

// Namespaced API endpoints
router.use('/vendor/auth', vendorAuthRoutes);
router.use('/chat', chatRoutes);

// Ready for future integration:
// router.use('/admin/auth', adminAuthRoutes);
// router.use('/user/auth', userAuthRoutes);

module.exports = router;
