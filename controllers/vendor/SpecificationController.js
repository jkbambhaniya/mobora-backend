const { Brand, Model, Storage, Ram, sequelize } = require("../../models");
const { Op } = require("sequelize");
const { sendSuccess, sendError } = require("../../utils/responseHelper");

// ─────────────────────────────────────────────
// METRICS
// ─────────────────────────────────────────────

async function getMetrics(req, res) {
	try {
		const [totalBrands, totalModels, totalStorages, totalRams] = await Promise.all([
			Brand.count(),
			Model.count(),
			Storage.count(),
			Ram.count()
		]);
		return sendSuccess(res, "Specification metrics retrieved.", {
			metrics: {
				totalBrands,
				totalModels,
				totalStorages,
				totalRams
			},
		});
	} catch (err) {
		console.error("[SpecController] getMetrics error:", err.message);
		return sendError(
			res,
			"Failed to fetch specification metrics.",
			{},
			500,
		);
	}
}

// ─────────────────────────────────────────────
// ALL SPEC DROPDOWNS (for inventory form selects)
// ─────────────────────────────────────────────

async function getAllSpecs(req, res) {
	try {
		const [brands, models, storages, rams] = await Promise.all([
			Brand.findAll({
				where: { status: "approved" },
				order: [["name", "ASC"]]
			}),
			Model.findAll({
				where: {
					[Op.or]: [
						{ vendor_id: req.user.id },
						{ vendor_id: null }
					]
				},
				include: [{ model: Brand, as: 'brand', attributes: ['name'] }],
				order: [
					[{ model: Brand, as: 'brand' }, 'name', 'ASC'],
					['name', 'ASC']
				]
			}),
			Storage.findAll({
				where: { status: "approved" },
				order: [["value", "ASC"]]
			}),
			Ram.findAll({
				where: { status: "approved" },
				order: [["value", "ASC"]]
			}),
		]);

		const formattedModels = models.map(m => ({
			id: m.id,
			name: m.name,
			brand_id: m.brand_id,
			brand_name: m.brand ? m.brand.name : ''
		}));

		return sendSuccess(res, "All specifications retrieved.", {
			brands,
			models: formattedModels,
			storages,
			rams,
		});
	} catch (err) {
		console.error("[SpecController] getAllSpecs error:", err.message);
		return sendError(res, "Failed to fetch specifications.", {}, 500);
	}
}

// ─────────────────────────────────────────────
// BRANDS
// ─────────────────────────────────────────────

async function getBrands(req, res) {
	try {
		const { search, page = 1, limit = 10, sortBy = "name", sortOrder = "asc" } = req.query;
		const offset = (Number(page) - 1) * Number(limit);

		const where = {};
		if (search) {
			where.name = { [Op.like]: `%${search}%` };
		}

		const allowedSort = { name: "name", created_at: "created_at" };
		const col = allowedSort[sortBy] || "name";
		const dir = sortOrder === "desc" ? "DESC" : "ASC";

		const { count, rows } = await Brand.findAndCountAll({
			where,
			attributes: {
				include: [
					[sequelize.literal('(SELECT COUNT(*) FROM models WHERE models.brand_id = Brand.id)'), 'model_count']
				]
			},
			order: [[col, dir]],
			limit: Number(limit),
			offset: Number(offset)
		});

		const formattedBrands = rows.map(b => ({
			id: b.id,
			name: b.name,
			status: b.status,
			created_at: b.created_at,
			model_count: parseInt(b.getDataValue('model_count') || 0, 10)
		}));

		return sendSuccess(res, "Brands retrieved successfully.", {
			data: formattedBrands,
			total: count,
			page: Number(page),
			limit: Number(limit),
		});
	} catch (err) {
		console.error("[SpecController] getBrands error:", err.message);
		return sendError(res, "Failed to fetch brands.", {}, 500);
	}
}

async function createBrand(req, res) {
	try {
		const { name } = req.body;
		if (!name || !name.trim()) {
			return sendError(res, "Brand name is required.", {}, 400);
		}

		const existing = await Brand.findOne({
			where: { name: name.trim() }
		});

		if (existing) {
			if (existing.status === "approved") {
				return sendError(
					res,
					"A brand with this name already exists.",
					{},
					409,
				);
			} else {
				return sendError(
					res,
					"A request for this brand has already been submitted and is pending approval.",
					{},
					409,
				);
			}
		}

		const brand = await Brand.create({
			name: name.trim(),
			status: 'pending'
		});

		return sendSuccess(
			res,
			"Brand request submitted successfully.",
			{ brand },
			201,
		);
	} catch (err) {
		console.error("[SpecController] createBrand error:", err.message);
		return sendError(res, "Failed to create brand request.", {}, 500);
	}
}

async function updateBrand(req, res) {
	try {
		return sendError(
			res,
			"Forbidden: Vendors do not have permission to edit brands.",
			{},
			403,
		);
	} catch (err) {
		console.error("[SpecController] updateBrand error:", err.message);
		return sendError(res, "Failed to update brand.", {}, 500);
	}
}

async function deleteBrand(req, res) {
	try {
		return sendError(
			res,
			"Forbidden: Vendors do not have permission to delete brands.",
			{},
			403,
		);
	} catch (err) {
		console.error("[SpecController] deleteBrand error:", err.message);
		return sendError(res, "Failed to delete brand.", {}, 500);
	}
}

// ─────────────────────────────────────────────
// MODELS
// ─────────────────────────────────────────────

async function getModels(req, res) {
	try {
		const { search, brandId, page = 1, limit = 10, sortBy = "name", sortOrder = "asc" } = req.query;
		const offset = (Number(page) - 1) * Number(limit);
		const vendorId = req.user.id;

		const where = {
			[Op.and]: [
				{
					[Op.or]: [
						{ vendor_id: vendorId },
						{ vendor_id: null }
					]
				}
			]
		};

		if (brandId) {
			where[Op.and].push({ brand_id: brandId });
		}

		if (search) {
			where[Op.and].push({
				[Op.or]: [
					{ name: { [Op.like]: `%${search}%` } },
					{ '$brand.name$': { [Op.like]: `%${search}%` } }
				]
			});
		}

		let orderClause = [['name', sortOrder === 'desc' ? 'DESC' : 'ASC']];
		if (sortBy === 'brand') {
			orderClause = [[{ model: Brand, as: 'brand' }, 'name', sortOrder === 'desc' ? 'DESC' : 'ASC']];
		} else if (sortBy === 'created_at') {
			orderClause = [['created_at', sortOrder === 'desc' ? 'DESC' : 'ASC']];
		}

		const { count, rows } = await Model.findAndCountAll({
			where,
			include: [{ model: Brand, as: 'brand', attributes: ['name'] }],
			order: orderClause,
			limit: Number(limit),
			offset: Number(offset)
		});

		const formattedRows = rows.map(m => ({
			id: m.id,
			name: m.name,
			brand_id: m.brand_id,
			vendor_id: m.vendor_id,
			brand_name: m.brand ? m.brand.name : '',
			created_at: m.created_at
		}));

		return sendSuccess(res, "Models retrieved successfully.", {
			data: formattedRows,
			total: count,
			page: Number(page),
			limit: Number(limit),
		});
	} catch (err) {
		console.error("[SpecController] getModels error:", err.message);
		return sendError(res, "Failed to fetch models.", {}, 500);
	}
}

async function createModel(req, res) {
	try {
		const { name, brand_id } = req.body;
		if (!name || !name.trim())
			return sendError(res, "Model name is required.", {}, 400);
		if (!brand_id) return sendError(res, "Brand is required.", {}, 400);

		// Verify brand exists and is approved
		const brand = await Brand.findOne({
			where: { id: brand_id, status: 'approved' }
		});
		if (!brand) {
			return sendError(
				res,
				"Cannot add model to a pending or non-existent brand.",
				{},
				400,
			);
		}

		// Check if a model with the same name exists for this brand (either global or this vendor)
		const existing = await Model.findOne({
			where: {
				brand_id,
				name: name.trim(),
				[Op.or]: [
					{ vendor_id: req.user.id },
					{ vendor_id: null }
				]
			}
		});

		if (existing) {
			return sendError(
				res,
				"A model with this name already exists under this brand.",
				{},
				409,
			);
		}

		const newModel = await Model.create({
			brand_id,
			name: name.trim(),
			vendor_id: req.user.id
		});

		const formattedModel = {
			id: newModel.id,
			name: newModel.name,
			brand_id: newModel.brand_id,
			vendor_id: newModel.vendor_id,
			brand_name: brand.name,
			created_at: newModel.created_at
		};

		return sendSuccess(res, "Model created successfully.", { model: formattedModel }, 201);
	} catch (err) {
		console.error("[SpecController] createModel error:", err.message);
		return sendError(res, "Failed to create model.", {}, 500);
	}
}

async function updateModel(req, res) {
	try {
		const { id } = req.params;
		const { name, brand_id } = req.body;

		const model = await Model.findByPk(id, {
			include: [{ model: Brand, as: 'brand', attributes: ['name'] }]
		});
		if (!model) return sendError(res, "Model not found.", {}, 404);

		// Verify the model belongs to this vendor
		if (model.vendor_id !== req.user.id) {
			return sendError(
				res,
				"Forbidden: You do not have permission to edit this model.",
				{},
				403,
			);
		}

		if (brand_id !== undefined) {
			const brand = await Brand.findOne({
				where: { id: brand_id, status: 'approved' }
			});
			if (!brand) {
				return sendError(
					res,
					"Cannot associate model with a pending or non-existent brand.",
					{},
					400,
				);
			}
		}

		const updates = {};
		if (name !== undefined) updates.name = name.trim();
		if (brand_id !== undefined) updates.brand_id = brand_id;

		await Model.update(updates, { where: { id } });

		const updatedModel = await Model.findByPk(id, {
			include: [{ model: Brand, as: 'brand', attributes: ['name'] }]
		});

		const formattedModel = {
			id: updatedModel.id,
			name: updatedModel.name,
			brand_id: updatedModel.brand_id,
			vendor_id: updatedModel.vendor_id,
			brand_name: updatedModel.brand ? updatedModel.brand.name : '',
			created_at: updatedModel.created_at
		};

		return sendSuccess(res, "Model updated successfully.", {
			model: formattedModel,
		});
	} catch (err) {
		console.error("[SpecController] updateModel error:", err.message);
		return sendError(res, "Failed to update model.", {}, 500);
	}
}

async function deleteModel(req, res) {
	try {
		const { id } = req.params;
		const model = await Model.findByPk(id);
		if (!model) return sendError(res, "Model not found.", {}, 404);

		// Verify the model belongs to this vendor
		if (model.vendor_id !== req.user.id) {
			return sendError(
				res,
				"Forbidden: You do not have permission to delete this model.",
				{},
				403,
			);
		}

		await Model.destroy({ where: { id } });
		return sendSuccess(res, "Model deleted successfully.", {
			success: true,
		});
	} catch (err) {
		console.error("[SpecController] deleteModel error:", err.message);
		return sendError(res, "Failed to delete model.", {}, 500);
	}
}

// ─────────────────────────────────────────────
// STORAGES
// ─────────────────────────────────────────────

async function getStorages(req, res) {
	try {
		const { search, page = 1, limit = 10, sortBy = "value", sortOrder = "asc" } = req.query;
		const offset = (Number(page) - 1) * Number(limit);

		const where = {};
		if (search) {
			where.value = { [Op.like]: `%${search}%` };
		}

		const allowedSort = { value: "value", created_at: "created_at" };
		const col = allowedSort[sortBy] || "value";
		const dir = sortOrder === "desc" ? "DESC" : "ASC";

		const { count, rows } = await Storage.findAndCountAll({
			where,
			order: [[col, dir]],
			limit: Number(limit),
			offset: Number(offset)
		});

		return sendSuccess(res, "Storages retrieved successfully.", {
			data: rows,
			total: count,
			page: Number(page),
			limit: Number(limit),
		});
	} catch (err) {
		console.error("[SpecController] getStorages error:", err.message);
		return sendError(res, "Failed to fetch storages.", {}, 500);
	}
}

async function createStorage(req, res) {
	try {
		const { value } = req.body;
		if (!value || !value.trim())
			return sendError(res, "Storage value is required.", {}, 400);

		const existing = await Storage.findOne({
			where: { value: value.trim() }
		});

		if (existing) {
			if (existing.status === "approved") {
				return sendError(
					res,
					"This storage option already exists.",
					{},
					409,
				);
			} else {
				return sendError(
					res,
					"A request for this storage option has already been submitted and is pending approval.",
					{},
					409,
				);
			}
		}

		const storage = await Storage.create({
			value: value.trim(),
			status: 'pending'
		});

		return sendSuccess(
			res,
			"Storage request submitted successfully.",
			{ storage },
			201,
		);
	} catch (err) {
		console.error("[SpecController] createStorage error:", err.message);
		return sendError(res, "Failed to create storage request.", {}, 500);
	}
}

async function updateStorage(req, res) {
	try {
		return sendError(
			res,
			"Forbidden: Vendors do not have permission to edit storages.",
			{},
			403,
		);
	} catch (err) {
		console.error("[SpecController] updateStorage error:", err.message);
		return sendError(res, "Failed to update storage.", {}, 500);
	}
}

async function deleteStorage(req, res) {
	try {
		return sendError(
			res,
			"Forbidden: Vendors do not have permission to delete storages.",
			{},
			403,
		);
	} catch (err) {
		console.error("[SpecController] deleteStorage error:", err.message);
		return sendError(res, "Failed to delete storage.", {}, 500);
	}
}

// ─────────────────────────────────────────────
// RAMS
// ─────────────────────────────────────────────

async function getRams(req, res) {
	try {
		const { search, page = 1, limit = 10, sortBy = "value", sortOrder = "asc" } = req.query;
		const offset = (Number(page) - 1) * Number(limit);

		const where = {};
		if (search) {
			where.value = { [Op.like]: `%${search}%` };
		}

		const allowedSort = { value: "value", created_at: "created_at" };
		const col = allowedSort[sortBy] || "value";
		const dir = sortOrder === "desc" ? "DESC" : "ASC";

		const { count, rows } = await Ram.findAndCountAll({
			where,
			order: [[col, dir]],
			limit: Number(limit),
			offset: Number(offset)
		});

		return sendSuccess(res, "RAM options retrieved successfully.", {
			data: rows,
			total: count,
			page: Number(page),
			limit: Number(limit),
		});
	} catch (err) {
		console.error("[SpecController] getRams error:", err.message);
		return sendError(res, "Failed to fetch RAM options.", {}, 500);
	}
}

async function createRam(req, res) {
	try {
		const { value } = req.body;
		if (!value || !value.trim())
			return sendError(res, "RAM value is required.", {}, 400);

		const existing = await Ram.findOne({
			where: { value: value.trim() }
		});

		if (existing) {
			if (existing.status === "approved") {
				return sendError(
					res,
					"This RAM option already exists.",
					{},
					409,
				);
			} else {
				return sendError(
					res,
					"A request for this RAM option has already been submitted and is pending approval.",
					{},
					409,
				);
			}
		}

		const ram = await Ram.create({
			value: value.trim(),
			status: 'pending'
		});

		return sendSuccess(
			res,
			"RAM request submitted successfully.",
			{ ram },
			201,
		);
	} catch (err) {
		console.error("[SpecController] createRam error:", err.message);
		return sendError(res, "Failed to create RAM request.", {}, 500);
	}
}

async function updateRam(req, res) {
	try {
		return sendError(
			res,
			"Forbidden: Vendors do not have permission to edit RAM options.",
			{},
			403,
		);
	} catch (err) {
		console.error("[SpecController] updateRam error:", err.message);
		return sendError(res, "Failed to update RAM option.", {}, 500);
	}
}

async function deleteRam(req, res) {
	try {
		return sendError(
			res,
			"Forbidden: Vendors do not have permission to delete RAM options.",
			{},
			403,
		);
	} catch (err) {
		console.error("[SpecController] deleteRam error:", err.message);
		return sendError(res, "Failed to delete RAM option.", {}, 500);
	}
}

module.exports = {
	getMetrics,
	getAllSpecs,
	getBrands,
	createBrand,
	updateBrand,
	deleteBrand,
	getModels,
	createModel,
	updateModel,
	deleteModel,
	getStorages,
	createStorage,
	updateStorage,
	deleteStorage,
	getRams,
	createRam,
	updateRam,
	deleteRam,
};
