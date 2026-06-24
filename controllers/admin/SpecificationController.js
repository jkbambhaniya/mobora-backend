const { Brand, Ram, Storage, Model, Vendor } = require("../../models");
const { Op } = require("sequelize");
const { sendSuccess, sendError } = require("../../utils/responseHelper");

// ─────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────

function buildPagination(query) {
	const page = Math.max(1, parseInt(query.page, 10) || 1);
	const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 15));
	const offset = (page - 1) * limit;
	const sortOrder = (query.sortOrder || "desc").toUpperCase() === "ASC" ? "ASC" : "DESC";
	return { page, limit, offset, sortOrder };
}

// ─────────────────────────────────────────────
// BRANDS
// ─────────────────────────────────────────────

async function listBrands(req, res) {
	try {
		const { page, limit, offset, sortOrder } = buildPagination(req.query);
		const { search, status, sortBy } = req.query;

		const where = {};
		if (status && ["pending", "approved", "rejected"].includes(status)) {
			where.status = status;
		}
		if (search && search.trim()) {
			where.name = { [Op.like]: `%${search.trim()}%` };
		}

		const allowedSort = { name: "name", created_at: "created_at", status: "status" };
		const col = allowedSort[sortBy] || "created_at";

		const { count, rows } = await Brand.findAndCountAll({
			where,
			order: [[col, sortOrder]],
			limit,
			offset,
		});

		return sendSuccess(res, "Brands retrieved successfully.", {
			data: rows,
			pagination: {
				totalCount: count,
				totalPages: Math.ceil(count / limit),
				currentPage: page,
				limit,
			},
		});
	} catch (err) {
		console.error("[AdminSpec] listBrands error:", err.message);
		return sendError(res, "Failed to fetch brands.", {}, 500);
	}
}

async function updateBrandStatus(req, res) {
	try {
		const { id } = req.params;
		const { status } = req.body;

		if (!["approved", "rejected"].includes(status)) {
			return sendError(res, "Invalid status. Must be 'approved' or 'rejected'.", {}, 400);
		}

		const brand = await Brand.findByPk(id);
		if (!brand) {
			return sendError(res, "Brand not found.", {}, 404);
		}

		brand.status = status;
		await brand.save();

		return sendSuccess(res, `Brand ${status} successfully.`, { brand });
	} catch (err) {
		console.error("[AdminSpec] updateBrandStatus error:", err.message);
		return sendError(res, "Failed to update brand status.", {}, 500);
	}
}

async function deleteBrand(req, res) {
	try {
		const { id } = req.params;
		const brand = await Brand.findByPk(id);
		if (!brand) {
			return sendError(res, "Brand not found.", {}, 404);
		}
		await brand.destroy();
		return sendSuccess(res, "Brand deleted successfully.", { id: Number(id) });
	} catch (err) {
		console.error("[AdminSpec] deleteBrand error:", err.message);
		return sendError(res, "Failed to delete brand.", {}, 500);
	}
}

// ─────────────────────────────────────────────
// RAM
// ─────────────────────────────────────────────

async function listRams(req, res) {
	try {
		const { page, limit, offset, sortOrder } = buildPagination(req.query);
		const { search, status, sortBy } = req.query;

		const where = {};
		if (status && ["pending", "approved", "rejected"].includes(status)) {
			where.status = status;
		}
		if (search && search.trim()) {
			where.value = { [Op.like]: `%${search.trim()}%` };
		}

		const allowedSort = { value: "value", created_at: "created_at", status: "status" };
		const col = allowedSort[sortBy] || "created_at";

		const { count, rows } = await Ram.findAndCountAll({
			where,
			order: [[col, sortOrder]],
			limit,
			offset,
		});

		return sendSuccess(res, "RAM options retrieved successfully.", {
			data: rows,
			pagination: {
				totalCount: count,
				totalPages: Math.ceil(count / limit),
				currentPage: page,
				limit,
			},
		});
	} catch (err) {
		console.error("[AdminSpec] listRams error:", err.message);
		return sendError(res, "Failed to fetch RAM options.", {}, 500);
	}
}

async function updateRamStatus(req, res) {
	try {
		const { id } = req.params;
		const { status } = req.body;

		if (!["approved", "rejected"].includes(status)) {
			return sendError(res, "Invalid status. Must be 'approved' or 'rejected'.", {}, 400);
		}

		const ram = await Ram.findByPk(id);
		if (!ram) {
			return sendError(res, "RAM option not found.", {}, 404);
		}

		ram.status = status;
		await ram.save();

		return sendSuccess(res, `RAM option ${status} successfully.`, { ram });
	} catch (err) {
		console.error("[AdminSpec] updateRamStatus error:", err.message);
		return sendError(res, "Failed to update RAM status.", {}, 500);
	}
}

async function deleteRam(req, res) {
	try {
		const { id } = req.params;
		const ram = await Ram.findByPk(id);
		if (!ram) {
			return sendError(res, "RAM option not found.", {}, 404);
		}
		await ram.destroy();
		return sendSuccess(res, "RAM option deleted successfully.", { id: Number(id) });
	} catch (err) {
		console.error("[AdminSpec] deleteRam error:", err.message);
		return sendError(res, "Failed to delete RAM option.", {}, 500);
	}
}

// ─────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────

async function listStorages(req, res) {
	try {
		const { page, limit, offset, sortOrder } = buildPagination(req.query);
		const { search, status, sortBy } = req.query;

		const where = {};
		if (status && ["pending", "approved", "rejected"].includes(status)) {
			where.status = status;
		}
		if (search && search.trim()) {
			where.value = { [Op.like]: `%${search.trim()}%` };
		}

		const allowedSort = { value: "value", created_at: "created_at", status: "status" };
		const col = allowedSort[sortBy] || "created_at";

		const { count, rows } = await Storage.findAndCountAll({
			where,
			order: [[col, sortOrder]],
			limit,
			offset,
		});

		return sendSuccess(res, "Storage options retrieved successfully.", {
			data: rows,
			pagination: {
				totalCount: count,
				totalPages: Math.ceil(count / limit),
				currentPage: page,
				limit,
			},
		});
	} catch (err) {
		console.error("[AdminSpec] listStorages error:", err.message);
		return sendError(res, "Failed to fetch storage options.", {}, 500);
	}
}

async function updateStorageStatus(req, res) {
	try {
		const { id } = req.params;
		const { status } = req.body;

		if (!["approved", "rejected"].includes(status)) {
			return sendError(res, "Invalid status. Must be 'approved' or 'rejected'.", {}, 400);
		}

		const storage = await Storage.findByPk(id);
		if (!storage) {
			return sendError(res, "Storage option not found.", {}, 404);
		}

		storage.status = status;
		await storage.save();

		return sendSuccess(res, `Storage option ${status} successfully.`, { storage });
	} catch (err) {
		console.error("[AdminSpec] updateStorageStatus error:", err.message);
		return sendError(res, "Failed to update storage status.", {}, 500);
	}
}

async function deleteStorage(req, res) {
	try {
		const { id } = req.params;
		const storage = await Storage.findByPk(id);
		if (!storage) {
			return sendError(res, "Storage option not found.", {}, 404);
		}
		await storage.destroy();
		return sendSuccess(res, "Storage option deleted successfully.", { id: Number(id) });
	} catch (err) {
		console.error("[AdminSpec] deleteStorage error:", err.message);
		return sendError(res, "Failed to delete storage option.", {}, 500);
	}
}

// ─────────────────────────────────────────────
// MODELS (device models — vendor-created)
// ─────────────────────────────────────────────

async function listModels(req, res) {
	try {
		const { page, limit, offset, sortOrder } = buildPagination(req.query);
		const { search, brandId, sortBy } = req.query;

		const where = {};
		if (brandId) where.brand_id = brandId;
		if (search && search.trim()) {
			where.name = { [Op.like]: `%${search.trim()}%` };
		}

		const allowedSort = { name: "name", created_at: "created_at" };
		const col = allowedSort[sortBy] || "created_at";

		const { count, rows } = await Model.findAndCountAll({
			where,
			include: [
				{ model: Brand, as: "brand", attributes: ["id", "name"] },
				{ model: Vendor, as: "vendor", attributes: ["id", "name", "email", "profile_img"] },
			],
			order: [[col, sortOrder]],
			limit,
			offset,
		});

		const formatted = rows.map((m) => ({
			id: m.id,
			name: m.name,
			slug: m.slug,
			brand_id: m.brand_id,
			brand_name: m.brand ? m.brand.name : "—",
			vendor_id: m.vendor_id,
			vendor_name: m.vendor ? m.vendor.name : "Global",
			vendor_email: m.vendor ? m.vendor.email : null,
			vendor_profile_img: m.vendor ? m.vendor.profile_img : null,
			created_at: m.created_at,
		}));

		return sendSuccess(res, "Models retrieved successfully.", {
			data: formatted,
			pagination: {
				totalCount: count,
				totalPages: Math.ceil(count / limit),
				currentPage: page,
				limit,
			},
		});
	} catch (err) {
		console.error("[AdminSpec] listModels error:", err.message);
		return sendError(res, "Failed to fetch models.", {}, 500);
	}
}

async function deleteModel(req, res) {
	try {
		const { id } = req.params;
		const model = await Model.findByPk(id);
		if (!model) {
			return sendError(res, "Model not found.", {}, 404);
		}
		await model.destroy();
		return sendSuccess(res, "Model deleted successfully.", { id: Number(id) });
	} catch (err) {
		console.error("[AdminSpec] deleteModel error:", err.message);
		return sendError(res, "Failed to delete model.", {}, 500);
	}
}

async function updateModel(req, res) {
	try {
		const { id } = req.params;
		const { name, brand_id } = req.body;
		const model = await Model.findByPk(id);
		if (!model) {
			return sendError(res, "Model not found.", {}, 404);
		}

		const targetName = name !== undefined ? name.trim() : model.name;
		const targetBrandId = brand_id !== undefined ? brand_id : model.brand_id;

		const existing = await Model.findOne({
			where: {
				brand_id: targetBrandId,
				name: targetName,
				id: { [Op.ne]: id }
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

		if (name !== undefined) {
			const { slugify } = require("../../utils/stringHelper");
			model.name = name.trim();
			model.slug = slugify(name);
		}

		if (brand_id !== undefined) {
			// Verify brand exists
			const brand = await Brand.findByPk(brand_id);
			if (!brand) {
				return sendError(res, "Brand not found.", {}, 400);
			}
			model.brand_id = brand_id;
		}

		await model.save();

		// Fetch model again with association to return clean payload
		const updated = await Model.findByPk(id, {
			include: [
				{ model: Brand, as: "brand", attributes: ["id", "name"] },
				{ model: Vendor, as: "vendor", attributes: ["id", "name", "email"] },
			],
		});

		const formatted = {
			id: updated.id,
			name: updated.name,
			slug: updated.slug,
			brand_id: updated.brand_id,
			brand_name: updated.brand ? updated.brand.name : "—",
			vendor_id: updated.vendor_id,
			vendor_name: updated.vendor ? updated.vendor.name : "Global",
			vendor_email: updated.vendor ? updated.vendor.email : null,
			created_at: updated.created_at,
		};

		return sendSuccess(res, "Model updated successfully.", { model: formatted });
	} catch (err) {
		console.error("[AdminSpec] updateModel error:", err.message);
		return sendError(res, "Failed to update model.", {}, 500);
	}
}

// ─────────────────────────────────────────────
// SUMMARY COUNTS
// ─────────────────────────────────────────────

async function getSpecSummary(req, res) {
	try {
		const [
			brandPending, brandApproved, brandRejected,
			ramPending, ramApproved, ramRejected,
			storagePending, storageApproved, storageRejected,
			totalModels,
		] = await Promise.all([
			Brand.count({ where: { status: "pending" } }),
			Brand.count({ where: { status: "approved" } }),
			Brand.count({ where: { status: "rejected" } }),
			Ram.count({ where: { status: "pending" } }),
			Ram.count({ where: { status: "approved" } }),
			Ram.count({ where: { status: "rejected" } }),
			Storage.count({ where: { status: "pending" } }),
			Storage.count({ where: { status: "approved" } }),
			Storage.count({ where: { status: "rejected" } }),
			Model.count(),
		]);

		return sendSuccess(res, "Specification summary retrieved.", {
			summary: {
				brands: { pending: brandPending, approved: brandApproved, rejected: brandRejected },
				rams: { pending: ramPending, approved: ramApproved, rejected: ramRejected },
				storages: { pending: storagePending, approved: storageApproved, rejected: storageRejected },
				models: { total: totalModels },
				totalPending: brandPending + ramPending + storagePending,
			},
		});
	} catch (err) {
		console.error("[AdminSpec] getSpecSummary error:", err.message);
		return sendError(res, "Failed to fetch specification summary.", {}, 500);
	}
}

module.exports = {
	listBrands,
	updateBrandStatus,
	deleteBrand,
	listRams,
	updateRamStatus,
	deleteRam,
	listStorages,
	updateStorageStatus,
	deleteStorage,
	listModels,
	updateModel,
	deleteModel,
	getSpecSummary,
};
