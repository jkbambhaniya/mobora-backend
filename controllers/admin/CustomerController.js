const { Customer, Vendor, BusinessDetail, Transaction, Mobile, Brand, Model, Storage, Ram, CustomerKyc, CustomerKycDocument, sequelize } = require("../../models");
const { sendSuccess, sendError } = require("../../utils/responseHelper");
const { Op } = require("sequelize");
const { saveBase64File } = require("../../utils/fileUploadHelper");

/**
 * Format database record to API response shape
 */
function formatCustomer(c) {
	const kyc = c.kyc || {};
	const docs = c.kycDocuments || [];
	let documentUrls = docs.map(doc => {
		const img = doc.document_path;
		if (
			img.startsWith("/") ||
			img.startsWith("http://") ||
			img.startsWith("https://") ||
			img.startsWith("data:")
		) {
			return img;
		} else {
			const host = process.env.APP_URL || "";
			return `${host}${img}`;
		}
	});

	return {
		id: c.id.toString(),
		name: c.name,
		email: c.email || "",
		phone: c.phone,
		status: c.status,
		totalOrders: c.total_orders || 0,
		totalSpent: c.total_spent || 0,
		joinedDate: c.joined_date,
		address: c.address || "",
		profileImg: c.profile_image_url || null,
		vendor: c.vendor ? {
			id: c.vendor.id.toString(),
			name: c.vendor.name,
			email: c.vendor.email || "",
			profileImg: c.vendor.profile_image_url || null,
			shopName: c.vendor.businessDetail ? c.vendor.businessDetail.shop_name : ""
		} : null,
		kycStatus: kyc.kyc_status || null,
		idType: kyc.id_type || null,
		idNumber: kyc.id_number || null,
		kycDocumentImg: documentUrls.length > 0 ? documentUrls.join(",") : null,
	};
}

/**
 * Helper to process and save one or more base64 document images
 */
async function syncCustomerKycDocuments(customerId, kycDocumentImgInput) {
	if (kycDocumentImgInput === undefined) return;

	const { CustomerKycDocument } = require("../../models");

	// If null/empty, clear all documents
	if (!kycDocumentImgInput) {
		await CustomerKycDocument.destroy({ where: { customer_id: customerId } });
		return;
	}

	let images = [];
	try {
		const parsed = JSON.parse(kycDocumentImgInput);
		if (Array.isArray(parsed)) {
			images = parsed;
		} else {
			images = [kycDocumentImgInput];
		}
	} catch (e) {
		if (kycDocumentImgInput.includes(",") && !kycDocumentImgInput.startsWith("data:")) {
			images = kycDocumentImgInput.split(",").map(s => s.trim()).filter(Boolean);
		} else {
			images = [kycDocumentImgInput];
		}
	}

	const savedPaths = images.map(img => saveBase64File(img, "customer")).filter(Boolean);

	// Reset rows
	await CustomerKycDocument.destroy({ where: { customer_id: customerId } });
	for (const docPath of savedPaths) {
		await CustomerKycDocument.create({
			customer_id: customerId,
			document_path: docPath,
		});
	}
}

/**
 * List all customers (across all vendors) with optional search, status filtering, and pagination.
 */
async function listCustomers(req, res) {
	try {
		const { search, status, page = 1, limit = 10, sortBy, sortOrder } = req.query;

		const pageNum = parseInt(page, 10) || 1;
		const limitNum = parseInt(limit, 10) || 10;
		const offset = (pageNum - 1) * limitNum;

		const whereClause = {};

		if (status && status !== "All") {
			whereClause.status = status;
		}

		if (search) {
			whereClause[Op.or] = [
				{ name: { [Op.like]: `%${search}%` } },
				{ email: { [Op.like]: `%${search}%` } },
				{ phone: { [Op.like]: `%${search}%` } }
			];
		}

		const sortField = sortBy || "created_at";
		const orderDir = (sortOrder || "DESC").toUpperCase();
		let order = [[sortField, orderDir]];

		if (sortField === "name") {
			order = [["name", orderDir]];
		} else if (sortField === "totalSpent") {
			order = [[sequelize.literal("total_spent"), orderDir]];
		} else if (sortField === "joinedDate") {
			order = [["joined_date", orderDir]];
		}

		const { count, rows } = await Customer.findAndCountAll({
			attributes: {
				include: [
					[
						sequelize.literal(`(
							SELECT COUNT(*) 
							FROM transactions AS t 
							WHERE t.partner_id = Customer.id 
							AND t.partner_type = 'Customer'
						)`),
						"total_orders"
					],
					[
						sequelize.literal(`(
							SELECT IFNULL(SUM(t.amount), 0) 
							FROM transactions AS t 
							WHERE t.partner_id = Customer.id 
							AND t.partner_type = 'Customer'
						)`),
						"total_spent"
					]
				]
			},
			where: whereClause,
			include: [
				{
					model: Vendor,
					as: "vendor",
					attributes: ["id", "name", "email", "profile_img"],
					include: [{ model: BusinessDetail, as: "businessDetail", attributes: ["shop_name"] }]
				},
				{ model: CustomerKyc, as: "kyc" },
				{ model: CustomerKycDocument, as: "kycDocuments" }
			],
			order,
			limit: limitNum,
			offset,
			distinct: true
		});

		// Query global metrics for admin
		const totalCustomers = await Customer.count();
		const activeCustomers = await Customer.count({ where: { status: "Active" } });
		const totalSpentResult = await Transaction.sum("amount", { where: { partner_type: "Customer" } });

		const metrics = {
			totalCustomers,
			activeCustomers,
			totalSpent: parseInt(totalSpentResult || 0, 10),
		};

		const formatted = rows.map(formatCustomer);

		return sendSuccess(res, "Customers retrieved successfully.", {
			customers: formatted,
			total: count,
			page: pageNum,
			limit: limitNum,
			metrics,
		});
	} catch (error) {
		console.error("[Admin Customer] List error:", error.message);
		return sendError(res, "Internal server error retrieving customers.", {}, 500);
	}
}

/**
 * Get details of a single customer by ID (including all purchases/sales/exchanges).
 */
async function getCustomerById(req, res) {
	try {
		const { id } = req.params;

		const customer = await Customer.findOne({
			where: { id },
			include: [
				{
					model: Vendor,
					as: "vendor",
					attributes: ["id", "name", "email", "profile_img"],
					include: [{ model: BusinessDetail, as: "businessDetail", attributes: ["shop_name"] }]
				},
				{ model: CustomerKyc, as: "kyc" },
				{ model: CustomerKycDocument, as: "kycDocuments" }
			]
		});

		if (!customer) {
			return sendError(res, "Customer not found.", {}, 404);
		}

		// Fetch all transactions (Sales, Purchases, Exchanges) for this customer
		const transactions = await Transaction.findAll({
			where: { partner_id: id, partner_type: "Customer" },
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
							attributes: ["id", "type", "amount"],
						},
					],
				},
				{
					model: Vendor,
					as: "vendor",
					attributes: ["id", "name"],
					include: [{ model: BusinessDetail, as: "businessDetail", attributes: ["shop_name"] }]
				}
			],
			order: [
				["date", "DESC"],
				["id", "DESC"],
			],
		});

		// Calculate stats
		let totalOrders = 0;
		let totalSpent = 0;
		let totalProfit = 0;

		// Fetch vendor business details or use default for GST margin calculation
		const gstEnabled = true;
		const gstRate = 18;

		const purchases = transactions.map((tx) => {
			const deviceName = tx.mobile
				? `${tx.mobile.brand?.name || ""} ${tx.mobile.model?.name || ""} (${tx.mobile.storage?.value || ""})`
				: "Unknown Device";

			totalOrders += 1;
			totalSpent += Number(tx.amount || 0);

			// Profit margin calculation (mirroring vendor-side logic)
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
				vendor: tx.vendor ? {
					id: tx.vendor.id.toString(),
					name: tx.vendor.name,
					shopName: tx.vendor.businessDetail ? tx.vendor.businessDetail.shop_name : ""
				} : null
			};
		});

		// Stats are calculated dynamically from transactions, no need to update customer record

		const docs = customer.kycDocuments || [];
		const documentUrls = docs.map(doc => {
			const img = doc.document_path;
			if (
				img.startsWith("/") ||
				img.startsWith("http://") ||
				img.startsWith("https://") ||
				img.startsWith("data:")
			) {
				return img;
			} else {
				const host = process.env.APP_URL || "";
				return `${host}${img}`;
			}
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
			vendor: customer.vendor ? {
				id: customer.vendor.id.toString(),
				name: customer.vendor.name,
				email: customer.vendor.email || "",
				profileImg: customer.vendor.profile_image_url || null,
				shopName: customer.vendor.businessDetail ? customer.vendor.businessDetail.shop_name : ""
			} : null,
			purchases,
			kycStatus: customer.kyc?.kyc_status || null,
			idType: customer.kyc?.id_type || null,
			idNumber: customer.kyc?.id_number || null,
			kycDocumentImg: documentUrls.length > 0 ? documentUrls.join(",") : null,
			verifiedAt: customer.kyc?.verified_at || null,
		};

		return sendSuccess(res, "Customer details retrieved successfully.", { customer: formatted });
	} catch (error) {
		console.error("[Admin Customer] Get detail error:", error.message);
		return sendError(res, "Internal server error retrieving customer details.", {}, 500);
	}
}

/**
 * Update basic details of a customer.
 */
async function updateCustomer(req, res) {
	try {
		const { id } = req.params;
		const updates = { ...req.body };

		if (updates.profileImg !== undefined) {
			updates.profile_img = updates.profileImg;
			delete updates.profileImg;
		}

		if (updates.profile_img) {
			updates.profile_img = saveBase64File(updates.profile_img, "customer");
		}

		const allowedFields = ["name", "email", "phone", "status", "address", "profile_img"];
		const filteredUpdates = {};
		for (const field of allowedFields) {
			if (updates[field] !== undefined) {
				filteredUpdates[field] = updates[field];
			}
		}

		const [affectedCount] = await Customer.update(filteredUpdates, {
			where: { id }
		});

		if (affectedCount === 0) {
			const exists = await Customer.findByPk(id);
			if (!exists) {
				return sendError(res, "Customer not found.", {}, 404);
			}
		}

		// Update KYC details if provided
		const { idType, idNumber, kycDocumentImg } = updates;
		if (idType !== undefined || idNumber !== undefined || kycDocumentImg !== undefined) {
			let dbKyc = await CustomerKyc.findOne({ where: { customer_id: id } });

			if (dbKyc) {
				const kycUpdates = {};
				if (idType !== undefined) kycUpdates.id_type = idType;
				if (idNumber !== undefined) kycUpdates.id_number = idNumber;
				kycUpdates.kyc_status = "Verified";
				await dbKyc.update(kycUpdates);
			} else {
				await CustomerKyc.create({
					customer_id: id,
					id_type: idType || null,
					id_number: idNumber || null,
					kyc_status: "Verified",
				});
			}

			if (kycDocumentImg !== undefined) {
				await syncCustomerKycDocuments(id, kycDocumentImg);
			}
		}

		const updated = await Customer.findOne({
			where: { id },
			include: [
				{
					model: Vendor,
					as: "vendor",
					attributes: ["id", "name", "email", "profile_img"],
					include: [{ model: BusinessDetail, as: "businessDetail", attributes: ["shop_name"] }]
				},
				{ model: CustomerKyc, as: "kyc" },
				{ model: CustomerKycDocument, as: "kycDocuments" }
			]
		});

		return sendSuccess(res, "Customer updated successfully.", { customer: formatCustomer(updated) });
	} catch (error) {
		console.error("[Admin Customer] Update error:", error.message);
		return sendError(res, "Internal server error updating customer.", {}, 500);
	}
}

/**
 * Delete a customer.
 */
async function deleteCustomer(req, res) {
	try {
		const { id } = req.params;

		const affectedRows = await Customer.destroy({
			where: { id }
		});

		if (affectedRows === 0) {
			return sendError(res, "Customer not found.", {}, 404);
		}

		return sendSuccess(res, "Customer deleted successfully.", { id: Number(id) });
	} catch (error) {
		console.error("[Admin Customer] Delete error:", error.message);
		return sendError(res, "Internal server error deleting customer.", {}, 500);
	}
}

/**
 * Approve Customer KYC (Admin)
 */
async function approveCustomerKyc(req, res) {
	try {
		const { id } = req.params;

		const customer = await Customer.findByPk(id);
		if (!customer) {
			return sendError(res, "Customer not found.", {}, 404);
		}

		let kyc = await CustomerKyc.findOne({ where: { customer_id: id } });
		if (!kyc) {
			return sendError(res, "KYC details not found for this customer. Please upload details first.", {}, 404);
		}

		await kyc.update({
			kyc_status: "Verified",
			verified_at: new Date(),
		});

		const updatedCustomer = await Customer.findOne({
			where: { id },
			include: [
				{ model: CustomerKyc, as: "kyc" },
				{ model: CustomerKycDocument, as: "kycDocuments" },
			],
		});

		return sendSuccess(res, "Customer KYC approved and verified.", {
			customer: formatCustomer(updatedCustomer),
		});
	} catch (error) {
		console.error("[Admin CustomerController] approveCustomerKyc error:", error.message);
		return sendError(res, "Internal server error approving KYC.", {}, 500);
	}
}

/**
 * Reject Customer KYC (Admin)
 */
async function rejectCustomerKyc(req, res) {
	try {
		const { id } = req.params;

		const customer = await Customer.findByPk(id);
		if (!customer) {
			return sendError(res, "Customer not found.", {}, 404);
		}

		let kyc = await CustomerKyc.findOne({ where: { customer_id: id } });
		if (!kyc) {
			return sendError(res, "KYC details not found for this customer.", {}, 404);
		}

		await kyc.update({
			kyc_status: "Rejected",
			verified_at: null,
		});

		const updatedCustomer = await Customer.findOne({
			where: { id },
			include: [
				{ model: CustomerKyc, as: "kyc" },
				{ model: CustomerKycDocument, as: "kycDocuments" },
			],
		});

		return sendSuccess(res, "Customer KYC rejected.", {
			customer: formatCustomer(updatedCustomer),
		});
	} catch (error) {
		console.error("[Admin CustomerController] rejectCustomerKyc error:", error.message);
		return sendError(res, "Internal server error rejecting KYC.", {}, 500);
	}
}

module.exports = {
	listCustomers,
	getCustomerById,
	updateCustomer,
	deleteCustomer,
	approveCustomerKyc,
	rejectCustomerKyc,
};
