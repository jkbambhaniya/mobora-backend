const { Server } = require('socket.io');
const db = require('../config/db');

let io = null;
const onlineVendors = new Map(); // maps vendorId (number) -> Array of socket IDs

async function updateVendorOnlineStatus(vendorId, status) {
  try {
    // 1. Update status in chat_sessions where this vendor is the recipient
    const updateSql = `UPDATE chat_sessions SET status = ? WHERE recipient_vendor_id = ?`;
    await db.query(updateSql, [status, vendorId]);

    // 2. Find all vendors (owners of these sessions) who need to be notified
    const findOwnersSql = `SELECT DISTINCT vendor_id FROM chat_sessions WHERE recipient_vendor_id = ?`;
    const [owners] = await db.query(findOwnersSql, [vendorId]);

    // 3. For each owner, fetch updated sessions and emit to their socket room
    for (const owner of owners) {
      const ownerId = owner.vendor_id;
      const sessions = await fetchVendorSessions(ownerId);
      if (io) {
        io.to(`vendor-${ownerId}`).emit('sessions_update', sessions);
      }
    }
  } catch (err) {
    console.error('[Socket] Failed to update vendor online status:', err.message);
  }
}

async function syncVendorSessionsOnlineStatus(vendorId) {
  try {
    // Get all B2B sessions for this vendor
    const getB2bSessionsSql = `SELECT chat_id, recipient_vendor_id FROM chat_sessions WHERE vendor_id = ? AND recipient_vendor_id IS NOT NULL`;
    const [sessions] = await db.query(getB2bSessionsSql, [vendorId]);

    for (const session of sessions) {
      const recipientId = session.recipient_vendor_id;
      const isRecipientOnline = onlineVendors.has(recipientId) && onlineVendors.get(recipientId).length > 0;
      const currentStatus = isRecipientOnline ? 'online' : 'offline';

      await db.query(`UPDATE chat_sessions SET status = ? WHERE chat_id = ?`, [currentStatus, session.chat_id]);
    }
  } catch (err) {
    console.error('[Socket] Failed to sync vendor sessions online status:', err.message);
  }
}

async function markChatMessagesAsRead(chatId, vendorId) {
  try {
    // 1. Verify session belongs to vendor
    const sessionSql = `SELECT recipient_vendor_id FROM chat_sessions WHERE chat_id = ? AND vendor_id = ?`;
    const [session] = await db.query(sessionSql, [chatId, vendorId]);
    if (session.length === 0) return;

    // 2. Mark customer messages in this chat as read
    const readMsgSql = `UPDATE messages SET status = 'read' WHERE chat_id = ? AND sender = 'customer' AND status != 'read'`;
    await db.query(readMsgSql, [chatId]);

    // 3. Clear unread count for this session
    await db.query(`UPDATE chat_sessions SET unread_count = 0 WHERE chat_id = ? AND vendor_id = ?`, [chatId, vendorId]);

    // 4. Broadcast sidebar update to the current vendor
    const sessions = await fetchVendorSessions(vendorId);
    if (io) {
      io.to(`vendor-${vendorId}`).emit('sessions_update', sessions);
    }

    // 5. If B2B, update recipient's vendor messages and notify
    if (session[0].recipient_vendor_id) {
      const recipientId = session[0].recipient_vendor_id;
      const chatIdB = `chat-${recipientId}-${vendorId}`;

      // Update Vendor B's sent messages in their room to 'read'
      const updateMsgBSql = `UPDATE messages SET status = 'read' WHERE chat_id = ? AND sender = 'vendor' AND status != 'read'`;
      await db.query(updateMsgBSql, [chatIdB]);

      if (io) {
        // Emit messages_read to Vendor B's chat room
        io.to(`chat-${chatIdB}`).emit('messages_read', { chatId: chatIdB });

        // Refresh Vendor B's sidebar sessions list
        const sessionsB = await fetchVendorSessions(recipientId);
        io.to(`vendor-${recipientId}`).emit('sessions_update', sessionsB);
      }
    }
  } catch (err) {
    console.error('[Socket] Failed to mark chat messages as read:', err.message);
  }
}

function leaveAllChatRooms(socket) {
  const rooms = Array.from(socket.rooms);
  for (const room of rooms) {
    if (room.startsWith('chat-')) {
      socket.leave(room);
      console.log(`[Socket] Client ${socket.id} left room ${room}`);
    }
  }
}

function init(server, corsOptions) {
  io = new Server(server, {
    cors: corsOptions
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] New client connected: ${socket.id}`);

    // Register vendor
    socket.on('register', async ({ vendorId }) => {
      if (vendorId) {
        const vId = parseInt(vendorId, 10);
        socket.join(`vendor-${vId}`);
        socket.vendorId = vId;

        const isFirstConnection = !onlineVendors.has(vId) || onlineVendors.get(vId).length === 0;

        if (!onlineVendors.has(vId)) {
          onlineVendors.set(vId, []);
        }
        onlineVendors.get(vId).push(socket.id);

        console.log(`[Socket] Client ${socket.id} registered to vendor-${vId}`);

        if (isFirstConnection) {
          await updateVendorOnlineStatus(vId, 'online');
        }

        // Sync recipient statuses for this vendor's sessions
        await syncVendorSessionsOnlineStatus(vId);

        // Immediately push updated sessions to the newly connected vendor
        const sessions = await fetchVendorSessions(vId);
        socket.emit('sessions_update', sessions);
      }
    });

    // Sync active chat session changes
    socket.on('active_chat_changed', async ({ chatId }) => {
      leaveAllChatRooms(socket);
      socket.activeChatId = chatId;
      if (chatId) {
        const roomName = `chat-${chatId}`;
        socket.join(roomName);
        console.log(`[Socket] Client ${socket.id} set active chat to ${chatId} and joined ${roomName}`);
        
        if (socket.vendorId) {
          await markChatMessagesAsRead(chatId, socket.vendorId);
        }
      } else {
        console.log(`[Socket] Client ${socket.id} cleared active chat`);
      }
    });

    // Join a specific chat room
    socket.on('join_chat', async ({ chatId }) => {
      if (chatId) {
        leaveAllChatRooms(socket);
        socket.activeChatId = chatId;
        socket.join(`chat-${chatId}`);
        console.log(`[Socket] Client ${socket.id} joined room chat-${chatId}`);
        
        if (socket.vendorId) {
          await markChatMessagesAsRead(chatId, socket.vendorId);
        }
      }
    });

    // Handle sending a message
    socket.on('send_message', async (data) => {
      const { chatId, vendorId, text, attachment } = data;
      if (!chatId || !vendorId) return;

      console.log(`[Socket] Message from vendor ${vendorId} in chat ${chatId}: ${text}`);

      try {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const lastMsgText = attachment ? `Attached: ${attachment.name}` : text;

        // Check if B2B chat session (has recipient_vendor_id)
        const checkB2bSql = `SELECT recipient_vendor_id FROM chat_sessions WHERE chat_id = ? AND vendor_id = ?`;
        const [sessionCheck] = await db.query(checkB2bSql, [chatId, vendorId]);
        const recipientVendorId = sessionCheck.length > 0 ? sessionCheck[0].recipient_vendor_id : null;

        if (chatId.startsWith('group-')) {
          // --- B2B GROUP CHAT ROUTING ---
          console.log(`[Socket Group] Routing B2B group message from Vendor ${vendorId} in chat ${chatId}: ${text}`);

          const getGroupSql = `SELECT group_members, group_name FROM chat_sessions WHERE chat_id = ? AND vendor_id = ?`;
          const [groupCheck] = await db.query(getGroupSql, [chatId, vendorId]);
          if (groupCheck.length > 0) {
            const groupMembers = JSON.parse(groupCheck[0].group_members || '[]');

            // Get sender details
            const [senderRes] = await db.query(`SELECT name FROM vendors WHERE id = ?`, [vendorId]);
            const senderName = senderRes.length > 0 ? senderRes[0].name : 'Dealer';

            const baseGroupId = chatId.split('-').slice(0, 2).join('-'); // e.g. group-123456789

            const attachmentType = attachment ? attachment.type : null;
            const attachmentName = attachment ? attachment.name : null;
            const attachmentSize = attachment ? attachment.size || null : null;
            const attachmentUrl = attachment ? attachment.url : null;

            for (const memberId of groupMembers) {
              const memberChatId = `${baseGroupId}-${memberId}`;

              // Check if this member is currently viewing this chat room
              const memberRoomName = `chat-${memberChatId}`;
              const room = io.sockets.adapter.rooms.get(memberRoomName);
              const isViewing = room && room.size > 0;

              const isSender = (memberId === vendorId);
              const msgSender = isSender ? 'vendor' : 'customer';
              const msgStatus = isSender ? 'sent' : (isViewing ? 'read' : 'unread');

              // 1. Insert message for this member's thread
              const insertMsgSql = `
                INSERT INTO messages (chat_id, sender, sender_id, sender_name, text, timestamp, status, attachment_type, attachment_name, attachment_size, attachment_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `;
              const [result] = await db.query(insertMsgSql, [
                memberChatId,
                msgSender,
                vendorId,
                senderName,
                text,
                timestamp,
                msgStatus,
                attachmentType,
                attachmentName,
                attachmentSize,
                attachmentUrl
              ]);

              // 2. Update member's chat session
              const unreadIncrement = (isSender || isViewing) ? 0 : 1;
              const updateSessionSql = `
                UPDATE chat_sessions 
                SET last_message = ?, last_active = 'Just now', unread_count = unread_count + ?
                WHERE chat_id = ? AND vendor_id = ?
              `;
              await db.query(updateSessionSql, [lastMsgText, unreadIncrement, memberChatId, memberId]);

              // 3. Emit message to the member's chat room
              const newMsg = {
                id: `m-${result.insertId}`,
                sender: msgSender,
                senderId: vendorId,
                senderName: senderName,
                text,
                timestamp,
                status: msgStatus,
                attachment
              };
              io.to(memberRoomName).emit('receive_message', newMsg);

              // 4. Broadcast sidebar update to the member
              const sessions = await fetchVendorSessions(memberId);
              io.to(`vendor-${memberId}`).emit('sessions_update', sessions);
            }
          }
        } else if (recipientVendorId) {
          // --- B2B VENDOR-TO-VENDOR ROUTING ---
          console.log(`[Socket B2B] Routing B2B message from Vendor ${vendorId} to Recipient Vendor ${recipientVendorId}`);

          // 1. Locate or create corresponding chat session for Recipient Vendor B
          let chatIdB;
          const getBResSql = `SELECT chat_id FROM chat_sessions WHERE vendor_id = ? AND recipient_vendor_id = ?`;
          const [bRes] = await db.query(getBResSql, [recipientVendorId, vendorId]);
          
          if (bRes.length > 0) {
            chatIdB = bRes[0].chat_id;
          } else {
            // Create session for B
            chatIdB = `chat-${recipientVendorId}-${vendorId}`;
            // Fetch Vendor A's profile name and shop name
            const getVendorASql = `SELECT name, shop_name FROM vendors WHERE id = ?`;
            const [vendorARes] = await db.query(getVendorASql, [vendorId]);
            const vendorAName = vendorARes.length > 0 ? vendorARes[0].name : 'Other Vendor';
            const shopName = vendorARes.length > 0 ? vendorARes[0].shop_name : '';
            const initials = vendorAName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'VD';
            
            const [existingChatB] = await db.query(`SELECT id FROM chat_sessions WHERE chat_id = ?`, [chatIdB]);
            if (existingChatB.length === 0) {
              const insertBSession = `
                INSERT INTO chat_sessions (chat_id, vendor_id, recipient_vendor_id, customer_name, avatar, status, last_message, unread_count, last_active, device_interest, notes)
                VALUES (?, ?, ?, ?, ?, 'online', ?, 0, 'Just now', ?, 'B2B Trade Partner')
              `;
              await db.query(insertBSession, [chatIdB, recipientVendorId, vendorId, vendorAName, initials, lastMsgText, shopName]);
            }
          }

          const isRecipientOnline = onlineVendors.has(recipientVendorId) && onlineVendors.get(recipientVendorId).length > 0;
          let initialStatus = 'sent';
          if (isRecipientOnline) {
            // Check if they are in the active chat room
            const room = io.sockets.adapter.rooms.get(`chat-${chatIdB}`);
            if (room && room.size > 0) {
              initialStatus = 'read';
            } else {
              initialStatus = 'delivered';
            }
          }

          // 2. Insert message for Vendor A (Sender)
          const insertMsgASql = `
            INSERT INTO messages (chat_id, sender, text, timestamp, status, attachment_type, attachment_name, attachment_size, attachment_url)
            VALUES (?, 'vendor', ?, ?, ?, ?, ?, ?, ?)
          `;
          const attachmentType = attachment ? attachment.type : null;
          const attachmentName = attachment ? attachment.name : null;
          const attachmentSize = attachment ? attachment.size || null : null;
          const attachmentUrl = attachment ? attachment.url : null;

          const [resultA] = await db.query(insertMsgASql, [
            chatId, text, timestamp, initialStatus, attachmentType, attachmentName, attachmentSize, attachmentUrl
          ]);

          // 3. Insert message for Vendor B (Recipient)
          const insertMsgBSql = `
            INSERT INTO messages (chat_id, sender, text, timestamp, status, attachment_type, attachment_name, attachment_size, attachment_url)
            VALUES (?, 'customer', ?, ?, ?, ?, ?, ?, ?)
          `;
          const recipientStatus = (initialStatus === 'read') ? 'read' : 'unread';
          const [resultB] = await db.query(insertMsgBSql, [
            chatIdB, text, timestamp, recipientStatus, attachmentType, attachmentName, attachmentSize, attachmentUrl
          ]);

          // 4. Update Chat Sessions last message & active timestamp
          const updateSessionASql = `
            UPDATE chat_sessions 
            SET last_message = ?, last_active = 'Just now', unread_count = 0
            WHERE chat_id = ? AND vendor_id = ?
          `;
          await db.query(updateSessionASql, [lastMsgText, chatId, vendorId]);

          const unreadIncrement = (initialStatus === 'read') ? 0 : 1;
          const updateSessionBSql = `
            UPDATE chat_sessions 
            SET last_message = ?, last_active = 'Just now', unread_count = unread_count + ?
            WHERE chat_id = ? AND vendor_id = ?
          `;
          await db.query(updateSessionBSql, [lastMsgText, unreadIncrement, chatIdB, recipientVendorId]);

          // 5. Emit messages to separate room connections
          const newMsgA = {
            id: `m-${resultA.insertId}`,
            sender: 'vendor',
            text,
            timestamp,
            status: initialStatus,
            attachment
          };
          const newMsgB = {
            id: `m-${resultB.insertId}`,
            sender: 'customer',
            text,
            timestamp,
            status: recipientStatus,
            attachment
          };

          io.to(`chat-${chatId}`).emit('receive_message', newMsgA);
          io.to(`chat-${chatIdB}`).emit('receive_message', newMsgB);

          // 6. Push sidebar updates to both vendors
          const sessionsA = await fetchVendorSessions(vendorId);
          const sessionsB = await fetchVendorSessions(recipientVendorId);
          io.to(`vendor-${vendorId}`).emit('sessions_update', sessionsA);
          io.to(`vendor-${recipientVendorId}`).emit('sessions_update', sessionsB);

        } else {
          // --- B2C CUSTOMER SIMULATOR ROUTING ---
          // 1. Insert message into DB
          const insertMsgQuery = `
            INSERT INTO messages (chat_id, sender, text, timestamp, status, attachment_type, attachment_name, attachment_size, attachment_url)
            VALUES (?, 'vendor', ?, ?, 'delivered', ?, ?, ?, ?)
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
            status: 'delivered',
            attachment
          };

          // 2. Update chat session last message and timestamp
          const updateSessionQuery = `
            UPDATE chat_sessions 
            SET last_message = ?, last_active = 'Just now', unread_count = 0
            WHERE chat_id = ? AND vendor_id = ?
          `;
          await db.query(updateSessionQuery, [lastMsgText, chatId, vendorId]);

          // 3. Broadcast message to the chat room
          io.to(`chat-${chatId}`).emit('receive_message', newMsg);

          // 4. Update the sessions list for this vendor
          const sessions = await fetchVendorSessions(vendorId);
          io.to(`vendor-${vendorId}`).emit('sessions_update', sessions);

          // 5. Trigger customer simulator response
          triggerCustomerSimulator(chatId, vendorId, text);
        }

      } catch (err) {
        console.error('[Socket] Failed to save/broadcast vendor message:', err.message);
      }
    });

    socket.on('disconnect', async () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
      if (socket.vendorId) {
        const vId = socket.vendorId;
        const sockets = onlineVendors.get(vId);
        if (sockets) {
          const idx = sockets.indexOf(socket.id);
          if (idx !== -1) {
            sockets.splice(idx, 1);
          }
          if (sockets.length === 0) {
            onlineVendors.delete(vId);
            console.log(`[Socket] Vendor-${vId} is now offline`);
            await updateVendorOnlineStatus(vId, 'offline');
          }
        }
      }
    });
  });

  return io;
}

function getIo() {
  return io;
}

/**
 * Fetch all sessions for a vendor
 */
async function fetchVendorSessions(vendorId) {
  const query = `
    SELECT * FROM chat_sessions 
    WHERE vendor_id = ? 
    ORDER BY updated_at DESC
  `;
  const [sessions] = await db.query(query, [vendorId]);
  
  // Format for frontend (rename snake_case keys to camelCase)
  return sessions.map(s => {
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
}

/**
 * Customer Simulator Logic
 */
function triggerCustomerSimulator(chatId, vendorId, vendorText) {
  const lowercaseText = vendorText.toLowerCase();

  // 1. Determine reply contents
  let replyText = "Thanks for the response! Is the device screen in perfect condition?";
  let replyAttachment = null;

  if (lowercaseText.includes('battery') || lowercaseText.includes('bh') || lowercaseText.includes('specs') || lowercaseText.includes('health')) {
    replyText = "Here is the battery specs screenshot of my device. What do you think?";
    replyAttachment = {
      type: 'image',
      name: 'battery_health.png',
      url: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=400'
    };
  } else if (lowercaseText.includes('location') || lowercaseText.includes('store') || lowercaseText.includes('visit') || lowercaseText.includes('address')) {
    replyText = "Got it! That is very clear. I will visit your shop tomorrow morning.";
  } else if (lowercaseText.includes('price') || lowercaseText.includes('discount') || lowercaseText.includes('offer') || lowercaseText.includes('deal')) {
    replyText = "Could you check the receipt or the verification video? Let me attach the receipt.";
    replyAttachment = {
      type: 'file',
      name: 'Retail_Receipt.pdf',
      size: '1.4 MB',
      url: '#'
    };
  } else if (lowercaseText.includes('video') || lowercaseText.includes('condition') || lowercaseText.includes('verify') || lowercaseText.includes('scratch')) {
    replyText = "Here is a quick check video of my device. Please review it:";
    replyAttachment = {
      type: 'video',
      name: 'Device_Inspection.mp4',
      size: '4.8 MB',
      url: 'https://assets.mixkit.co/videos/preview/mixkit-hand-holding-a-smart-phone-in-vertical-mode-39902-large.mp4'
    };
  } else {
    // Random default replies
    const replies = [
      "Alright, that sounds great. Do you accept credit cards or only cash?",
      "Can we negotiate the price a little bit if I trade in my old device?",
      "Thanks! Do you have the original retail box and charger available?",
      "Sounds like a good deal. Let me double check and get back to you soon."
    ];
    replyText = replies[Math.floor(Math.random() * replies.length)];
  }

  // 2. Typing indicator start (after 700ms)
  setTimeout(async () => {
    if (!io) return;

    try {
      // Mark all vendor sent/delivered messages as read
      const updateMsgSql = `
        UPDATE messages 
        SET status = 'read' 
        WHERE chat_id = ? AND sender = 'vendor' AND status != 'read'
      `;
      await db.query(updateMsgSql, [chatId]);
      
      // Emit messages_read event to room
      io.to(`chat-${chatId}`).emit('messages_read', { chatId });
    } catch (err) {
      console.error('[Socket Simulator] Failed to mark messages as read on typing:', err.message);
    }

    io.to(`chat-${chatId}`).emit('typing_status', { chatId, isTyping: true });
  }, 700);

  // 3. Send actual response (after 2500ms total)
  setTimeout(async () => {
    if (!io) return;

    try {
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Check if the vendor is actively viewing this chat room
      const room = io.sockets.adapter.rooms.get(`chat-${chatId}`);
      const isViewingThisChat = room && room.size > 0;
      const initialStatus = isViewingThisChat ? 'read' : 'unread';
      const unreadIncrement = isViewingThisChat ? 0 : 1;

      // Save customer message to DB
      const insertMsgQuery = `
        INSERT INTO messages (chat_id, sender, text, timestamp, status, attachment_type, attachment_name, attachment_size, attachment_url)
        VALUES (?, 'customer', ?, ?, ?, ?, ?, ?, ?)
      `;
      const attachmentType = replyAttachment ? replyAttachment.type : null;
      const attachmentName = replyAttachment ? replyAttachment.name : null;
      const attachmentSize = replyAttachment ? replyAttachment.size || null : null;
      const attachmentUrl = replyAttachment ? replyAttachment.url : null;

      const [result] = await db.query(insertMsgQuery, [
        chatId,
        replyText,
        timestamp,
        initialStatus,
        attachmentType,
        attachmentName,
        attachmentSize,
        attachmentUrl
      ]);

      const messageId = result.insertId;
      const newCustomerMsg = {
        id: `m-${messageId}`,
        sender: 'customer',
        text: replyText,
        timestamp,
        status: initialStatus,
        attachment: replyAttachment
      };

      // Update session last message and unread count
      const updateSessionQuery = `
        UPDATE chat_sessions 
        SET last_message = ?, last_active = 'Just now', unread_count = unread_count + ?
        WHERE chat_id = ? AND vendor_id = ?
      `;
      const lastMsgText = replyAttachment ? `Attached: ${replyAttachment.name}` : replyText;
      await db.query(updateSessionQuery, [lastMsgText, unreadIncrement, chatId, vendorId]);

      // Turn off typing indicator
      io.to(`chat-${chatId}`).emit('typing_status', { chatId, isTyping: false });

      // Emit new message
      io.to(`chat-${chatId}`).emit('receive_message', newCustomerMsg);

      // Refresh list
      const sessions = await fetchVendorSessions(vendorId);
      io.to(`vendor-${vendorId}`).emit('sessions_update', sessions);

    } catch (err) {
      console.error('[Socket Simulator] Failed to save/broadcast simulated customer reply:', err.message);
    }
  }, 2500);
}

module.exports = {
  init,
  getIo,
  fetchVendorSessions
};
