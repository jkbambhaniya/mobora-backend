const fs = require('fs');
const path = require('path');
const { ChatSession, Message, Vendor, sequelize } = require('../../models');
const { Op } = require('sequelize');
const socketHandler = require('../../utils/socketHandler');
const { sendSuccess, sendError } = require('../../utils/responseHelper');
const { saveBase64File } = require('../../utils/fileUploadHelper');

// Mock data sessions for seeding
const defaultSessions = [
  {
    id: "chat-1",
    customer_name: "Rahul Mehta",
    customer_phone: "+91 98210 12345",
    customer_email: "rahul.mehta@gmail.com",
    avatar: "RM",
    status: "online",
    last_message: "Attached: Battery_Specs.pdf",
    unread_count: 1,
    last_active: "Just now",
    device_interest: "iPhone 13 Pro (128GB Graphite)",
    notes: "Regular customer. Prefers high battery health devices (>90%). Has a pending exchange request.",
    messages: [
      { sender: "customer", text: "Hello! I saw your listing for the iPhone 13 Pro.", timestamp: "10:00 AM", status: "read" },
      { sender: "vendor", text: "Hello Rahul! Yes, it is available in Graphite, Mint condition. How can I help you?", timestamp: "10:02 AM", status: "read" },
      { sender: "customer", text: "What is the battery health of the device?", timestamp: "10:05 AM", status: "read" },
      { sender: "vendor", text: "It is currently at 92% battery health, and has never been serviced.", timestamp: "10:06 AM", status: "read" },
      { sender: "customer", text: "Great. Does it come with the box and original cable?", timestamp: "10:08 AM", status: "read" },
      { sender: "vendor", text: "Yes, it includes the original box and Apple USB-C to Lightning cable.", timestamp: "10:09 AM", status: "read" },
      { sender: "customer", text: "Is there any warranty remaining on it?", timestamp: "10:12 AM", status: "read" },
      { sender: "vendor", text: "Apple warranty expired, but we offer a 6-month store warranty.", timestamp: "10:13 AM", status: "read" },
      { sender: "customer", text: "Do you accept trade-ins? I have an iPhone 11 (64GB).", timestamp: "10:15 AM", status: "read" },
      { sender: "vendor", text: "Yes we do! What is the battery health and general condition of your iPhone 11?", timestamp: "10:17 AM", status: "read" },
      { sender: "customer", text: "It's around 81% battery health, screen has minor scratches but back is perfect.", timestamp: "10:20 AM", status: "read" },
      { sender: "vendor", text: "Sounds good. We can offer a tentative trade-in value of 14,000 INR pending physical verification.", timestamp: "10:22 AM", status: "read" },
      { sender: "customer", text: "That sounds reasonable. Can we make it 15,000 INR?", timestamp: "10:24 AM", status: "read" },
      { sender: "vendor", text: "If the screen is original and face ID works, we can try to adjust closer to that.", timestamp: "10:26 AM", status: "read" },
      { sender: "customer", text: "Yes, everything is original and Face ID works perfectly.", timestamp: "10:27 AM", status: "read" },
      { sender: "vendor", text: "Excellent, then we can aim for 14,500 INR.", timestamp: "10:28 AM", status: "read" },
      { sender: "customer", text: "Deal. When can I visit the store?", timestamp: "10:29 AM", status: "read" },
      { sender: "vendor", text: "We are open from 10:30 AM to 8:30 PM. Let us know when you plan to come.", timestamp: "10:30 AM", status: "read" },
      { sender: "customer", text: "I'll try to come around 4:00 PM today.", timestamp: "10:31 AM", status: "read" },
      { sender: "vendor", text: "Perfect, looking forward to seeing you. Please bring a valid ID for verification.", timestamp: "10:32 AM", status: "read" },
      { sender: "customer", text: "Sure thing. By the way, could you share the diagnostic report of the iPhone 13 Pro?", timestamp: "10:33 AM", status: "read" },
      { sender: "vendor", text: "Sure, let me fetch it and send it over.", timestamp: "10:34 AM", status: "read" },
      { sender: "customer", text: "Here is the battery specs sheet of my old device for trade-in.", timestamp: "10:35 AM", status: "read" },
      { 
        sender: "customer", 
        text: "", 
        timestamp: "10:36 AM",
        status: "unread",
        attachment_type: "file",
        attachment_name: "Battery_Specs.pdf",
        attachment_size: "1.2 MB",
        attachment_url: "#"
      },
      { sender: "customer", text: "Let me know if this looks okay.", timestamp: "10:37 AM", status: "unread" }
    ]
  },
  {
    id: "chat-2",
    customer_name: "Priya Patel",
    customer_phone: "+91 99123 45678",
    customer_email: "priya.patel@yahoo.com",
    avatar: "PP",
    status: "online",
    last_message: "Thanks for the discount offer, I will visit the store tomorrow.",
    unread_count: 0,
    last_active: "15m ago",
    device_interest: "OnePlus 10 Pro (128GB Emerald Forest)",
    notes: "Active trader. Likes to inspect phones in person before final payment.",
    messages: [
      { sender: "customer", text: "Do you have the retail bill for the OnePlus 10 Pro?", timestamp: "09:15 AM", status: "read" },
      { sender: "vendor", text: "Hi Priya! Yes, here is a copy of the official purchase receipt.", timestamp: "09:20 AM", status: "read" },
      {
        sender: "vendor",
        text: "Invoice copy attached below:",
        timestamp: "09:20 AM",
        status: "read",
        attachment_type: "image",
        attachment_name: "oneplus_10pro_invoice.png",
        attachment_url: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=400"
      },
      { sender: "customer", text: "Thanks for the discount offer, I will visit the store tomorrow.", timestamp: "09:22 AM", status: "read" }
    ]
  },
  {
    id: "chat-3",
    customer_name: "Amit Sharma",
    customer_phone: "+91 98765 87654",
    customer_email: "amit.sharma@outlook.com",
    avatar: "AS",
    status: "offline",
    last_message: "What is the battery health of Galaxy S22 Ultra?",
    unread_count: 0,
    last_active: "2h ago",
    device_interest: "Galaxy S22 Ultra (256GB Phantom Black)",
    notes: "Prefers physical store visits. Inquired about exchange values.",
    messages: [
      { sender: "customer", text: "Hey, is the Galaxy S22 Ultra screen clean?", timestamp: "Yesterday 2:00 PM", status: "read" },
      { sender: "vendor", text: "Here is a quick boot-up check video of the S22 Ultra for you.", timestamp: "Yesterday 2:05 PM", status: "read" },
      {
        sender: "vendor",
        text: "Galaxy S22 Ultra Verification Video",
        timestamp: "Yesterday 2:05 PM",
        status: "read",
        attachment_type: "video",
        attachment_name: "S22_Ultra_Inspection.mp4",
        attachment_size: "4.8 MB",
        attachment_url: "https://assets.mixkit.co/videos/preview/mixkit-hand-holding-a-smart-phone-in-vertical-mode-39902-large.mp4"
      },
      { sender: "customer", text: "Thanks, the screen looks spotless. Any scratches on the sides?", timestamp: "Yesterday 2:10 PM", status: "read" },
      { sender: "vendor", text: "There are extremely minor scuffs near the charging port, otherwise side rails are pristine.", timestamp: "Yesterday 2:12 PM", status: "read" },
      { sender: "customer", text: "Does it come with the S-Pen?", timestamp: "Yesterday 2:15 PM", status: "read" },
      { sender: "vendor", text: "Yes, the original S-Pen is included and works perfectly.", timestamp: "Yesterday 2:16 PM", status: "read" },
      { sender: "customer", text: "Is the price negotiable? I see it listed for 42,000 INR.", timestamp: "Yesterday 2:20 PM", status: "read" },
      { sender: "vendor", text: "For this condition and 256GB storage, 42,000 is our best price, but we can offer a 1,000 INR discount if you complete payment via UPI today.", timestamp: "Yesterday 2:22 PM", status: "read" },
      { sender: "customer", text: "What about the charger? Is it in the box?", timestamp: "Yesterday 2:25 PM", status: "read" },
      { sender: "vendor", text: "Samsung doesn't include a charger in the box anymore, but we can bundle a compatible 25W fast charger for just 500 INR extra.", timestamp: "Yesterday 2:27 PM", status: "read" },
      { sender: "customer", text: "Okay, I'll take the charger bundle too.", timestamp: "Yesterday 2:30 PM", status: "read" },
      { sender: "vendor", text: "Excellent choice. I will put it aside for you.", timestamp: "Yesterday 2:32 PM", status: "read" },
      { sender: "customer", text: "What is the warranty period for this device?", timestamp: "Yesterday 2:35 PM", status: "read" },
      { sender: "vendor", text: "We offer a 7-day checking warranty and a 3-month store warranty for motherboard issues.", timestamp: "Yesterday 2:37 PM", status: "read" },
      { sender: "customer", text: "Do you have options for delivery or only store pickup?", timestamp: "Yesterday 2:40 PM", status: "read" },
      { sender: "vendor", text: "We offer free home delivery within a 10km radius, or same-day shipping via courier for other areas.", timestamp: "Yesterday 2:42 PM", status: "read" },
      { sender: "customer", text: "My location is near MG Road Metro station. Is that eligible for free delivery?", timestamp: "Yesterday 2:45 PM", status: "read" },
      { sender: "vendor", text: "Yes, MG Road is well within our 10km free delivery zone!", timestamp: "Yesterday 2:47 PM", status: "read" },
      { sender: "customer", text: "Perfect. Can I pay cash on delivery?", timestamp: "Yesterday 2:50 PM", status: "read" },
      { sender: "vendor", text: "We accept COD up to 30,000 INR. For higher amounts, we request a 2,000 INR advance deposit, with the remaining paid on delivery.", timestamp: "Yesterday 2:52 PM", status: "read" },
      { sender: "customer", text: "Ah I see. Let me think about that.", timestamp: "Yesterday 3:00 PM", status: "read" },
      { sender: "vendor", text: "Sure, let know. We also accept online card payments on delivery.", timestamp: "Yesterday 3:05 PM", status: "read" },
      { sender: "customer", text: "That works. Before I order, just one last question...", timestamp: "Yesterday 3:10 PM", status: "read" },
      { sender: "customer", text: "What is the battery health of Galaxy S22 Ultra?", timestamp: "Yesterday 3:11 PM", status: "read" }
    ]
  }
];

/**
 * Seed helper for a vendor
 */
async function seedVendorChats(vendorId) {
  console.log(`[ChatSeeder] Seeding chats for vendor ${vendorId}...`);
  const transaction = await sequelize.transaction();
  try {
    for (const session of defaultSessions) {
      const uniqueChatId = `${session.id}-${vendorId}`;

      // 1. Insert chat session
      await ChatSession.create({
        chat_id: uniqueChatId,
        vendor_id: vendorId,
        customer_name: session.customer_name,
        customer_phone: session.customer_phone,
        customer_email: session.customer_email,
        avatar: session.avatar,
        status: session.status,
        last_message: session.last_message,
        unread_count: session.unread_count,
        last_active: session.last_active,
        device_interest: session.device_interest,
        notes: session.notes,
        is_group: false
      }, { transaction });

      // 2. Insert messages
      for (const msg of session.messages) {
        await Message.create({
          chat_id: uniqueChatId,
          sender: msg.sender,
          text: msg.text,
          timestamp: msg.timestamp,
          status: msg.status,
          attachment_type: msg.attachment_type || null,
          attachment_name: msg.attachment_name || null,
          attachment_size: msg.attachment_size || null,
          attachment_url: msg.attachment_url || null
        }, { transaction });
      }
    }

    await transaction.commit();
    console.log(`[ChatSeeder] Seeding for vendor ${vendorId} finished successfully.`);
  } catch (error) {
    await transaction.rollback();
    console.error(`[ChatSeeder] Failed to seed chats for vendor ${vendorId}:`, error.message);
    throw error;
  }
}

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
    groupMembers: parsedMembers
  };
}

/**
 * Get all chat sessions for the logged-in vendor
 */
async function getSessions(req, res) {
  try {
    const vendorId = req.user.id;

    // Check if any sessions exist
    const count = await ChatSession.count({ where: { vendor_id: vendorId } });

    if (count === 0) {
      // Auto seed
      await seedVendorChats(vendorId);
    }

    // Fetch sessions
    const sessions = await ChatSession.findAll({
      where: { vendor_id: vendorId },
      order: [['updated_at', 'DESC']]
    });

    const formattedSessions = sessions.map(formatSession);

    return sendSuccess(res, 'Chat sessions retrieved.', { chats: formattedSessions });
  } catch (error) {
    console.error('[ChatController] getSessions error:', error.message);
    return sendError(res, 'Internal server error retrieving chat sessions.', {}, 500);
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
      where: { chat_id: chatId, vendor_id: vendorId }
    });
    if (!session) {
      return sendError(res, 'Chat session not found or access denied.', {}, 403);
    }

    // Update unread count to 0 in this chat
    await ChatSession.update(
      { unread_count: 0 },
      { where: { chat_id: chatId, vendor_id: vendorId } }
    );

    // Mark customer messages in this chat as read
    await Message.update(
      { status: 'read' },
      { where: { chat_id: chatId, sender: 'customer', status: { [Op.ne]: 'read' } } }
    );

    // If B2B, also mark recipient vendor's sent messages in their room to 'read'
    if (session.recipient_vendor_id) {
      const recipientId = session.recipient_vendor_id;
      const chatIdB = `chat-${recipientId}-${vendorId}`;
      
      await Message.update(
        { status: 'read' },
        { where: { chat_id: chatIdB, sender: 'vendor', status: { [Op.ne]: 'read' } } }
      );

      // Emit messages_read to recipient's room
      const io = socketHandler.getIo();
      if (io) {
        io.to(`chat-${chatIdB}`).emit('messages_read', { chatId: chatIdB });
        
        // Refresh recipient's sidebar sessions list
        try {
          const sessionsB = await socketHandler.fetchVendorSessions(recipientId);
          io.to(`vendor-${recipientId}`).emit('sessions_update', sessionsB);
        } catch (err) {
          console.error('[ChatController] Failed to notify B2B recipient of read messages:', err.message);
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
      order: [['id', 'DESC']],
      limit,
      offset
    });
    messages.reverse();

    const hasMore = offset + messages.length < total;

    const formattedMessages = messages.map(m => {
      const msg = {
        id: `m-${m.id}`,
        sender: m.sender,
        senderId: m.sender_id,
        senderName: m.sender_name,
        text: m.text,
        timestamp: m.timestamp,
        status: m.status
      };

      if (m.attachment_type) {
        msg.attachment = {
          type: m.attachment_type,
          name: m.attachment_name,
          size: m.attachment_size,
          url: m.attachment_url
        };
      }

      return msg;
    });

    // Notify sidebar through sockets that unread count was reset
    const io = socketHandler.getIo();
    if (io) {
      // Reload sessions and emit to vendor updates
      const formattedSessions = await socketHandler.fetchVendorSessions(vendorId);
      io.to(`vendor-${vendorId}`).emit('sessions_update', formattedSessions);
    }

    return sendSuccess(res, 'Chat messages retrieved.', { messages: formattedMessages, hasMore });
  } catch (error) {
    console.error('[ChatController] getMessages error:', error.message);
    return sendError(res, 'Internal server error retrieving chat messages.', {}, 500);
  }
}

/**
 * Handle base64 uploads and save file locally in backend
 */
async function uploadFile(req, res) {
  try {
    const { name, type, base64 } = req.body;
    if (!name || !type || !base64) {
      return sendError(res, 'Invalid request arguments: name, type, and base64 string are required.', {}, 400);
    }

    const fileUrl = saveBase64File(base64, 'chat', name);
    const uniqueFilename = path.basename(fileUrl);

    return sendSuccess(res, 'File uploaded successfully.', {
      url: fileUrl,
      name: uniqueFilename
    });

  } catch (error) {
    console.error('[ChatController] File upload error:', error.message);
    return sendError(res, 'Internal server error uploading file.', {}, 500);
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
      return sendError(res, 'Chat ID and message content are required.', {}, 400);
    }

    const { text, attachment } = message;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Save message to DB
    const attachmentType = attachment ? attachment.type : null;
    const attachmentName = attachment ? attachment.name : null;
    const attachmentSize = attachment ? attachment.size || null : null;
    const attachmentUrl = attachment ? attachment.url : null;

    const result = await Message.create({
      chat_id: chatId,
      sender: 'vendor',
      text,
      timestamp,
      status: 'sent',
      attachment_type: attachmentType,
      attachment_name: attachmentName,
      attachment_size: attachmentSize,
      attachment_url: attachmentUrl
    });

    const newMsg = {
      id: `m-${result.id}`,
      sender: 'vendor',
      text,
      timestamp,
      status: 'sent',
      attachment
    };

    // Update session
    const lastMsgText = attachment ? `Sent attachment: ${attachment.name}` : text;
    await ChatSession.update(
      { last_message: lastMsgText, last_active: 'Just now', unread_count: 0 },
      { where: { chat_id: chatId, vendor_id: vendorId } }
    );

    // Broadcast message to chat room using socket handler
    const io = socketHandler.getIo();
    if (io) {
      io.to(`chat-${chatId}`).emit('receive_message', newMsg);
      // Emit sessions updates
      const formattedSessions = await socketHandler.fetchVendorSessions(vendorId);
      io.to(`vendor-${vendorId}`).emit('sessions_update', formattedSessions);
    }

    return sendSuccess(res, 'Message sent.', { message: newMsg });

  } catch (error) {
    console.error('[ChatController] sendMessage error:', error.message);
    return sendError(res, 'Internal server error sending message.', {}, 500);
  }
}

/**
 * Create a new chat session manually (supports B2C simulated customers and B2B vendor trades)
 */
async function createSession(req, res) {
  try {
    console.log('[ChatController] createSession request body:', req.body);
    const { isGroup, groupName, memberIds, customerName, customerPhone, customerEmail, deviceInterest, notes, initialMessage, recipientVendorId } = req.body;
    const vendorId = req.user.id;

    const io = socketHandler.getIo();

    if (isGroup) {
      if (!groupName || !memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
        return sendError(res, 'Group name and members are required.', {}, 400);
      }

      // Find current vendor details for sender name
      const creator = await Vendor.findByPk(vendorId);
      const creatorName = creator ? creator.name : 'Dealer';

      const timestamp = Date.now();
      const uniqueMemberIds = Array.from(new Set([...memberIds.map(id => parseInt(id, 10)), vendorId]));
      const groupChatIdBase = `group-${timestamp}`;

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const lastMsgText = initialMessage ? initialMessage : 'Group created';

      // Insert session for each group member
      for (const mId of uniqueMemberIds) {
        const memberChatId = `${groupChatIdBase}-${mId}`;
        const initials = groupName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'GP';

        const unreadCount = (mId === vendorId) ? 0 : (initialMessage ? 1 : 0);
        
        await ChatSession.create({
          chat_id: memberChatId,
          vendor_id: mId,
          customer_name: groupName,
          avatar: initials,
          status: 'online',
          last_message: lastMsgText,
          unread_count: unreadCount,
          last_active: 'Just now',
          notes: 'B2B Group Trade Channel',
          is_group: true,
          group_name: groupName,
          group_members: JSON.stringify(uniqueMemberIds)
        });

        if (initialMessage) {
          const msgSender = (mId === vendorId) ? 'vendor' : 'customer';
          const msgStatus = (mId === vendorId) ? 'sent' : 'unread';
          
          await Message.create({
            chat_id: memberChatId,
            sender: msgSender,
            sender_id: vendorId,
            sender_name: creatorName,
            text: initialMessage,
            timestamp: timeStr,
            status: msgStatus
          });
        }
      }

      // Broadcast sessions update to all members
      if (io) {
        for (const mId of uniqueMemberIds) {
          try {
            const sessions = await socketHandler.fetchVendorSessions(mId);
            io.to(`vendor-${mId}`).emit('sessions_update', sessions);
          } catch (err) {
            console.error(`[ChatController] Group session notify failed for vendor ${mId}:`, err.message);
          }
        }
      }

      // Return the creator's chat session ID
      const creatorChatId = `${groupChatIdBase}-${vendorId}`;
      return sendSuccess(res, 'B2B Group Chat created successfully.', { chatId: creatorChatId });
    }

    if (recipientVendorId) {
      // --- B2B VENDOR-TO-VENDOR CONVERSATION ---
      const recipientId = parseInt(recipientVendorId, 10);

      // 1. Check if session already exists
      const existing = await ChatSession.findOne({
        where: { vendor_id: vendorId, recipient_vendor_id: recipientId }
      });
      
      if (existing) {
        return sendSuccess(res, 'B2B chat session already exists.', { chatId: existing.chat_id });
      }

      // 2. Fetch both vendor details
      const [vendorA, vendorB] = await Promise.all([
        Vendor.findByPk(vendorId),
        Vendor.findByPk(recipientId)
      ]);

      if (!vendorB) {
        return sendError(res, 'Recipient vendor not found.', {}, 404);
      }

      const vendorAName = vendorA.name;
      const vendorBName = vendorB.name;
      const shopNameA = vendorA.shop_name || 'Dealer';
      const shopNameB = vendorB.shop_name || 'Dealer';

      const initialsA = vendorAName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'VD';
      const initialsB = vendorBName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'VD';

      const chatIdA = `chat-${vendorId}-${recipientId}`;
      const chatIdB = `chat-${recipientId}-${vendorId}`;
      const lastMsgText = initialMessage ? initialMessage : 'Conversation started';

      // 3. Create Session A (for Vendor A) if not exists
      const existingSessionA = await ChatSession.findOne({ where: { chat_id: chatIdA } });
      if (!existingSessionA) {
        await ChatSession.create({
          chat_id: chatIdA,
          vendor_id: vendorId,
          recipient_vendor_id: recipientId,
          customer_name: vendorBName,
          avatar: initialsB,
          status: 'online',
          last_message: lastMsgText,
          unread_count: 0,
          last_active: 'Just now',
          device_interest: shopNameB,
          notes: 'B2B Trade Partner'
        });
      }

      // 4. Create Session B (for Vendor B) if not exists
      const existingSessionB = await ChatSession.findOne({ where: { chat_id: chatIdB } });
      if (!existingSessionB) {
        const unreadCountB = initialMessage ? 1 : 0;
        await ChatSession.create({
          chat_id: chatIdB,
          vendor_id: recipientId,
          recipient_vendor_id: vendorId,
          customer_name: vendorAName,
          avatar: initialsA,
          status: 'online',
          last_message: lastMsgText,
          unread_count: unreadCountB,
          last_active: 'Just now',
          device_interest: shopNameA,
          notes: 'B2B Trade Partner'
        });
      }

      // 5. If initial message is provided, save it for both sessions
      if (initialMessage) {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Save for A (sender = 'vendor')
        await Message.create({
          chat_id: chatIdA,
          sender: 'vendor',
          text: initialMessage,
          timestamp,
          status: 'sent'
        });
        
        // Save for B (sender = 'customer')
        await Message.create({
          chat_id: chatIdB,
          sender: 'customer',
          text: initialMessage,
          timestamp,
          status: 'unread'
        });
      }

      // 6. Broadcast list update to both sockets
      if (io) {
        // Vendor A updates
        const sessionsA = await socketHandler.fetchVendorSessions(vendorId);
        io.to(`vendor-${vendorId}`).emit('sessions_update', sessionsA);

        // Vendor B updates
        const sessionsB = await socketHandler.fetchVendorSessions(recipientId);
        io.to(`vendor-${recipientId}`).emit('sessions_update', sessionsB);
      }

      return sendSuccess(res, 'B2B Chat session created successfully.', { chatId: chatIdA });

    } else {
      // --- B2C CONVERSATION ---
      if (!customerName) {
        return sendError(res, 'Customer name is required.', {}, 400);
      }

      const chatId = `chat-${Date.now()}`;
      const avatar = customerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'CU';
      const lastMsg = initialMessage ? initialMessage : 'Conversation started';

      await ChatSession.create({
        chat_id: chatId,
        vendor_id: vendorId,
        customer_name: customerName,
        customer_phone: customerPhone || null,
        customer_email: customerEmail || null,
        avatar,
        status: 'online',
        last_message: lastMsg,
        unread_count: 0,
        last_active: 'Just now',
        device_interest: deviceInterest || null,
        notes: notes || 'New manual conversation.'
      });

      if (initialMessage) {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        await Message.create({
          chat_id: chatId,
          sender: 'vendor',
          text: initialMessage,
          timestamp,
          status: 'sent'
        });
      }

      if (io) {
        const sessions = await socketHandler.fetchVendorSessions(vendorId);
        io.to(`vendor-${vendorId}`).emit('sessions_update', sessions);
      }

      return sendSuccess(res, 'Chat session created successfully.', { chatId });
    }

  } catch (error) {
    console.error('[ChatController] createSession error:', error.message);
    return sendError(res, 'Internal server error creating chat session.', {}, 500);
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
        status: 'approved'
      },
      attributes: ['id', 'name', 'email', 'shop_name', 'profile_img'],
      order: [['name', 'ASC']]
    });
    
    return sendSuccess(res, 'Other vendors retrieved successfully.', { vendors });
  } catch (error) {
    console.error('[ChatController] getVendors error:', error.message);
    return sendError(res, 'Internal server error retrieving vendors list.', {}, 500);
  }
}

module.exports = {
  getSessions,
  getMessages,
  uploadFile,
  sendMessage,
  createSession,
  getVendors
};
