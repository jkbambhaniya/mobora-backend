const notificationModel = require('../models/notificationModel');

/**
 * GET /api/notifications
 * Returns all notifications for the authenticated vendor.
 */
async function getNotifications(req, res) {
  try {
    const vendorId = req.user.id;
    const notifications = await notificationModel.getNotificationsByVendor(vendorId);
    res.json({ success: true, notifications });
  } catch (err) {
    console.error('[NotificationController] getNotifications error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
}

/**
 * PATCH /api/notifications/:id/read
 * Marks a single notification as read (extracts numeric DB id from "notif-{id}").
 */
async function markRead(req, res) {
  try {
    const vendorId = req.user.id;
    const rawId = req.params.id; // e.g. "notif-42"
    const dbId = parseInt(rawId.replace('notif-', ''), 10);
    if (isNaN(dbId)) return res.status(400).json({ success: false, message: 'Invalid notification id.' });
    await notificationModel.markNotificationRead(dbId, vendorId);
    res.json({ success: true });
  } catch (err) {
    console.error('[NotificationController] markRead error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to mark notification as read.' });
  }
}

/**
 * PATCH /api/notifications/read-all
 * Marks all notifications for the vendor as read.
 */
async function markAllRead(req, res) {
  try {
    const vendorId = req.user.id;
    await notificationModel.markAllNotificationsRead(vendorId);
    res.json({ success: true });
  } catch (err) {
    console.error('[NotificationController] markAllRead error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to mark all as read.' });
  }
}

/**
 * DELETE /api/notifications/:id
 * Deletes a single notification.
 */
async function deleteNotification(req, res) {
  try {
    const vendorId = req.user.id;
    const rawId = req.params.id;
    const dbId = parseInt(rawId.replace('notif-', ''), 10);
    if (isNaN(dbId)) return res.status(400).json({ success: false, message: 'Invalid notification id.' });
    await notificationModel.deleteNotification(dbId, vendorId);
    res.json({ success: true });
  } catch (err) {
    console.error('[NotificationController] deleteNotification error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to delete notification.' });
  }
}

/**
 * DELETE /api/notifications
 * Deletes all notifications for the vendor.
 */
async function deleteAllNotifications(req, res) {
  try {
    const vendorId = req.user.id;
    await notificationModel.deleteAllNotifications(vendorId);
    res.json({ success: true });
  } catch (err) {
    console.error('[NotificationController] deleteAllNotifications error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to clear all notifications.' });
  }
}

module.exports = {
  getNotifications,
  markRead,
  markAllRead,
  deleteNotification,
  deleteAllNotifications
};
