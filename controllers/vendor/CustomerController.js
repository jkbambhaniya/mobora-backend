const fs = require("fs");
const path = require("path");
const { Customer, sequelize } = require("../../models");
const { Op } = require("sequelize");
const { sendSuccess, sendError } = require("../../utils/responseHelper");
const { saveBase64File } = require("../../utils/fileUploadHelper");

/**
 * Format database record to API response shape
 */
function formatCustomer(c, vc) {
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
		totalOrders: vc ? vc.total_orders : (c.total_orders || 0),
		totalSpent: vc ? vc.total_spent : (c.total_spent || 0),
		joinedDate: vc ? vc.joined_date : (c.joined_date || null),
		address: c.address || "",
		profileImg: c.profile_image_url || null,
		purchases: [],
		kycStatus: kyc.kyc_status || null,
		idType: kyc.id_type || null,
		idNumber: kyc.id_number || null,
		kycDocumentImg: documentUrls.length > 0 ? documentUrls.join(",") : null,
		verifiedAt: kyc.verified_at || null,
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

		const { VendorCustomer, Customer, CustomerKyc, CustomerKycDocument } = require("../../models");

		// Construct sorting
		let order = [];
		const direction = sortOrder === "desc" ? "DESC" : "ASC";
		if (sortBy === "name") {
			order = [[{ model: Customer, as: "customer" }, "name", direction]];
		} else if (sortBy === "totalSpent") {
			order = [["total_spent", direction]];
		} else if (sortBy === "joinedDate") {
			order = [["joined_date", direction]];
		} else {
			order = [["id", direction]];
		}

		// Filters for Customer
		const customerWhere = {};
		if (search) {
			customerWhere[Op.or] = [
				{ name: { [Op.like]: `%${search}%` } },
				{ email: { [Op.like]: `%${search}%` } },
				{ phone: { [Op.like]: `%${search}%` } },
			];
		}
		if (status && status !== "All") {
			customerWhere.status = status;
		}

		// Filters for VendorCustomer
		const vendorCustomerWhere = { vendor_id: vendorId };
		if (spent) {
			if (spent === "High") {
				vendorCustomerWhere.total_spent = { [Op.gte]: 50000 };
			} else if (spent === "Low") {
				vendorCustomerWhere.total_spent = { [Op.lt]: 50000 };
			}
		}

		// Query VendorCustomer count & rows
		const { count, rows } = await VendorCustomer.findAndCountAll({
			where: vendorCustomerWhere,
			order,
			limit: Number(limit),
			offset: Number(offset),
			subQuery: false,
			include: [
				{
					model: Customer,
					as: "customer",
					where: customerWhere,
					include: [
						{ model: CustomerKyc, as: "kyc" },
						{ model: CustomerKycDocument, as: "kycDocuments" },
					],
				},
			],
		});

		// Query metrics
		const totalCustomers = await VendorCustomer.count({ where: { vendor_id: vendorId } });
		const activeCustomers = await VendorCustomer.count({
			where: { vendor_id: vendorId },
			include: [{ model: Customer, as: "customer", where: { status: "Active" } }]
		});
		const totalSpentResult = await VendorCustomer.sum("total_spent", { where: { vendor_id: vendorId } });

		const metrics = {
			totalCustomers,
			activeCustomers,
			totalSpent: parseInt(totalSpentResult || 0, 10),
		};

		const formatted = rows.map(r => formatCustomer(r.customer, r));
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

		const { VendorCustomer, CustomerKyc, CustomerKycDocument } = require("../../models");

		// Verify association exists
		const association = await VendorCustomer.findOne({
			where: { customer_id: id, vendor_id: vendorId }
		});

		if (!association) {
			return sendError(res, "Customer not found.", {}, 404);
		}

		const customer = await Customer.findOne({
			where: { id },
			include: [
				{ model: CustomerKyc, as: "kyc" },
				{ model: CustomerKycDocument, as: "kycDocuments" },
			],
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
		await association.update({
			total_orders: totalOrders,
			total_spent: totalSpent,
		});

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
			joinedDate: association.joined_date,
			address: customer.address || "",
			profileImg: customer.profile_image_url || null,
			purchases,
			kycStatus: customer.kyc?.kyc_status || null,
			idType: customer.kyc?.id_type || null,
			idNumber: customer.kyc?.id_number || null,
			kycDocumentImg: documentUrls.length > 0 ? documentUrls.join(",") : null,
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
		const { name, email, phone, status, address, idType, idNumber, kycDocumentImg, associateExisting } = req.body;
		let profile_img = req.body.profile_img || req.body.profileImg || null;

		// Check if customer with this phone already exists
		let customer = await Customer.findOne({ where: { phone } });

		if (customer) {
			// Find if already associated with this vendor
			const { VendorCustomer } = require("../../models");
			const existingAssociation = await VendorCustomer.findOne({
				where: { vendor_id: vendorId, customer_id: customer.id }
			});

			if (existingAssociation) {
				return sendError(res, "Customer with this mobile number is already in your customer list.", {}, 400);
			}

			// If already exists globally but not associated with this vendor
			if (associateExisting) {
				// Update global customer details if they are provided and different
				const updateFields = {};
				if (name !== undefined) updateFields.name = name;
				if (email !== undefined) updateFields.email = email || null;
				if (address !== undefined) updateFields.address = address || null;
				if (status !== undefined) updateFields.status = status || "Active";
				if (profile_img) {
					updateFields.profile_img = saveBase64File(profile_img, "customer");
				}

				if (Object.keys(updateFields).length > 0) {
					await customer.update(updateFields);
				}

				// Update KYC details if provided
				if (idType !== undefined || idNumber !== undefined || kycDocumentImg !== undefined) {
					const { CustomerKyc } = require("../../models");
					let dbKyc = await CustomerKyc.findOne({ where: { customer_id: customer.id } });

					if (dbKyc) {
						const kycUpdates = {};
						if (idType !== undefined) kycUpdates.id_type = idType;
						if (idNumber !== undefined) kycUpdates.id_number = idNumber;
						kycUpdates.kyc_status = "Verified";
						await dbKyc.update(kycUpdates);
					} else {
						await CustomerKyc.create({
							customer_id: customer.id,
							id_type: idType || null,
							id_number: idNumber || null,
							kyc_status: "Verified",
						});
					}

					if (kycDocumentImg !== undefined) {
						await syncCustomerKycDocuments(customer.id, kycDocumentImg);
					}
				}

				// Create association
				const formattedJoinedDate = new Date().toISOString().split("T")[0];
				const association = await VendorCustomer.create({
					vendor_id: vendorId,
					customer_id: customer.id,
					joined_date: formattedJoinedDate,
					total_orders: 0,
					total_spent: 0,
				});

				// Reload customer with KYC association
				const { CustomerKyc, CustomerKycDocument } = require("../../models");
				const reloaded = await Customer.findOne({
					where: { id: customer.id },
					include: [
						{ model: CustomerKyc, as: "kyc" },
						{ model: CustomerKycDocument, as: "kycDocuments" },
					],
				});

				return sendSuccess(res, "Customer added to your list successfully.", {
					customer: formatCustomer(reloaded, association),
				});
			} else {
				// Return warning that customer exists globally
				const { CustomerKyc, CustomerKycDocument } = require("../../models");
				const reloaded = await Customer.findOne({
					where: { id: customer.id },
					include: [
						{ model: CustomerKyc, as: "kyc" },
						{ model: CustomerKycDocument, as: "kycDocuments" },
					],
				});

				return sendSuccess(res, "Customer already exists in the system.", {
					existsGlobally: true,
					customer: formatCustomer(reloaded),
				});
			}
		}

		// Create new customer record if it doesn't exist
		if (profile_img) {
			profile_img = saveBase64File(profile_img, "customer");
		}

		const formattedJoinedDate = new Date().toISOString().split("T")[0];
		customer = await Customer.create({
			vendor_id: vendorId, // Creator
			name,
			email: email || null,
			phone,
			status: status || "Active",
			address: address || null,
			profile_img,
			joined_date: formattedJoinedDate,
		});

		// Ensure association in vendor_customers table exists
		const { VendorCustomer } = require("../../models");
		const association = await VendorCustomer.create({
			vendor_id: vendorId,
			customer_id: customer.id,
			joined_date: formattedJoinedDate,
			total_orders: 0,
			total_spent: 0,
		});

		// Save KYC if provided
		if (idType || idNumber || kycDocumentImg) {
			const { CustomerKyc } = require("../../models");
			await CustomerKyc.create({
				customer_id: customer.id,
				id_type: idType || null,
				id_number: idNumber || null,
				kyc_status: "Verified",
			});
			await syncCustomerKycDocuments(customer.id, kycDocumentImg);
		}

		// Reload customer with KYC association
		const { CustomerKyc, CustomerKycDocument } = require("../../models");
		const reloaded = await Customer.findOne({
			where: { id: customer.id },
			include: [
				{ model: CustomerKyc, as: "kyc" },
				{ model: CustomerKycDocument, as: "kycDocuments" },
			],
		});

		return sendSuccess(res, "Customer created successfully.", {
			customer: formatCustomer(reloaded, association),
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
		];
		const filteredUpdates = {};
		for (const field of allowedFields) {
			if (updates[field] !== undefined) {
				filteredUpdates[field] = updates[field];
			}
		}

		// Verify association exists
		const { VendorCustomer } = require("../../models");
		const association = await VendorCustomer.findOne({
			where: { customer_id: id, vendor_id: vendorId }
		});

		if (!association) {
			return sendError(res, "Customer not found.", {}, 404);
		}

		// Update global customer details
		await Customer.update(filteredUpdates, {
			where: { id },
		});

		// Update KYC details if provided
		const { idType, idNumber, kycDocumentImg } = updates;
		if (idType !== undefined || idNumber !== undefined || kycDocumentImg !== undefined) {
			const { CustomerKyc } = require("../../models");
			let dbKyc = await CustomerKyc.findOne({ where: { customer_id: id } });

			if (dbKyc) {
				const kycUpdates = {};
				if (idType !== undefined) kycUpdates.id_type = idType;
				if (idNumber !== undefined) kycUpdates.id_number = idNumber;
				// Reset status to Verified if document or ID changes
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

		const { CustomerKyc, CustomerKycDocument } = require("../../models");
		const updated = await Customer.findOne({
			where: { id },
			include: [
				{ model: CustomerKyc, as: "kyc" },
				{ model: CustomerKycDocument, as: "kycDocuments" },
			],
		});

		return sendSuccess(res, "Customer updated successfully.", {
			customer: formatCustomer(updated, association),
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

		const { VendorCustomer } = require("../../models");
		const affectedRows = await VendorCustomer.destroy({
			where: { customer_id: id, vendor_id: vendorId },
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

		const { VendorCustomer } = require("../../models");
		const deletedCount = await VendorCustomer.destroy({
			where: {
				customer_id: { [Op.in]: ids },
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

		const { VendorCustomer } = require("../../models");
		// Find associated customer IDs from the requested list
		const associations = await VendorCustomer.findAll({
			where: {
				customer_id: { [Op.in]: ids },
				vendor_id: vendorId,
			},
			attributes: ["customer_id"],
		});
		const associatedIds = associations.map(a => a.customer_id);

		if (associatedIds.length === 0) {
			return sendSuccess(res, "Selected customers status updated successfully.", { updatedCount: 0 });
		}

		const [updatedCount] = await Customer.update(
			{ status },
			{
				where: {
					id: { [Op.in]: associatedIds },
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

/**
 * Update Customer KYC details directly
 */
async function updateCustomerKyc(req, res) {
	try {
		const { id } = req.params;
		const vendorId = req.user.id;
		const { idType, idNumber, kycDocumentImg } = req.body;

		const { VendorCustomer, CustomerKyc, CustomerKycDocument } = require("../../models");
		const association = await VendorCustomer.findOne({ where: { customer_id: id, vendor_id: vendorId } });
		if (!association) {
			return sendError(res, "Customer not found.", {}, 404);
		}

		const customer = await Customer.findOne({ where: { id } });
		if (!customer) {
			return sendError(res, "Customer not found.", {}, 404);
		}

		let kyc = await CustomerKyc.findOne({ where: { customer_id: id } });

		if (kyc) {
			const updates = { kyc_status: "Verified" };
			if (idType) updates.id_type = idType;
			if (idNumber) updates.id_number = idNumber;
			await kyc.update(updates);
		} else {
			kyc = await CustomerKyc.create({
				customer_id: id,
				id_type: idType || null,
				id_number: idNumber || null,
				kyc_status: "Verified",
			});
		}

		if (kycDocumentImg !== undefined) {
			await syncCustomerKycDocuments(id, kycDocumentImg);
		}

		const updatedCustomer = await Customer.findOne({
			where: { id },
			include: [
				{ model: CustomerKyc, as: "kyc" },
				{ model: CustomerKycDocument, as: "kycDocuments" },
			],
		});

		return sendSuccess(res, "Customer KYC details updated.", {
			customer: formatCustomer(updatedCustomer, association),
		});
	} catch (error) {
		console.error("[CustomerController] updateCustomerKyc error:", error.message);
		return sendError(res, "Internal server error updating Customer KYC.", {}, 500);
	}
}

/**
 * Approve Customer KYC
 */
async function approveCustomerKyc(req, res) {
	try {
		const { id } = req.params;
		const vendorId = req.user.id;

		const { VendorCustomer, CustomerKyc, CustomerKycDocument } = require("../../models");
		const association = await VendorCustomer.findOne({ where: { customer_id: id, vendor_id: vendorId } });
		if (!association) {
			return sendError(res, "Customer not found.", {}, 404);
		}

		const customer = await Customer.findOne({ where: { id } });
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
			customer: formatCustomer(updatedCustomer, association),
		});
	} catch (error) {
		console.error("[CustomerController] approveCustomerKyc error:", error.message);
		return sendError(res, "Internal server error approving KYC.", {}, 500);
	}
}

/**
 * Reject Customer KYC
 */
async function rejectCustomerKyc(req, res) {
	try {
		const { id } = req.params;
		const vendorId = req.user.id;

		const { VendorCustomer, CustomerKyc, CustomerKycDocument } = require("../../models");
		const association = await VendorCustomer.findOne({ where: { customer_id: id, vendor_id: vendorId } });
		if (!association) {
			return sendError(res, "Customer not found.", {}, 404);
		}

		const customer = await Customer.findOne({ where: { id } });
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
			customer: formatCustomer(updatedCustomer, association),
		});
	} catch (error) {
		console.error("[CustomerController] rejectCustomerKyc error:", error.message);
		return sendError(res, "Internal server error rejecting KYC.", {}, 500);
	}
}

/**
 * Check if customer with phone number exists globally
 */
async function checkCustomerPhone(req, res) {
	try {
		const { phone } = req.query;
		if (!phone) {
			return sendError(res, "Phone number is required.", {}, 400);
		}

		// Find customer with this phone
		const { CustomerKyc, CustomerKycDocument } = require("../../models");
		const customer = await Customer.findOne({
			where: { phone },
			include: [
				{ model: CustomerKyc, as: "kyc" },
				{ model: CustomerKycDocument, as: "kycDocuments" },
			],
		});

		if (!customer) {
			return sendSuccess(res, "Customer not found.", { exists: false });
		}

		// Check if already associated with this vendor
		const vendorId = req.user.id;
		const { VendorCustomer } = require("../../models");
		const association = await VendorCustomer.findOne({
			where: { customer_id: customer.id, vendor_id: vendorId }
		});

		return sendSuccess(res, "Customer check complete.", {
			exists: true,
			alreadyAssociated: !!association,
			customer: formatCustomer(customer, association || null),
		});
	} catch (error) {
		console.error("[CustomerController] checkCustomerPhone error:", error.message);
		return sendError(res, "Internal server error checking phone.", {}, 500);
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
	updateCustomerKyc,
	approveCustomerKyc,
	rejectCustomerKyc,
	checkCustomerPhone,
};
