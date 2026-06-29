const { CourierOrder, Mobile, MobileStock, Vendor, BusinessDetail, Brand, Model, Storage, Ram, sequelize } = require("../../models");
const { sendSuccess, sendError } = require("../../utils/responseHelper");
const { Op } = require("sequelize");

/**
 * List all courier orders with search, filter, sorting, and pagination
 */
async function listCourierOrders(req, res) {
	try {
		const { search, status, page, limit, sortBy, sortOrder } = req.query;

		const pageNum = parseInt(page, 10) || 1;
		const limitNum = parseInt(limit, 10) || 10;
		const offset = (pageNum - 1) * limitNum;

		const whereClause = {};

		if (status && status !== "All") {
			whereClause.status = status;
		}

		if (search) {
			whereClause[Op.or] = [
				{ courier_name: { [Op.like]: `%${search}%` } },
				{ tracking_id: { [Op.like]: `%${search}%` } },
				{ '$seller.name$': { [Op.like]: `%${search}%` } },
				{ '$buyer.name$': { [Op.like]: `%${search}%` } },
				{ '$seller.businessDetail.shop_name$': { [Op.like]: `%${search}%` } },
				{ '$buyer.businessDetail.shop_name$': { [Op.like]: `%${search}%` } }
			];
		}

		const sortField = sortBy || "id";
		const orderDir = (sortOrder || "DESC").toUpperCase();
		const order = [[sortField, orderDir]];

		const { count, rows } = await CourierOrder.findAndCountAll({
			where: whereClause,
			include: [
				{
					model: Vendor,
					as: "seller",
					attributes: ["id", "name", "email"],
					include: [{ model: BusinessDetail, as: "businessDetail", attributes: ["shop_name", "phone"] }]
				},
				{
					model: Vendor,
					as: "buyer",
					attributes: ["id", "name", "email"],
					include: [{ model: BusinessDetail, as: "businessDetail", attributes: ["shop_name", "phone"] }]
				},
				{
					model: Mobile,
					as: "sellerMobile",
					include: [
						{ model: Brand, as: "brand", attributes: ["name"] },
						{ model: Model, as: "model", attributes: ["name"] },
						{ model: Storage, as: "storage", attributes: ["value"] },
						{ model: Ram, as: "ram", attributes: ["value"] },
					]
				},
				{
					model: Mobile,
					as: "buyerMobile",
					include: [
						{ model: Brand, as: "brand", attributes: ["name"] },
						{ model: Model, as: "model", attributes: ["name"] },
						{ model: Storage, as: "storage", attributes: ["value"] },
						{ model: Ram, as: "ram", attributes: ["value"] },
					]
				}
			],
			order,
			limit: limitNum,
			offset,
			distinct: true
		});

		// Fetch quick metrics for the dashboard
		const totalCount = await CourierOrder.count();
		const pendingCount = await CourierOrder.count({ where: { status: "Pending" } });
		const shippedCount = await CourierOrder.count({ where: { status: "Shipped" } });
		const deliveredCount = await CourierOrder.count({ where: { status: "Delivered" } });
		const cancelledCount = await CourierOrder.count({ where: { status: "Cancelled" } });

		const totalPages = Math.ceil(count / limitNum);

		return sendSuccess(res, "Courier orders retrieved successfully.", {
			orders: rows,
			metrics: {
				totalCount,
				pendingCount,
				shippedCount,
				deliveredCount,
				cancelledCount
			},
			pagination: {
				totalCount: count,
				totalPages,
				currentPage: pageNum,
				limit: limitNum,
				sortBy: sortField,
				sortOrder: orderDir
			}
		});
	} catch (error) {
		console.error("[Admin CourierOrder] List error:", error.message);
		return sendError(res, "An internal server error occurred while retrieving courier orders.", {}, 500);
	}
}

/**
 * Cancel a courier order by Admin
 */
async function cancelCourierOrder(req, res) {
	const t = await sequelize.transaction();
	try {
		const { id } = req.params;

		const order = await CourierOrder.findByPk(id, { transaction: t });

		if (!order) {
			await t.rollback();
			return sendError(res, "Courier order not found.", {}, 404);
		}

		if (order.status !== "Pending" && order.status !== "Shipped") {
			await t.rollback();
			return sendError(res, `Cannot cancel order in status: ${order.status}`, {}, 400);
		}

		// Revert Seller's Mobile status to Available in MobileStock
		await MobileStock.update(
			{ status: "Available" },
			{
				where: { mobile_id: order.seller_mobile_id, vendor_id: order.seller_id },
				transaction: t
			}
		);

		// Revert Buyer's Mobile status to Cancelled in MobileStock
		if (order.buyer_mobile_id) {
			await MobileStock.update(
				{ status: "Cancelled" },
				{
					where: { mobile_id: order.buyer_mobile_id, vendor_id: order.buyer_id },
					transaction: t
				}
			);
		}

		await order.update({ status: "Cancelled" }, { transaction: t });

		await t.commit();
		return sendSuccess(res, "Courier order cancelled successfully by Admin.", { order });
	} catch (error) {
		await t.rollback();
		console.error("[Admin CourierOrder] cancel error:", error.message);
		return sendError(res, "Failed to cancel courier order.", {}, 500);
	}
}

module.exports = {
	listCourierOrders,
	cancelCourierOrder
};
