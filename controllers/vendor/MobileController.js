const { Mobile, Brand, Model, Storage, Ram, Transaction, Customer, sequelize } = require("../../models");
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
		repairingCost: m.repairing_cost || 0,
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
			subQuery: false,
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
			repairing_cost,
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
			status: status || "Available",
			description: description || null,
			repairing_cost: repairing_cost ? Number(repairing_cost) : 0,
		}, { transaction: t });

		// Create corresponding Purchase transaction
		const purchaseAmount = purchase_price ? Number(purchase_price) : 0;
		let pId = customer_id;
		let pType = "Customer";
		if (typeof customer_id === "string" && customer_id.includes(":")) {
			const [type, val] = customer_id.split(":");
			pId = isNaN(Number(val)) ? null : Number(val);
			pType = type;
		}
		await Transaction.create({
			vendor_id: vendorId,
			partner_id: pId ? Number(pId) : null,
			partner_type: pType,
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

		// Trigger requirements alerts matching
		checkAndAlertRequirements(fetched, vendorId).catch(err => {
			console.error("[MobileController] checkAndAlertRequirements error:", err);
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
	const t = await sequelize.transaction();
	try {
		const { id } = req.params;
		const vendorId = req.user.id;
		const updates = { ...req.body };

		// Check if mobile exists and belongs to this vendor
		const mobile = await Mobile.findOne({
			where: { id, vendor_id: vendorId },
			transaction: t,
		});
		if (!mobile) {
			await t.rollback();
			return sendError(res, "Mobile not found.", {}, 404);
		}

		// Check duplicate IMEI if updated
		if (updates.imei && updates.imei !== mobile.imei) {
			const existing = await Mobile.findOne({
				where: { imei: updates.imei },
				transaction: t,
			});
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
			"repairing_cost",
		];

		const filteredUpdates = {};
		for (const field of allowedFields) {
			if (updates[field] !== undefined) {
				filteredUpdates[field] = updates[field];
			}
		}

		await Mobile.update(filteredUpdates, {
			where: { id, vendor_id: vendorId },
		}, { transaction: t });

		// If purchase_price is updated, update the most recent associated 'Purchase' transaction
		if (updates.purchase_price !== undefined) {
			const purchaseAmount = Number(updates.purchase_price);
			const latestPurchaseTx = await Transaction.findOne({
				where: {
					mobile_id: id,
					type: "Purchase",
					vendor_id: vendorId,
				},
				order: [["id", "DESC"]],
				transaction: t,
			});

			if (latestPurchaseTx) {
				await latestPurchaseTx.update({ amount: purchaseAmount }, { transaction: t });

				// Recalculate customer total spent if a customer is linked to this transaction
				if (latestPurchaseTx.customer_id) {
					const customerTxs = await Transaction.findAll({
						where: { customer_id: latestPurchaseTx.customer_id },
						transaction: t,
					});
					const totalSpent = customerTxs.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
					await Customer.update(
						{ total_spent: totalSpent },
						{
							where: { id: latestPurchaseTx.customer_id },
							transaction: t,
						}
					);
				}
			}
		}

		await t.commit();

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
		await t.rollback();
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
			where: { vendor_id: vendorId, status: "Available" },
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

/**
 * Check and alert vendors with matching active device requirements when a new device is registered.
 */
async function checkAndAlertRequirements(mobile, registeringVendorId) {
	try {
		const { DeviceRequirement, Notification, ChatSession, Message, Vendor, BusinessDetail } = require("../../models");
		const socketHandler = require("../../utils/socketHandler");
		const { Op } = require("sequelize");

		// Find matching active requirements
		const requirements = await DeviceRequirement.findAll({
			where: {
				brand_id: mobile.brand_id,
				model_id: mobile.model_id,
				storage_id: mobile.storage_id,
				ram_id: mobile.ram_id,
				status: "Active",
				vendor_id: { [Op.ne]: registeringVendorId },
				[Op.or]: [
					{ color: null },
					{ color: "" },
					{ color: { [Op.like]: `%${mobile.color}%` } }
				]
			}
		});

		if (requirements.length === 0) return;

		// Fetch registering vendor profile & business details
		const registeringVendor = await Vendor.findByPk(registeringVendorId, {
			include: [{ model: BusinessDetail, as: "businessDetail", attributes: ["shop_name"] }]
		});
		const registeringShopName = registeringVendor?.businessDetail?.shop_name || registeringVendor?.name || "A vendor";

		const brandName = mobile.brand ? mobile.brand.name : "";
		const modelName = mobile.model ? mobile.model.name : "";
		const colorVal = mobile.color || "";
		const ramVal = mobile.ram ? mobile.ram.value : "";
		const storageVal = mobile.storage ? mobile.storage.value : "";
		const deviceName = `${brandName} ${modelName} (${colorVal}, ${ramVal} RAM, ${storageVal} Storage)`;

		const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

		for (const req of requirements) {
			const reqVendorId = req.vendor_id;

			// 1. Create system notification
			const notifBody = `${registeringShopName} registered a matching device: ${deviceName}!`;
			const newNotif = await Notification.create({
				vendor_id: reqVendorId,
				type: "requirement_match",
				title: "Requirement Matched!",
				body: notifBody,
				timestamp
			});

			// Emit socket notification if vendor online
			const io = socketHandler.getIo();
			if (io) {
				io.to(`vendor-${reqVendorId}`).emit('new_notification', {
					id: `notif-${newNotif.id}`,
					type: 'requirement_match',
					title: 'Requirement Matched!',
					body: notifBody,
					timestamp
				});
			}

			// 2. Automatically initiate/send a B2B Chat message
			// From: registeringVendorId (sender) -> reqVendorId (recipient)
			const chatIdSender = `chat-${registeringVendorId}-${reqVendorId}`;
			const chatIdRecipient = `chat-${reqVendorId}-${registeringVendorId}`;

			// Check/create chat session for Registering Vendor (Sender)
			let sessionSender = await ChatSession.findOne({
				where: { vendor_id: registeringVendorId, recipient_vendor_id: reqVendorId }
			});
			if (!sessionSender) {
				const reqVendor = await Vendor.findByPk(reqVendorId);
				const reqVendorName = reqVendor ? reqVendor.name : 'Other Vendor';
				const initials = reqVendorName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'VD';
				sessionSender = await ChatSession.create({
					chat_id: chatIdSender,
					vendor_id: registeringVendorId,
					recipient_vendor_id: reqVendorId,
					customer_name: reqVendorName,
					avatar: initials,
					status: 'offline',
					last_message: '',
					unread_count: 0,
					last_active: 'Just now',
					notes: 'B2B Trade Partner'
				});
			}

			// Check/create chat session for Requesting Vendor (Recipient)
			let sessionRecipient = await ChatSession.findOne({
				where: { vendor_id: reqVendorId, recipient_vendor_id: registeringVendorId }
			});
			if (!sessionRecipient) {
				const initials = registeringVendor.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'VD';
				sessionRecipient = await ChatSession.create({
					chat_id: chatIdRecipient,
					vendor_id: reqVendorId,
					recipient_vendor_id: registeringVendorId,
					customer_name: registeringVendor.name,
					avatar: initials,
					status: 'offline',
					last_message: '',
					unread_count: 0,
					last_active: 'Just now',
					device_interest: registeringShopName,
					notes: 'B2B Trade Partner'
				});
			}

			const messageText = `Hi! I just registered a device matching your requirement: ${deviceName}. Let me know if you are interested!`;

			// Create the message database entries
			const msgSender = await Message.create({
				chat_id: chatIdSender,
				sender: 'vendor',
				text: messageText,
				timestamp,
				status: 'sent'
			});

			const msgRecipient = await Message.create({
				chat_id: chatIdRecipient,
				sender: 'customer',
				text: messageText,
				timestamp,
				status: 'unread'
			});

			// Update sessions last_message & unread_count
			await ChatSession.update(
				{ last_message: messageText, last_active: 'Just now' },
				{ where: { chat_id: chatIdSender, vendor_id: registeringVendorId } }
			);

			await ChatSession.update(
				{ last_message: messageText, last_active: 'Just now', unread_count: sequelize.literal('unread_count + 1') },
				{ where: { chat_id: chatIdRecipient, vendor_id: reqVendorId } }
			);

			// Socket emits if io is active
			if (io) {
				// Emit message to respective rooms
				io.to(`chat-${chatIdSender}`).emit('receive_message', {
					id: `m-${msgSender.id}`,
					sender: 'vendor',
					text: messageText,
					timestamp,
					status: 'sent'
				});

				io.to(`chat-${chatIdRecipient}`).emit('receive_message', {
					id: `m-${msgRecipient.id}`,
					sender: 'customer',
					text: messageText,
					timestamp,
					status: 'unread'
				});

				// Broadcast sidebar updates
				const sessionsA = await socketHandler.fetchVendorSessions(registeringVendorId);
				const sessionsB = await socketHandler.fetchVendorSessions(reqVendorId);
				io.to(`vendor-${registeringVendorId}`).emit('sessions_update', sessionsA);
				io.to(`vendor-${reqVendorId}`).emit('sessions_update', sessionsB);
			}
		}
	} catch (error) {
		console.error("[MobileController] checkAndAlertRequirements failed:", error);
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
