const express = require('express');
const router = express.Router();
const authController = require('../../controllers/vendor/AuthController');
const { authenticateToken, requireRole } = require('../../middleware/authMiddleware');
const { validateBody } = require('../../middleware/validationMiddleware');

// Public endpoints
router.post('/register', validateBody(authController.registerSchema), authController.register);
router.post('/login', validateBody(authController.loginSchema), authController.login);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refresh);

// Protected endpoints (requires valid JWT token and 'vendor' role)
router.get('/profile', authenticateToken, requireRole('vendor'), authController.getProfile);
router.put('/profile', authenticateToken, requireRole('vendor'), validateBody(authController.updateProfileSchema), authController.updateProfile);
router.put('/change-password', authenticateToken, requireRole('vendor'), validateBody(authController.changePasswordSchema), authController.changePassword);

module.exports = router;
