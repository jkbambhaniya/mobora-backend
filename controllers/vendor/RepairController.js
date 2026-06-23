const { Repair, sequelize } = require("../../models");
const { Op } = require("sequelize");
const { sendSuccess, sendError } = require("../../utils/responseHelper");

/**
 * Get all repair jobs for the logged-in vendor.
 */
async function getRepairs(req, res) {
	try {
		const vendorId = req.user.id;
		const { search, status, sortBy = "createdAt", sortOrder = "desc" } = req.query;

		const where = { vendor_id: vendorId };

		if (status && status !== "All") {
			where.status = status;
		}

		if (search) {
			const searchQuery = `%${search}%`;
			where[Op.or] = [
				{ customer_name: { [Op.like]: searchQuery } },
				{ customer_phone: { [Op.like]: searchQuery } },
				{ device_model: { [Op.like]: searchQuery } },
				{ imei: { [Op.like]: searchQuery } },
				{ notes: { [Op.like]: searchQuery } },
			];
		}

		const direction = sortOrder.toLowerCase() === "asc" ? "ASC" : "DESC";
		let orderClause = [["created_at", "DESC"]];
		if (sortBy === "deliveryDate") {
			orderClause = [["delivery_date", direction]];
		} else if (sortBy === "cost") {
			orderClause = [["estimated_cost", direction]];
		} else if (sortBy === "createdAt") {
			orderClause = [["created_at", direction]];
		}

		const repairs = await Repair.findAll({
			where,
			order: orderClause,
		});

		// Parse JSON strings in issues back into arrays
		const formattedRepairs = repairs.map(r => {
			const data = r.toJSON();
			try {
				data.issues = JSON.parse(data.issues || "[]");
			} catch (e) {
				data.issues = [];
			}
			return data;
		});

		return sendSuccess(res, "Repairs retrieved successfully.", { repairs: formattedRepairs });
	} catch (error) {
		console.error("[RepairController] getRepairs error:", error.message);
		return sendError(res, "Internal server error retrieving repairs.", {}, 500);
	}
}

/**
 * Record a new repair job.
 */
async function createRepair(req, res) {
	try {
		const vendorId = req.user.id;
		const {
			customer_name,
			customer_phone,
			device_model,
			imei,
			issues,
			estimated_cost,
			delivery_date,
			notes,
		} = req.body;

		if (!customer_name || !customer_phone || !device_model || estimated_cost === undefined || !delivery_date) {
			return sendError(res, "Required fields are missing.", {}, 400);
		}

		const issuesStr = Array.isArray(issues) ? JSON.stringify(issues) : "[]";

		const newRepair = await Repair.create({
			vendor_id: vendorId,
			customer_name,
			customer_phone,
			device_model,
			imei: imei || null,
			issues: issuesStr,
			estimated_cost: Number(estimated_cost),
			status: "Received",
			delivery_date,
			notes: notes || "",
		});

		const formatted = newRepair.toJSON();
		formatted.issues = JSON.parse(formatted.issues);

		return sendSuccess(res, "Repair job sheet recorded successfully.", { repair: formatted }, 201);
	} catch (error) {
		console.error("[RepairController] createRepair error:", error.message);
		return sendError(res, "Internal server error recording repair job.", {}, 500);
	}
}

/**
 * Update an existing repair job.
 */
async function updateRepair(req, res) {
	try {
		const vendorId = req.user.id;
		const { id } = req.params;
		const {
			customer_name,
			customer_phone,
			device_model,
			imei,
			issues,
			estimated_cost,
			status,
			delivery_date,
			notes,
		} = req.body;

		const repair = await Repair.findOne({ where: { id, vendor_id: vendorId } });
		if (!repair) {
			return sendError(res, "Repair job not found.", {}, 404);
		}

		const updates = {};
		if (customer_name !== undefined) updates.customer_name = customer_name;
		if (customer_phone !== undefined) updates.customer_phone = customer_phone;
		if (device_model !== undefined) updates.device_model = device_model;
		if (imei !== undefined) updates.imei = imei || null;
		if (issues !== undefined) {
			updates.issues = Array.isArray(issues) ? JSON.stringify(issues) : "[]";
		}
		if (estimated_cost !== undefined) updates.estimated_cost = Number(estimated_cost);
		if (status !== undefined) updates.status = status;
		if (delivery_date !== undefined) updates.delivery_date = delivery_date;
		if (notes !== undefined) updates.notes = notes;

		await repair.update(updates);

		const formatted = repair.toJSON();
		try {
			formatted.issues = JSON.parse(formatted.issues || "[]");
		} catch (e) {
			formatted.issues = [];
		}

		return sendSuccess(res, "Repair job updated successfully.", { repair: formatted });
	} catch (error) {
		console.error("[RepairController] updateRepair error:", error.message);
		return sendError(res, "Internal server error updating repair job.", {}, 500);
	}
}

/**
 * Delete a repair job.
 */
async function deleteRepair(req, res) {
	try {
		const vendorId = req.user.id;
		const { id } = req.params;

		const repair = await Repair.findOne({ where: { id, vendor_id: vendorId } });
		if (!repair) {
			return sendError(res, "Repair job not found.", {}, 404);
		}

		await repair.destroy();

		return sendSuccess(res, "Repair job deleted successfully.", {});
	} catch (error) {
		console.error("[RepairController] deleteRepair error:", error.message);
		return sendError(res, "Internal server error deleting repair job.", {}, 500);
	}
}

module.exports = {
	getRepairs,
	createRepair,
	updateRepair,
	deleteRepair,
};
