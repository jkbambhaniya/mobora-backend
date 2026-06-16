const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const socketHandler = require('../utils/socketHandler');
const { sendSuccess, sendError } = require('../utils/responseHelper');

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
      { sender: "customer", text: "Hello! I saw your listing for the iPhone 13 Pro.", timestamp: "10:30 AM", status: "read" },
      { sender: "vendor", text: "Hello Rahul! Yes, it is available in Graphite, Mint condition. How can I help you?", timestamp: "10:32 AM", status: "read" },
      { sender: "customer", text: "Here is the battery specs sheet of my old device for trade-in.", timestamp: "10:33 AM", status: "read" },
      { 
        sender: "customer", 
        text: "", 
        timestamp: "10:33 AM",
        status: "unread",
        attachment_type: "file",
        attachment_name: "Battery_Specs.pdf",
        attachment_size: "1.2 MB",
        attachment_url: "#"
      }
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
      { sender: "customer", text: "Hey, is the Galaxy S22 Ultra screen clean?", timestamp: "Yesterday", status: "read" },
      { sender: "vendor", text: "Here is a quick boot-up check video of the S22 Ultra for you.", timestamp: "Yesterday", status: "read" },
      {
        sender: "vendor",
        text: "Galaxy S22 Ultra Verification Video",
        timestamp: "Yesterday",
        status: "read",
        attachment_type: "video",
        attachment_name: "S22_Ultra_Inspection.mp4",
        attachment_size: "4.8 MB",
        attachment_url: "https://assets.mixkit.co/videos/preview/mixkit-hand-holding-a-smart-phone-in-vertical-mode-39902-large.mp4"
      },
      { sender: "customer", text: "What is the battery health of Galaxy S22 Ultra?", timestamp: "Yesterday", status: "read" }
    ]
  }
];

/**
 * Seed helper for a vendor
 */
async function seedVendorChats(vendorId) {
  console.log(`[ChatSeeder] Seeding chats for vendor ${vendorId}...`);
  const connection = await db.getPool().getConnection();
  try {
    await connection.beginTransaction();

    for (const session of defaultSessions) {
      const uniqueChatId = `${session.id}-${vendorId}`;

      // 1. Insert chat session
      const insertSessionSql = `
        INSERT INTO chat_sessions (chat_id, vendor_id, customer_name, customer_phone, customer_email, avatar, status, last_message, unread_count, last_active, device_interest, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await connection.query(insertSessionSql, [
        uniqueChatId,
        vendorId,
        session.customer_name,
        session.customer_phone,
        session.customer_email,
        session.avatar,
        session.status,
        session.last_message,
        session.unread_count,
        session.last_active,
        session.device_interest,
        session.notes
      ]);

      // 2. Insert messages
      for (const msg of session.messages) {
        const insertMsgSql = `
          INSERT INTO messages (chat_id, sender, text, timestamp, status, attachment_type, attachment_name, attachment_size, attachment_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await connection.query(insertMsgSql, [
          uniqueChatId,
          msg.sender,
          msg.text,
          msg.timestamp,
          msg.status,
          msg.attachment_type || null,
          msg.attachment_name || null,
          msg.attachment_size || null,
          msg.attachment_url || null
        ]);
      }
    }

    await connection.commit();
    console.log(`[ChatSeeder] Seeding for vendor ${vendorId} finished successfully.`);
  } catch (error) {
    await connection.rollback();
    console.error(`[ChatSeeder] Failed to seed chats for vendor ${vendorId}:`, error.message);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get all chat sessions for the logged-in vendor
 */
async function getSessions(req, res) {
  try {
    const vendorId = req.user.id;

    // Check if any sessions exist
    const checkSql = `SELECT COUNT(*) as count FROM chat_sessions WHERE vendor_id = ?`;
    const [countResult] = await db.query(checkSql, [vendorId]);

    if (countResult[0].count === 0) {
      // Auto seed
      await seedVendorChats(vendorId);
    }

    // Fetch and format sessions
    const selectSql = `SELECT * FROM chat_sessions WHERE vendor_id = ? ORDER BY updated_at DESC`;
    const [sessions] = await db.query(selectSql, [vendorId]);

    const formattedSessions = sessions.map(s => {
      let parsedMembers = [];
      if (s.group_members) {
        try {
          parsedMembers = JSON.parse(s.group_members);
        } catch (e) {
          parsedMembers = [];
        }
      }
      return {
        id: s.chat_id, // Map s.chat_id to API 'id' field for frontend routing
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
        isGroup: s.is_group === 1,
        groupName: s.group_name,
        groupMembers: parsedMembers
      };
    });

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
    const sessionSql = `SELECT * FROM chat_sessions WHERE chat_id = ? AND vendor_id = ?`;
    const [session] = await db.query(sessionSql, [chatId, vendorId]);
    if (session.length === 0) {
      return sendError(res, 'Chat session not found or access denied.', {}, 403);
    }

    // Update unread count to 0 in this chat
    const clearUnreadSql = `UPDATE chat_sessions SET unread_count = 0 WHERE chat_id = ? AND vendor_id = ?`;
    await db.query(clearUnreadSql, [chatId, vendorId]);

    // Mark customer messages in this chat as read
    const readMsgSql = `UPDATE messages SET status = 'read' WHERE chat_id = ? AND sender = 'customer' AND status != 'read'`;
    await db.query(readMsgSql, [chatId]);

    // If B2B, also mark recipient vendor's sent messages in their room to 'read'
    if (session[0].recipient_vendor_id) {
      const recipientId = session[0].recipient_vendor_id;
      const chatIdB = `chat-${recipientId}-${vendorId}`;
      
      const updateMsgBSql = `UPDATE messages SET status = 'read' WHERE chat_id = ? AND sender = 'vendor' AND status != 'read'`;
      await db.query(updateMsgBSql, [chatIdB]);

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

    // Fetch messages
    const selectSql = `SELECT * FROM messages WHERE chat_id = ? ORDER BY id ASC`;
    const [messages] = await db.query(selectSql, [chatId]);

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

    return sendSuccess(res, 'Chat messages retrieved.', { messages: formattedMessages });
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

    // Ensure upload dir exists
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Strip out base64 prefixes if present (e.g. "data:image/png;base64,")
    const match = base64.match(/^data:([^;]+);base64,(.+)$/);
    let fileBuffer;
    if (match) {
      fileBuffer = Buffer.from(match[2], 'base64');
    } else {
      fileBuffer = Buffer.from(base64, 'base64');
    }

    // Generate unique file name
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 1000);
    const sanitizedName = name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueFilename = `${timestamp}-${randomSuffix}-${sanitizedName}`;
    const filePath = path.join(uploadDir, uniqueFilename);

    // Save to disk
    fs.writeFileSync(filePath, fileBuffer);
    console.log(`[Upload] File saved successfully at: ${filePath}`);

    // Return final URL
    const fileUrl = `/uploads/${uniqueFilename}`;

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
    const insertMsgQuery = `
      INSERT INTO messages (chat_id, sender, text, timestamp, status, attachment_type, attachment_name, attachment_size, attachment_url)
      VALUES (?, 'vendor', ?, ?, 'sent', ?, ?, ?, ?)
    `;
    const attachmentType = attachment ? attachment.type : null;
    const attachmentName = attachment ? attachment.name : null;
    const attachmentSize = attachment ? attachment.size || null : null;
    const attachmentUrl = attachment ? attachment.url : null;

    const [result] = await db.query(insertMsgQuery, [
      chatId,
      text,
      timestamp,
      attachmentType,
      attachmentName,
      attachmentSize,
      attachmentUrl
    ]);

    const messageId = result.insertId;
    const newMsg = {
      id: `m-${messageId}`,
      sender: 'vendor',
      text,
      timestamp,
      status: 'sent',
      attachment
    };

    // Update session
    const updateSessionQuery = `
      UPDATE chat_sessions 
      SET last_message = ?, last_active = 'Just now', unread_count = 0
      WHERE chat_id = ? AND vendor_id = ?
    `;
    const lastMsgText = attachment ? `Sent attachment: ${attachment.name}` : text;
    await db.query(updateSessionQuery, [lastMsgText, chatId, vendorId]);

    // Broadcast message to chat room using socket handler
    const io = socketHandler.getIo();
    if (io) {
      io.to(`chat-${chatId}`).emit('receive_message', newMsg);
      // Emit sessions updates
      const sessionsQuery = `SELECT * FROM chat_sessions WHERE vendor_id = ? ORDER BY updated_at DESC`;
      const [sessions] = await db.query(sessionsQuery, [vendorId]);
      const formattedSessions = sessions.map(s => ({
        id: s.chat_id, // Map s.chat_id to API 'id' field for frontend routing
        customerName: s.customer_name,
        customerPhone: s.customer_phone,
        customerEmail: s.customer_email,
        avatar: s.avatar,
        status: s.status,
        lastMessage: s.last_message,
        unreadCount: s.unread_count,
        lastActive: s.last_active,
        deviceInterest: s.device_interest,
        notes: s.notes
      }));
      io.to(`vendor-${vendorId}`).emit('sessions_update', formattedSessions);
    }

    // Trigger simulator replies
    // Wait a brief delay to simulate customer typing
    setTimeout(() => {
      // Run simulation trigger
      // Import/trigger from socketHandler
      const lowercaseText = text.toLowerCase();
      // Simulated response triggers...
    }, 100);

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
      const [creatorRes] = await db.query(`SELECT name FROM vendors WHERE id = ?`, [vendorId]);
      const creatorName = creatorRes.length > 0 ? creatorRes[0].name : 'Dealer';

      const timestamp = Date.now();
      const uniqueMemberIds = Array.from(new Set([...memberIds.map(id => parseInt(id, 10)), vendorId]));
      const groupChatIdBase = `group-${timestamp}`;

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const lastMsgText = initialMessage ? initialMessage : 'Group created';

      // Insert session for each group member
      for (const mId of uniqueMemberIds) {
        const memberChatId = `${groupChatIdBase}-${mId}`;
        const initials = groupName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'GP';

        const insertSessionSql = `
          INSERT INTO chat_sessions (chat_id, vendor_id, customer_name, avatar, status, last_message, unread_count, last_active, notes, is_group, group_name, group_members)
          VALUES (?, ?, ?, ?, 'online', ?, ?, 'Just now', 'B2B Group Trade Channel', 1, ?, ?)
        `;
        const unreadCount = (mId === vendorId) ? 0 : (initialMessage ? 1 : 0);
        await db.query(insertSessionSql, [
          memberChatId,
          mId,
          groupName,
          initials,
          lastMsgText,
          unreadCount,
          groupName,
          JSON.stringify(uniqueMemberIds)
        ]);

        if (initialMessage) {
          const insertMsgSql = `
            INSERT INTO messages (chat_id, sender, sender_id, sender_name, text, timestamp, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `;
          const msgSender = (mId === vendorId) ? 'vendor' : 'customer';
          const msgStatus = (mId === vendorId) ? 'sent' : 'unread';
          await db.query(insertMsgSql, [
            memberChatId,
            msgSender,
            vendorId,
            creatorName,
            initialMessage,
            timeStr,
            msgStatus
          ]);
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
      const checkSql = `SELECT chat_id FROM chat_sessions WHERE vendor_id = ? AND recipient_vendor_id = ?`;
      const [existing] = await db.query(checkSql, [vendorId, recipientId]);
      
      if (existing.length > 0) {
        return sendSuccess(res, 'B2B chat session already exists.', { chatId: existing[0].chat_id });
      }

      // 2. Fetch both vendor details
      const [vendorARes] = await db.query(`SELECT name, shop_name FROM vendors WHERE id = ?`, [vendorId]);
      const [vendorBRes] = await db.query(`SELECT name, shop_name FROM vendors WHERE id = ?`, [recipientId]);

      if (vendorBRes.length === 0) {
        return sendError(res, 'Recipient vendor not found.', {}, 404);
      }

      const vendorAName = vendorARes[0].name;
      const vendorBName = vendorBRes[0].name;
      const shopNameA = vendorARes[0].shop_name || 'Dealer';
      const shopNameB = vendorBRes[0].shop_name || 'Dealer';

      const initialsA = vendorAName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'VD';
      const initialsB = vendorBName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'VD';

      const chatIdA = `chat-${vendorId}-${recipientId}`;
      const chatIdB = `chat-${recipientId}-${vendorId}`;
      const lastMsgText = initialMessage ? initialMessage : 'Conversation started';

      // 3. Create Session A (for Vendor A) if not exists
      const [existingSessionA] = await db.query(`SELECT id FROM chat_sessions WHERE chat_id = ?`, [chatIdA]);
      if (existingSessionA.length === 0) {
        const insertSessionASql = `
          INSERT INTO chat_sessions (chat_id, vendor_id, recipient_vendor_id, customer_name, avatar, status, last_message, unread_count, last_active, device_interest, notes)
          VALUES (?, ?, ?, ?, ?, 'online', ?, 0, 'Just now', ?, 'B2B Trade Partner')
        `;
        await db.query(insertSessionASql, [chatIdA, vendorId, recipientId, vendorBName, initialsB, lastMsgText, shopNameB]);
      }

      // 4. Create Session B (for Vendor B) if not exists
      const [existingSessionB] = await db.query(`SELECT id FROM chat_sessions WHERE chat_id = ?`, [chatIdB]);
      if (existingSessionB.length === 0) {
        const insertSessionBSql = `
          INSERT INTO chat_sessions (chat_id, vendor_id, recipient_vendor_id, customer_name, avatar, status, last_message, unread_count, last_active, device_interest, notes)
          VALUES (?, ?, ?, ?, ?, 'online', ?, ?, 'Just now', ?, 'B2B Trade Partner')
        `;
        const unreadCountB = initialMessage ? 1 : 0;
        await db.query(insertSessionBSql, [chatIdB, recipientId, vendorId, vendorAName, initialsA, lastMsgText, unreadCountB, shopNameA]);
      }

      // 5. If initial message is provided, save it for both sessions
      if (initialMessage) {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Save for A (sender = 'vendor')
        await db.query(`INSERT INTO messages (chat_id, sender, text, timestamp, status) VALUES (?, 'vendor', ?, ?, 'sent')`, [chatIdA, initialMessage, timestamp]);
        // Save for B (sender = 'customer')
        await db.query(`INSERT INTO messages (chat_id, sender, text, timestamp, status) VALUES (?, 'customer', ?, ?, 'unread')`, [chatIdB, initialMessage, timestamp]);
      }

      // 6. Broadcast list update to both sockets
      if (io) {
        // Vendor A updates
        const selectSqlA = `SELECT * FROM chat_sessions WHERE vendor_id = ? ORDER BY updated_at DESC`;
        const [sessionsA] = await db.query(selectSqlA, [vendorId]);
        const formattedA = sessionsA.map(s => ({
          id: s.chat_id, // Map s.chat_id to API 'id' field for frontend routing
          customerName: s.customer_name,
          avatar: s.avatar,
          status: s.status,
          lastMessage: s.last_message,
          unreadCount: s.unread_count,
          lastActive: s.last_active,
          deviceInterest: s.device_interest,
          notes: s.notes
        }));
        io.to(`vendor-${vendorId}`).emit('sessions_update', formattedA);

        // Vendor B updates
        const selectSqlB = `SELECT * FROM chat_sessions WHERE vendor_id = ? ORDER BY updated_at DESC`;
        const [sessionsB] = await db.query(selectSqlB, [recipientId]);
        const formattedB = sessionsB.map(s => ({
          id: s.chat_id, // Map s.chat_id to API 'id' field for frontend routing
          customerName: s.customer_name,
          avatar: s.avatar,
          status: s.status,
          lastMessage: s.last_message,
          unreadCount: s.unread_count,
          lastActive: s.last_active,
          deviceInterest: s.device_interest,
          notes: s.notes
        }));
        io.to(`vendor-${recipientId}`).emit('sessions_update', formattedB);
      }

      return sendSuccess(res, 'B2B Chat session created successfully.', { chatId: chatIdA });

    } else {
      // --- B2C CONVERSATION (EXISTING LOGIC) ---
      if (!customerName) {
        return sendError(res, 'Customer name is required.', {}, 400);
      }

      const chatId = `chat-${Date.now()}`;
      const avatar = customerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'CU';

      const insertSql = `
        INSERT INTO chat_sessions (chat_id, vendor_id, customer_name, customer_phone, customer_email, avatar, status, last_message, unread_count, last_active, device_interest, notes)
        VALUES (?, ?, ?, ?, ?, ?, 'online', ?, 0, 'Just now', ?, ?)
      `;

      const lastMsg = initialMessage ? initialMessage : 'Conversation started';

      await db.query(insertSql, [
        chatId,
        vendorId,
        customerName,
        customerPhone || null,
        customerEmail || null,
        avatar,
        lastMsg,
        deviceInterest || null,
        notes || 'New manual conversation.'
      ]);

      if (initialMessage) {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const insertMsgSql = `
          INSERT INTO messages (chat_id, sender, text, timestamp, status)
          VALUES (?, 'vendor', ?, ?, 'sent')
        `;
        await db.query(insertMsgSql, [chatId, initialMessage, timestamp]);
      }

      if (io) {
        const selectSql = `SELECT * FROM chat_sessions WHERE vendor_id = ? ORDER BY updated_at DESC`;
        const [sessions] = await db.query(selectSql, [vendorId]);
        const formattedSessions = sessions.map(s => ({
          id: s.chat_id, // Map s.chat_id to API 'id' field for frontend routing
          customerName: s.customer_name,
          customerPhone: s.customer_phone,
          customerEmail: s.customer_email,
          avatar: s.avatar,
          status: s.status,
          lastMessage: s.last_message,
          unreadCount: s.unread_count,
          lastActive: s.last_active,
          deviceInterest: s.device_interest,
          notes: s.notes
        }));
        io.to(`vendor-${vendorId}`).emit('sessions_update', formattedSessions);
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
    const query = `
      SELECT id, name, email, shop_name, profile_img 
      FROM vendors 
      WHERE id != ? AND status = 'approved'
      ORDER BY name ASC
    `;
    const [vendors] = await db.query(query, [currentVendorId]);
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
