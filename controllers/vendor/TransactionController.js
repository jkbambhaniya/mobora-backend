const { Transaction, Mobile, Customer, Brand, Model, Storage, Ram, sequelize } = require("../../models");
const { Op } = require("sequelize");
const { sendSuccess, sendError } = require("../../utils/responseHelper");

/**
 * Format database record to API response shape compatible with frontend TradeTransaction.
 */
function formatTransaction(tx) {
	return {
		id: tx.id.toString(),
		imei: tx.mobile ? tx.mobile.imei : "N/A",
		deviceBrand: tx.mobile && tx.mobile.brand ? tx.mobile.brand.name : "N/A",
		deviceModel: tx.mobile && tx.mobile.model ? tx.mobile.model.name : "N/A",
		storage: tx.mobile && tx.mobile.storage ? tx.mobile.storage.value : undefined,
		ram: tx.mobile && tx.mobile.ram ? tx.mobile.ram.value : undefined,
		color: tx.mobile ? tx.mobile.color : undefined,
		condition: tx.mobile ? tx.mobile.condition : undefined,
		batteryHealth: tx.mobile ? tx.mobile.battery_health : undefined,
		type: tx.type,
		customerName: tx.customer ? tx.customer.name : "Walk-in Customer",
		amount: tx.amount,
		date: tx.date,
		notes: tx.notes || "",
		createdAt: tx.created_at,
	};
}

/**
 * Get all transactions for the logged-in vendor.
 */
async function getTransactions(req, res) {
	try {
		const vendorId = req.user.id;
		const { search, type, sortBy = "createdAt", sortOrder = "desc", page = 1, limit = 100 } = req.query;

		const offset = (Number(page) - 1) * Number(limit);
		const where = { vendor_id: vendorId };

		if (type && type !== "All") {
			where.type = type;
		}

		const include = [
			{
				model: Mobile,
				as: "mobile",
				include: [
					{ model: Brand, as: "brand", attributes: ["name"] },
					{ model: Model, as: "model", attributes: ["name"] },
					{ model: Storage, as: "storage", attributes: ["value"] },
					{ model: Ram, as: "ram", attributes: ["value"] },
				],
			},
			{
				model: Customer,
				as: "customer",
				attributes: ["name", "phone"],
			},
		];

		if (search) {
			const searchQuery = `%${search}%`;
			where[Op.and] = [
				{
					[Op.or]: [
						{ "$mobile.imei$": { [Op.like]: searchQuery } },
						{ "$customer.name$": { [Op.like]: searchQuery } },
						{ "$mobile.brand.name$": { [Op.like]: searchQuery } },
						{ "$mobile.model.name$": { [Op.like]: searchQuery } },
						{ notes: { [Op.like]: searchQuery } },
					],
				},
			];
		}

		let orderClause = [["created_at", "DESC"]];
		if (sortBy) {
			const direction = sortOrder.toLowerCase() === "asc" ? "ASC" : "DESC";
			if (sortBy === "date") {
				orderClause = [["date", direction]];
			} else if (sortBy === "amount") {
				orderClause = [["amount", direction]];
			} else if (sortBy === "createdAt") {
				orderClause = [["created_at", direction]];
			}
		}

		const { count, rows } = await Transaction.findAndCountAll({
			where,
			include,
			order: orderClause,
			limit: Number(limit),
			offset: Number(offset),
		});

		const formatted = rows.map(formatTransaction);

		return sendSuccess(res, "Transactions retrieved successfully.", {
			transactions: formatted,
			total: count,
			page: Number(page),
			limit: Number(limit),
		});
	} catch (error) {
		console.error("[TransactionController] getTransactions error:", error.message);
		return sendError(res, "Internal server error retrieving transactions.", {}, 500);
	}
}

/**
 * Record a sale or buyback transaction.
 */
async function createTransaction(req, res) {
	const t = await sequelize.transaction();
	try {
		const vendorId = req.user.id;
		const {
			mobile_id,
			customer_id,
			customer_name,
			type,
			amount,
			date,
			notes,
			// Buyback optional parameters
			condition,
			battery_health,
			// Mobile creation params if not existing
			imei,
			brand_name,
			model_name,
			storage_val,
			ram_val,
			color,
		} = req.body;

		// 1. Resolve or Create Mobile listing
		let mobile;
		let mobileId = mobile_id;

		if (mobileId) {
			mobile = await Mobile.findOne({
				where: { id: mobileId, vendor_id: vendorId },
				transaction: t,
			});
		} else if (imei) {
			mobile = await Mobile.findOne({
				where: { imei, vendor_id: vendorId },
				transaction: t,
			});
		}

		if (!mobile && (type === "Purchase" || type === "Exchange")) {
			// Attempt to auto-create listing
			const bName = brand_name || "Apple";
			const mName = model_name || "iPhone";
			const sVal = storage_val || "128GB";
			const rVal = ram_val || "6GB";

			const [brandObj] = await Brand.findOrCreate({
				where: { name: bName },
				defaults: { name: bName },
				transaction: t
			});
			const [modelObj] = await Model.findOrCreate({
				where: { name: mName, brand_id: brandObj.id, vendor_id: vendorId },
				defaults: { name: mName, brand_id: brandObj.id, vendor_id: vendorId },
				transaction: t
			});
			const [storageObj] = await Storage.findOrCreate({
				where: { value: sVal },
				defaults: { value: sVal },
				transaction: t
			});
			const [ramObj] = await Ram.findOrCreate({
				where: { value: rVal },
				defaults: { value: rVal },
				transaction: t
			});

			mobile = await Mobile.create({
				vendor_id: vendorId,
				brand_id: brandObj.id,
				model_id: modelObj.id,
				storage_id: storageObj.id,
				ram_id: ramObj.id,
				color: color || "Space Gray",
				imei: imei || null,
				condition: condition || "Excellent",
				battery_health: battery_health !== undefined ? battery_health : 90,
				status: "Active",
				description: notes || `Acquired via ${type}.`
			}, { transaction: t });
		}

		if (!mobile) {
			await t.rollback();
			return sendError(res, "Mobile listing not found.", {}, 404);
		}

		// 2. Resolve Customer ID
		let resolvedCustomerId = customer_id;
		if (!resolvedCustomerId && customer_name) {
			const customer = await Customer.findOne({
				where: { name: customer_name, vendor_id: vendorId },
				transaction: t,
			});
			if (customer) {
				resolvedCustomerId = customer.id;
			}
		}

		// 3. Atomically Update Mobile attributes based on transaction type
		if (type === "Sale") {
			await mobile.update(
				{
					status: "Sold",
					description: notes || `Sold to customer.`,
				},
				{ transaction: t },
			);
		} else if (type === "Purchase" || type === "Exchange") {
			// Buyback reactivation or new stock acquisition
			await mobile.update(
				{
					status: "Active",
					condition: condition || mobile.condition,
					battery_health: battery_health !== undefined ? battery_health : mobile.battery_health,
					description: notes || `Re-acquired via buyback.`,
				},
				{ transaction: t },
			);
		}

		// 4. Create Transaction Record
		const newTransaction = await Transaction.create(
			{
				vendor_id: vendorId,
				customer_id: resolvedCustomerId || null,
				mobile_id: mobile.id,
				type,
				amount,
				date,
				notes: notes || `${type} transaction recorded.`,
			},
			{ transaction: t },
		);

		// Recalculate customer total orders and total spent if a customer is linked
		if (resolvedCustomerId) {
			const customerTxs = await Transaction.findAll({
				where: { customer_id: resolvedCustomerId },
				transaction: t,
			});
			let newTxsList = [...customerTxs];
			// Check if new transaction is already in database list, else add it
			if (!newTxsList.some(tx => tx.id === newTransaction.id)) {
				newTxsList.push(newTransaction);
			}
			const uniqueTxs = [];
			const seen = new Set();
			for (const s of newTxsList) {
				if (!seen.has(s.id)) {
					seen.add(s.id);
					uniqueTxs.push(s);
				}
			}
			const totalOrders = uniqueTxs.length;
			const totalSpent = uniqueTxs.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

			await Customer.update(
				{ total_orders: totalOrders, total_spent: totalSpent },
				{ where: { id: resolvedCustomerId }, transaction: t }
			);
		}

		await t.commit();

		// 5. Fetch fully populated transaction to return to client
		const fetchedTx = await Transaction.findByPk(newTransaction.id, {
			include: [
				{
					model: Mobile,
					as: "mobile",
					include: [
						{ model: Brand, as: "brand", attributes: ["name"] },
						{ model: Model, as: "model", attributes: ["name"] },
						{ model: Storage, as: "storage", attributes: ["value"] },
						{ model: Ram, as: "ram", attributes: ["value"] },
					],
				},
				{
					model: Customer,
					as: "customer",
					attributes: ["name", "phone"],
				},
			],
		});

		return sendSuccess(
			res,
			"Transaction recorded successfully.",
			{ transaction: formatTransaction(fetchedTx) },
			201,
		);
	} catch (error) {
		await t.rollback();
		console.error("[TransactionController] createTransaction error:", error.message);
		return sendError(res, "Internal server error recording transaction.", {}, 500);
	}
}
module.exports = {
	getTransactions,
	createTransaction,
};
