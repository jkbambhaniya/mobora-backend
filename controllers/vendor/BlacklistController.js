const { BlacklistedMobile, Vendor, BusinessDetail } = require("../../models");
const { sendSuccess, sendError } = require("../../utils/responseHelper");

/**
 * Add a device IMEI to the blacklist.
 */
async function blacklistDevice(req, res) {
	try {
		const vendorId = req.user.id;
		const { imei, reason } = req.body;

		if (!imei) {
			return sendError(res, "IMEI is required.", { imei: "IMEI is required." }, 400);
		}

		if (imei.length < 14 || imei.length > 16) {
			return sendError(res, "IMEI must be a valid 15-digit number.", { imei: "Invalid IMEI length." }, 400);
		}

		const existing = await BlacklistedMobile.findOne({ where: { imei } });
		if (existing) {
			return sendError(res, "This device is already blacklisted.", {}, 409);
		}

		const newBlacklist = await BlacklistedMobile.create({
			vendor_id: vendorId,
			imei,
			reason: reason || "No description provided.",
		});

		return sendSuccess(res, "Device successfully blacklisted.", { blacklist: newBlacklist }, 201);
	} catch (error) {
		console.error("[BlacklistController] blacklistDevice error:", error.message);
		return sendError(res, "Internal server error blacklisting device.", {}, 500);
	}
}

/**
 * Get all devices blacklisted by the current vendor.
 */
async function getBlacklistedDevices(req, res) {
	try {
		const vendorId = req.user.id;
		const list = await BlacklistedMobile.findAll({
			where: { vendor_id: vendorId },
			order: [["id", "DESC"]],
		});

		return sendSuccess(res, "Blacklisted devices retrieved successfully.", {
			blacklistedDevices: list,
		});
	} catch (error) {
		console.error("[BlacklistController] getBlacklistedDevices error:", error.message);
		return sendError(res, "Internal server error retrieving blacklisted devices.", {}, 500);
	}
}

/**
 * Check if a device IMEI is blacklisted.
 */
async function checkBlacklist(req, res) {
	try {
		const { imei } = req.params;

		if (!imei) {
			return sendError(res, "IMEI parameter is required.", {}, 400);
		}

		const blacklisted = await BlacklistedMobile.findOne({
			where: { imei },
			include: [
				{
					model: Vendor,
					as: "vendor",
					attributes: ["name"],
					include: [{ model: BusinessDetail, as: "businessDetail", attributes: ["shop_name"] }],
				},
			],
		});

		if (blacklisted) {
			const shopName = blacklisted.vendor?.businessDetail?.shop_name;
			const vendorName = blacklisted.vendor?.name || "Another Vendor";
			const blacklistedBy = shopName ? `${shopName} (${vendorName})` : vendorName;

			return sendSuccess(res, "Device is blacklisted.", {
				isBlacklisted: true,
				reason: blacklisted.reason,
				blacklistedBy,
				createdAt: blacklisted.createdAt || blacklisted.created_at,
			});
		}

		return sendSuccess(res, "Device is not blacklisted.", {
			isBlacklisted: false,
		});
	} catch (error) {
		console.error("[BlacklistController] checkBlacklist error:", error.message);
		return sendError(res, "Internal server error checking device blacklist status.", {}, 500);
	}
}

module.exports = {
	blacklistDevice,
	getBlacklistedDevices,
	checkBlacklist,
};
