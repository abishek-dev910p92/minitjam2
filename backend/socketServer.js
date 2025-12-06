// socketServer.js - Socket.IO implementation for real-time chat
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const chatCtrl = require('./controllers/chatController');
const pool = require('./db');
const { sendPushToUser } = require('./utils/push');

/**
 * Helper to compute a conversation room id for DM chats
 */
function dmRoomId({ sender_type, sender_id, receiver_type, receiver_id }) {
  return chatCtrl.generateConversationId(sender_type, sender_id, receiver_type, receiver_id);
}

class SocketServer {
  constructor(httpServer) {
    this.httpServer = httpServer;
    this.io = new Server(httpServer, {
      cors: {
        origin: '*', // For production: restrict to your frontend origin
        methods: ['GET', 'POST']
      },
      transports: ['websocket', 'polling']
    });

    // Online presence map: key => Set of socket ids
    this.onlineUsers = new Map(); // key: `${role}:${id}` => Set<string>

    // Optional: Redis adapter for scaling
    try {
      if (process.env.REDIS_URL) {
        const { createAdapter } = require('@socket.io/redis-adapter');
        const { createClient } = require('redis');
        const pubClient = createClient({ url: process.env.REDIS_URL });
        const subClient = pubClient.duplicate();
        pubClient.connect();
        subClient.connect();
        this.io.adapter(createAdapter(pubClient, subClient));
        console.log('Socket.IO Redis adapter enabled');
      }
    } catch (_e) {
      // ignore adapter errors in dev
    }

    this._wireEvents();
  }

  _verifyToken(token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      return { id: payload.sub, role: payload.role };
    } catch (_e) {
      return null;
    }
  }

  _userKey(user) {
    return `${user.role}:${user.id}`;
  }

  _addOnline(user, socketId) {
    const key = this._userKey(user);
    const set = this.onlineUsers.get(key) || new Set();
    set.add(socketId);
    this.onlineUsers.set(key, set);
    this._broadcastPresence(user, true);
  }

  _removeOnline(user, socketId) {
    const key = this._userKey(user);
    const set = this.onlineUsers.get(key);
    if (set) {
      set.delete(socketId);
      if (set.size === 0) {
        this.onlineUsers.delete(key);
        this._broadcastPresence(user, false);
      } else {
        this.onlineUsers.set(key, set);
      }
    }
  }

  _broadcastPresence(user, online) {
    this.io.emit('presence:update', {
      user_type: user.role,
      user_id: user.id,
      online
    });
  }

  _wireEvents() {
    this.io.use((socket, next) => {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Auth token required'));
      const user = this._verifyToken(token);
      if (!user) return next(new Error('Invalid token'));
      socket.data.user = user;
      next();
    });

    this.io.on('connection', (socket) => {
      const user = socket.data.user;
      this._addOnline(user, socket.id);

      // Heartbeat: application-level ping/pong for connection health
      try {
        socket.data.lastPongAt = Date.now();
        const heartbeatMs = Number(process.env.SOCKET_HEARTBEAT_MS || 25000);
        const hb = setInterval(() => {
          try {
            socket.emit('heartbeat:ping', { ts: Date.now() });
          } catch (_e) {}
        }, heartbeatMs);
        socket.data._hb = hb;
        socket.on('heartbeat:pong', (payload) => {
          socket.data.lastPongAt = Date.now();
        });
      } catch (_e) {}

      // Join per-user room for direct notifications
      try {
        const userRoom = `user:${user.role}:${user.id}`;
        socket.join(userRoom);
        console.log('[socket] user joined room', userRoom, 'socket', socket.id);
      } catch (e) {
        console.warn('[socket] failed to join user room', e?.message || e);
      }

      // Join direct message room
      socket.on('join', (payload) => {
        const { sender_type, sender_id, receiver_type, receiver_id } = payload || {};
        if (!sender_type || !sender_id || !receiver_type || !receiver_id) return;
        // Access control: only allow participants (authenticated user) to join the DM room
        const isParticipant = (
          (String(user.role) === String(sender_type) && Number(user.id) === Number(sender_id)) ||
          (String(user.role) === String(receiver_type) && Number(user.id) === Number(receiver_id))
        );
        if (!isParticipant) {
          console.warn('[socket] unauthorized join attempt', { reqUser: this._userKey(user), sender_type, sender_id, receiver_type, receiver_id });
          // Do not join; optionally notify client
          socket.emit('error', { error: 'unauthorized_join' });
          return;
        }
        const roomId = dmRoomId({ sender_type, sender_id, receiver_type, receiver_id });
        socket.join(roomId);
        socket.emit('joined', { roomId });
      });

      // Typing indicators
      socket.on('typing', (userId) => {
        socket.rooms.forEach((roomId) => {
          socket.to(roomId).emit('typing', String(userId));
        });
      });
      socket.on('stop_typing', (userId) => {
        socket.rooms.forEach((roomId) => {
          socket.to(roomId).emit('stop_typing', String(userId));
        });
      });

      // Direct message event
      socket.on('message', async (msg, ack) => {
        try {
          const { sender_type, sender_id, receiver_type, receiver_id, message } = msg || {};
          if (!sender_type || !sender_id || !receiver_type || !receiver_id || !message) {
            if (ack) ack({ ok: false, error: 'Missing fields' });
            return;
          }
          // Access control: sender must match authenticated user
          if (!(String(user.role) === String(sender_type) && Number(user.id) === Number(sender_id))) {
            console.warn('[socket] forbidden DM send attempt', { reqUser: this._userKey(user), sender_type, sender_id });
            if (ack) ack({ ok: false, error: 'Forbidden' });
            return;
          }
          console.log('[socket] DM message received', { sender_type, sender_id, receiver_type, receiver_id });
          const saved = await chatCtrl.saveMessage({ sender_type, sender_id, receiver_type, receiver_id, message });
          const roomId = dmRoomId({ sender_type, sender_id, receiver_type, receiver_id });
          this.io.to(roomId).emit('message', saved);
          // Push a lightweight notification to receiver's user room
          const receiverUserRoom = `user:${receiver_type}:${receiver_id}`;
          this.io.to(receiverUserRoom).emit('notify:new_message', {
            chat_id: saved.chat_id,
            sender_type,
            sender_id,
            receiver_type,
            receiver_id,
            sent_at: saved.sent_at,
            message: saved.message,
          });
          const senderUserRoom = `user:${sender_type}:${sender_id}`;
          this.io.to(senderUserRoom).emit('dm:started', {
            other_party_type: receiver_type,
            other_party_id: receiver_id,
            last_message_at: saved.sent_at,
          });
          this.io.to(receiverUserRoom).emit('dm:started', {
            other_party_type: sender_type,
            other_party_id: sender_id,
            last_message_at: saved.sent_at,
          });
          console.log('[socket] DM message emitted to', roomId, 'and notify to', receiverUserRoom);
          if (ack) ack({ ok: true, delivered: true, message: saved });
        } catch (e) {
          console.error('Socket message error', e);
          if (ack) ack({ ok: false, error: 'Failed to send message' });
        }
      });

      // Read receipts: persist and broadcast
      socket.on('read', async (data) => {
        const { sender_type, sender_id, receiver_type, receiver_id, chat_id } = data || {};
        if (!chat_id) return;
        try {
          const updated = await chatCtrl.markMessageRead(chat_id, user.role, user.id);
          const roomId = dmRoomId({ sender_type, sender_id, receiver_type, receiver_id });
          const payload = { chat_id, reader_type: user.role, reader_id: user.id, read_at: updated?.read_at || new Date() };
          socket.to(roomId).emit('read', payload);
        } catch (_e) {
          // ignore
        }
      });

      // Client-side display confirmation (for logging/metrics)
      socket.on('client:received', (data) => {
        try {
          const { chat_id, room_id, kind } = data || {};
          console.log('[socket] client:received', { user: this._userKey(user), chat_id, room_id, kind });
        } catch (e) {
          console.warn('[socket] client:received log failed', e?.message || e);
        }
      });

      socket.on('user-online', async (userId) => {
        try {
          if (Number(userId) !== Number(user.id)) return;
          console.log('[socket] user-online', { userId, room: `user:${user.role}:${user.id}` });
          const conn = await pool.getConnection();
          try {
            await conn.beginTransaction();
            const [rows] = await conn.query(
              'SELECT * FROM Chats WHERE receiver_type = ? AND receiver_id = ? AND (delivered_status = 0 OR delivered_status IS NULL) ORDER BY sent_at ASC',
              [user.role, user.id]
            );
            console.log('[socket] undelivered rows count', rows.length);
            const ids = [];
            const userRoom = `user:${user.role}:${user.id}`;
            const roomExists = this.io.sockets.adapter.rooms.has(userRoom);
            console.log('[socket] user room exists?', roomExists);
            for (const m of rows) {
              ids.push(m.chat_id);
              const payload = { ...m };
              try { payload.sent_at = new Date(m.sent_at).toISOString(); } catch {}
              this.io.to(userRoom).emit('new-message', payload);
              console.log('[socket] new-message flush to', userRoom, 'chat_id', m.chat_id);
            }
            if (ids.length > 0) {
              await conn.query('UPDATE Chats SET delivered_status = 1 WHERE chat_id IN (?)', [ids]);
            }
            await conn.commit();
          } catch (e) {
            try { await conn.rollback(); } catch {}
            console.error('user-online flush error', e);
          } finally {
            conn.release();
          }
        } catch (_e) {}
      });

      // Group room join
      socket.on('group:join', ({ room_id }) => {
        if (!room_id) return;
        socket.join(`group:${room_id}`);
        socket.emit('group:joined', { room_id });
      });

      // Group message event
      socket.on('group:message', async (payload, ack) => {
        try {
          const { room_id, sender_type, sender_id, ciphertext } = payload || {};
          if (!room_id || !sender_type || !sender_id || !ciphertext) {
            if (ack) ack({ ok: false, error: 'Missing fields' });
            return;
          }
          console.log('[socket] group:message received', { room_id, sender_type, sender_id });
          const conn = await pool.getConnection();
          try {
            await conn.query(
              'INSERT INTO GroupMessages (room_id, sender_type, sender_id, ciphertext) VALUES (?, ?, ?, ?)',
              [room_id, sender_type, sender_id, ciphertext]
            );
            const [rows] = await conn.query('SELECT * FROM GroupMessages WHERE room_id = ? ORDER BY sent_at DESC LIMIT 1', [room_id]);
            this.io.to(`group:${room_id}`).emit('group:message', rows[0]);
            console.log('[socket] group:message emitted to', `group:${room_id}`);
            if (ack) ack({ ok: true, delivered: true, message: rows[0] });
          } finally {
            conn.release();
          }
        } catch (e) {
          console.error('Socket group:message error', e);
          if (ack) ack({ ok: false, error: 'Failed to send group message' });
        }
      });

      socket.on('disconnect', () => {
        try {
          if (socket.data?._hb) clearInterval(socket.data._hb);
        } catch {}
        this._removeOnline(user, socket.id);
      });
    });
  }

  getIO() {
    return this.io;
  }
}

module.exports = SocketServer;
