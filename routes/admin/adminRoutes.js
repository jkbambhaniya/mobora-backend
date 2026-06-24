const express = require('express');
const router = express.Router();
const authController = require('../../controllers/admin/AuthController');
const vendorController = require('../../controllers/admin/VendorController');
const specController = require('../../controllers/admin/SpecificationController');
const { authenticateToken, requireRole } = require('../../middleware/authMiddleware');
const { validateBody } = require('../../middleware/validationMiddleware');

const adminAuth = [authenticateToken, requireRole('admin')];

// Public endpoints
router.post('/auth/login', validateBody(authController.loginSchema), authController.login);
router.post('/auth/logout', authController.logout);
router.post('/auth/refresh', authController.refresh);

// Protected endpoints (requires valid JWT token and 'admin' role)
router.get('/auth/profile', ...adminAuth, authController.getProfile);
router.put('/auth/profile', ...adminAuth, validateBody(authController.updateProfileSchema), authController.updateProfile);
router.put('/auth/change-password', ...adminAuth, validateBody(authController.changePasswordSchema), authController.changePassword);
router.get('/vendors', ...adminAuth, vendorController.listVendors);
router.get('/vendors/:id', ...adminAuth, vendorController.getVendorById);
router.put('/vendors/:id/status', ...adminAuth, vendorController.updateVendorStatus);
router.put('/vendors/:id', ...adminAuth, vendorController.updateVendor);
router.delete('/vendors/:id', ...adminAuth, vendorController.deleteVendor);
router.get('/stats', ...adminAuth, vendorController.getStats);

// ─── Specification Management ───────────────────────────────────────────────
router.get('/specifications/summary', ...adminAuth, specController.getSpecSummary);

// Brands
router.get('/specifications/brands', ...adminAuth, specController.listBrands);
router.put('/specifications/brands/:id/status', ...adminAuth, specController.updateBrandStatus);
router.delete('/specifications/brands/:id', ...adminAuth, specController.deleteBrand);

// RAMs
router.get('/specifications/rams', ...adminAuth, specController.listRams);
router.put('/specifications/rams/:id/status', ...adminAuth, specController.updateRamStatus);
router.delete('/specifications/rams/:id', ...adminAuth, specController.deleteRam);

// Storages
router.get('/specifications/storages', ...adminAuth, specController.listStorages);
router.put('/specifications/storages/:id/status', ...adminAuth, specController.updateStorageStatus);
router.delete('/specifications/storages/:id', ...adminAuth, specController.deleteStorage);

// Models (device models)
router.get('/specifications/models', ...adminAuth, specController.listModels);
router.put('/specifications/models/:id', ...adminAuth, specController.updateModel);
router.delete('/specifications/models/:id', ...adminAuth, specController.deleteModel);

module.exports = router;
