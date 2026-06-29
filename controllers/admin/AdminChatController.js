const { ChatSession, Message, Vendor, Notification, sequelize } = require("../../models");
const { Op } = require("sequelize");
const socketHandler = require("../../utils/socketHandler");
const { sendSuccess, sendError } = require("../../utils/responseHelper");
const { saveBase64File } = require("../../utils/fileUploadHelper");
const path = require("path");

/**
 * Format session for admin response
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
		unreadCount: s.admin_unread_count || 0,
		lastActive: s.last_active,
		deviceInterest: s.device_interest,
		notes: s.notes,
		isGroup: s.is_group === true || s.is_group === 1,
		groupName: s.group_name,
		groupMembers: parsedMembers,
		vendorId: s.vendor_id,
		recipientVendorId: s.recipient_vendor_id
	};
}

/**
 * Get all admin chat sessions (direct and group chats)
 */
async function getSessions(req, res) {
	try {
		const sessions = await socketHandler.fetchAdminSessions();
		return sendSuccess(res, "Admin chat sessions retrieved successfully.", {
			chats: sessions,
		});
	} catch (error) {
		console.error("[AdminChatController] getSessions error:", error.message);
		return sendError(
			res,
			"Internal server error retrieving admin chat sessions.",
			{},
			500,
		);
	}
}

/**
 * Get message history for an admin chat session
 */
async function getMessages(req, res) {
	try {
		const { chatId } = req.params;

		// 1. Mark admin messages as read in database
		await ChatSession.update(
			{ admin_unread_count: 0 },
			{ where: { chat_id: chatId } }
		);

		// Mark vendor messages in this chat as read
		await Message.update(
			{ status: "read" },
			{
				where: {
					chat_id: chatId,
					sender: "vendor",
					status: { [Op.ne]: "read" },
				},
			}
		);

		// If direct admin chat, notify vendor
		if (chatId.startsWith("admin-chat-")) {
			const vendorId = parseInt(chatId.split("-").pop(), 10);
			const io = socketHandler.getIo();
			if (io) {
				io.to(`chat-${chatId}`).emit("messages_read", { chatId });
				const sessions = await socketHandler.fetchVendorSessions(vendorId);
				io.to(`vendor-${vendorId}`).emit("sessions_update", sessions);
			}
		}

		const limit = parseInt(req.query.limit, 10) || 15;
		const offset = parseInt(req.query.offset, 10) || 0;

		const total = await Message.count({ where: { chat_id: chatId } });

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

		// Update admin sidebar
		const io = socketHandler.getIo();
		if (io) {
			const adminSessions = await socketHandler.fetchAdminSessions();
			io.to("admin-room").emit("admin_sessions_update", adminSessions);
		}

		return sendSuccess(res, "Messages retrieved successfully.", {
			messages: formattedMessages,
			hasMore,
		});
	} catch (error) {
		console.error("[AdminChatController] getMessages error:", error.message);
		return sendError(
			res,
			"Internal server error retrieving message history.",
			{},
			500,
		);
	}
}

/**
 * Create a new admin session (direct or group)
 */
async function createSession(req, res) {
	try {
		const {
			isGroup,
			groupName,
			memberIds,
			vendorId: targetVendorId,
			initialMessage,
		} = req.body;

		const io = socketHandler.getIo();
		const timestamp = Date.now();

		if (isGroup) {
			if (!groupName || !memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
				return sendError(res, "Group name and member vendor IDs are required.", {}, 400);
			}

			const baseGroupId = `admin-group-${timestamp}`;
			const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
			const lastMsg = initialMessage || "Admin Group Created";
			const initials = groupName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "AG";

			const uniqueMemberIds = Array.from(new Set(memberIds.map(id => parseInt(id, 10))));

			for (const mId of uniqueMemberIds) {
				const memberChatId = `${baseGroupId}-${mId}`;
				await ChatSession.create({
					chat_id: memberChatId,
					vendor_id: mId,
					customer_name: groupName,
					avatar: initials,
					status: "online",
					last_message: lastMsg,
					unread_count: initialMessage ? 1 : 0,
					admin_unread_count: 0,
					last_active: "Just now",
					notes: "Administrator Group Chat",
					is_group: true,
					group_name: groupName,
					group_members: JSON.stringify(uniqueMemberIds),
				});

				if (initialMessage) {
					await Message.create({
						chat_id: memberChatId,
						sender: "admin",
						sender_id: 1, // System Admin
						sender_name: "Administrator",
						text: initialMessage,
						timestamp: timeStr,
						status: "unread",
					});
				}

				// Broadcast to vendor
				if (io) {
					const vendorSessions = await socketHandler.fetchVendorSessions(mId);
					io.to(`vendor-${mId}`).emit("sessions_update", vendorSessions);
				}
			}

			if (io) {
				const adminSessions = await socketHandler.fetchAdminSessions();
				io.to("admin-room").emit("admin_sessions_update", adminSessions);
			}

			return sendSuccess(res, "Admin Group Chat created successfully.", {
				chatId: baseGroupId,
			});
		} else {
			// Direct Chat between Admin and Vendor
			if (!targetVendorId) {
				return sendError(res, "Target vendor ID is required.", {}, 400);
			}

			const vId = parseInt(targetVendorId, 10);
			const vendor = await Vendor.findByPk(vId);
			if (!vendor) {
				return sendError(res, "Vendor not found.", {}, 404);
			}

			const chatId = `admin-chat-${vId}`;
			const lastMsg = initialMessage || "Chat started with Administrator";

			let session = await ChatSession.findOne({ where: { chat_id: chatId, vendor_id: vId } });
			if (!session) {
				session = await ChatSession.create({
					chat_id: chatId,
					vendor_id: vId,
					customer_name: "System Administrator",
					avatar: "AD",
					status: "online",
					last_message: lastMsg,
					unread_count: initialMessage ? 1 : 0,
					admin_unread_count: 0,
					last_active: "Just now",
					notes: "Support Conversation with Admin",
				});

				if (initialMessage) {
					const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
					await Message.create({
						chat_id: chatId,
						sender: "admin",
						sender_id: 1,
						sender_name: "Administrator",
						text: initialMessage,
						timestamp: timeStr,
						status: "unread",
					});
				}

				if (io) {
					const vendorSessions = await socketHandler.fetchVendorSessions(vId);
					io.to(`vendor-${vId}`).emit("sessions_update", vendorSessions);
					
					const adminSessions = await socketHandler.fetchAdminSessions();
					io.to("admin-room").emit("admin_sessions_update", adminSessions);
				}
			}

			return sendSuccess(res, "Admin Direct Chat opened successfully.", {
				chatId,
			});
		}
	} catch (error) {
		console.error("[AdminChatController] createSession error:", error.message);
		return sendError(res, "Internal server error creating session.", {}, 500);
	}
}

/**
 * Send a broadcast message to all active vendors
 */
async function broadcastMessage(req, res) {
	try {
		const { text, attachment } = req.body;
		if (!text && !attachment) {
			return sendError(res, "Broadcast content (text or attachment) is required.", {}, 400);
		}

		const vendors = await Vendor.findAll({ where: { status: "active" } });
		const io = socketHandler.getIo();
		const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
		const lastMsg = attachment ? `Attached: ${attachment.name}` : text;

		const attachmentType = attachment ? attachment.type : null;
		const attachmentName = attachment ? attachment.name : null;
		const attachmentSize = attachment ? attachment.size || null : null;
		const attachmentUrl = attachment ? attachment.url : null;

		for (const vendor of vendors) {
			const chatId = `admin-chat-${vendor.id}`;
			
			// Create session if it doesn't exist
			let session = await ChatSession.findOne({ where: { chat_id: chatId, vendor_id: vendor.id } });
			if (!session) {
				await ChatSession.create({
					chat_id: chatId,
					vendor_id: vendor.id,
					customer_name: "System Administrator",
					avatar: "AD",
					status: "online",
					last_message: lastMsg,
					unread_count: 1,
					admin_unread_count: 0,
					last_active: "Just now",
					notes: "Support Conversation with Admin",
				});
			} else {
				await ChatSession.update(
					{
						last_message: lastMsg,
						last_active: "Just now",
						unread_count: sequelize.literal("unread_count + 1"),
					},
					{ where: { chat_id: chatId } }
				);
			}

			// Insert Message
			await Message.create({
				chat_id: chatId,
				sender: "admin",
				sender_id: 1,
				sender_name: "Administrator",
				text,
				timestamp,
				status: "unread",
				attachment_type: attachmentType,
				attachment_name: attachmentName,
				attachment_size: attachmentSize,
				attachment_url: attachmentUrl,
			});

			// Notify vendor
			if (io) {
				const vendorSessions = await socketHandler.fetchVendorSessions(vendor.id);
				io.to(`vendor-${vendor.id}`).emit("sessions_update", vendorSessions);

				const notifBody = attachment ? `📎 ${attachment.name}` : (text || "Broadcast received");
				await Notification.create({
					vendor_id: vendor.id,
					type: "admin_message",
					title: "System Broadcast from Administrator",
					body: notifBody,
					chat_id: chatId,
					sender_name: "Administrator",
					timestamp,
				});

				io.to(`vendor-${vendor.id}`).emit("new_notification", {
					type: "admin_message",
					title: "System Broadcast from Administrator",
					body: notifBody,
					chatId,
					senderName: "Administrator",
				});
			}
		}

		if (io) {
			const adminSessions = await socketHandler.fetchAdminSessions();
			io.to("admin-room").emit("admin_sessions_update", adminSessions);
		}

		return sendSuccess(res, `Broadcast successfully sent to ${vendors.length} vendors.`);
	} catch (error) {
		console.error("[AdminChatController] broadcastMessage error:", error.message);
		return sendError(res, "Internal server error broadcasting message.", {}, 500);
	}
}

/**
 * Handle base64 uploads and save file locally in backend
 */
async function uploadFile(req, res) {
	try {
		const { name, type, base64 } = req.body;
		if (!name || !type || !base64) {
			return sendError(res, "Invalid file upload arguments.", {}, 400);
		}

		const fileUrl = saveBase64File(base64, "chat", name);
		const uniqueFilename = path.basename(fileUrl);

		return sendSuccess(res, "File uploaded successfully.", {
			url: fileUrl,
			name: uniqueFilename,
		});
	} catch (error) {
		console.error("[AdminChatController] uploadFile error:", error.message);
		return sendError(res, "Internal server error uploading file.", {}, 500);
	}
}

module.exports = {
	getSessions,
	getMessages,
	createSession,
	broadcastMessage,
	uploadFile,
};
