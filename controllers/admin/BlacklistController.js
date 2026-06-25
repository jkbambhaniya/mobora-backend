const { BlacklistedMobile, Vendor, BusinessDetail } = require("../../models");
const { sendSuccess, sendError } = require("../../utils/responseHelper");
const { Op } = require("sequelize");

/**
 * Admin: Get all blacklisted devices across all vendors.
 */
async function getAllBlacklistedDevices(req, res) {
	try {
		const { search = "", page = 1, limit = 10, sortBy = "id", sortOrder = "desc" } = req.query;

		const pageNum = parseInt(page, 10) || 1;
		const limitNum = parseInt(limit, 10) || 10;
		const offset = (pageNum - 1) * limitNum;

		const where = {};
		if (search) {
			where[Op.or] = [
				{ imei: { [Op.like]: `%${search}%` } },
				{ reason: { [Op.like]: `%${search}%` } },
			];
		}

		const order = [[sortBy === "id" ? "id" : sortBy, sortOrder === "asc" ? "ASC" : "DESC"]];

		const { count, rows } = await BlacklistedMobile.findAndCountAll({
			where,
			order,
			limit: limitNum,
			offset,
			include: [
				{
					model: Vendor,
					as: "vendor",
					attributes: ["id", "name", "email"],
					include: [{ model: BusinessDetail, as: "businessDetail", attributes: ["shop_name", "phone"] }],
				},
			],
		});

		const totalBlacklisted = await BlacklistedMobile.count();
		const uniqueVendors = await BlacklistedMobile.count({
			distinct: true,
			col: "vendor_id",
		});

		return sendSuccess(res, "Blacklisted devices retrieved successfully.", {
			blacklistedDevices: rows.map((b) => ({
				id: b.id,
				imei: b.imei,
				reason: b.reason,
				createdAt: b.created_at || b.createdAt,
				vendorId: b.vendor?.id,
				vendorName: b.vendor?.name || "Unknown Vendor",
				vendorEmail: b.vendor?.email || "",
				shopName: b.vendor?.businessDetail?.shop_name || "",
				vendorPhone: b.vendor?.businessDetail?.phone || "",
			})),
			total: count,
			page: pageNum,
			limit: limitNum,
			metrics: {
				totalBlacklisted,
				uniqueVendors,
			},
		});
	} catch (error) {
		console.error("[Admin BlacklistController] getAllBlacklistedDevices error:", error.message);
		return sendError(res, "Internal server error retrieving blacklisted devices.", {}, 500);
	}
}

/**
 * Admin: Get a single blacklisted device by ID.
 */
async function getBlacklistedDeviceById(req, res) {
	try {
		const { id } = req.params;

		const blacklisted = await BlacklistedMobile.findByPk(id, {
			include: [
				{
					model: Vendor,
					as: "vendor",
					attributes: ["id", "name", "email"],
					include: [{ model: BusinessDetail, as: "businessDetail", attributes: ["shop_name", "phone", "address"] }],
				},
			],
		});

		if (!blacklisted) {
			return sendError(res, "Blacklisted device not found.", {}, 404);
		}

		return sendSuccess(res, "Blacklisted device details retrieved.", {
			blacklistedDevice: {
				id: blacklisted.id,
				imei: blacklisted.imei,
				reason: blacklisted.reason,
				createdAt: blacklisted.created_at || blacklisted.createdAt,
				updatedAt: blacklisted.updated_at || blacklisted.updatedAt,
				vendor: {
					id: blacklisted.vendor?.id,
					name: blacklisted.vendor?.name || "Unknown Vendor",
					email: blacklisted.vendor?.email || "",
					shopName: blacklisted.vendor?.businessDetail?.shop_name || "",
					phone: blacklisted.vendor?.businessDetail?.phone || "",
					address: blacklisted.vendor?.businessDetail?.address || "",
				},
			},
		});
	} catch (error) {
		console.error("[Admin BlacklistController] getBlacklistedDeviceById error:", error.message);
		return sendError(res, "Internal server error retrieving blacklisted device.", {}, 500);
	}
}

/**
 * Admin: Remove a blacklisted device entry.
 */
async function removeBlacklistedDevice(req, res) {
	try {
		const { id } = req.params;

		const affectedRows = await BlacklistedMobile.destroy({ where: { id } });

		if (affectedRows === 0) {
			return sendError(res, "Blacklisted device not found.", {}, 404);
		}

		return sendSuccess(res, "Blacklisted device removed successfully.", { success: true });
	} catch (error) {
		console.error("[Admin BlacklistController] removeBlacklistedDevice error:", error.message);
		return sendError(res, "Internal server error removing blacklisted device.", {}, 500);
	}
}

module.exports = {
	getAllBlacklistedDevices,
	getBlacklistedDeviceById,
	removeBlacklistedDevice,
};
