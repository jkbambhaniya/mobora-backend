const fs = require("fs");
const path = require("path");
const { ChatSession, Message, Vendor, BusinessDetail, sequelize } = require("../../models");
const { Op } = require("sequelize");
const socketHandler = require("../../utils/socketHandler");
const { sendSuccess, sendError } = require("../../utils/responseHelper");
const { saveBase64File } = require("../../utils/fileUploadHelper");
/**
 * Helper to format sessions for response
 */
function formatSession(s) {
	let parsedMembers = [];
	if (s.group_members) {
		try {
			parsedMembers = JSON.parse(s.group_members);
		} catch (e) {
			parsedMembers = [];
		}
	}
	return {
		id: s.chat_id,
		customerName: s.customer_name,
		customerPhone: s.customer_phone,
		customerEmail: s.customer_email,
		avatar: s.avatar,
		status: s.status,
		lastMessage: s.last_message,
		unreadCount: s.unread_count,
		lastActive: s.last_active,
		deviceInterest: s.device_interest,
		notes: s.notes,
		isGroup: s.is_group === true || s.is_group === 1,
		groupName: s.group_name,
		groupMembers: parsedMembers,
	};
}

/**
 * Get all chat sessions for the logged-in vendor
 */
async function getSessions(req, res) {
	try {
		const vendorId = req.user.id;

		// Fetch sessions
		const sessions = await ChatSession.findAll({
			where: { vendor_id: vendorId },
			order: [["updated_at", "DESC"]],
		});

		const formattedSessions = sessions.map(formatSession);

		return sendSuccess(res, "Chat sessions retrieved.", {
			chats: formattedSessions,
		});
	} catch (error) {
		console.error("[ChatController] getSessions error:", error.message);
		return sendError(
			res,
			"Internal server error retrieving chat sessions.",
			{},
			500,
		);
	}
}

/**
 * Get message history for a specific chat room
 */
async function getMessages(req, res) {
	try {
		const { chatId } = req.params;
		const vendorId = req.user.id;

		// Verify session belongs to vendor
		const session = await ChatSession.findOne({
			where: { chat_id: chatId, vendor_id: vendorId },
		});
		if (!session) {
			return sendError(
				res,
				"Chat session not found or access denied.",
				{},
				403,
			);
		}

		// Update unread count to 0 in this chat
		await ChatSession.update(
			{ unread_count: 0 },
			{ where: { chat_id: chatId, vendor_id: vendorId } },
		);

		// Mark customer messages in this chat as read
		await Message.update(
			{ status: "read" },
			{
				where: {
					chat_id: chatId,
					sender: "customer",
					status: { [Op.ne]: "read" },
				},
			},
		);

		// If B2B, also mark recipient vendor's sent messages in their room to 'read'
		if (session.recipient_vendor_id) {
			const recipientId = session.recipient_vendor_id;
			const chatIdB = `chat-${recipientId}-${vendorId}`;

			await Message.update(
				{ status: "read" },
				{
					where: {
						chat_id: chatIdB,
						sender: "vendor",
						status: { [Op.ne]: "read" },
					},
				},
			);

			// Emit messages_read to recipient's room
			const io = socketHandler.getIo();
			if (io) {
				io.to(`chat-${chatIdB}`).emit("messages_read", {
					chatId: chatIdB,
				});

				// Refresh recipient's sidebar sessions list
				try {
					const sessionsB =
						await socketHandler.fetchVendorSessions(recipientId);
					io.to(`vendor-${recipientId}`).emit(
						"sessions_update",
						sessionsB,
					);
				} catch (err) {
					console.error(
						"[ChatController] Failed to notify B2B recipient of read messages:",
						err.message,
					);
				}
			}
		}

		const limit = parseInt(req.query.limit, 10) || 15;
		const offset = parseInt(req.query.offset, 10) || 0;

		// Get total count of messages
		const total = await Message.count({ where: { chat_id: chatId } });

		// Fetch messages paginated in reverse chronological order
		const messages = await Message.findAll({
			where: { chat_id: chatId },
			order: [["id", "DESC"]],
			limit,
			offset,
		});
		messages.reverse();

		const hasMore = offset + messages.length < total;

		const formattedMessages = messages.map((m) => {
			const msg = {
				id: `m-${m.id}`,
				sender: m.sender,
				senderId: m.sender_id,
				senderName: m.sender_name,
				text: m.text,
				timestamp: m.timestamp,
				status: m.status,
			};

			if (m.attachment_type) {
				msg.attachment = {
					type: m.attachment_type,
					name: m.attachment_name,
					size: m.attachment_size,
					url: m.attachment_url,
				};
			}

			return msg;
		});

		// Notify sidebar through sockets that unread count was reset
		const io = socketHandler.getIo();
		if (io) {
			// Reload sessions and emit to vendor updates
			const formattedSessions =
				await socketHandler.fetchVendorSessions(vendorId);
			io.to(`vendor-${vendorId}`).emit(
				"sessions_update",
				formattedSessions,
			);
		}

		return sendSuccess(res, "Chat messages retrieved.", {
			messages: formattedMessages,
			hasMore,
		});
	} catch (error) {
		console.error("[ChatController] getMessages error:", error.message);
		return sendError(
			res,
			"Internal server error retrieving chat messages.",
			{},
			500,
		);
	}
}

/**
 * Handle base64 uploads and save file locally in backend
 */
async function uploadFile(req, res) {
	try {
		const { name, type, base64 } = req.body;
		if (!name || !type || !base64) {
			return sendError(
				res,
				"Invalid request arguments: name, type, and base64 string are required.",
				{},
				400,
			);
		}

		const fileUrl = saveBase64File(base64, "chat", name);
		const uniqueFilename = path.basename(fileUrl);

		return sendSuccess(res, "File uploaded successfully.", {
			url: fileUrl,
			name: uniqueFilename,
		});
	} catch (error) {
		console.error("[ChatController] File upload error:", error.message);
		return sendError(res, "Internal server error uploading file.", {}, 500);
	}
}

/**
 * REST API Fallback endpoint to post messages manually
 */
async function sendMessage(req, res) {
	try {
		const { chatId, message } = req.body;
		const vendorId = req.user.id;

		if (!chatId || !message) {
			return sendError(
				res,
				"Chat ID and message content are required.",
				{},
				400,
			);
		}

		const { text, attachment } = message;
		const timestamp = new Date().toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});

		// Save message to DB
		const attachmentType = attachment ? attachment.type : null;
		const attachmentName = attachment ? attachment.name : null;
		const attachmentSize = attachment ? attachment.size || null : null;
		const attachmentUrl = attachment ? attachment.url : null;

		const result = await Message.create({
			chat_id: chatId,
			sender: "vendor",
			text,
			timestamp,
			status: "sent",
			attachment_type: attachmentType,
			attachment_name: attachmentName,
			attachment_size: attachmentSize,
			attachment_url: attachmentUrl,
		});

		const newMsg = {
			id: `m-${result.id}`,
			sender: "vendor",
			text,
			timestamp,
			status: "sent",
			attachment,
		};

		// Update session
		const lastMsgText = attachment
			? `Sent attachment: ${attachment.name}`
			: text;
		await ChatSession.update(
			{
				last_message: lastMsgText,
				last_active: "Just now",
				unread_count: 0,
			},
			{ where: { chat_id: chatId, vendor_id: vendorId } },
		);

		// Broadcast message to chat room using socket handler
		const io = socketHandler.getIo();
		if (io) {
			io.to(`chat-${chatId}`).emit("receive_message", newMsg);
			// Emit sessions updates
			const formattedSessions =
				await socketHandler.fetchVendorSessions(vendorId);
			io.to(`vendor-${vendorId}`).emit(
				"sessions_update",
				formattedSessions,
			);
		}

		return sendSuccess(res, "Message sent.", { message: newMsg });
	} catch (error) {
		console.error("[ChatController] sendMessage error:", error.message);
		return sendError(
			res,
			"Internal server error sending message.",
			{},
			500,
		);
	}
}

/**
 * Create a new chat session manually (supports B2C simulated customers and B2B vendor trades)
 */
async function createSession(req, res) {
	try {
		console.log("[ChatController] createSession request body:", req.body);
		const {
			isGroup,
			groupName,
			memberIds,
			customerName,
			customerPhone,
			customerEmail,
			deviceInterest,
			notes,
			initialMessage,
			recipientVendorId,
		} = req.body;
		const vendorId = req.user.id;

		const io = socketHandler.getIo();

		if (isGroup) {
			if (
				!groupName ||
				!memberIds ||
				!Array.isArray(memberIds) ||
				memberIds.length === 0
			) {
				return sendError(
					res,
					"Group name and members are required.",
					{},
					400,
				);
			}

			// Find current vendor details for sender name
			const creator = await Vendor.findByPk(vendorId);
			const creatorName = creator ? creator.name : "Dealer";

			const timestamp = Date.now();
			const uniqueMemberIds = Array.from(
				new Set([...memberIds.map((id) => parseInt(id, 10)), vendorId]),
			);
			const groupChatIdBase = `group-${timestamp}`;

			const timeStr = new Date().toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
			});
			const lastMsgText = initialMessage
				? initialMessage
				: "Group created";

			// Insert session for each group member
			for (const mId of uniqueMemberIds) {
				const memberChatId = `${groupChatIdBase}-${mId}`;
				const initials =
					groupName
						.split(" ")
						.map((n) => n[0])
						.join("")
						.toUpperCase()
						.slice(0, 2) || "GP";

				const unreadCount =
					mId === vendorId ? 0 : initialMessage ? 1 : 0;

				await ChatSession.create({
					chat_id: memberChatId,
					vendor_id: mId,
					customer_name: groupName,
					avatar: initials,
					status: "online",
					last_message: lastMsgText,
					unread_count: unreadCount,
					last_active: "Just now",
					notes: "B2B Group Trade Channel",
					is_group: true,
					group_name: groupName,
					group_members: JSON.stringify(uniqueMemberIds),
				});

				if (initialMessage) {
					const msgSender = mId === vendorId ? "vendor" : "customer";
					const msgStatus = mId === vendorId ? "sent" : "unread";

					await Message.create({
						chat_id: memberChatId,
						sender: msgSender,
						sender_id: vendorId,
						sender_name: creatorName,
						text: initialMessage,
						timestamp: timeStr,
						status: msgStatus,
					});
				}
			}

			// Broadcast sessions update to all members
			if (io) {
				for (const mId of uniqueMemberIds) {
					try {
						const sessions =
							await socketHandler.fetchVendorSessions(mId);
						io.to(`vendor-${mId}`).emit(
							"sessions_update",
							sessions,
						);
					} catch (err) {
						console.error(
							`[ChatController] Group session notify failed for vendor ${mId}:`,
							err.message,
						);
					}
				}
			}

			// Return the creator's chat session ID
			const creatorChatId = `${groupChatIdBase}-${vendorId}`;
			return sendSuccess(res, "B2B Group Chat created successfully.", {
				chatId: creatorChatId,
			});
		}

		if (recipientVendorId) {
			// --- B2B VENDOR-TO-VENDOR CONVERSATION ---
			const recipientId = parseInt(recipientVendorId, 10);

			// 1. Check if session already exists
			const existing = await ChatSession.findOne({
				where: {
					vendor_id: vendorId,
					recipient_vendor_id: recipientId,
				},
			});

			if (existing) {
				return sendSuccess(res, "B2B chat session already exists.", {
					chatId: existing.chat_id,
				});
			}

			// 2. Fetch both vendor details
			const [vendorA, vendorB] = await Promise.all([
				Vendor.findByPk(vendorId),
				Vendor.findByPk(recipientId),
			]);

			if (!vendorB) {
				return sendError(res, "Recipient vendor not found.", {}, 404);
			}

			const vendorAName = vendorA.name;
			const vendorBName = vendorB.name;
			const shopNameA = vendorA.shop_name || "Dealer";
			const shopNameB = vendorB.shop_name || "Dealer";

			const initialsA =
				vendorAName
					.split(" ")
					.map((n) => n[0])
					.join("")
					.toUpperCase()
					.slice(0, 2) || "VD";
			const initialsB =
				vendorBName
					.split(" ")
					.map((n) => n[0])
					.join("")
					.toUpperCase()
					.slice(0, 2) || "VD";

			const chatIdA = `chat-${vendorId}-${recipientId}`;
			const chatIdB = `chat-${recipientId}-${vendorId}`;
			const lastMsgText = initialMessage
				? initialMessage
				: "Conversation started";

			// 3. Create Session A (for Vendor A) if not exists
			const existingSessionA = await ChatSession.findOne({
				where: { chat_id: chatIdA },
			});
			if (!existingSessionA) {
				await ChatSession.create({
					chat_id: chatIdA,
					vendor_id: vendorId,
					recipient_vendor_id: recipientId,
					customer_name: vendorBName,
					avatar: initialsB,
					status: "online",
					last_message: lastMsgText,
					unread_count: 0,
					last_active: "Just now",
					device_interest: shopNameB,
					notes: "B2B Trade Partner",
				});
			}

			// 4. Create Session B (for Vendor B) if not exists
			const existingSessionB = await ChatSession.findOne({
				where: { chat_id: chatIdB },
			});
			if (!existingSessionB) {
				const unreadCountB = initialMessage ? 1 : 0;
				await ChatSession.create({
					chat_id: chatIdB,
					vendor_id: recipientId,
					recipient_vendor_id: vendorId,
					customer_name: vendorAName,
					avatar: initialsA,
					status: "online",
					last_message: lastMsgText,
					unread_count: unreadCountB,
					last_active: "Just now",
					device_interest: shopNameA,
					notes: "B2B Trade Partner",
				});
			}

			// 5. If initial message is provided, save it for both sessions
			if (initialMessage) {
				const timestamp = new Date().toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit",
				});

				// Save for A (sender = 'vendor')
				await Message.create({
					chat_id: chatIdA,
					sender: "vendor",
					text: initialMessage,
					timestamp,
					status: "sent",
				});

				// Save for B (sender = 'customer')
				await Message.create({
					chat_id: chatIdB,
					sender: "customer",
					text: initialMessage,
					timestamp,
					status: "unread",
				});
			}

			// 6. Broadcast list update to both sockets
			if (io) {
				// Vendor A updates
				const sessionsA =
					await socketHandler.fetchVendorSessions(vendorId);
				io.to(`vendor-${vendorId}`).emit("sessions_update", sessionsA);

				// Vendor B updates
				const sessionsB =
					await socketHandler.fetchVendorSessions(recipientId);
				io.to(`vendor-${recipientId}`).emit(
					"sessions_update",
					sessionsB,
				);
			}

			return sendSuccess(res, "B2B Chat session created successfully.", {
				chatId: chatIdA,
			});
		} else {
			// --- B2C CONVERSATION ---
			if (!customerName) {
				return sendError(res, "Customer name is required.", {}, 400);
			}

			const chatId = `chat-${Date.now()}`;
			const avatar =
				customerName
					.split(" ")
					.map((n) => n[0])
					.join("")
					.toUpperCase()
					.slice(0, 2) || "CU";
			const lastMsg = initialMessage
				? initialMessage
				: "Conversation started";

			await ChatSession.create({
				chat_id: chatId,
				vendor_id: vendorId,
				customer_name: customerName,
				customer_phone: customerPhone || null,
				customer_email: customerEmail || null,
				avatar,
				status: "online",
				last_message: lastMsg,
				unread_count: 0,
				last_active: "Just now",
				device_interest: deviceInterest || null,
				notes: notes || "New manual conversation.",
			});

			if (initialMessage) {
				const timestamp = new Date().toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit",
				});
				await Message.create({
					chat_id: chatId,
					sender: "vendor",
					text: initialMessage,
					timestamp,
					status: "sent",
				});
			}

			if (io) {
				const sessions =
					await socketHandler.fetchVendorSessions(vendorId);
				io.to(`vendor-${vendorId}`).emit("sessions_update", sessions);
			}

			return sendSuccess(res, "Chat session created successfully.", {
				chatId,
			});
		}
	} catch (error) {
		console.error("[ChatController] createSession error:", error.message);
		return sendError(
			res,
			"Internal server error creating chat session.",
			{},
			500,
		);
	}
}

/**
 * Retrieve all registered vendors (except the logged-in vendor)
 */
async function getVendors(req, res) {
	try {
		const currentVendorId = req.user.id;
		const vendors = await Vendor.findAll({
			where: {
				id: { [Op.ne]: currentVendorId },
				status: "active",
			},
			attributes: ["id", "name", "email", "profile_img"],
			include: [
				{
					model: BusinessDetail,
					as: "businessDetail",
					attributes: ["shop_name"],
				},
			],
			order: [["name", "ASC"]],
		});

		const formattedVendors = vendors.map((v) => {
			const json = v.toJSON();
			return {
				id: json.id,
				name: json.name,
				email: json.email,
				profile_img: json.profile_img,
				shop_name: json.businessDetail ? json.businessDetail.shop_name : null,
			};
		});

		return sendSuccess(res, "Other vendors retrieved successfully.", {
			vendors: formattedVendors,
		});
	} catch (error) {
		console.error("[ChatController] getVendors error:", error.message);
		return sendError(
			res,
			"Internal server error retrieving vendors list.",
			{},
			500,
		);
	}
}

module.exports = {
	getSessions,
	getMessages,
	uploadFile,
	sendMessage,
	createSession,
	getVendors,
};
