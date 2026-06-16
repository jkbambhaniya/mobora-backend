const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

// All routes require a valid vendor JWT
router.use(authenticateToken, requireRole('vendor'));

// GET    /api/notifications          → list all for vendor
router.get('/', notificationController.getNotifications);

// PATCH  /api/notifications/read-all → mark all as read (must come before /:id)
router.patch('/read-all', notificationController.markAllRead);

// PATCH  /api/notifications/:id/read → mark single as read
router.patch('/:id/read', notificationController.markRead);

// DELETE /api/notifications          → clear all
router.delete('/', notificationController.deleteAllNotifications);

// DELETE /api/notifications/:id      → delete single
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
