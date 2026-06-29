const express = require('express');
const router = express.Router();
const chatController = require('../../controllers/vendor/ChatController');
const chatTemplateController = require('../../controllers/vendor/ChatTemplateController');
const { authenticateToken, requireRole } = require('../../middleware/authMiddleware');

// Protected endpoints (requires valid JWT token and 'vendor' role)
router.get('/sessions', authenticateToken, requireRole('vendor'), chatController.getSessions);
router.post('/sessions', authenticateToken, requireRole('vendor'), chatController.createSession);
router.get('/vendors', authenticateToken, requireRole('vendor'), chatController.getVendors);
router.get('/sessions/:chatId/messages', authenticateToken, requireRole('vendor'), chatController.getMessages);
router.post('/upload', authenticateToken, requireRole('vendor'), chatController.uploadFile);
router.post('/message', authenticateToken, requireRole('vendor'), chatController.sendMessage);

// Chat template endpoints
router.get('/templates', authenticateToken, requireRole('vendor'), chatTemplateController.getTemplates);
router.post('/templates', authenticateToken, requireRole('vendor'), chatTemplateController.createTemplate);
router.put('/templates/:id', authenticateToken, requireRole('vendor'), chatTemplateController.updateTemplate);
router.delete('/templates/:id', authenticateToken, requireRole('vendor'), chatTemplateController.deleteTemplate);

module.exports = router;
