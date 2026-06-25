const express = require('express');
const router = express.Router();
const authController = require('../../controllers/admin/AuthController');
const vendorController = require('../../controllers/admin/VendorController');
const specController = require('../../controllers/admin/SpecificationController');
const customerController = require('../../controllers/admin/CustomerController');
const blacklistController = require('../../controllers/admin/BlacklistController');
const requirementController = require('../../controllers/admin/DeviceRequirementController');
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

// Customer Management
router.get('/customers', ...adminAuth, customerController.listCustomers);
router.get('/customers/:id', ...adminAuth, customerController.getCustomerById);
router.put('/customers/:id', ...adminAuth, customerController.updateCustomer);
router.delete('/customers/:id', ...adminAuth, customerController.deleteCustomer);

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

// ─── Blacklist Management ────────────────────────────────────────────────────
router.get('/blacklist', ...adminAuth, blacklistController.getAllBlacklistedDevices);
router.get('/blacklist/:id', ...adminAuth, blacklistController.getBlacklistedDeviceById);
router.delete('/blacklist/:id', ...adminAuth, blacklistController.removeBlacklistedDevice);

// ─── Device Requirements Management ─────────────────────────────────────────
router.get('/requirements', ...adminAuth, requirementController.getAllRequirements);
router.get('/requirements/:id', ...adminAuth, requirementController.getRequirementById);
router.delete('/requirements/:id', ...adminAuth, requirementController.deleteRequirement);
router.put('/requirements/:id/status', ...adminAuth, requirementController.updateRequirementStatus);

// ─── Chat Management ────────────────────────────────────────────────────────
const adminChatRoutes = require('./adminChatRoutes');
router.use('/chat', adminChatRoutes);

module.exports = router;
