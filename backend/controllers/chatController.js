// controllers/chatController.js
const pool = require('../db');
const push = require('../utils/push');

let chatsColumnsEnsured = false;
async function ensureChatsReadColumns(conn) {
  if (chatsColumnsEnsured) return;
  const [cols] = await conn.query(
    "SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Chats'"
  );
  const map = new Map(cols.map((c) => [c.COLUMN_NAME, c.DATA_TYPE]));
  if (!map.has('read_status')) {
    await conn.query("ALTER TABLE Chats ADD COLUMN read_status TINYINT(1) NOT NULL DEFAULT 0");
  } else {
    const dt = map.get('read_status');
    if (String(dt).toLowerCase() === 'enum') {
      await conn.query("ALTER TABLE Chats MODIFY COLUMN read_status TINYINT(1) NOT NULL DEFAULT 0");
    }
  }
  if (!map.has('read_at')) {
    await conn.query("ALTER TABLE Chats ADD COLUMN read_at DATETIME NULL");
  }
  if (!map.has('delivered_status')) {
    await conn.query("ALTER TABLE Chats ADD COLUMN delivered_status TINYINT(1) NOT NULL DEFAULT 0");
  }
  const [idxRows] = await conn.query(
    "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Chats' AND COLUMN_NAME = 'read_status'"
  );
  const hasIdx = Array.isArray(idxRows) && idxRows.length > 0;
  if (!hasIdx) {
    await conn.query("CREATE INDEX idx_chats_read_status ON Chats(read_status)").catch(() => {});
  }
  const [idxRows2] = await conn.query(
    "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Chats' AND COLUMN_NAME = 'read_at'"
  );
  const hasIdx2 = Array.isArray(idxRows2) && idxRows2.length > 0;
  if (!hasIdx2) {
    await conn.query("CREATE INDEX idx_chats_read_at ON Chats(read_at)").catch(() => {});
  }
  const [idxRows3] = await conn.query(
    "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Chats' AND COLUMN_NAME = 'delivered_status'"
  );
  const hasIdx3 = Array.isArray(idxRows3) && idxRows3.length > 0;
  if (!hasIdx3) {
    await conn.query("CREATE INDEX idx_chats_delivered_status ON Chats(delivered_status)").catch(() => {});
  }
  try {
    await conn.query('UPDATE Chats SET read_status = CASE WHEN read_at IS NOT NULL THEN 1 ELSE read_status END');
  } catch (_e) {}
  chatsColumnsEnsured = true;
}

// Generate conversation ID for two users (virtual key, not stored)
function generateConversationId(senderType, senderId, receiverType, receiverId) {
  const participants = [
    `${senderType}:${senderId}`,
    `${receiverType}:${receiverId}`
  ].sort();
  return `conv:${participants.join('_')}`;
}

// Save message to database (used by both REST and WebSocket)
async function saveMessage(messageData) {
  const {
    sender_type,
    sender_id,
    receiver_type,
    receiver_id,
    message
  } = messageData;

  if (!sender_type || !sender_id || !receiver_type || !receiver_id || !message) {
    throw new Error('Missing required fields');
  }

  const conn = await pool.getConnection();
  try {
    await ensureChatsReadColumns(conn);
    const [result] = await conn.query(
      'INSERT INTO Chats (sender_type, sender_id, receiver_type, receiver_id, message, read_status, delivered_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [sender_type, sender_id, receiver_type, receiver_id, message, 0, 0]
    );

    // Get the complete message with timestamp
    const [rows] = await conn.query('SELECT * FROM Chats WHERE chat_id = ?', [result.insertId]);

    // Create rich notification payload for receiver (best-effort)
    try {
      const preview = String(message).slice(0, 160);
      const notifPayload = {
        kind: 'new_message',
        sender_type,
        sender_id,
        receiver_type,
        receiver_id,
        chat_id: rows[0]?.chat_id,
        preview,
        sent_at: rows[0]?.sent_at
      };
      await conn.query(
        'ALTER TABLE Notifications ADD COLUMN dismissed_at DATETIME NULL',
      ).catch(() => {/* ignore if exists */});
      await conn.query(
        'INSERT INTO Notifications (owner_type, owner_id, message) VALUES (?, ?, ?)',
        [receiver_type, receiver_id, JSON.stringify(notifPayload)]
      );
      // Fire push notification (best-effort; non-blocking)
      push.sendPushToUser(receiver_type, receiver_id, {
        title: 'New message',
        body: preview,
        data: {
          screen: 'chats',
          sender_type,
          sender_id,
          receiver_type,
          receiver_id,
          chat_id: rows[0]?.chat_id
        }
      }).catch(() => {});
    } catch (e) {
      console.warn('saveMessage: notifications insert skipped:', e && e.message);
      // Continue without notifications to avoid blocking chat delivery
    }

    return rows[0];
  } finally {
    conn.release();
  }
}

async function sendMessage(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  const { sender_type, sender_id, receiver_type, receiver_id, message } = req.body;
  
  if (!sender_type || !sender_id || !receiver_type || !receiver_id || !message) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  // verify req.user corresponds to sender
  if (req.user.role !== sender_type || req.user.id !== Number(sender_id)) {
    return res.status(403).json({ error: 'Invalid sender' });
  }

  try {
    const savedMessage = await saveMessage({
      sender_type,
      sender_id,
      receiver_type,
      receiver_id,
      message
    });

    res.json(savedMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
}

async function getConversation(req, res) {
  const { sender_type, sender_id, receiver_type, receiver_id, page = 1, per_page = 50 } = req.query;
  
  if (!sender_type || !sender_id || !receiver_type || !receiver_id) {
    return res.status(400).json({ error: 'Missing participant information' });
  }
  if (!Number.isFinite(Number(sender_id)) || !Number.isFinite(Number(receiver_id))) {
    return res.status(400).json({ error: 'Invalid participant id' });
  }

  const pageNum = Number(page);
  const perPageNum = Number(per_page);
  const offset = (pageNum - 1) * perPageNum;
  
  const conn = await pool.getConnection();
  try {
    await ensureChatsReadColumns(conn);
    const where = `
      (sender_type = ? AND sender_id = ? AND receiver_type = ? AND receiver_id = ?)
      OR (sender_type = ? AND sender_id = ? AND receiver_type = ? AND receiver_id = ?)
    `;

    const params = [
      sender_type, sender_id, receiver_type, receiver_id,
      receiver_type, receiver_id, sender_type, sender_id
    ];
    const [countRows] = await conn.query(
      `SELECT COUNT(*) AS total FROM Chats WHERE ${where}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await conn.query(
      `SELECT * FROM Chats WHERE ${where} ORDER BY sent_at DESC LIMIT ? OFFSET ?`,
      [...params, perPageNum, offset]
    );

    const normalize = (m) => {
      if (!m) return m;
      const o = { ...m };
      try { o.sent_at = new Date(m.sent_at).toISOString(); } catch {}
      if (m.read_at) {
        try { o.read_at = new Date(m.read_at).toISOString(); } catch {}
      }
      return o;
    };

    const messages = rows.map(normalize);
    const totalPages = Math.ceil(total / perPageNum);
    const has_more = offset + messages.length < total;
    res.json({
      messages,
      pagination: {
        page: pageNum,
        per_page: perPageNum,
        total,
        total_pages: totalPages,
        has_more
      }
    });
  } finally {
    conn.release();
  }
}

// Get user conversations list (grouped by the "other party")
async function getUserConversations(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  
  const { page = 1, per_page = 20 } = req.query;
  const pageNum = Number(page);
  const perPageNum = Number(per_page);
  const offset = (pageNum - 1) * perPageNum;
  const userId = req.user.id;
  const userType = req.user.role;
  
  const conn = await pool.getConnection();
  try {
    const q = `
      SELECT 
        MAX(sent_at) as last_message_at,
        COUNT(*) as message_count,
        CASE 
          WHEN sender_type = ? AND sender_id = ? THEN receiver_type
          ELSE sender_type
        END as other_party_type,
        CASE 
          WHEN sender_type = ? AND sender_id = ? THEN receiver_id
          ELSE sender_id
        END as other_party_id
      FROM Chats
      WHERE (sender_type = ? AND sender_id = ?) OR (receiver_type = ? AND receiver_id = ?)
      GROUP BY other_party_type, other_party_id
      ORDER BY last_message_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const [rows] = await conn.query(q, [
      userType, userId, userType, userId,
      userType, userId, userType, userId,
      perPageNum, offset
    ]);

    res.json(rows);
  } finally {
    conn.release();
  }
}

module.exports = { 
  sendMessage, 
  getConversation, 
  getUserConversations,
  getUnreadCounts,
  saveMessage,
  generateConversationId,
  markMessageRead,
  updateReadStatus
};
async function markMessageRead(chatId, readerType, readerId) {
  const conn = await pool.getConnection();
  try {
    await ensureChatsReadColumns(conn);
    const [rows] = await conn.query('SELECT * FROM Chats WHERE chat_id = ? LIMIT 1', [chatId]);
    if (!rows.length) return null;
    const m = rows[0];
    const isParticipant = (
      (String(m.sender_type) === String(readerType) && Number(m.sender_id) === Number(readerId)) ||
      (String(m.receiver_type) === String(readerType) && Number(m.receiver_id) === Number(readerId))
    );
    if (!isParticipant) return null;
    const isReceiver = (String(m.receiver_type) === String(readerType) && Number(m.receiver_id) === Number(readerId));
    if (!isReceiver) return null;
    if (Number(m.read_status) === 1) return m;
    const now = new Date();
    await conn.query('UPDATE Chats SET read_status = ?, read_at = ? WHERE chat_id = ?', [1, now, chatId]);
    const [updated] = await conn.query('SELECT * FROM Chats WHERE chat_id = ?', [chatId]);
    return updated[0];
  } finally {
    conn.release();
  }
}

async function getUnreadCounts(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  const userId = req.user.id;
  const userType = req.user.role;
  const conn = await pool.getConnection();
  try {
    await ensureChatsReadColumns(conn);
    const q = `
      SELECT 
        sender_type AS other_party_type,
        sender_id AS other_party_id,
        COUNT(*) AS unread_count,
        MAX(sent_at) AS last_unread_at
      FROM Chats
      WHERE receiver_type = ? AND receiver_id = ? AND read_status = 0
      GROUP BY other_party_type, other_party_id
      ORDER BY last_unread_at DESC
    `;
    const [rows] = await conn.query(q, [userType, userId]);
    const total_unread = rows.reduce((a, r) => a + Number(r.unread_count || 0), 0);
    const conversations = rows.map((r) => ({
      other_party_type: r.other_party_type,
      other_party_id: r.other_party_id,
      unread_count: Number(r.unread_count || 0),
      last_unread_at: r.last_unread_at ? new Date(r.last_unread_at).toISOString() : null,
    }));
    res.json({ total_unread, conversations });
  } finally {
    conn.release();
  }
}

async function updateReadStatus(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  const chatId = Number(req.params.chat_id);
  if (!chatId) return res.status(400).json({ error: 'chat_id required' });
  try {
    const updated = await markMessageRead(chatId, req.user.role, req.user.id);
    if (!updated) return res.status(404).json({ error: 'Message not found or not authorized' });
    return res.json({ ok: true, chat_id: updated.chat_id, read_status: updated.read_status, read_at: updated.read_at });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to update read status' });
  }
}
