const express = require('express');
const router = express.Router();
const chatController = require('../../controllers/admin/AdminChatController');
const { authenticateToken, requireRole } = require('../../middleware/authMiddleware');

const adminAuth = [authenticateToken, requireRole('admin')];

router.get('/sessions', ...adminAuth, chatController.getSessions);
router.get('/sessions/:chatId/messages', ...adminAuth, chatController.getMessages);
router.post('/sessions', ...adminAuth, chatController.createSession);
router.post('/broadcast', ...adminAuth, chatController.broadcastMessage);
router.post('/upload', ...adminAuth, chatController.uploadFile);

module.exports = router;
