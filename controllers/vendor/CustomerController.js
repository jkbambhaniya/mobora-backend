const fs = require("fs");
const path = require("path");
const { Customer, sequelize } = require("../../models");
const { Op } = require("sequelize");
const { sendSuccess, sendError } = require("../../utils/responseHelper");
const { saveBase64File } = require("../../utils/fileUploadHelper");

/**
 * Format database record to API response shape
 */
function formatCustomer(c) {
	return {
		id: c.id.toString(),
		name: c.name,
		email: c.email || "",
		phone: c.phone,
		status: c.status,
		totalOrders: c.total_orders,
		totalSpent: c.total_spent,
		joinedDate: c.joined_date,
		address: c.address || "",
		profileImg: c.profile_image_url || null,
		purchases: [],
	};
}

/**
 * Get all customers for logged-in vendor.
 */
async function getCustomers(req, res) {
	try {
		const vendorId = req.user.id;
		const {
			search,
			status,
			spent,
			sortBy,
			sortOrder,
			page = 1,
			limit = 10,
		} = req.query;
		const offset = (Number(page) - 1) * Number(limit);

		const where = { vendor_id: vendorId };

		// 1. Search filter
		if (search) {
			where[Op.or] = [
				{ name: { [Op.like]: `%${search}%` } },
				{ email: { [Op.like]: `%${search}%` } },
				{ phone: { [Op.like]: `%${search}%` } },
			];
		}

		// 2. Status filter
		if (status && status !== "All") {
			where.status = status;
		}

		// 3. Spent filter
		if (spent) {
			if (spent === "High") {
				where.total_spent = { [Op.gte]: 50000 };
			} else if (spent === "Low") {
				where.total_spent = { [Op.lt]: 50000 };
			}
		}

		// 4. Sorting
		let orderColumn = "id";
		if (sortBy === "name") {
			orderColumn = "name";
		} else if (sortBy === "totalSpent") {
			orderColumn = "total_spent";
		} else if (sortBy === "joinedDate") {
			orderColumn = "joined_date";
		}
		const direction = sortOrder === "desc" ? "DESC" : "ASC";

		// Query customers with pagination
		const { count, rows } = await Customer.findAndCountAll({
			where,
			order: [[orderColumn, direction]],
			limit: Number(limit),
			offset: Number(offset),
		});

		// Query metrics (aggregate statistics independent of filters)
		const metricsResult = await Customer.findOne({
			where: { vendor_id: vendorId },
			attributes: [
				[sequelize.fn("COUNT", sequelize.col("id")), "totalCustomers"],
				[
					sequelize.fn(
						"SUM",
						sequelize.literal(
							"CASE WHEN status = 'Active' THEN 1 ELSE 0 END",
						),
					),
					"activeCustomers",
				],
				[
					sequelize.fn("SUM", sequelize.col("total_spent")),
					"totalSpent",
				],
			],
			raw: true,
		});

		const metrics = {
			totalCustomers: parseInt(metricsResult.totalCustomers || 0, 10),
			activeCustomers: parseInt(metricsResult.activeCustomers || 0, 10),
			totalSpent: parseInt(metricsResult.totalSpent || 0, 10),
		};

		const formatted = rows.map(formatCustomer);
		return sendSuccess(res, "Customers retrieved successfully.", {
			customers: formatted,
			total: count,
			page: Number(page),
			limit: Number(limit),
			metrics,
		});
	} catch (error) {
		console.error(
			"[CustomerController] getCustomers error:",
			error.message,
		);
		return sendError(
			res,
			"Internal server error retrieving customers.",
			{},
			500,
		);
	}
}

/**
 * Get single customer details
 */
async function getCustomer(req, res) {
	try {
		const { id } = req.params;
		const vendorId = req.user.id;

		const customer = await Customer.findOne({
			where: { id, vendor_id: vendorId },
		});

		if (!customer) {
			return sendError(res, "Customer not found.", {}, 404);
		}

		const {
			Transaction,
			Mobile,
			Brand,
			Model,
			Storage,
			Ram,
		} = require("../../models");

		// Fetch all transactions (Sales, Purchases, Exchanges) for this customer
		const transactions = await Transaction.findAll({
			where: { partner_id: id, vendor_id: vendorId, partner_type: "Customer" },
			include: [
				{
					model: Mobile,
					as: "mobile",
					include: [
						{ model: Brand, as: "brand", attributes: ["name"] },
						{ model: Model, as: "model", attributes: ["name"] },
						{
							model: Storage,
							as: "storage",
							attributes: ["value"],
						},
						{
							model: Ram,
							as: "ram",
							attributes: ["value"],
						},
						{
							model: Transaction,
							as: "transactions",
							attributes: ["id", "type", "amount"],
						},
					],
				},
			],
			order: [
				["date", "DESC"],
				["id", "DESC"],
			],
		});

		const { BusinessDetail } = require("../../models");
		const detailObj = await BusinessDetail.findOne({ where: { vendor_id: vendorId } });
		const gstEnabled = detailObj ? detailObj.gst_enabled : true;
		const gstRate = detailObj ? detailObj.gst_rate : 18;

		let totalOrders = 0;
		let totalSpent = 0;
		let totalProfit = 0;

		const purchases = transactions.map((tx) => {
			const deviceName = tx.mobile
				? `${tx.mobile.brand?.name || ""} ${tx.mobile.model?.name || ""} (${tx.mobile.storage?.value || ""})`
				: "Unknown Device";

			totalOrders += 1;
			totalSpent += Number(tx.amount || 0);

			// Calculate profit for this transaction
			if (tx.mobile) {
				const mobileTxs = tx.mobile.transactions || [];
				if (tx.type === "Sale") {
					const purchaseTx = mobileTxs.find((mTx) => mTx.type === "Purchase");
					const cost = purchaseTx ? Number(purchaseTx.amount) : 0;
					const margin = Number(tx.amount) - cost;
					const gstAmount = (gstEnabled && margin > 0) ? Math.round(margin - (margin / (1 + (gstRate / 100)))) : 0;
					totalProfit += margin - gstAmount;
				} else if (tx.type === "Purchase") {
					const saleTx = mobileTxs.find((mTx) => mTx.type === "Sale");
					if (saleTx) {
						const margin = Number(saleTx.amount) - Number(tx.amount);
						const gstAmount = (gstEnabled && margin > 0) ? Math.round(margin - (margin / (1 + (gstRate / 100)))) : 0;
						totalProfit += margin - gstAmount;
					}
				}
			}

			return {
				id: tx.id.toString(),
				device: deviceName,
				date: tx.date,
				type: tx.type, // 'Sale', 'Purchase', 'Exchange'
				amount: tx.amount,
				status: "Delivered",
				imei: tx.mobile ? tx.mobile.imei : null,
				color: tx.mobile ? tx.mobile.color : null,
				ram: tx.mobile && tx.mobile.ram ? tx.mobile.ram.value : null,
				storage: tx.mobile && tx.mobile.storage ? tx.mobile.storage.value : null,
				condition: tx.mobile ? tx.mobile.condition : null,
				batteryHealth: tx.mobile ? tx.mobile.battery_health : null,
			};
		});

		// Sync values in db
		await customer.update({
			total_orders: totalOrders,
			total_spent: totalSpent,
		});

		const formatted = {
			id: customer.id.toString(),
			name: customer.name,
			email: customer.email || "",
			phone: customer.phone,
			status: customer.status,
			totalOrders,
			totalSpent,
			totalProfit,
			joinedDate: customer.joined_date,
			address: customer.address || "",
			profileImg: customer.profile_image_url || null,
			purchases,
		};

		return sendSuccess(res, "Customer retrieved successfully.", {
			customer: formatted,
		});
	} catch (error) {
		console.error("[CustomerController] getCustomer error:", error.message);
		return sendError(
			res,
			"Internal server error retrieving customer.",
			{},
			500,
		);
	}
}

/**
 * Create new customer
 */
async function createCustomer(req, res) {
	try {
		const vendorId = req.user.id;
		const { name, email, phone, status, address } = req.body;
		let profile_img = req.body.profile_img || req.body.profileImg || null;

		if (profile_img) {
			profile_img = saveBase64File(profile_img, "customer");
		}

		const formattedJoinedDate = new Date().toISOString().split("T")[0];

		const newCustomer = await Customer.create({
			vendor_id: vendorId,
			name,
			email: email || null,
			phone,
			status: status || "Active",
			address: address || null,
			profile_img,
			joined_date: formattedJoinedDate,
			total_orders: 0,
			total_spent: 0,
		});

		return sendSuccess(res, "Customer created successfully.", {
			customer: formatCustomer(newCustomer),
		});
	} catch (error) {
		console.error(
			"[CustomerController] createCustomer error:",
			error.message,
		);
		return sendError(
			res,
			"Internal server error creating customer.",
			{},
			500,
		);
	}
}

/**
 * Update customer profile details
 */
async function updateCustomer(req, res) {
	try {
		const { id } = req.params;
		const vendorId = req.user.id;
		const updates = { ...req.body };

		// Map profileImg to profile_img if present
		if (updates.profileImg !== undefined) {
			updates.profile_img = updates.profileImg;
			delete updates.profileImg;
		}

		if (updates.profile_img) {
			updates.profile_img = saveBase64File(
				updates.profile_img,
				"customer",
			);
		}

		const allowedFields = [
			"name",
			"email",
			"phone",
			"status",
			"address",
			"profile_img",
			"total_orders",
			"total_spent",
		];
		const filteredUpdates = {};
		for (const field of allowedFields) {
			if (updates[field] !== undefined) {
				filteredUpdates[field] = updates[field];
			}
		}

		const [affectedCount] = await Customer.update(filteredUpdates, {
			where: { id, vendor_id: vendorId },
		});

		if (affectedCount === 0) {
			// Check if it exists or if nothing changed
			const exists = await Customer.findOne({
				where: { id, vendor_id: vendorId },
			});
			if (!exists) {
				return sendError(res, "Customer not found.", {}, 404);
			}
		}

		const updated = await Customer.findOne({
			where: { id, vendor_id: vendorId },
		});
		return sendSuccess(res, "Customer updated successfully.", {
			customer: formatCustomer(updated),
		});
	} catch (error) {
		console.error(
			"[CustomerController] updateCustomer error:",
			error.message,
		);
		return sendError(
			res,
			"Internal server error updating customer.",
			{},
			500,
		);
	}
}

/**
 * Delete customer
 */
async function deleteCustomer(req, res) {
	try {
		const { id } = req.params;
		const vendorId = req.user.id;

		const affectedRows = await Customer.destroy({
			where: { id, vendor_id: vendorId },
		});

		if (affectedRows === 0) {
			return sendError(res, "Customer not found.", {}, 404);
		}

		return sendSuccess(res, "Customer deleted successfully.", {
			success: true,
		});
	} catch (error) {
		console.error(
			"[CustomerController] deleteCustomer error:",
			error.message,
		);
		return sendError(
			res,
			"Internal server error deleting customer.",
			{},
			500,
		);
	}
}

/**
 * Bulk delete customers
 */
async function bulkDelete(req, res) {
	try {
		const vendorId = req.user.id;
		const { ids } = req.body;

		if (!Array.isArray(ids) || ids.length === 0) {
			return sendError(res, "Customer IDs list is required.", {}, 400);
		}

		const deletedCount = await Customer.destroy({
			where: {
				id: { [Op.in]: ids },
				vendor_id: vendorId,
			},
		});

		return sendSuccess(res, "Selected customers deleted successfully.", {
			deletedCount,
		});
	} catch (error) {
		console.error("[CustomerController] bulkDelete error:", error.message);
		return sendError(
			res,
			"Internal server error deleting customers.",
			{},
			500,
		);
	}
}

/**
 * Bulk update customer statuses
 */
async function bulkUpdateStatus(req, res) {
	try {
		const vendorId = req.user.id;
		const { ids, status } = req.body;

		if (!Array.isArray(ids) || ids.length === 0 || !status) {
			return sendError(
				res,
				"Customer IDs list and status are required.",
				{},
				400,
			);
		}

		if (status !== "Active" && status !== "Inactive") {
			return sendError(
				res,
				"Status must be either Active or Inactive.",
				{},
				400,
			);
		}

		const [updatedCount] = await Customer.update(
			{ status },
			{
				where: {
					id: { [Op.in]: ids },
					vendor_id: vendorId,
				},
			},
		);

		return sendSuccess(
			res,
			"Selected customers status updated successfully.",
			{ updatedCount },
		);
	} catch (error) {
		console.error(
			"[CustomerController] bulkUpdateStatus error:",
			error.message,
		);
		return sendError(
			res,
			"Internal server error updating status.",
			{},
			500,
		);
	}
}

module.exports = {
	getCustomers,
	getCustomer,
	createCustomer,
	updateCustomer,
	deleteCustomer,
	bulkDelete,
	bulkUpdateStatus,
};
