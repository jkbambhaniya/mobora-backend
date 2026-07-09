const { Server } = require('socket.io');
const { ChatSession, Message, Vendor, Admin, Notification, sequelize } = require('../models');
const { Op } = require('sequelize');

let io = null;
const onlineVendors = new Map(); // maps vendorId (number) -> Array of socket IDs
const onlineAdmins = new Map(); // maps adminId (number) -> Array of socket IDs

async function updateVendorOnlineStatus(vendorId, status) {
  try {
    // 1. Update status in chat_sessions where this vendor is the recipient (for Vendor B2B)
    await ChatSession.update(
      { status },
      { where: { recipient_vendor_id: vendorId } }
    );

    // 2. Update status in chat_sessions for admin support chat (where vendor is the owner/customer)
    await ChatSession.update(
      { status },
      { where: { chat_id: `admin-chat-${vendorId}` } }
    );

    // 3. Find all vendors (owners of these sessions) who need to be notified
    const sessions = await ChatSession.findAll({
      where: { recipient_vendor_id: vendorId },
      attributes: ['vendor_id'],
      group: ['vendor_id'],
      raw: true
    });

    // 4. For each owner, fetch updated sessions and emit to their socket room
    if (io) {
      for (const session of sessions) {
        const ownerId = session.vendor_id;
        const updatedSessions = await fetchVendorSessions(ownerId);
        io.to(`vendor-${ownerId}`).emit('sessions_update', updatedSessions);
      }

      // 5. Fetch updated sessions for admin and emit to the admin room
      const updatedAdminSessions = await fetchAdminSessions();
      io.to('admin-room').emit('admin_sessions_update', updatedAdminSessions);
    }
  } catch (err) {
    console.error('[Socket] Failed to update vendor online status:', err.message);
  }
}

async function syncVendorSessionsOnlineStatus(vendorId) {
  try {
    // Get all B2B sessions for this vendor
    const sessions = await ChatSession.findAll({
      where: {
        vendor_id: vendorId,
        recipient_vendor_id: { [Op.ne]: null }
      },
      attributes: ['chat_id', 'recipient_vendor_id'],
      raw: true
    });

    for (const session of sessions) {
      const recipientId = session.recipient_vendor_id;
      const isRecipientOnline = onlineVendors.has(recipientId) && onlineVendors.get(recipientId).length > 0;
      const currentStatus = isRecipientOnline ? 'online' : 'offline';

      await ChatSession.update(
        { status: currentStatus },
        { where: { chat_id: session.chat_id } }
      );
    }
  } catch (err) {
    console.error('[Socket] Failed to sync vendor sessions online status:', err.message);
  }
}

async function markChatMessagesAsRead(chatId, vendorId) {
  try {
    // 1. Verify session belongs to vendor
    const session = await ChatSession.findOne({
      where: { chat_id: chatId, vendor_id: vendorId }
    });
    if (!session) return;

    // 2. Mark customer messages in this chat as read
    await Message.update(
      { status: 'read' },
      { where: { chat_id: chatId, sender: 'customer', status: { [Op.ne]: 'read' } } }
    );

    // 3. Clear unread count for this session
    await ChatSession.update(
      { unread_count: 0 },
      { where: { chat_id: chatId, vendor_id: vendorId } }
    );

    // 4. Broadcast sidebar update to the current vendor
    const sessions = await fetchVendorSessions(vendorId);
    if (io) {
      io.to(`vendor-${vendorId}`).emit('sessions_update', sessions);
    }

    // 5. If B2B, update recipient's vendor messages and notify
    if (session.recipient_vendor_id) {
      const recipientId = session.recipient_vendor_id;
      const chatIdB = `chat-${recipientId}-${vendorId}`;

      // Update Vendor B's sent messages in their room to 'read'
      await Message.update(
        { status: 'read' },
        { where: { chat_id: chatIdB, sender: 'vendor', status: { [Op.ne]: 'read' } } }
      );

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
    cors: corsOptions,
    transports: ['websocket', 'polling']
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

    // Register admin
    socket.on('register_admin', async ({ adminId }) => {
      if (adminId) {
        const aId = parseInt(adminId, 10);
        socket.join(`admin-${aId}`);
        socket.join('admin-room');
        socket.adminId = aId;
        socket.isAdmin = true;

        if (!onlineAdmins.has(aId)) {
          onlineAdmins.set(aId, []);
        }
        onlineAdmins.get(aId).push(socket.id);

        console.log(`[Socket] Admin ${socket.id} registered to admin-${aId}`);

        // Sync admin sessions
        const adminSessions = await fetchAdminSessions();
        socket.emit('admin_sessions_update', adminSessions);
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
        } else if (socket.isAdmin) {
          await markAdminChatMessagesAsRead(chatId);
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
        } else if (socket.isAdmin) {
          await markAdminChatMessagesAsRead(chatId);
        }
      }
    });

    // Handle sending a message
    socket.on('send_message', async (data) => {
      const { chatId, vendorId, adminId, text, attachment } = data;
      if (!chatId) return;

      // Handle ADMIN sender or ADMIN target chats
      if (chatId.startsWith('admin-') || adminId || socket.isAdmin) {
        console.log(`[Socket Admin Chat] Message in chat ${chatId}: ${text}`);
        try {
          const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const lastMsgText = attachment ? `Attached: ${attachment.name}` : text;
          const attachmentType = attachment ? attachment.type : null;
          const attachmentName = attachment ? attachment.name : null;
          const attachmentSize = attachment ? attachment.size || null : null;
          const attachmentUrl = attachment ? attachment.url : null;

          const isSenderAdmin = socket.isAdmin || adminId;
          const msgSender = isSenderAdmin ? 'admin' : 'vendor';
          const msgSenderName = isSenderAdmin ? 'Administrator' : (await Vendor.findByPk(vendorId)).name;

          // 1. Direct Admin Chat: admin-chat-<vendorId>
          if (chatId.startsWith('admin-chat-')) {
            const targetVendorId = parseInt(chatId.split('-').pop(), 10);
            
            // Check if vendor has this session, if not create it
            let session = await ChatSession.findOne({ where: { chat_id: chatId, vendor_id: targetVendorId } });
            if (!session) {
              session = await ChatSession.create({
                chat_id: chatId,
                vendor_id: targetVendorId,
                customer_name: 'System Administrator',
                avatar: 'AD',
                status: 'online',
                last_message: lastMsgText,
                unread_count: 0,
                admin_unread_count: 0,
                last_active: 'Just now',
                notes: 'Admin Support Chat'
              });
            }

            // Determine if the recipient is actively viewing this room
            let isRecipientViewing = false;
            const room = io.sockets.adapter.rooms.get(`chat-${chatId}`);
            if (room) {
              for (const socketId of room) {
                const s = io.sockets.sockets.get(socketId);
                if (s) {
                  if (isSenderAdmin) {
                    if (s.vendorId === targetVendorId) {
                      isRecipientViewing = true;
                      break;
                    }
                  } else {
                    if (s.isAdmin) {
                      isRecipientViewing = true;
                      break;
                    }
                  }
                }
              }
            }

            const initialStatus = isRecipientViewing ? 'read' : 'unread';

            // Insert Message
            const result = await Message.create({
              chat_id: chatId,
              sender: msgSender,
              sender_id: isSenderAdmin ? adminId || socket.adminId : vendorId,
              sender_name: msgSenderName,
              text,
              timestamp,
              status: initialStatus,
              attachment_type: attachmentType,
              attachment_name: attachmentName,
              attachment_size: attachmentSize,
              attachment_url: attachmentUrl
            });

            // Update unread count for recipient
            if (isSenderAdmin) {
              const unreadIncrement = isRecipientViewing ? 0 : 1;
              await ChatSession.update(
                {
                  last_message: lastMsgText,
                  last_active: 'Just now',
                  unread_count: sequelize.literal(`unread_count + ${unreadIncrement}`)
                },
                { where: { chat_id: chatId, vendor_id: targetVendorId } }
              );

              // Notify Vendor if not viewing
              if (!isRecipientViewing) {
                const notifBody = attachment ? `📎 ${attachment.name}` : (text || 'Sent a message');
                const notifBodyTrimmed = notifBody.length > 80 ? notifBody.slice(0, 80) + '…' : notifBody;

                await Notification.create({
                  vendor_id: targetVendorId,
                  type: 'admin_message',
                  title: 'New message from Administrator',
                  body: notifBodyTrimmed,
                  chat_id: chatId,
                  sender_name: 'Administrator',
                  timestamp
                });

                const isVendorOnline = onlineVendors.has(targetVendorId) && onlineVendors.get(targetVendorId).length > 0;
                if (isVendorOnline) {
                  io.to(`vendor-${targetVendorId}`).emit('new_notification', {
                    type: 'admin_message',
                    title: 'New message from Administrator',
                    body: notifBodyTrimmed,
                    chatId: chatId,
                    senderName: 'Administrator'
                  });
                }
              }
            } else {
              const adminUnreadIncrement = isRecipientViewing ? 0 : 1;
              await ChatSession.update(
                {
                  last_message: lastMsgText,
                  last_active: 'Just now',
                  admin_unread_count: sequelize.literal(`admin_unread_count + ${adminUnreadIncrement}`)
                },
                { where: { chat_id: chatId, vendor_id: vendorId } }
              );

              io.to('admin-room').emit('admin_notification', {
                type: 'new_message',
                title: `Message from ${msgSenderName}`,
                body: lastMsgText.length > 80 ? lastMsgText.slice(0, 80) + '…' : lastMsgText,
                chatId: chatId,
                senderName: msgSenderName
              });
            }

            const newMsg = {
              id: `m-${result.id}`,
              sender: msgSender,
              senderId: isSenderAdmin ? adminId || socket.adminId : vendorId,
              senderName: msgSenderName,
              text,
              timestamp,
              status: initialStatus,
              attachment
            };

            io.to(`chat-${chatId}`).emit('receive_message', newMsg);

            const sessionsV = await fetchVendorSessions(targetVendorId);
            io.to(`vendor-${targetVendorId}`).emit('sessions_update', sessionsV);

            const sessionsA = await fetchAdminSessions();
            io.to('admin-room').emit('admin_sessions_update', sessionsA);
          }

          // 2. Admin Group Chat: admin-group-<timestamp>
          else if (chatId.startsWith('admin-group-')) {
            const parts = chatId.split('-');
            const baseGroupId = parts.slice(0, 3).join('-');
            
            const currentSession = await ChatSession.findOne({
              where: {
                chat_id: { [Op.like]: `${baseGroupId}-%` }
              }
            });

            if (currentSession) {
              const groupMembers = JSON.parse(currentSession.group_members || '[]');

              if (isSenderAdmin) {
                for (const memberId of groupMembers) {
                  const memberChatId = `${baseGroupId}-${memberId}`;

                  const room = io.sockets.adapter.rooms.get(`chat-${memberChatId}`);
                  const isViewing = room && room.size > 0;
                  const initialStatus = isViewing ? 'read' : 'unread';

                  const result = await Message.create({
                    chat_id: memberChatId,
                    sender: 'admin',
                    sender_id: adminId || socket.adminId,
                    sender_name: 'Administrator',
                    text,
                    timestamp,
                    status: initialStatus,
                    attachment_type: attachmentType,
                    attachment_name: attachmentName,
                    attachment_size: attachmentSize,
                    attachment_url: attachmentUrl
                  });

                  const unreadIncrement = isViewing ? 0 : 1;
                  await ChatSession.update(
                    {
                      last_message: lastMsgText,
                      last_active: 'Just now',
                      unread_count: sequelize.literal(`unread_count + ${unreadIncrement}`)
                    },
                    { where: { chat_id: memberChatId, vendor_id: memberId } }
                  );

                  const newMsg = {
                    id: `m-${result.id}`,
                    sender: 'admin',
                    senderId: adminId || socket.adminId,
                    senderName: 'Administrator',
                    text,
                    timestamp,
                    status: initialStatus,
                    attachment
                  };

                  io.to(`chat-${memberChatId}`).emit('receive_message', newMsg);
                  
                  const sessionsV = await fetchVendorSessions(memberId);
                  io.to(`vendor-${memberId}`).emit('sessions_update', sessionsV);

                  if (!isViewing) {
                    const isMemberOnline = onlineVendors.has(memberId) && onlineVendors.get(memberId).length > 0;
                    if (isMemberOnline) {
                      const notifBody = attachment ? `📎 ${attachment.name}` : (text || 'Sent a message');
                      const bodyWithSender = `Administrator: ${notifBody.length > 70 ? notifBody.slice(0, 70) + '…' : notifBody}`;

                      await Notification.create({
                        vendor_id: memberId,
                        type: 'group_message',
                        title: currentSession.group_name,
                        body: bodyWithSender,
                        chat_id: memberChatId,
                        sender_name: 'Administrator',
                        timestamp
                      });

                      io.to(`vendor-${memberId}`).emit('new_notification', {
                        type: 'group_message',
                        title: currentSession.group_name,
                        body: bodyWithSender,
                        chatId: memberChatId,
                        senderName: 'Administrator'
                      });
                    }
                  }
                }

                const newMsgForAdmin = {
                  id: `m-admin-${Date.now()}`,
                  sender: 'admin',
                  senderId: adminId || socket.adminId,
                  senderName: 'Administrator',
                  text,
                  timestamp,
                  status: 'sent',
                  attachment
                };
                io.to(`chat-${baseGroupId}`).emit('receive_message', newMsgForAdmin);

                const sessionsA = await fetchAdminSessions();
                io.to('admin-room').emit('admin_sessions_update', sessionsA);

              } else {
                const senderVendorId = vendorId;
                
                for (const memberId of groupMembers) {
                  const memberChatId = `${baseGroupId}-${memberId}`;

                  const isSender = (memberId === senderVendorId);
                  const msgSender = isSender ? 'vendor' : 'customer';
                  const room = io.sockets.adapter.rooms.get(`chat-${memberChatId}`);
                  const isViewing = room && room.size > 0;
                  const msgStatus = isSender ? 'sent' : (isViewing ? 'read' : 'unread');

                  const result = await Message.create({
                    chat_id: memberChatId,
                    sender: msgSender,
                    sender_id: senderVendorId,
                    sender_name: msgSenderName,
                    text,
                    timestamp,
                    status: msgStatus,
                    attachment_type: attachmentType,
                    attachment_name: attachmentName,
                    attachment_size: attachmentSize,
                    attachment_url: attachmentUrl
                  });

                  if (!isSender) {
                    const unreadIncrement = isViewing ? 0 : 1;
                    await ChatSession.update(
                      {
                        last_message: lastMsgText,
                        last_active: 'Just now',
                        unread_count: sequelize.literal(`unread_count + ${unreadIncrement}`)
                      },
                      { where: { chat_id: memberChatId, vendor_id: memberId } }
                    );

                    const sessionsV = await fetchVendorSessions(memberId);
                    io.to(`vendor-${memberId}`).emit('sessions_update', sessionsV);
                  }
                  
                  const newMsg = {
                    id: `m-${result.id}`,
                    sender: msgSender,
                    senderId: senderVendorId,
                    senderName: msgSenderName,
                    text,
                    timestamp,
                    status: msgStatus,
                    attachment
                  };
                  io.to(`chat-${memberChatId}`).emit('receive_message', newMsg);
                }

                const adminRoom = io.sockets.adapter.rooms.get(`chat-${baseGroupId}`);
                const isAdminViewing = adminRoom && adminRoom.size > 0;
                const adminUnreadInc = isAdminViewing ? 0 : 1;

                await ChatSession.update(
                  {
                    last_message: lastMsgText,
                    last_active: 'Just now',
                    admin_unread_count: sequelize.literal(`admin_unread_count + ${adminUnreadInc}`)
                  },
                  { where: { chat_id: `${baseGroupId}-${senderVendorId}` } }
                );

                const newMsgForAdmin = {
                  id: `m-vendor-${Date.now()}`,
                  sender: 'vendor',
                  senderId: senderVendorId,
                  senderName: msgSenderName,
                  text,
                  timestamp,
                  status: 'sent',
                  attachment
                };
                io.to(`chat-${baseGroupId}`).emit('receive_message', newMsgForAdmin);

                const sessionsA = await fetchAdminSessions();
                io.to('admin-room').emit('admin_sessions_update', sessionsA);
              }
            }
          }
        } catch (err) {
          console.error('[Socket Admin Chat Error]:', err.message);
        }
        return;
      }

      if (!chatId || !vendorId) return;

      console.log(`[Socket] Message from vendor ${vendorId} in chat ${chatId}: ${text}`);

      try {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const lastMsgText = attachment ? `Attached: ${attachment.name}` : text;

        // Check if B2B chat session (has recipient_vendor_id)
        const sessionCheck = await ChatSession.findOne({
          where: { chat_id: chatId, vendor_id: vendorId }
        });
        const recipientVendorId = sessionCheck ? sessionCheck.recipient_vendor_id : null;

        const attachmentType = attachment ? attachment.type : null;
        const attachmentName = attachment ? attachment.name : null;
        const attachmentSize = attachment ? attachment.size || null : null;
        const attachmentUrl = attachment ? attachment.url : null;

        if (chatId.startsWith('group-')) {
          // --- B2B GROUP CHAT ROUTING ---
          console.log(`[Socket Group] Routing B2B group message from Vendor ${vendorId} in chat ${chatId}: ${text}`);

          if (sessionCheck) {
            const groupMembers = JSON.parse(sessionCheck.group_members || '[]');

            // Get sender details
            const sender = await Vendor.findByPk(vendorId);
            const senderName = sender ? sender.name : 'Dealer';

            const baseGroupId = chatId.split('-').slice(0, 2).join('-'); // e.g. group-123456789

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
              const result = await Message.create({
                chat_id: memberChatId,
                sender: msgSender,
                sender_id: vendorId,
                sender_name: senderName,
                text,
                timestamp,
                status: msgStatus,
                attachment_type: attachmentType,
                attachment_name: attachmentName,
                attachment_size: attachmentSize,
                attachment_url: attachmentUrl
              });

              // 2. Update member's chat session
              const unreadIncrement = (isSender || isViewing) ? 0 : 1;
              await ChatSession.update(
                {
                  last_message: lastMsgText,
                  last_active: 'Just now',
                  unread_count: sequelize.literal(`unread_count + ${unreadIncrement}`)
                },
                { where: { chat_id: memberChatId, vendor_id: memberId } }
              );

              // 3. Emit message to the member's chat room
              const newMsg = {
                id: `m-${result.id}`,
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

              // 5. Notify member if not viewing this group chat
              if (!isSender && !isViewing) {
                const notifBody = attachment ? `📎 ${attachment.name}` : (text || 'Sent a message');
                const bodyWithSender = `${senderName}: ${notifBody.length > 70 ? notifBody.slice(0, 70) + '…' : notifBody}`;
                
                // Persist to DB
                await Notification.create({
                  vendor_id: memberId,
                  type: 'group_message',
                  title: sessionCheck.group_name,
                  body: bodyWithSender,
                  chat_id: memberChatId,
                  sender_name: senderName,
                  timestamp
                });

                const isMemberOnline = onlineVendors.has(memberId) && onlineVendors.get(memberId).length > 0;
                if (isMemberOnline) {
                  io.to(`vendor-${memberId}`).emit('new_notification', {
                    type: 'group_message',
                    title: sessionCheck.group_name,
                    body: bodyWithSender,
                    chatId: memberChatId,
                    senderName: senderName
                  });
                }
              }
            }
          }
        } else if (recipientVendorId) {
          // --- B2B VENDOR-TO-VENDOR ROUTING ---
          console.log(`[Socket B2B] Routing B2B message from Vendor ${vendorId} to Recipient Vendor ${recipientVendorId}`);

          // 1. Locate or create corresponding chat session for Recipient Vendor B
          let chatIdB = `chat-${recipientVendorId}-${vendorId}`;
          let sessionB = await ChatSession.findOne({
            where: { vendor_id: recipientVendorId, recipient_vendor_id: vendorId }
          });
          
          if (!sessionB) {
            // Fetch Vendor A's profile name and shop name
            const vendorA = await Vendor.findByPk(vendorId);
            const vendorAName = vendorA ? vendorA.name : 'Other Vendor';
            const shopName = vendorA ? vendorA.shop_name : '';
            const initials = vendorAName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'VD';
            
            sessionB = await ChatSession.create({
              chat_id: chatIdB,
              vendor_id: recipientVendorId,
              recipient_vendor_id: vendorId,
              customer_name: vendorAName,
              avatar: initials,
              status: 'online',
              last_message: lastMsgText,
              unread_count: 0,
              last_active: 'Just now',
              device_interest: shopName,
              notes: 'B2B Trade Partner'
            });
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
          const resultA = await Message.create({
            chat_id: chatId,
            sender: 'vendor',
            text,
            timestamp,
            status: initialStatus,
            attachment_type: attachmentType,
            attachment_name: attachmentName,
            attachment_size: attachmentSize,
            attachment_url: attachmentUrl
          });

          // 3. Insert message for Vendor B (Recipient)
          const recipientStatus = (initialStatus === 'read') ? 'read' : 'unread';
          const resultB = await Message.create({
            chat_id: chatIdB,
            sender: 'customer',
            text,
            timestamp,
            status: recipientStatus,
            attachment_type: attachmentType,
            attachment_name: attachmentName,
            attachment_size: attachmentSize,
            attachment_url: attachmentUrl
          });

          // 4. Update Chat Sessions last message & active timestamp
          await ChatSession.update(
            { last_message: lastMsgText, last_active: 'Just now', unread_count: 0 },
            { where: { chat_id: chatId, vendor_id: vendorId } }
          );

          const unreadIncrement = (initialStatus === 'read') ? 0 : 1;
          await ChatSession.update(
            {
              last_message: lastMsgText,
              last_active: 'Just now',
              unread_count: sequelize.literal(`unread_count + ${unreadIncrement}`)
            },
            { where: { chat_id: chatIdB, vendor_id: recipientVendorId } }
          );

          // 5. Emit messages to separate room connections
          const newMsgA = {
            id: `m-${resultA.id}`,
            sender: 'vendor',
            text,
            timestamp,
            status: initialStatus,
            attachment
          };
          const newMsgB = {
            id: `m-${resultB.id}`,
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

          // 7. Notify recipient if NOT viewing the chat
          const recipientRoom = io.sockets.adapter.rooms.get(`chat-${chatIdB}`);
          const recipientIsViewing = recipientRoom && recipientRoom.size > 0;
          if (!recipientIsViewing) {
            // Fetch sender name for notification
            const sender = await Vendor.findByPk(vendorId);
            const senderDisplayName = sender ? sender.name : 'A vendor';
            const notifBody = attachment ? `📎 ${attachment.name}` : (text || 'Sent a message');
            const notifBodyTrimmed = notifBody.length > 80 ? notifBody.slice(0, 80) + '…' : notifBody;
            
            // Persist to DB
            await Notification.create({
              vendor_id: recipientVendorId,
              type: 'vendor_message',
              title: `New message from ${senderDisplayName}`,
              body: notifBodyTrimmed,
              chat_id: chatIdB,
              sender_name: senderDisplayName,
              timestamp
            });

            if (isRecipientOnline) {
              io.to(`vendor-${recipientVendorId}`).emit('new_notification', {
                type: 'vendor_message',
                title: `New message from ${senderDisplayName}`,
                body: notifBodyTrimmed,
                chatId: chatIdB,
                senderName: senderDisplayName
              });
            }
          }

        } else {
          // --- B2C CUSTOMER SIMULATOR ROUTING ---
          // 1. Insert message into DB
          const result = await Message.create({
            chat_id: chatId,
            sender: 'vendor',
            text,
            timestamp,
            status: 'delivered',
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
            status: 'delivered',
            attachment
          };

          // 2. Update chat session last message and timestamp
          await ChatSession.update(
            { last_message: lastMsgText, last_active: 'Just now', unread_count: 0 },
            { where: { chat_id: chatId, vendor_id: vendorId } }
          );

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
      if (socket.adminId) {
        const aId = socket.adminId;
        const sockets = onlineAdmins.get(aId);
        if (sockets) {
          const idx = sockets.indexOf(socket.id);
          if (idx !== -1) {
            sockets.splice(idx, 1);
          }
          if (sockets.length === 0) {
            onlineAdmins.delete(aId);
            console.log(`[Socket] Admin-${aId} is now offline`);
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
 * Fetch all sessions for Admin
 */
async function fetchAdminSessions() {
  try {
    const sessions = await ChatSession.findAll({
      where: {
        chat_id: {
          [Op.or]: [
            { [Op.like]: 'admin-chat-%' },
            { [Op.like]: 'admin-group-%' }
          ]
        }
      },
      order: [['updated_at', 'DESC']]
    });

    const vendorIds = sessions.filter(s => !s.is_group).map(s => s.vendor_id);
    const vendors = await Vendor.findAll({
      where: { id: vendorIds },
      attributes: ['id', 'name', 'profile_img']
    });
    const vendorsMap = new Map(vendors.map(v => [v.id, v]));

    return sessions.map(s => {
      let parsedMembers = [];
      if (s.group_members) {
        try {
          parsedMembers = JSON.parse(s.group_members);
        } catch (e) {
          parsedMembers = [];
        }
      }

      const isGroup = s.is_group === true || s.is_group === 1;
      let displayName = s.customer_name;
      let avatarName = s.avatar;
      let profileImg = null;

      if (!isGroup && s.chat_id.startsWith('admin-chat-')) {
        const vendor = vendorsMap.get(s.vendor_id);
        if (vendor) {
          displayName = vendor.name;
          avatarName = vendor.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "VD";
          profileImg = vendor.profile_image_url;
        }
      }

      const isVendorOnline = onlineVendors.has(s.vendor_id) && onlineVendors.get(s.vendor_id).length > 0;
      const dynamicStatus = isGroup ? 'online' : (isVendorOnline ? 'online' : 'offline');

      return {
        id: s.chat_id,
        customerName: displayName,
        customerPhone: s.customer_phone,
        customerEmail: s.customer_email,
        avatar: avatarName,
        profileImg: profileImg,
        status: dynamicStatus,
        lastMessage: s.last_message,
        unreadCount: s.admin_unread_count || 0,
        lastActive: s.last_active,
        deviceInterest: s.device_interest,
        notes: s.notes,
        isGroup: isGroup,
        groupName: s.group_name,
        groupMembers: parsedMembers,
        vendorId: s.vendor_id,
        recipientVendorId: s.recipient_vendor_id
      };
    });
  } catch (err) {
    console.error('[Socket] Failed to fetch admin sessions:', err.message);
    return [];
  }
}

/**
 * Mark messages in an Admin chat session as read
 */
async function markAdminChatMessagesAsRead(chatId) {
  try {
    // 1. Mark vendor messages in this chat as read
    await Message.update(
      { status: 'read' },
      { where: { chat_id: chatId, sender: 'vendor', status: { [Op.ne]: 'read' } } }
    );

    // 2. Clear admin unread count for this session
    await ChatSession.update(
      { admin_unread_count: 0 },
      { where: { chat_id: chatId } }
    );

    // 3. Broadcast sidebar update to all admins
    const sessions = await fetchAdminSessions();
    if (io) {
      io.to('admin-room').emit('admin_sessions_update', sessions);
    }

    // 4. If direct admin-vendor chat, notify vendor
    if (chatId.startsWith('admin-chat-')) {
      const vendorId = parseInt(chatId.split('-').pop(), 10);
      if (io) {
        io.to(`chat-${chatId}`).emit('messages_read', { chatId });
        const vendorSessions = await fetchVendorSessions(vendorId);
        io.to(`vendor-${vendorId}`).emit('sessions_update', vendorSessions);
      }
    }
  } catch (err) {
    console.error('[Socket] Failed to mark admin chat messages as read:', err.message);
  }
}

/**
 * Fetch all sessions for a vendor
 */
async function fetchVendorSessions(vendorId) {
  try {
    const sessions = await ChatSession.findAll({
      where: { vendor_id: vendorId },
      order: [['updated_at', 'DESC']]
    });

    const adminSession = sessions.find(s => s.chat_id.startsWith('admin-chat-'));
    let adminProfileImg = null;
    if (adminSession) {
      const admin = await Admin.findOne({ attributes: ['name', 'profile_img'] });
      adminProfileImg = admin ? admin.profile_image_url : null;
    }

    const recipientVendorIds = sessions.filter(s => s.recipient_vendor_id).map(s => s.recipient_vendor_id);
    const recipientVendors = await Vendor.findAll({
      where: { id: recipientVendorIds },
      attributes: ['id', 'name', 'profile_img']
    });
    const recipientMap = new Map(recipientVendors.map(v => [v.id, v]));
    
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

      let profileImg = null;
      if (s.chat_id.startsWith('admin-chat-')) {
        profileImg = adminProfileImg;
      } else if (s.recipient_vendor_id) {
        const recipient = recipientMap.get(s.recipient_vendor_id);
        if (recipient) {
          profileImg = recipient.profile_image_url;
        }
      }

      return {
        id: s.chat_id,
        customerName: s.customer_name,
        customerPhone: s.customer_phone,
        customerEmail: s.customer_email,
        avatar: s.avatar,
        profileImg: profileImg,
        status: s.status,
        lastMessage: s.last_message,
        unreadCount: s.unread_count,
        lastActive: s.last_active,
        deviceInterest: s.device_interest,
        notes: s.notes,
        isGroup: s.is_group === true || s.is_group === 1,
        groupName: s.group_name,
        groupMembers: parsedMembers,
        recipientVendorId: s.recipient_vendor_id
      };
    });
  } catch (err) {
    console.error('[Socket] Failed to fetch vendor sessions:', err.message);
    return [];
  }
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
      await Message.update(
        { status: 'read' },
        { where: { chat_id: chatId, sender: 'vendor', status: { [Op.ne]: 'read' } } }
      );
      
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
      const attachmentType = replyAttachment ? replyAttachment.type : null;
      const attachmentName = replyAttachment ? replyAttachment.name : null;
      const attachmentSize = replyAttachment ? replyAttachment.size || null : null;
      const attachmentUrl = replyAttachment ? replyAttachment.url : null;

      const result = await Message.create({
        chat_id: chatId,
        sender: 'customer',
        text: replyText,
        timestamp,
        status: initialStatus,
        attachment_type: attachmentType,
        attachment_name: attachmentName,
        attachment_size: attachmentSize,
        attachment_url: attachmentUrl
      });

      const newCustomerMsg = {
        id: `m-${result.id}`,
        sender: 'customer',
        text: replyText,
        timestamp,
        status: initialStatus,
        attachment: replyAttachment
      };

      // Update session last message and unread count
      const lastMsgText = replyAttachment ? `Attached: ${replyAttachment.name}` : replyText;
      await ChatSession.update(
        {
          last_message: lastMsgText,
          last_active: 'Just now',
          unread_count: sequelize.literal(`unread_count + ${unreadIncrement}`)
        },
        { where: { chat_id: chatId, vendor_id: vendorId } }
      );

      // Turn off typing indicator
      io.to(`chat-${chatId}`).emit('typing_status', { chatId, isTyping: false });

      // Emit new message
      io.to(`chat-${chatId}`).emit('receive_message', newCustomerMsg);

      // Refresh list
      const sessions = await fetchVendorSessions(vendorId);
      io.to(`vendor-${vendorId}`).emit('sessions_update', sessions);

      // Notify vendor if online but NOT currently viewing this chat
      if (unreadIncrement > 0) {
        const isVendorOnline = onlineVendors.has(vendorId) && onlineVendors.get(vendorId).length > 0;
        if (isVendorOnline) {
          // Look up customer name for notification title
          const chatSession = await ChatSession.findOne({
            where: { chat_id: chatId, vendor_id: vendorId }
          });
          const customerName = chatSession ? chatSession.customer_name : 'A customer';
          const notifBody = replyAttachment ? `📎 ${replyAttachment.name}` : (replyText || 'Sent a message');
          const notifBodyTrimmed = notifBody.length > 80 ? notifBody.slice(0, 80) + '…' : notifBody;
          
          // Persist to DB
          await Notification.create({
            vendor_id: vendorId,
            type: 'new_message',
            title: `New message from ${customerName}`,
            body: notifBodyTrimmed,
            chat_id: chatId,
            sender_name: customerName,
            timestamp
          });

          io.to(`vendor-${vendorId}`).emit('new_notification', {
            type: 'new_message',
            title: `New message from ${customerName}`,
            body: notifBodyTrimmed,
            chatId: chatId,
            senderName: customerName
          });
        }
      }

    } catch (err) {
      console.error('[Socket Simulator] Failed to save/broadcast simulated customer reply:', err.message);
    }
  }, 2500);
}

module.exports = {
  init,
  getIo,
  fetchVendorSessions,
  fetchAdminSessions
};
