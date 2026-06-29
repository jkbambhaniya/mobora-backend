const { Mobile, Brand, Model, Storage, Ram, Transaction, Customer, MobileStock, Vendor, BusinessDetail, Repair, sequelize } = require("../../models");
const { Op } = require("sequelize");
const { sendSuccess, sendError } = require("../../utils/responseHelper");

/**
 * Format a database record to the API response shape compatible with admin frontend types.
 */
function formatMobile(stockRecord) {
	if (!stockRecord) return null;
	const m = stockRecord.mobile || {};
	
	const sortedTxs = m.transactions
		? [...m.transactions].sort((a, b) => Number(b.id) - Number(a.id))
		: [];

	const purchaseTx = sortedTxs.find(tx => tx.type === "Purchase" && tx.vendor_id === stockRecord.vendor_id);
	const saleTx = sortedTxs.find(tx => tx.type === "Sale" && tx.vendor_id === stockRecord.vendor_id);

	const purchasePrice = purchaseTx ? purchaseTx.amount : undefined;
	const price = stockRecord.status === "Sold" && saleTx
		? saleTx.amount
		: (purchasePrice ? Math.round(purchasePrice * 1.2) : 0);

	return {
		id: m.id ? m.id.toString() : "",
		stockId: stockRecord.id.toString(),
		brand: m.brand ? m.brand.name : "",
		brandId: m.brand_id,
		model: m.model ? m.model.name : "",
		modelId: m.model_id,
		storage: m.storage ? m.storage.value : "",
		storageId: m.storage_id,
		ram: m.ram ? m.ram.value : "",
		ramId: m.ram_id,
		color: m.color || "",
		imei: m.imei || undefined,
		condition: m.condition || "NEW",
		price: price,
		purchasePrice: purchasePrice,
		repairingCost: stockRecord.repairing_cost || 0,
		batteryHealth: m.battery_health,
		status: stockRecord.status || "Available",
		description: m.description || "",
		createdAt: stockRecord.created_at,
		vendor: stockRecord.vendor ? {
			id: stockRecord.vendor.id,
			name: stockRecord.vendor.name,
			email: stockRecord.vendor.email,
			shopName: stockRecord.vendor.businessDetail ? stockRecord.vendor.businessDetail.shop_name : "",
		} : null
	};
}

/**
 * List all mobile devices in stock (across all vendors) grouped uniquely by Mobile specs (IMEI-wise).
 */
async function listMobiles(req, res) {
	try {
		const {
			search,
			brand,
			model,
			condition,
			sortBy,
			sortOrder = "desc",
			page = 1,
			limit = 10,
		} = req.query;

		const offset = (Number(page) - 1) * Number(limit);
		const where = {};

		// Filters on Mobile specification table
		if (condition && condition !== "All") {
			where.condition = condition;
		}

		if (brand && brand !== "All" && !isNaN(Number(brand))) {
			where.brand_id = Number(brand);
		}

		if (model && model !== "All" && !isNaN(Number(model))) {
			where.model_id = Number(model);
		}

		// Search across IMEI, color, brand, model
		if (search) {
			const searchQuery = `%${search}%`;
			where[Op.or] = [
				{ "color": { [Op.like]: searchQuery } },
				{ "imei": { [Op.like]: searchQuery } },
				{ "$brand.name$": { [Op.like]: searchQuery } },
				{ "$model.name$": { [Op.like]: searchQuery } },
			];
		}

		// Ordering
		let orderClause = [["id", "DESC"]];
		if (sortBy) {
			const direction = sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC";
			if (sortBy === "color") {
				orderClause = [["color", direction]];
			} else if (sortBy === "imei") {
				orderClause = [["imei", direction]];
			} else if (sortBy === "condition") {
				orderClause = [["condition", direction]];
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
			attributes: [
				'brand_id',
				'model_id',
				'storage_id',
				'ram_id',
				'color',
				[sequelize.fn('COUNT', sequelize.col('Mobile.id')), 'totalUnits'],
				[sequelize.fn('MIN', sequelize.col('Mobile.id')), 'id'],
				[sequelize.fn('MAX', sequelize.col('Mobile.condition')), 'condition'],
			],
			include: [
				{ model: Brand, as: "brand", attributes: ["name"] },
				{ model: Model, as: "model", attributes: ["name"] },
				{ model: Storage, as: "storage", attributes: ["value"] },
				{ model: Ram, as: "ram", attributes: ["value"] },
			],
			group: ['brand_id', 'model_id', 'storage_id', 'ram_id', 'color'],
			order: orderClause,
			limit: Number(limit),
			offset: Number(offset),
			subQuery: false,
		});

		const totalCount = Array.isArray(count) ? count.length : count;

		const formatted = rows.map(m => {
			const data = m.get({ plain: true });
			return {
				id: data.id.toString(),
				brand: m.brand ? m.brand.name : "",
				brandId: m.brand_id,
				brandSlug: m.brand?.slug || slugify(m.brand?.name),
				model: m.model ? m.model.name : "",
				modelId: m.model_id,
				modelSlug: m.model?.slug || slugify(m.model?.name),
				storage: m.storage ? m.storage.value : "",
				storageId: m.storage_id,
				ram: m.ram ? m.ram.value : "",
				ramId: m.ram_id,
				color: m.color || "",
				condition: data.condition || "NEW",
				totalUnits: Number(data.totalUnits) || 1,
				createdAt: m.created_at,
			};
		});

		return sendSuccess(res, "Mobiles list retrieved successfully.", {
			mobiles: formatted,
			pagination: {
				totalCount: totalCount,
				totalPages: Math.ceil(totalCount / limit),
				currentPage: Number(page),
				limit: Number(limit),
			}
		});
	} catch (error) {
		console.error("[AdminMobileController] listMobiles error:", error.message);
		return sendError(res, "Internal server error retrieving mobiles list.", {}, 500);
	}
}

function slugify(text) {
	if (!text) return "";
	return text.toString().toLowerCase().trim()
		.replace(/\s+/g, '-')           // Replace spaces with -
		.replace(/[^\w\-]+/g, '')       // Remove all non-word chars
		.replace(/\-\-+/g, '-');        // Replace multiple - with single -
}

/**
 * Get metrics for mobile inventory.
 */
async function getMobileStats(req, res) {
	try {
		const totalCount = await MobileStock.count();
		const availableCount = await MobileStock.count({ where: { status: "Available" } });
		const soldCount = await MobileStock.count({ where: { status: "Sold" } });
		const reviewCount = await MobileStock.count({ where: { status: "Review" } });
		
		// Sum of repairing cost
		const repairSums = await MobileStock.sum("repairing_cost") || 0;

		return sendSuccess(res, "Admin mobile statistics retrieved successfully.", {
			stats: {
				total: totalCount,
				available: availableCount,
				sold: soldCount,
				review: reviewCount,
				totalRepairingCost: repairSums
			}
		});
	} catch (error) {
		console.error("[AdminMobileController] getMobileStats error:", error.message);
		return sendError(res, "Internal server error retrieving metrics.", {}, 500);
	}
}

/**
 * Get detailed view of a specific mobile.
 */
async function getMobileById(req, res) {
	try {
		const { id } = req.params; // stockId
		
		const stockRecord = await MobileStock.findByPk(id, {
			include: [
				{
					model: Mobile,
					as: "mobile",
					include: [
						{ model: Brand, as: "brand", attributes: ["name"] },
						{ model: Model, as: "model", attributes: ["name"] },
						{ model: Storage, as: "storage", attributes: ["value"] },
						{ model: Ram, as: "ram", attributes: ["value"] },
						{
							model: Transaction,
							as: "transactions",
							include: [
								{ model: Customer, as: "customer", attributes: ["name", "phone", "email"] },
								{ model: Vendor, as: "vendor", attributes: ["name"] }
							]
						}
					]
				},
				{
					model: Vendor,
					as: "vendor",
					include: [
						{ model: BusinessDetail, as: "businessDetail" }
					]
				}
			]
		});

		if (!stockRecord) {
			return sendError(res, "Mobile stock entry not found.", {}, 404);
		}

		// Also check if there are repairs associated with this vendor & mobile
		const repairs = await Repair.findAll({
			where: {
				vendor_id: stockRecord.vendor_id,
				[Op.or]: [
					{ device_model: { [Op.like]: `%${stockRecord.mobile?.model?.name}%` } }
				]
			}
		});

		const formattedMobile = formatMobile(stockRecord);
		
		// Include full nested details
		const responseData = {
			...formattedMobile,
			description: stockRecord.mobile?.description || "",
			transactions: stockRecord.mobile?.transactions || [],
			repairs: repairs || [],
			vendorDetails: stockRecord.vendor ? {
				id: stockRecord.vendor.id,
				name: stockRecord.vendor.name,
				email: stockRecord.vendor.email,
				shopName: stockRecord.vendor.businessDetail?.shop_name || "",
				phone: stockRecord.vendor.businessDetail?.phone || "",
				address: stockRecord.vendor.businessDetail?.address || "",
			} : null
		};

		return sendSuccess(res, "Mobile detail retrieved successfully.", { mobile: responseData });
	} catch (error) {
		console.error("[AdminMobileController] getMobileById error:", error.message);
		return sendError(res, "Internal server error retrieving mobile details.", {}, 500);
	}
}

/**
 * Get all vendor stocks for a specific Mobile record by mobileId.
 */
async function getMobileStocksByMobileId(req, res) {
	try {
		const { id } = req.params; // mobileId
		
		const mobile = await Mobile.findByPk(id, {
			include: [
				{ model: Brand, as: "brand", attributes: ["name"] },
				{ model: Model, as: "model", attributes: ["name"] },
				{ model: Storage, as: "storage", attributes: ["value"] },
				{ model: Ram, as: "ram", attributes: ["value"] },
			]
		});

		if (!mobile) {
			return sendError(res, "Mobile device not found.", {}, 404);
		}

		const stocks = await MobileStock.findAll({
			include: [
				{
					model: Vendor,
					as: "vendor",
					attributes: ["id", "name", "email"],
					include: [
						{ model: BusinessDetail, as: "businessDetail", attributes: ["shop_name"] }
					]
				},
				{
					model: Mobile,
					as: "mobile",
					required: true,
					where: {
						brand_id: mobile.brand_id,
						model_id: mobile.model_id,
						storage_id: mobile.storage_id,
						ram_id: mobile.ram_id,
						color: mobile.color,
					},
					include: [
						{
							model: Transaction,
							as: "transactions",
						}
					]
				}
			],
			order: [["id", "DESC"]]
		});

		const formattedStocks = stocks.map(stock => {
			const sortedTxs = stock.mobile?.transactions
				? [...stock.mobile.transactions].sort((a, b) => Number(b.id) - Number(a.id))
				: [];

			const purchaseTx = sortedTxs.find(tx => tx.type === "Purchase" && tx.vendor_id === stock.vendor_id);
			const saleTx = sortedTxs.find(tx => tx.type === "Sale" && tx.vendor_id === stock.vendor_id);

			const purchasePrice = purchaseTx ? purchaseTx.amount : undefined;
			const price = stock.status === "Sold" && saleTx
				? saleTx.amount
				: (purchasePrice ? Math.round(purchasePrice * 1.2) : 0);

			return {
				stockId: stock.id.toString(),
				status: stock.status,
				repairingCost: stock.repairing_cost,
				price: price,
				purchasePrice: purchasePrice,
				createdAt: stock.created_at,
				vendor: stock.vendor ? {
					id: stock.vendor.id,
					name: stock.vendor.name,
					email: stock.vendor.email,
					shopName: stock.vendor.businessDetail ? stock.vendor.businessDetail.shop_name : "",
				} : null
			};
		});

		return sendSuccess(res, "Device stocks retrieved successfully.", {
			mobile: {
				id: mobile.id.toString(),
				brand: mobile.brand?.name || "",
				model: mobile.model?.name || "",
				storage: mobile.storage?.value || "",
				ram: mobile.ram?.value || "",
				color: mobile.color || "",
				imei: mobile.imei,
				condition: mobile.condition,
				batteryHealth: mobile.battery_health,
				description: mobile.description,
			},
			stocks: formattedStocks
		});
	} catch (error) {
		console.error("[AdminMobileController] getMobileStocksByMobileId error:", error.message);
		return sendError(res, "Internal server error retrieving device stocks.", {}, 500);
	}
}

/**
 * Update stock status or repairing cost.
 */
async function updateMobileStockStatus(req, res) {
	try {
		const { id } = req.params; // stockId
		const { status, repairingCost } = req.body;

		const stockRecord = await MobileStock.findByPk(id);
		if (!stockRecord) {
			return sendError(res, "Mobile stock entry not found.", {}, 404);
		}

		if (status) {
			const validStatuses = ["Available", "Sold", "Review", "Transit", "Pending", "Shipped", "Cancelled"];
			if (!validStatuses.includes(status)) {
				return sendError(res, `Invalid status value. Allowed: ${validStatuses.join(", ")}`, {}, 400);
			}
			stockRecord.status = status;
		}

		if (repairingCost !== undefined) {
			stockRecord.repairing_cost = Number(repairingCost);
		}

		await stockRecord.save();

		return sendSuccess(res, "Mobile stock entry updated successfully.", {
			id: stockRecord.id,
			status: stockRecord.status,
			repairingCost: stockRecord.repairing_cost
		});
	} catch (error) {
		console.error("[AdminMobileController] updateMobileStockStatus error:", error.message);
		return sendError(res, "Internal server error updating stock entry.", {}, 500);
	}
}

/**
 * Delete a mobile stock entry from the system.
 */
async function deleteMobileStock(req, res) {
	const t = await sequelize.transaction();
	try {
		const { id } = req.params; // stockId

		const stockRecord = await MobileStock.findByPk(id, { transaction: t });
		if (!stockRecord) {
			await t.rollback();
			return sendError(res, "Mobile stock entry not found.", {}, 404);
		}

		const mobileId = stockRecord.mobile_id;

		// Delete the stock entry
		await stockRecord.destroy({ transaction: t });

		// Check if any other stock entries exist for this specific Mobile record.
		// If none, we can clean up the Mobile record too.
		const otherStocks = await MobileStock.count({ where: { mobile_id: mobileId }, transaction: t });
		if (otherStocks === 0) {
			await Mobile.destroy({ where: { id: mobileId }, transaction: t });
		}

		await t.commit();
		return sendSuccess(res, "Mobile stock entry deleted successfully.", { id: Number(id) });
	} catch (error) {
		await t.rollback();
		console.error("[AdminMobileController] deleteMobileStock error:", error.message);
		return sendError(res, "Internal server error deleting stock entry.", {}, 500);
	}
}

/**
 * Get device configuration and stock listings by brand slug and model slug.
 */
async function getMobileStocksBySlug(req, res) {
	try {
		const { brandSlug, modelSlug } = req.params;
		
		// Find brand
		const brand = await Brand.findOne({ where: { slug: brandSlug } });
		if (!brand) {
			return sendError(res, "Brand not found.", {}, 404);
		}

		// Find model
		const model = await Model.findOne({ 
			where: { 
				slug: modelSlug,
				brand_id: brand.id
			} 
		});
		if (!model) {
			return sendError(res, "Model not found.", {}, 404);
		}

		// Find all MobileStock records for this brand & model configuration
		const stocks = await MobileStock.findAll({
			include: [
				{
					model: Vendor,
					as: "vendor",
					attributes: ["id", "name", "email"],
					include: [
						{ model: BusinessDetail, as: "businessDetail", attributes: ["shop_name"] }
					]
				},
				{
					model: Mobile,
					as: "mobile",
					required: true,
					where: {
						brand_id: brand.id,
						model_id: model.id,
					},
					include: [
						{ model: Brand, as: "brand", attributes: ["name"] },
						{ model: Model, as: "model", attributes: ["name"] },
						{ model: Storage, as: "storage", attributes: ["value"] },
						{ model: Ram, as: "ram", attributes: ["value"] },
						{
							model: Transaction,
							as: "transactions",
						}
					]
				}
			],
			order: [["id", "DESC"]]
		});

		const representationalMobile = stocks.length > 0 ? stocks[0].mobile : null;

		const formattedStocks = stocks.map(stock => {
			const sortedTxs = stock.mobile?.transactions
				? [...stock.mobile.transactions].sort((a, b) => Number(b.id) - Number(a.id))
				: [];

			const purchaseTx = sortedTxs.find(tx => tx.type === "Purchase" && tx.vendor_id === stock.vendor_id);
			const saleTx = sortedTxs.find(tx => tx.type === "Sale" && tx.vendor_id === stock.vendor_id);

			const purchasePrice = purchaseTx ? purchaseTx.amount : undefined;
			const price = stock.status === "Sold" && saleTx
				? saleTx.amount
				: (purchasePrice ? Math.round(purchasePrice * 1.2) : 0);

			return {
				stockId: stock.id.toString(),
				status: stock.status,
				repairingCost: stock.repairing_cost,
				price: price,
				purchasePrice: purchasePrice,
				createdAt: stock.created_at,
				vendor: stock.vendor ? {
					id: stock.vendor.id,
					name: stock.vendor.name,
					email: stock.vendor.email,
					shopName: stock.vendor.businessDetail ? stock.vendor.businessDetail.shop_name : "",
				} : null,
				mobile: stock.mobile ? {
					color: stock.mobile.color || "",
					condition: stock.mobile.condition || "NEW",
					batteryHealth: stock.mobile.battery_health,
					imei: stock.mobile.imei || "",
				} : null
			};
		});

		return sendSuccess(res, "Device stocks retrieved successfully by slug.", {
			mobile: representationalMobile ? {
				id: representationalMobile.id.toString(),
				brand: brand.name,
				model: model.name,
				storage: representationalMobile.storage?.value || "",
				ram: representationalMobile.ram?.value || "",
				color: representationalMobile.color || "",
				imei: representationalMobile.imei,
				condition: representationalMobile.condition,
				batteryHealth: representationalMobile.battery_health,
				description: representationalMobile.description,
			} : {
				brand: brand.name,
				model: model.name,
				storage: "",
				ram: "",
				color: "",
				condition: "NEW"
			},
			stocks: formattedStocks
		});
	} catch (error) {
		console.error("[AdminMobileController] getMobileStocksBySlug error:", error.message);
		return sendError(res, "Internal server error retrieving device stocks by slug.", {}, 500);
	}
}

/**
 * Fetch a single mobile stock entry details using its IMEI number.
 */
async function getMobileStockByImei(req, res) {
	try {
		const { imei } = req.params;
		
		const stockRecord = await MobileStock.findOne({
			include: [
				{
					model: Mobile,
					as: "mobile",
					required: true,
					where: { imei },
					include: [
						{ model: Brand, as: "brand", attributes: ["name"] },
						{ model: Model, as: "model", attributes: ["name"] },
						{ model: Storage, as: "storage", attributes: ["value"] },
						{ model: Ram, as: "ram", attributes: ["value"] },
						{
							model: Transaction,
							as: "transactions",
							include: [
								{ model: Customer, as: "customer", attributes: ["name", "phone", "email"] },
								{ model: Vendor, as: "vendor", attributes: ["name"] }
							]
						}
					]
				},
				{
					model: Vendor,
					as: "vendor",
					include: [
						{ model: BusinessDetail, as: "businessDetail" }
					]
				}
			]
		});

		if (!stockRecord) {
			return sendError(res, "Mobile stock entry not found for the specified IMEI.", {}, 404);
		}

		// Also check if there are repairs associated with this vendor & mobile
		const repairs = await Repair.findAll({
			where: {
				vendor_id: stockRecord.vendor_id,
				[Op.or]: [
					{ device_model: { [Op.like]: `%${stockRecord.mobile?.model?.name}%` } }
				]
			}
		});

		const formattedMobile = formatMobile(stockRecord);
		
		const responseData = {
			...formattedMobile,
			description: stockRecord.mobile?.description || "",
			transactions: stockRecord.mobile?.transactions || [],
			repairs: repairs || [],
			vendorDetails: stockRecord.vendor ? {
				id: stockRecord.vendor.id,
				name: stockRecord.vendor.name,
				email: stockRecord.vendor.email,
				shopName: stockRecord.vendor.businessDetail?.shop_name || "",
				phone: stockRecord.vendor.businessDetail?.phone || "",
				address: stockRecord.vendor.businessDetail?.address || "",
			} : null
		};

		return sendSuccess(res, "Mobile details retrieved successfully by IMEI.", { mobile: responseData });
	} catch (error) {
		console.error("[AdminMobileController] getMobileStockByImei error:", error.message);
		return sendError(res, "Internal server error retrieving mobile details by IMEI.", {}, 500);
	}
}

module.exports = {
	listMobiles,
	getMobileStats,
	getMobileById,
	getMobileStocksByMobileId,
	getMobileStocksBySlug,
	getMobileStockByImei,
	updateMobileStockStatus,
	deleteMobileStock,
};
