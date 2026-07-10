const { Vendor, BusinessDetail, Mobile, Repair, Transaction, Model, Brand, Storage, Ram, Customer } = require("../../models");
const { sendSuccess, sendError } = require("../../utils/responseHelper");
const { Op } = require("sequelize");

/**
 * List all vendors with optional filtering & searching.
 */
async function listVendors(req, res) {
	try {
		const { search, status, page, limit, sortBy, sortOrder } = req.query;

		const pageNum = parseInt(page, 10) || 1;
		const limitNum = parseInt(limit, 10) || 10;
		const offset = (pageNum - 1) * limitNum;

		const whereClause = {};

		if (status) {
			whereClause.status = status;
		}

		if (search) {
			whereClause[Op.or] = [
				{ name: { [Op.like]: `%${search}%` } },
				{ email: { [Op.like]: `%${search}%` } },
				{ '$businessDetail.shop_name$': { [Op.like]: `%${search}%` } }
			];
		}

		// Sorting configuration
		const sortField = sortBy || "created_at";
		const orderDir = (sortOrder || "DESC").toUpperCase();
		let order = [[sortField, orderDir]];
		
		if (sortField === "shop_name") {
			order = [[{ model: BusinessDetail, as: "businessDetail" }, "shop_name", orderDir]];
		} else if (sortField === "phone") {
			order = [[{ model: BusinessDetail, as: "businessDetail" }, "phone", orderDir]];
		}

		const { count, rows } = await Vendor.findAndCountAll({
			where: whereClause,
			include: [{ model: BusinessDetail, as: "businessDetail" }],
			order,
			limit: limitNum,
			offset,
			distinct: true // ensures correct counts with includes
		});

		const totalPages = Math.ceil(count / limitNum);

		return sendSuccess(res, "Dealers retrieved successfully.", { 
			vendors: rows,
			pagination: {
				totalCount: count,
				totalPages,
				currentPage: pageNum,
				limit: limitNum,
				sortBy: sortField,
				sortOrder: orderDir
			}
		});
	} catch (error) {
		console.error("[Admin Vendor] List error:", error.message);
		return sendError(
			res,
			"An internal server error occurred while retrieving dealers.",
			{},
			500,
		);
	}
}

/**
 * Update a vendor's status (pending, active, inactive).
 */
async function updateVendorStatus(req, res) {
	try {
		const { id } = req.params;
		const { status } = req.body;

		if (!["pending", "active", "inactive"].includes(status)) {
			return sendError(res, "Invalid status value. Must be 'pending', 'active', or 'inactive'.", {}, 400);
		}

		const vendor = await Vendor.findByPk(id);
		if (!vendor) {
			return sendError(res, "Dealer not found.", {}, 404);
		}

		vendor.status = status;
		await vendor.save();

		return sendSuccess(res, `Dealer status successfully updated to ${status}.`, {
			vendor: {
				id: vendor.id,
				name: vendor.name,
				email: vendor.email,
				status: vendor.status
			}
		});
	} catch (error) {
		console.error("[Admin Vendor] Status update error:", error.message);
		return sendError(
			res,
			"An internal server error occurred while updating dealer status.",
			{},
			500,
		);
	}
}

/**
 * Get overview dashboard stats for admin.
 */
async function getStats(req, res) {
	try {
		const totalVendors = await Vendor.count();
		const pendingVendors = await Vendor.count({ where: { status: "pending" } });
		const activeVendors = await Vendor.count({ where: { status: "active" } });
		const inactiveVendors = await Vendor.count({ where: { status: "inactive" } });

		const totalMobiles = await Mobile.count();
		const totalRepairs = await Repair.count();
		const totalTransactions = await Transaction.count();
		const totalCustomers = await Customer.count({
			distinct: true,
			col: "phone"
		});

		// Dynamic 6-month growth calculation
		const growth = [];
		const now = new Date();
		for (let i = 5; i >= 0; i--) {
			const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
			const monthName = d.toLocaleString('en-US', { month: 'short' });
			const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

			const vendorsCount = await Vendor.count({
				where: {
					createdAt: {
						[Op.lte]: endOfMonth
					}
				}
			});

			const mobilesCount = await Mobile.count({
				where: {
					createdAt: {
						[Op.lte]: endOfMonth
					}
				}
			});

			growth.push({
				name: monthName,
				vendors: vendorsCount,
				mobiles: mobilesCount
			});
		}

		return sendSuccess(res, "Admin stats retrieved successfully.", {
			stats: {
				totalVendors,
				pendingVendors,
				activeVendors,
				inactiveVendors,
				totalMobiles,
				totalRepairs,
				totalTransactions,
				totalCustomers,
				growth
			}
		});
	} catch (error) {
		console.error("[Admin Stats] Fetch error:", error.message);
		return sendError(
			res,
			"An internal server error occurred while retrieving admin dashboard statistics.",
			{},
			500,
		);
	}
}

/**
 * Update basic details of a vendor and their associated business details.
 */
async function updateVendor(req, res) {
	try {
		const { id } = req.params;
		const { name, email, shop_name, phone, address, profile_img } = req.body;

		const vendor = await Vendor.findByPk(id, {
			include: [{ model: BusinessDetail, as: "businessDetail" }]
		});

		if (!vendor) {
			return sendError(res, "Vendor not found.", {}, 404);
		}

		if (name) vendor.name = name;
		if (profile_img !== undefined) vendor.profile_img = profile_img;
		if (email) {
			// Check if email is already taken by another vendor
			const existing = await Vendor.findOne({ where: { email, id: { [Op.ne]: id } } });
			if (existing) {
				return sendError(res, "Email address is already in use by another dealer.", {}, 400);
			}
			vendor.email = email;
		}
		await vendor.save();

		// Update or create associated business details
		if (vendor.businessDetail) {
			if (shop_name !== undefined) vendor.businessDetail.shop_name = shop_name;
			if (phone !== undefined) vendor.businessDetail.phone = phone;
			if (address !== undefined) vendor.businessDetail.address = address;
			await vendor.businessDetail.save();
		} else if (shop_name !== undefined || phone !== undefined || address !== undefined) {
			await BusinessDetail.create({
				vendor_id: vendor.id,
				shop_name: shop_name || "",
				phone: phone || "",
				address: address || "",
			});
		}

		// Reload vendor to return fresh details
		const updatedVendor = await Vendor.findByPk(id, {
			include: [{ model: BusinessDetail, as: "businessDetail" }]
		});

		return sendSuccess(res, "Dealer updated successfully.", { vendor: updatedVendor });
	} catch (error) {
		console.error("[Admin Vendor] Update error:", error.message);
		return sendError(res, "An internal server error occurred while updating the dealer.", {}, 500);
	}
}

/**
 * Delete a vendor.
 */
async function deleteVendor(req, res) {
	try {
		const { id } = req.params;
		const vendor = await Vendor.findByPk(id);

		if (!vendor) {
			return sendError(res, "Dealer not found.", {}, 404);
		}

		await vendor.destroy();
		return sendSuccess(res, "Dealer deleted successfully.", { id: Number(id) });
	} catch (error) {
		console.error("[Admin Vendor] Delete error:", error.message);
		return sendError(res, "An internal server error occurred while deleting the dealer.", {}, 500);
	}
}

/**
 * Get vendor details by ID.
 */
async function getVendorById(req, res) {
	try {
		const { id } = req.params;
		const vendor = await Vendor.findByPk(id, {
			include: [
				{ model: BusinessDetail, as: "businessDetail" },
				{
					model: Mobile,
					as: "mobiles",
					include: [
						{ model: Brand, as: "brand", attributes: ["name"] },
						{ model: Model, as: "model", attributes: ["id", "name", "slug", "created_at"] },
						{ model: Storage, as: "storage", attributes: ["value"] },
						{ model: Ram, as: "ram", attributes: ["value"] },
						{ model: Transaction, as: "transactions", attributes: ["id", "type", "amount"] }
					]
				},
				{
					model: Transaction,
					as: "transactions",
					include: [
						{
							model: Mobile,
							as: "mobile",
							include: [
								{ model: Brand, as: "brand", attributes: ["name"] },
								{ model: Model, as: "model", attributes: ["name"] }
							]
						},
						{ model: Customer, as: "customer", attributes: ["name"] }
					]
				},
				{ model: Repair, as: "repairs" }
			]
		});

		if (!vendor) {
			return sendError(res, "Dealer not found.", {}, 404);
		}

		// Dynamically construct models array from mobiles in inventory
		const modelsMap = new Map();
		if (vendor.mobiles) {
			vendor.mobiles.forEach((mobile) => {
				if (mobile.model) {
					modelsMap.set(mobile.model.id, {
						id: mobile.model.id,
						name: mobile.model.name,
						slug: mobile.model.slug,
						brand_id: mobile.brand_id,
						brand: mobile.brand ? { name: mobile.brand.name } : null,
						created_at: mobile.model.created_at
					});
				}
			});
		}

		const vendorJson = vendor.toJSON();
		vendorJson.models = Array.from(modelsMap.values());

		return sendSuccess(res, "Dealer details retrieved successfully.", { vendor: vendorJson });
	} catch (error) {
		console.error("[Admin Vendor] Fetch by ID error:", error.message);
		return sendError(res, "An internal server error occurred while retrieving dealer details.", {}, 500);
	}
}

module.exports = {
	listVendors,
	updateVendorStatus,
	getStats,
	updateVendor,
	deleteVendor,
	getVendorById
};
