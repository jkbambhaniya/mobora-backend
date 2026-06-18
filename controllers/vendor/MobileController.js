const { Mobile, Brand, Model, Storage, Ram, Transaction, sequelize } = require("../../models");
const { Op } = require("sequelize");
const { sendSuccess, sendError } = require("../../utils/responseHelper");

/**
 * Format a database record to the API response shape compatible with frontend types.
 */
function formatMobile(m) {
	const sortedTxs = m.transactions
		? [...m.transactions].sort((a, b) => Number(b.id) - Number(a.id))
		: [];

	const purchaseTx = sortedTxs.find(tx => tx.type === "Purchase");
	const saleTx = sortedTxs.find(tx => tx.type === "Sale");

	const purchasePrice = purchaseTx ? purchaseTx.amount : undefined;
	const price = m.status === "Sold" && saleTx
		? saleTx.amount
		: (purchasePrice ? Math.round(purchasePrice * 1.2) : 0);

	return {
		id: m.id.toString(),
		brand: m.brand ? m.brand.name : "",
		brandId: m.brand_id,
		model: m.model ? m.model.name : "",
		modelId: m.model_id,
		storage: m.storage ? m.storage.value : "",
		storageId: m.storage_id,
		ram: m.ram ? m.ram.value : "",
		ramId: m.ram_id,
		color: m.color,
		imei: m.imei || undefined,
		condition: m.condition,
		price: price,
		purchasePrice: purchasePrice,
		stock: 1, // Each listing is tracked by IMEI and has a stock count of 1
		batteryHealth: m.battery_health,
		status: m.status,
		description: m.description || "",
		createdAt: m.created_at,
	};
}

/**
 * Get all mobiles for the logged-in vendor.
 */
async function getMobiles(req, res) {
	try {
		const vendorId = req.user.id;
		const {
			search,
			brand,
			model,
			status,
			condition,
			sortBy,
			sortOrder = "asc",
			page = 1,
			limit = 100, // Default to a larger limit to load full dataset if pagination is not specified
		} = req.query;

		const offset = (Number(page) - 1) * Number(limit);
		const where = { vendor_id: vendorId };

		// Filters
		if (status && status !== "All") {
			where.status = status;
		}

		if (condition && condition !== "All") {
			where.condition = condition;
		}

		if (brand && brand !== "All") {
			// supports both ID and name checks
			if (isNaN(Number(brand))) {
				// Search by name (via Brand association)
			} else {
				where.brand_id = Number(brand);
			}
		}

		if (model && model !== "All") {
			if (isNaN(Number(model))) {
				// Search by name (via Model association)
			} else {
				where.model_id = Number(model);
			}
		}

		// Search filter (searches in color, imei, and associated brand/model names)
		const include = [
			{ model: Brand, as: "brand", attributes: ["name"] },
			{ model: Model, as: "model", attributes: ["name"] },
			{ model: Storage, as: "storage", attributes: ["value"] },
			{ model: Ram, as: "ram", attributes: ["value"] },
			{ model: Transaction, as: "transactions", attributes: ["id", "type", "amount"] },
		];

		if (search) {
			const searchQuery = `%${search}%`;
			where[Op.and] = [
				{
					[Op.or]: [
						{ color: { [Op.like]: searchQuery } },
						{ imei: { [Op.like]: searchQuery } },
						{ "$brand.name$": { [Op.like]: searchQuery } },
						{ "$model.name$": { [Op.like]: searchQuery } },
					],
				},
			];
		}

		// Sorting mappings
		let orderClause = [["id", "DESC"]];
		if (sortBy) {
			const direction = sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC";
			if (sortBy === "color") {
				orderClause = [["color", direction]];
			} else if (sortBy === "imei") {
				orderClause = [["imei", direction]];
			} else if (sortBy === "condition") {
				orderClause = [["condition", direction]];
			} else if (sortBy === "batteryHealth") {
				orderClause = [["battery_health", direction]];
			} else if (sortBy === "createdAt") {
				orderClause = [["created_at", direction]];
			} else if (sortBy === "brand") {
				orderClause = [[{ model: Brand, as: "brand" }, "name", direction]];
			} else if (sortBy === "model") {
				orderClause = [[{ model: Model, as: "model" }, "name", direction]];
			}
		}

		const { count, rows } = await Mobile.findAndCountAll({
			where,
			include,
			order: (sortBy === "price" || sortBy === "purchasePrice") ? [["id", "DESC"]] : orderClause,
			limit: Number(limit),
			offset: Number(offset),
		});

		// Secondary check for filters on associated tables if string value matches are queried
		let filteredRows = rows;
		let finalCount = count;

		if (brand && isNaN(Number(brand)) && brand !== "All") {
			filteredRows = filteredRows.filter(
				(r) => r.brand && r.brand.name.toLowerCase() === brand.toLowerCase(),
			);
			finalCount = filteredRows.length;
		}

		if (model && isNaN(Number(model)) && model !== "All") {
			filteredRows = filteredRows.filter(
				(r) => r.model && r.model.name.toLowerCase() === model.toLowerCase(),
			);
			finalCount = filteredRows.length;
		}

		let formatted = filteredRows.map(formatMobile);

		if (sortBy === "price" || sortBy === "purchasePrice") {
			const direction = sortOrder.toUpperCase() === "DESC" ? -1 : 1;
			formatted.sort((a, b) => {
				const valA = a[sortBy] || 0;
				const valB = b[sortBy] || 0;
				return (valA - valB) * direction;
			});
		}

		return sendSuccess(res, "Mobiles retrieved successfully.", {
			mobiles: formatted,
			total: finalCount,
			page: Number(page),
			limit: Number(limit),
		});
	} catch (error) {
		console.error("[MobileController] getMobiles error:", error.message);
		return sendError(res, "Internal server error retrieving mobiles.", {}, 500);
	}
}

/**
 * Get a single mobile.
 */
async function getMobile(req, res) {
	try {
		const { id } = req.params;
		const vendorId = req.user.id;

		const mobile = await Mobile.findOne({
			where: { id, vendor_id: vendorId },
			include: [
				{ model: Brand, as: "brand", attributes: ["name"] },
				{ model: Model, as: "model", attributes: ["name"] },
				{ model: Storage, as: "storage", attributes: ["value"] },
				{ model: Ram, as: "ram", attributes: ["value"] },
				{ model: Transaction, as: "transactions", attributes: ["id", "type", "amount"] },
			],
		});

		if (!mobile) {
			return sendError(res, "Mobile not found.", {}, 404);
		}

		return sendSuccess(res, "Mobile retrieved successfully.", {
			mobile: formatMobile(mobile),
		});
	} catch (error) {
		console.error("[MobileController] getMobile error:", error.message);
		return sendError(res, "Internal server error retrieving mobile.", {}, 500);
	}
}

/**
 * Create a new mobile.
 */
async function createMobile(req, res) {
	const t = await sequelize.transaction();
	try {
		const vendorId = req.user.id;
		const {
			brand_id,
			model_id,
			storage_id,
			ram_id,
			color,
			imei,
			condition,
			price,
			purchase_price,
			battery_health,
			status,
			description,
			customer_id,
		} = req.body;

		// Check duplicate IMEI if provided
		if (imei) {
			const existing = await Mobile.findOne({ where: { imei } });
			if (existing) {
				await t.rollback();
				return sendError(
					res,
					"A device with this IMEI is already registered in stock.",
					{ imei: "IMEI already exists." },
					409,
				);
			}
		}

		const newMobile = await Mobile.create({
			vendor_id: vendorId,
			brand_id,
			model_id,
			storage_id,
			ram_id,
			color,
			imei: imei || null,
			condition,
			battery_health: battery_health !== undefined ? battery_health : null,
			status: status || "Active",
			description: description || null,
		}, { transaction: t });

		// Create corresponding Purchase transaction
		const purchaseAmount = purchase_price ? Number(purchase_price) : 0;
		await Transaction.create({
			vendor_id: vendorId,
			customer_id: customer_id ? Number(customer_id) : null,
			mobile_id: newMobile.id,
			type: "Purchase",
			amount: purchaseAmount,
			date: new Date().toISOString().split("T")[0],
			notes: description || "Initial stock registration.",
		}, { transaction: t });

		await t.commit();

		const fetched = await Mobile.findByPk(newMobile.id, {
			include: [
				{ model: Brand, as: "brand", attributes: ["name"] },
				{ model: Model, as: "model", attributes: ["name"] },
				{ model: Storage, as: "storage", attributes: ["value"] },
				{ model: Ram, as: "ram", attributes: ["value"] },
				{ model: Transaction, as: "transactions", attributes: ["id", "type", "amount"] },
			],
		});

		return sendSuccess(
			res,
			"Mobile registered successfully.",
			{ mobile: formatMobile(fetched) },
			201,
		);
	} catch (error) {
		await t.rollback();
		console.error("[MobileController] createMobile error:", error.message);
		return sendError(res, "Internal server error registering mobile device.", {}, 500);
	}
}

/**
 * Update an existing mobile.
 */
async function updateMobile(req, res) {
	try {
		const { id } = req.params;
		const vendorId = req.user.id;
		const updates = { ...req.body };

		// Check if mobile exists and belongs to this vendor
		const mobile = await Mobile.findOne({
			where: { id, vendor_id: vendorId },
		});
		if (!mobile) {
			return sendError(res, "Mobile not found.", {}, 404);
		}

		// Check duplicate IMEI if updated
		if (updates.imei && updates.imei !== mobile.imei) {
			const existing = await Mobile.findOne({
				where: { imei: updates.imei },
			});
			if (existing) {
				return sendError(
					res,
					"A device with this IMEI is already registered in stock.",
					{ imei: "IMEI already exists." },
					409,
				);
			}
		}

		const allowedFields = [
			"brand_id",
			"model_id",
			"storage_id",
			"ram_id",
			"color",
			"imei",
			"condition",
			"battery_health",
			"status",
			"description",
		];

		const filteredUpdates = {};
		for (const field of allowedFields) {
			if (updates[field] !== undefined) {
				filteredUpdates[field] = updates[field];
			}
		}

		await Mobile.update(filteredUpdates, {
			where: { id, vendor_id: vendorId },
		});

		const updated = await Mobile.findOne({
			where: { id, vendor_id: vendorId },
			include: [
				{ model: Brand, as: "brand", attributes: ["name"] },
				{ model: Model, as: "model", attributes: ["name"] },
				{ model: Storage, as: "storage", attributes: ["value"] },
				{ model: Ram, as: "ram", attributes: ["value"] },
				{ model: Transaction, as: "transactions", attributes: ["id", "type", "amount"] },
			],
		});

		return sendSuccess(res, "Mobile updated successfully.", {
			mobile: formatMobile(updated),
		});
	} catch (error) {
		console.error("[MobileController] updateMobile error:", error.message);
		return sendError(res, "Internal server error updating mobile.", {}, 500);
	}
}

/**
 * Delete a mobile.
 */
async function deleteMobile(req, res) {
	try {
		const { id } = req.params;
		const vendorId = req.user.id;

		const affectedRows = await Mobile.destroy({
			where: { id, vendor_id: vendorId },
		});

		if (affectedRows === 0) {
			return sendError(res, "Mobile not found.", {}, 404);
		}

		return sendSuccess(res, "Mobile deleted successfully.", { success: true });
	} catch (error) {
		console.error("[MobileController] deleteMobile error:", error.message);
		return sendError(res, "Internal server error deleting mobile.", {}, 500);
	}
}

/**
 * Get aggregate metrics for the vendor's inventory.
 */
async function getMetrics(req, res) {
	try {
		const vendorId = req.user.id;

		// 1. Total unique models
		const uniqueModelsResult = await Mobile.findOne({
			where: { vendor_id: vendorId },
			attributes: [
				[sequelize.fn("COUNT", sequelize.fn("DISTINCT", sequelize.col("model_id"))), "count"],
			],
			raw: true,
		});

		// 2. Active Inventory units count
		const activeStockResult = await Mobile.count({
			where: { vendor_id: vendorId, status: "Active" },
		});

		// 3. Total units sold
		const totalSoldResult = await Mobile.count({
			where: { vendor_id: vendorId, status: "Sold" },
		});

		// 4. IMEI Logged Count
		const imeiLoggedResult = await Mobile.count({
			where: {
				vendor_id: vendorId,
				imei: { [Op.ne]: null },
			},
		});

		return sendSuccess(res, "Mobile metrics retrieved successfully.", {
			metrics: {
				totalUniqueModels: parseInt(uniqueModelsResult.count || 0, 10),
				activeStock: activeStockResult,
				totalSold: totalSoldResult,
				totalTracedDevices: imeiLoggedResult,
			},
		});
	} catch (error) {
		console.error("[MobileController] getMetrics error:", error.message);
		return sendError(res, "Internal server error retrieving metrics.", {}, 500);
	}
}

module.exports = {
	getMobiles,
	getMobile,
	createMobile,
	updateMobile,
	deleteMobile,
	getMetrics,
};
