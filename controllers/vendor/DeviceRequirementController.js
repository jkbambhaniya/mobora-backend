const { DeviceRequirement, Brand, Model, Storage, Ram } = require("../../models");
const { sendSuccess, sendError } = require("../../utils/responseHelper");

/**
 * Get all active requirements for the current vendor.
 */
async function getRequirements(req, res) {
	try {
		const vendorId = req.user.id;
		const requirements = await DeviceRequirement.findAll({
			where: { vendor_id: vendorId },
			include: [
				{ model: Brand, as: "brand", attributes: ["name"] },
				{ model: Model, as: "model", attributes: ["name"] },
				{ model: Storage, as: "storage", attributes: ["value"] },
				{ model: Ram, as: "ram", attributes: ["value"] },
			],
			order: [["id", "DESC"]],
		});

		return sendSuccess(res, "Device requirements retrieved successfully.", {
			requirements: requirements.map((r) => ({
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
			})),
		});
	} catch (error) {
		console.error("[DeviceRequirementController] getRequirements error:", error.message);
		return sendError(res, "Internal server error retrieving requirements.", {}, 500);
	}
}

/**
 * Add a new device requirement.
 */
async function createRequirement(req, res) {
	try {
		const vendorId = req.user.id;
		const { brand_id, model_id, storage_id, ram_id, color } = req.body;

		if (!brand_id || !model_id || !storage_id || !ram_id) {
			return sendError(res, "Brand, Model, Storage, and RAM are required.", {}, 400);
		}

		const newRequirement = await DeviceRequirement.create({
			vendor_id: vendorId,
			brand_id,
			model_id,
			storage_id,
			ram_id,
			color: color || null,
			status: "Active",
		});

		const fetched = await DeviceRequirement.findByPk(newRequirement.id, {
			include: [
				{ model: Brand, as: "brand", attributes: ["name"] },
				{ model: Model, as: "model", attributes: ["name"] },
				{ model: Storage, as: "storage", attributes: ["value"] },
				{ model: Ram, as: "ram", attributes: ["value"] },
			],
		});

		return sendSuccess(
			res,
			"Device requirement registered successfully.",
			{
				requirement: {
					id: fetched.id,
					brandId: fetched.brand_id,
					brand: fetched.brand ? fetched.brand.name : "",
					modelId: fetched.model_id,
					model: fetched.model ? fetched.model.name : "",
					storageId: fetched.storage_id,
					storage: fetched.storage ? fetched.storage.value : "",
					ramId: fetched.ram_id,
					ram: fetched.ram ? fetched.ram.value : "",
					color: fetched.color || "Any Color",
					status: fetched.status,
					createdAt: fetched.created_at || fetched.createdAt,
				},
			},
			201,
		);
	} catch (error) {
		console.error("[DeviceRequirementController] createRequirement error:", error.message);
		return sendError(res, "Internal server error creating requirement.", {}, 500);
	}
}

/**
 * Delete a device requirement.
 */
async function deleteRequirement(req, res) {
	try {
		const { id } = req.params;
		const vendorId = req.user.id;

		const affectedRows = await DeviceRequirement.destroy({
			where: { id, vendor_id: vendorId },
		});

		if (affectedRows === 0) {
			return sendError(res, "Device requirement not found.", {}, 404);
		}

		return sendSuccess(res, "Device requirement deleted successfully.", { success: true });
	} catch (error) {
		console.error("[DeviceRequirementController] deleteRequirement error:", error.message);
		return sendError(res, "Internal server error deleting requirement.", {}, 500);
	}
}

/**
 * Get all mobile devices matching the vendor's active requirements.
 */
async function getMatchingDevices(req, res) {
	try {
		const vendorId = req.user.id;
		const { Mobile, Brand, Model, Storage, Ram, Vendor, BusinessDetail } = require("../../models");
		const { Op } = require("sequelize");

		// Fetch all active requirements for this vendor
		const activeReqs = await DeviceRequirement.findAll({
			where: { vendor_id: vendorId, status: "Active" }
		});

		if (activeReqs.length === 0) {
			return sendSuccess(res, "No active requirements found.", { matches: [] });
		}

		const matches = [];

		for (const r of activeReqs) {
			// Find devices matching this requirement from OTHER vendors
			const devices = await Mobile.findAll({
				where: {
					brand_id: r.brand_id,
					model_id: r.model_id,
					storage_id: r.storage_id,
					ram_id: r.ram_id,
					status: "Available",
					vendor_id: { [Op.ne]: vendorId },
					...(r.color ? { color: { [Op.like]: `%${r.color}%` } } : {})
				},
				include: [
					{ model: Brand, as: "brand", attributes: ["name"] },
					{ model: Model, as: "model", attributes: ["name"] },
					{ model: Storage, as: "storage", attributes: ["value"] },
					{ model: Ram, as: "ram", attributes: ["value"] },
					{
						model: Vendor,
						as: "vendor",
						attributes: ["id", "name", "email"],
						include: [{ model: BusinessDetail, as: "businessDetail", attributes: ["shop_name", "phone"] }]
					}
				]
			});

			for (const m of devices) {
				const purchaseTx = m.transactions ? m.transactions.find(tx => tx.type === "Purchase") : null;
				const basePrice = purchaseTx ? purchaseTx.amount : 200; // fallback default
				const sellingPrice = Math.round(basePrice * 1.2);

				matches.push({
					id: m.id,
					brand: m.brand ? m.brand.name : "",
					model: m.model ? m.model.name : "",
					storage: m.storage ? m.storage.value : "",
					ram: m.ram ? m.ram.value : "",
					color: m.color,
					condition: m.condition,
					price: sellingPrice,
					status: m.status,
					vendorName: m.vendor?.name || "Dealer",
					vendorEmail: m.vendor?.email || "",
					vendorPhone: m.vendor?.businessDetail?.phone || "",
					shopName: m.vendor?.businessDetail?.shop_name || "B2B Shop",
					vendorId: m.vendor?.id,
					matchedRequirementId: r.id
				});
			}
		}

		return sendSuccess(res, "Matching devices retrieved.", { matches });
	} catch (error) {
		console.error("[DeviceRequirementController] getMatchingDevices error:", error.message);
		return sendError(res, "Internal server error retrieving matching devices.", {}, 500);
	}
}

module.exports = {
	getRequirements,
	createRequirement,
	deleteRequirement,
	getMatchingDevices,
};
