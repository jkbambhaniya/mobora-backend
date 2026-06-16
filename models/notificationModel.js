const db = require('../config/db');

/**
 * Create a new notification for a vendor.
 */
async function createNotification({ vendorId, type, title, body, chatId = null, senderName = null }) {
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const sql = `
    INSERT INTO notifications (vendor_id, type, title, body, chat_id, sender_name, is_read, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `;
  const [result] = await db.query(sql, [vendorId, type, title, body, chatId, senderName, timestamp]);
  return {
    id: `notif-${result.insertId}`,
    type,
    title,
    body,
    chatId,
    senderName,
    isRead: false,
    timestamp
  };
}

/**
 * Get all notifications for a vendor (newest first, capped at 50).
 */
async function getNotificationsByVendor(vendorId) {
  const sql = `
    SELECT * FROM notifications
    WHERE vendor_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `;
  const [rows] = await db.query(sql, [vendorId]);
  return rows.map(row => ({
    id: `notif-${row.id}`,
    type: row.type,
    title: row.title,
    body: row.body,
    chatId: row.chat_id,
    senderName: row.sender_name,
    isRead: row.is_read === 1,
    timestamp: row.timestamp
  }));
}

/**
 * Mark a single notification as read.
 */
async function markNotificationRead(notifDbId, vendorId) {
  const sql = `UPDATE notifications SET is_read = 1 WHERE id = ? AND vendor_id = ?`;
  await db.query(sql, [notifDbId, vendorId]);
}

/**
 * Mark ALL notifications for a vendor as read.
 */
async function markAllNotificationsRead(vendorId) {
  const sql = `UPDATE notifications SET is_read = 1 WHERE vendor_id = ?`;
  await db.query(sql, [vendorId]);
}

/**
 * Delete (clear) a single notification.
 */
async function deleteNotification(notifDbId, vendorId) {
  const sql = `DELETE FROM notifications WHERE id = ? AND vendor_id = ?`;
  await db.query(sql, [notifDbId, vendorId]);
}

/**
 * Delete all notifications for a vendor.
 */
async function deleteAllNotifications(vendorId) {
  const sql = `DELETE FROM notifications WHERE vendor_id = ?`;
  await db.query(sql, [vendorId]);
}

module.exports = {
  createNotification,
  getNotificationsByVendor,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllNotifications
};
