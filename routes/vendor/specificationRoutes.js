const express = require("express");
const router = express.Router();
const specController = require("../../controllers/vendor/SpecificationController");
const {
	authenticateToken,
	requireRole,
} = require("../../middleware/authMiddleware");
const { validateBody } = require("../../middleware/validationMiddleware");
const {
	brandSchema,
	createModelSchema,
	updateModelSchema,
	storageSchema,
	ramSchema,
} = require("../../validation/vendor/specificationValidation");

const auth = [authenticateToken, requireRole("vendor")];

// Metrics & dropdown helpers
router.get("/metrics", ...auth, specController.getMetrics);
router.get("/all", ...auth, specController.getAllSpecs);

// Brands
router.get("/brands", ...auth, specController.getBrands);
router.post(
	"/brands",
	...auth,
	validateBody(brandSchema),
	specController.createBrand,
);
router.put(
	"/brands/:id",
	...auth,
	validateBody(brandSchema),
	specController.updateBrand,
);
router.delete("/brands/:id", ...auth, specController.deleteBrand);

// Models
router.get("/models", ...auth, specController.getModels);
router.post(
	"/models",
	...auth,
	validateBody(createModelSchema),
	specController.createModel,
);
router.put(
	"/models/:id",
	...auth,
	validateBody(updateModelSchema),
	specController.updateModel,
);
router.delete("/models/:id", ...auth, specController.deleteModel);

// Storages
router.get("/storages", ...auth, specController.getStorages);
router.post(
	"/storages",
	...auth,
	validateBody(storageSchema),
	specController.createStorage,
);
router.put(
	"/storages/:id",
	...auth,
	validateBody(storageSchema),
	specController.updateStorage,
);
router.delete("/storages/:id", ...auth, specController.deleteStorage);

// RAMs
router.get("/rams", ...auth, specController.getRams);
router.post(
	"/rams",
	...auth,
	validateBody(ramSchema),
	specController.createRam,
);
router.put(
	"/rams/:id",
	...auth,
	validateBody(ramSchema),
	specController.updateRam,
);
router.delete("/rams/:id", ...auth, specController.deleteRam);

module.exports = router;
