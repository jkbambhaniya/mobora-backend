const { CourierOrder, Mobile, Transaction, Vendor, Brand, Model, Storage, Ram, Notification, ChatSession, Message, sequelize } = require("../../models");
const { sendSuccess, sendError } = require("../../utils/responseHelper");
const { Op } = require("sequelize");
const socketHandler = require("../../utils/socketHandler");


/**
 * Get all courier orders for the logged-in vendor (both as seller or buyer)
 */
async function getCourierOrders(req, res) {
	try {
		const vendorId = req.user.id;
		const { type = "all" } = req.query; // 'sales', 'purchases', or 'all'

		const where = {};
		if (type === "sales") {
			where.seller_id = vendorId;
		} else if (type === "purchases") {
			where.buyer_id = vendorId;
		} else {
			where[Op.or] = [
				{ seller_id: vendorId },
				{ buyer_id: vendorId }
			];
		}

		const orders = await CourierOrder.findAll({
			where,
			include: [
				{
					model: Vendor,
					as: "seller",
					attributes: ["id", "name"],
				},
				{
					model: Vendor,
					as: "buyer",
					attributes: ["id", "name"],
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
			order: [["id", "DESC"]]
		});

		return sendSuccess(res, "Courier orders fetched successfully.", { orders });
	} catch (error) {
		console.error("[CourierOrderController] getCourierOrders error:", error.message);
		return sendError(res, "Failed to fetch courier orders.", {}, 500);
	}
}

/**
 * Create a new Courier Order (V2V Sale initialization)
 */
async function createCourierOrder(req, res) {
	const t = await sequelize.transaction();
	try {
		const sellerId = req.user.id;
		const { buyer_id, mobile_id, amount, notes } = req.body;

		if (!buyer_id || !mobile_id || !amount) {
			await t.rollback();
			return sendError(res, "Missing required fields (buyer_id, mobile_id, amount).", {}, 400);
		}

		if (Number(sellerId) === Number(buyer_id)) {
			await t.rollback();
			return sendError(res, "You cannot sell a device to yourself.", {}, 400);
		}

		// Verify seller owns this mobile and it is available
		const mobile = await Mobile.findOne({
			where: { id: mobile_id, vendor_id: sellerId },
			transaction: t,
		});

		if (!mobile) {
			await t.rollback();
			return sendError(res, "Mobile listing not found in your inventory.", {}, 404);
		}

		if (mobile.status !== "Available") {
			await t.rollback();
			return sendError(res, `Mobile is not available for sale. Current status: ${mobile.status}`, {}, 400);
		}

		// Update mobile status to Pending
		await mobile.update({ status: "Pending" }, { transaction: t });

		// Create buyer's mobile in Pending status
		const buyerMobile = await Mobile.create({
			vendor_id: buyer_id,
			brand_id: mobile.brand_id,
			model_id: mobile.model_id,
			storage_id: mobile.storage_id,
			ram_id: mobile.ram_id,
			color: mobile.color,
			imei: mobile.imei ? `${mobile.imei}` : null,
			condition: mobile.condition,
			battery_health: mobile.battery_health,
			status: "Pending",
			description: `Courier purchase pending from Vendor ID ${sellerId}.`,
			repairing_cost: 0
		}, { transaction: t });

		// Create CourierOrder linked with both mobiles
		const order = await CourierOrder.create({
			seller_id: sellerId,
			buyer_id,
			seller_mobile_id: mobile_id,
			buyer_mobile_id: buyerMobile.id,
			amount,
			status: "Pending",
			date: new Date().toISOString().split("T")[0],
			notes: notes || "Courier shipment sales order initialized.",
		}, { transaction: t });

		await t.commit();


		// Send Notification and Chat Message asynchronously
		try {
			const seller = await Vendor.findByPk(sellerId, {
				include: [{ model: sequelize.models.BusinessDetail, as: "businessDetail" }]
			});
			const buyer = await Vendor.findByPk(buyer_id);
			
			const mobileDetails = await Mobile.findByPk(mobile_id, {
				include: [
					{ model: Brand, as: "brand", attributes: ["name"] },
					{ model: Model, as: "model", attributes: ["name"] },
					{ model: Storage, as: "storage", attributes: ["value"] },
					{ model: Ram, as: "ram", attributes: ["value"] },
				]
			});

			if (seller && buyer && mobileDetails) {
				const sellerShopName = seller.businessDetail ? seller.businessDetail.shop_name : seller.name;
				const deviceName = `${mobileDetails.brand ? mobileDetails.brand.name : ""} ${mobileDetails.model ? mobileDetails.model.name : ""} (${mobileDetails.storage ? mobileDetails.storage.value : ""}/${mobileDetails.ram ? mobileDetails.ram.value : ""})`;
				const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

				// 1. Create Notification for Buyer
				const notifBody = `${sellerShopName} has registered a courier sale to you for ${deviceName} of ₹${amount.toLocaleString()}.`;
				const notif = await Notification.create({
					vendor_id: buyer_id,
					type: "courier_order",
					title: "New Courier Order!",
					body: notifBody,
					timestamp
				});

				const io = socketHandler.getIo();
				if (io) {
					io.to(`vendor-${buyer_id}`).emit('new_notification', {
						id: `notif-${notif.id}`,
						type: 'courier_order',
						title: 'New Courier Order!',
						body: notifBody,
						timestamp
					});
				}

				// 2. Chat message
				const chatIdSender = `chat-${sellerId}-${buyer_id}`;
				const chatIdRecipient = `chat-${buyer_id}-${sellerId}`;

				// Check/create chat session for Seller (Sender)
				let sessionSender = await ChatSession.findOne({
					where: { vendor_id: sellerId, recipient_vendor_id: buyer_id }
				});
				if (!sessionSender) {
					const initials = buyer.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'VD';
					sessionSender = await ChatSession.create({
						chat_id: chatIdSender,
						vendor_id: sellerId,
						recipient_vendor_id: buyer_id,
						customer_name: buyer.name,
						avatar: initials,
						status: 'offline',
						last_message: '',
						unread_count: 0,
						last_active: 'Just now',
						notes: 'B2B Trade Partner'
					});
				}

				// Check/create chat session for Buyer (Recipient)
				let sessionRecipient = await ChatSession.findOne({
					where: { vendor_id: buyer_id, recipient_vendor_id: sellerId }
				});
				if (!sessionRecipient) {
					const initials = seller.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'VD';
					sessionRecipient = await ChatSession.create({
						chat_id: chatIdRecipient,
						vendor_id: buyer_id,
						recipient_vendor_id: sellerId,
						customer_name: seller.name,
						avatar: initials,
						status: 'offline',
						last_message: '',
						unread_count: 0,
						last_active: 'Just now',
						device_interest: sellerShopName,
						notes: 'B2B Trade Partner'
					});
				}

				const messageText = `Hi! I have initiated a courier sale to you for ${deviceName} for ₹${amount.toLocaleString()}. Please track it in your Courier Orders portal.`;

				// Create messages
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

				// Update sessions
				await ChatSession.update(
					{ last_message: messageText, last_active: 'Just now' },
					{ where: { chat_id: chatIdSender, vendor_id: sellerId } }
				);

				await ChatSession.update(
					{ last_message: messageText, last_active: 'Just now', unread_count: sequelize.literal('unread_count + 1') },
					{ where: { chat_id: chatIdRecipient, vendor_id: buyer_id } }
				);

				if (io) {
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

					const sessionsA = await socketHandler.fetchVendorSessions(sellerId);
					const sessionsB = await socketHandler.fetchVendorSessions(buyer_id);
					io.to(`vendor-${sellerId}`).emit('sessions_update', sessionsA);
					io.to(`vendor-${buyer_id}`).emit('sessions_update', sessionsB);
				}
			}
		} catch (err) {
			console.error("[CourierOrderController] Failed to send chat notification:", err.message);
		}

		return sendSuccess(res, "Courier order created successfully. Awaiting dispatch.", { order }, 201);

	} catch (error) {
		await t.rollback();
		console.error("[CourierOrderController] createCourierOrder error:", error.message);
		return sendError(res, "Failed to create courier order.", {}, 500);
	}
}

/**
 * Update shipment info (Ship the order)
 */
async function shipCourierOrder(req, res) {
	try {
		const sellerId = req.user.id;
		const { id } = req.params;
		const { courier_name, tracking_id } = req.body;

		if (!courier_name || !tracking_id) {
			return sendError(res, "Missing courier_name or tracking_id.", {}, 400);
		}

		const order = await CourierOrder.findOne({
			where: { id, seller_id: sellerId }
		});

		if (!order) {
			return sendError(res, "Order not found or you are not authorized.", {}, 404);
		}

		if (order.status !== "Pending") {
			return sendError(res, `Cannot ship order in current status: ${order.status}`, {}, 400);
		}

		const t = await sequelize.transaction();
		try {
			// Update seller mobile status to Shipped
			await Mobile.update({ status: "Shipped" }, {
				where: { id: order.seller_mobile_id },
				transaction: t
			});

			// Update buyer mobile status to Shipped
			if (order.buyer_mobile_id) {
				await Mobile.update({ status: "Shipped" }, {
					where: { id: order.buyer_mobile_id },
					transaction: t
				});
			}

			await order.update({
				courier_name,
				tracking_id,
				status: "Shipped"
			}, { transaction: t });

			await t.commit();

			// Send Notification and Chat Message asynchronously
			try {
				const buyer_id = order.buyer_id;
				const amount = order.amount;
				const mobile_id = order.seller_mobile_id;

				const seller = await Vendor.findByPk(sellerId, {
					include: [{ model: sequelize.models.BusinessDetail, as: "businessDetail" }]
				});
				const buyer = await Vendor.findByPk(buyer_id);
				
				const mobileDetails = await Mobile.findByPk(mobile_id, {
					include: [
						{ model: Brand, as: "brand", attributes: ["name"] },
						{ model: Model, as: "model", attributes: ["name"] },
						{ model: Storage, as: "storage", attributes: ["value"] },
						{ model: Ram, as: "ram", attributes: ["value"] },
					]
				});

				if (seller && buyer && mobileDetails) {
					const sellerShopName = seller.businessDetail ? seller.businessDetail.shop_name : seller.name;
					const deviceName = `${mobileDetails.brand ? mobileDetails.brand.name : ""} ${mobileDetails.model ? mobileDetails.model.name : ""} (${mobileDetails.storage ? mobileDetails.storage.value : ""}/${mobileDetails.ram ? mobileDetails.ram.value : ""})`;
					const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

					// 1. Create Notification for Buyer
					const notifBody = `${sellerShopName} has shipped your order for ${deviceName} via ${courier_name} (Tracking ID: ${tracking_id}).`;
					const notif = await Notification.create({
						vendor_id: buyer_id,
						type: "courier_order",
						title: "Order Shipped!",
						body: notifBody,
						timestamp
					});

					const io = socketHandler.getIo();
					if (io) {
						io.to(`vendor-${buyer_id}`).emit('new_notification', {
							id: `notif-${notif.id}`,
							type: 'courier_order',
							title: 'Order Shipped!',
							body: notifBody,
							timestamp
						});
					}

					// 2. Chat message
					const chatIdSender = `chat-${sellerId}-${buyer_id}`;
					const chatIdRecipient = `chat-${buyer_id}-${sellerId}`;

					// Check/create chat session for Seller (Sender)
					let sessionSender = await ChatSession.findOne({
						where: { vendor_id: sellerId, recipient_vendor_id: buyer_id }
					});
					if (!sessionSender) {
						const initials = buyer.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'VD';
						sessionSender = await ChatSession.create({
							chat_id: chatIdSender,
							vendor_id: sellerId,
							recipient_vendor_id: buyer_id,
							customer_name: buyer.name,
							avatar: initials,
							status: 'offline',
							last_message: '',
							unread_count: 0,
							last_active: 'Just now',
							notes: 'B2B Trade Partner'
						});
					}

					// Check/create chat session for Buyer (Recipient)
					let sessionRecipient = await ChatSession.findOne({
						where: { vendor_id: buyer_id, recipient_vendor_id: sellerId }
					});
					if (!sessionRecipient) {
						const initials = seller.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'VD';
						sessionRecipient = await ChatSession.create({
							chat_id: chatIdRecipient,
							vendor_id: buyer_id,
							recipient_vendor_id: sellerId,
							customer_name: seller.name,
							avatar: initials,
							status: 'offline',
							last_message: '',
							unread_count: 0,
							last_active: 'Just now',
							device_interest: sellerShopName,
							notes: 'B2B Trade Partner'
						});
					}

					const messageText = `I have shipped your courier order for ${deviceName} via ${courier_name} (Tracking ID: ${tracking_id}).`;

					// Create messages
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

					// Update sessions
					await ChatSession.update(
						{ last_message: messageText, last_active: 'Just now' },
						{ where: { chat_id: chatIdSender, vendor_id: sellerId } }
					);

					await ChatSession.update(
						{ last_message: messageText, last_active: 'Just now', unread_count: sequelize.literal('unread_count + 1') },
						{ where: { chat_id: chatIdRecipient, vendor_id: buyer_id } }
					);

					if (io) {
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

						const sessionsA = await socketHandler.fetchVendorSessions(sellerId);
						const sessionsB = await socketHandler.fetchVendorSessions(buyer_id);
						io.to(`vendor-${sellerId}`).emit('sessions_update', sessionsA);
						io.to(`vendor-${buyer_id}`).emit('sessions_update', sessionsB);
					}
				}
			} catch (err) {
				console.error("[CourierOrderController] Failed to send ship chat notification:", err.message);
			}

			return sendSuccess(res, "Order shipped successfully with courier details.", { order });
		} catch (shipErr) {
			await t.rollback();
			console.error("[CourierOrderController] ship transaction failed:", shipErr);
			return sendError(res, "Failed to update shipment status.", {}, 500);
		}
	} catch (error) {
		console.error("[CourierOrderController] shipCourierOrder error:", error.message);
		return sendError(res, "Failed to ship order.", {}, 500);
	}
}

/**
 * Confirm delivery and perform the double transaction + ownership creation
 */
async function receiveCourierOrder(req, res) {
	const t = await sequelize.transaction();
	try {
		const buyerId = req.user.id;
		const { id } = req.params;

		const order = await CourierOrder.findOne({
			where: { id, buyer_id: buyerId },
			transaction: t
		});

		if (!order) {
			await t.rollback();
			return sendError(res, "Order not found or you are not authorized.", {}, 404);
		}

		if (order.status !== "Shipped") {
			await t.rollback();
			return sendError(res, `Cannot confirm receipt for order in status: ${order.status}`, {}, 400);
		}

		// Get Seller's Mobile
		const sellerMobile = await Mobile.findOne({
			where: { id: order.seller_mobile_id },
			transaction: t
		});

		if (!sellerMobile) {
			await t.rollback();
			return sendError(res, "Original mobile listing not found.", {}, 404);
		}

		// 1. Mark Seller's Mobile as Sold
		await sellerMobile.update({ status: "Sold" }, { transaction: t });

		// 2. Update Buyer's Mobile status to Available
		if (order.buyer_mobile_id) {
			await Mobile.update({
				status: "Available",
				description: `Purchased from Vendor ID ${order.seller_id} via Courier Order #${order.id}.`
			}, {
				where: { id: order.buyer_mobile_id },
				transaction: t
			});
		}


		// 3. Create Sale Transaction for Seller
		const currentDate = new Date().toISOString().split("T")[0];
		await Transaction.create({
			vendor_id: order.seller_id,
			partner_id: buyerId,
			partner_type: "Vendor",
			mobile_id: sellerMobile.id,
			type: "Sale",
			amount: order.amount,
			date: currentDate,
			notes: `Sold to Vendor ID ${buyerId} via Courier Order #${order.id}`,
		}, { transaction: t });

		// 4. Create Purchase Transaction for Buyer
		await Transaction.create({
			vendor_id: buyerId,
			partner_id: order.seller_id,
			partner_type: "Vendor",
			mobile_id: order.buyer_mobile_id,
			type: "Purchase",
			amount: order.amount,
			date: currentDate,
			notes: `Purchased from Vendor ID ${order.seller_id} via Courier Order #${order.id}`,
		}, { transaction: t });

		// 5. Complete the order status
		await order.update({
			status: "Delivered"
		}, { transaction: t });


		await t.commit();

		// Send Notification and Chat Message asynchronously
		try {
			const seller_id = order.seller_id;
			const amount = order.amount;
			const mobile_id = order.seller_mobile_id;

			const buyer = await Vendor.findByPk(buyerId, {
				include: [{ model: sequelize.models.BusinessDetail, as: "businessDetail" }]
			});
			const seller = await Vendor.findByPk(seller_id);
			
			const mobileDetails = await Mobile.findByPk(mobile_id, {
				include: [
					{ model: Brand, as: "brand", attributes: ["name"] },
					{ model: Model, as: "model", attributes: ["name"] },
					{ model: Storage, as: "storage", attributes: ["value"] },
					{ model: Ram, as: "ram", attributes: ["value"] },
				]
			});

			if (seller && buyer && mobileDetails) {
				const buyerShopName = buyer.businessDetail ? buyer.businessDetail.shop_name : buyer.name;
				const deviceName = `${mobileDetails.brand ? mobileDetails.brand.name : ""} ${mobileDetails.model ? mobileDetails.model.name : ""} (${mobileDetails.storage ? mobileDetails.storage.value : ""}/${mobileDetails.ram ? mobileDetails.ram.value : ""})`;
				const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

				// 1. Create Notification for Seller
				const notifBody = `${buyerShopName} has received and confirmed delivery of the order for ${deviceName}.`;
				const notif = await Notification.create({
					vendor_id: seller_id,
					type: "courier_order",
					title: "Order Delivered!",
					body: notifBody,
					timestamp
				});

				const io = socketHandler.getIo();
				if (io) {
					io.to(`vendor-${seller_id}`).emit('new_notification', {
						id: `notif-${notif.id}`,
						type: 'courier_order',
						title: 'Order Delivered!',
						body: notifBody,
						timestamp
					});
				}

				// 2. Chat message
				const chatIdSender = `chat-${buyerId}-${seller_id}`;
				const chatIdRecipient = `chat-${seller_id}-${buyerId}`;

				// Check/create chat session for Buyer (Sender)
				let sessionSender = await ChatSession.findOne({
					where: { vendor_id: buyerId, recipient_vendor_id: seller_id }
				});
				if (!sessionSender) {
					const initials = seller.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'VD';
					sessionSender = await ChatSession.create({
						chat_id: chatIdSender,
						vendor_id: buyerId,
						recipient_vendor_id: seller_id,
						customer_name: seller.name,
						avatar: initials,
						status: 'offline',
						last_message: '',
						unread_count: 0,
						last_active: 'Just now',
						notes: 'B2B Trade Partner'
					});
				}

				// Check/create chat session for Seller (Recipient)
				let sessionRecipient = await ChatSession.findOne({
					where: { vendor_id: seller_id, recipient_vendor_id: buyerId }
				});
				if (!sessionRecipient) {
					const initials = buyer.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'VD';
					sessionRecipient = await ChatSession.create({
						chat_id: chatIdRecipient,
						vendor_id: seller_id,
						recipient_vendor_id: buyerId,
						customer_name: buyer.name,
						avatar: initials,
						status: 'offline',
						last_message: '',
						unread_count: 0,
						last_active: 'Just now',
						device_interest: buyerShopName,
						notes: 'B2B Trade Partner'
					});
				}

				const messageText = `I have received and confirmed the delivery of the courier order for ${deviceName}.`;

				// Create messages
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

				// Update sessions
				await ChatSession.update(
					{ last_message: messageText, last_active: 'Just now' },
					{ where: { chat_id: chatIdSender, vendor_id: buyerId } }
				);

				await ChatSession.update(
					{ last_message: messageText, last_active: 'Just now', unread_count: sequelize.literal('unread_count + 1') },
					{ where: { chat_id: chatIdRecipient, vendor_id: seller_id } }
				);

				if (io) {
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

					const sessionsA = await socketHandler.fetchVendorSessions(buyerId);
					const sessionsB = await socketHandler.fetchVendorSessions(seller_id);
					io.to(`vendor-${buyerId}`).emit('sessions_update', sessionsA);
					io.to(`vendor-${seller_id}`).emit('sessions_update', sessionsB);
				}
			}
		} catch (err) {
			console.error("[CourierOrderController] Failed to send receive chat notification:", err.message);
		}

		return sendSuccess(res, "Order received successfully. Inventory and transactions updated.", { order });
	} catch (error) {
		await t.rollback();
		console.error("[CourierOrderController] receiveCourierOrder error:", error.message);
		return sendError(res, "Failed to confirm receipt of order.", {}, 500);
	}
}

/**
 * Cancel a pending courier order
 */
async function cancelCourierOrder(req, res) {
	const t = await sequelize.transaction();
	try {
		const vendorId = req.user.id;
		const { id } = req.params;

		const order = await CourierOrder.findOne({
			where: {
				id,
				[Op.or]: [
					{ seller_id: vendorId },
					{ buyer_id: vendorId }
				]
			},
			transaction: t
		});

		if (!order) {
			await t.rollback();
			return sendError(res, "Order not found or unauthorized.", {}, 404);
		}

		if (order.status !== "Pending" && order.status !== "Shipped") {
			await t.rollback();
			return sendError(res, `Cannot cancel order in status: ${order.status}`, {}, 400);
		}

		// Revert Mobile status to Available
		const mobile = await Mobile.findOne({
			where: { id: order.seller_mobile_id },
			transaction: t
		});

		if (mobile) {
			await mobile.update({ status: "Available" }, { transaction: t });
		}

		// Revert Buyer Mobile status to Cancelled
		if (order.buyer_mobile_id) {
			await Mobile.update({ status: "Cancelled" }, {
				where: { id: order.buyer_mobile_id },
				transaction: t
			});
		}

		await order.update({ status: "Cancelled" }, { transaction: t });

		await t.commit();
		return sendSuccess(res, "Courier order cancelled successfully.", { order });

	} catch (error) {
		await t.rollback();
		console.error("[CourierOrderController] cancelCourierOrder error:", error.message);
		return sendError(res, "Failed to cancel order.", {}, 500);
	}
}

module.exports = {
	getCourierOrders,
	createCourierOrder,
	shipCourierOrder,
	receiveCourierOrder,
	cancelCourierOrder
};
