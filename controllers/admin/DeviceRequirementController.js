const { DeviceRequirement, Brand, Model, Storage, Ram, Vendor, BusinessDetail } = require("../../models");
const { sendSuccess, sendError } = require("../../utils/responseHelper");
const { Op } = require("sequelize");

/**
 * Admin: Get all device requirements across all vendors.
 */
async function getAllRequirements(req, res) {
	try {
		const { search = "", page = 1, limit = 10, status = "All", sortBy = "id", sortOrder = "desc" } = req.query;

		const pageNum = parseInt(page, 10) || 1;
		const limitNum = parseInt(limit, 10) || 10;
		const offset = (pageNum - 1) * limitNum;

		const vendorWhere = {};
		const reqWhere = {};

		if (status && status !== "All") {
			reqWhere.status = status;
		}

		const order = [[sortBy === "id" ? "id" : sortBy, sortOrder === "asc" ? "ASC" : "DESC"]];

		const { count, rows } = await DeviceRequirement.findAndCountAll({
			where: reqWhere,
			order,
			limit: limitNum,
			offset,
			include: [
				{ model: Brand, as: "brand", attributes: ["name"] },
				{ model: Model, as: "model", attributes: ["name"] },
				{ model: Storage, as: "storage", attributes: ["value"] },
				{ model: Ram, as: "ram", attributes: ["value"] },
				{
					model: Vendor,
					as: "vendor",
					attributes: ["id", "name", "email"],
					include: [{ model: BusinessDetail, as: "businessDetail", attributes: ["shop_name", "phone"] }],
					...(search
						? {
								where: {
									[Op.or]: [
										{ name: { [Op.like]: `%${search}%` } },
										{ email: { [Op.like]: `%${search}%` } },
									],
								},
								required: true,
							}
						: {}),
				},
			],
		});

		const totalRequirements = await DeviceRequirement.count();
		const activeRequirements = await DeviceRequirement.count({ where: { status: "Active" } });
		const uniqueVendors = await DeviceRequirement.count({
			distinct: true,
			col: "vendor_id",
		});

		return sendSuccess(res, "All device requirements retrieved successfully.", {
			requirements: rows.map((r) => ({
				id: r.id,
				brandId: r.brand_id,
				brand: r.brand ? r.brand.name : "",
				modelId: r.model_id,
				model: r.model ? r.model.name : "",
				storageId: r.storage_id,
				storage: r.storage ? r.storage.value : "",
				ramId: r.ram_id,
				ram: r.ram ? r.ram.value : "",
				color: r.color || "Any Color",
				status: r.status,
				createdAt: r.created_at || r.createdAt,
				vendorId: r.vendor?.id,
				vendorName: r.vendor?.name || "Unknown Vendor",
				vendorEmail: r.vendor?.email || "",
				shopName: r.vendor?.businessDetail?.shop_name || "",
				vendorPhone: r.vendor?.businessDetail?.phone || "",
			})),
			total: count,
			page: pageNum,
			limit: limitNum,
			metrics: {
				totalRequirements,
				activeRequirements,
				uniqueVendors,
			},
		});
	} catch (error) {
		console.error("[Admin DeviceRequirementController] getAllRequirements error:", error.message);
		return sendError(res, "Internal server error retrieving requirements.", {}, 500);
	}
}

/**
 * Admin: Get a single device requirement by ID.
 */
async function getRequirementById(req, res) {
	try {
		const { id } = req.params;

		const requirement = await DeviceRequirement.findByPk(id, {
			include: [
				{ model: Brand, as: "brand", attributes: ["name"] },
				{ model: Model, as: "model", attributes: ["name"] },
				{ model: Storage, as: "storage", attributes: ["value"] },
				{ model: Ram, as: "ram", attributes: ["value"] },
				{
					model: Vendor,
					as: "vendor",
					attributes: ["id", "name", "email"],
					include: [{ model: BusinessDetail, as: "businessDetail", attributes: ["shop_name", "phone", "address"] }],
				},
			],
		});

		if (!requirement) {
			return sendError(res, "Device requirement not found.", {}, 404);
		}

		return sendSuccess(res, "Device requirement details retrieved.", {
			requirement: {
				id: requirement.id,
				brandId: requirement.brand_id,
				brand: requirement.brand ? requirement.brand.name : "",
				modelId: requirement.model_id,
				model: requirement.model ? requirement.model.name : "",
				storageId: requirement.storage_id,
				storage: requirement.storage ? requirement.storage.value : "",
				ramId: requirement.ram_id,
				ram: requirement.ram ? requirement.ram.value : "",
				color: requirement.color || "Any Color",
				status: requirement.status,
				createdAt: requirement.created_at || requirement.createdAt,
				updatedAt: requirement.updated_at || requirement.updatedAt,
				vendor: {
					id: requirement.vendor?.id,
					name: requirement.vendor?.name || "Unknown Vendor",
					email: requirement.vendor?.email || "",
					shopName: requirement.vendor?.businessDetail?.shop_name || "",
					phone: requirement.vendor?.businessDetail?.phone || "",
					address: requirement.vendor?.businessDetail?.address || "",
				},
			},
		});
	} catch (error) {
		console.error("[Admin DeviceRequirementController] getRequirementById error:", error.message);
		return sendError(res, "Internal server error retrieving requirement.", {}, 500);
	}
}

/**
 * Admin: Delete a device requirement.
 */
async function deleteRequirement(req, res) {
	try {
		const { id } = req.params;

		const affectedRows = await DeviceRequirement.destroy({ where: { id } });

		if (affectedRows === 0) {
			return sendError(res, "Device requirement not found.", {}, 404);
		}

		return sendSuccess(res, "Device requirement deleted successfully.", { success: true });
	} catch (error) {
		console.error("[Admin DeviceRequirementController] deleteRequirement error:", error.message);
		return sendError(res, "Internal server error deleting requirement.", {}, 500);
	}
}

/**
 * Admin: Update a device requirement status.
 */
async function updateRequirementStatus(req, res) {
	try {
		const { id } = req.params;
		const { status } = req.body;

		if (!["Active", "Inactive"].includes(status)) {
			return sendError(res, "Invalid status. Must be 'Active' or 'Inactive'.", {}, 400);
		}

		const [affectedRows] = await DeviceRequirement.update({ status }, { where: { id } });

		if (affectedRows === 0) {
			return sendError(res, "Device requirement not found.", {}, 404);
		}

		return sendSuccess(res, "Device requirement status updated.", { success: true, status });
	} catch (error) {
		console.error("[Admin DeviceRequirementController] updateRequirementStatus error:", error.message);
		return sendError(res, "Internal server error updating requirement.", {}, 500);
	}
}

module.exports = {
	getAllRequirements,
	getRequirementById,
	deleteRequirement,
	updateRequirementStatus,
};
