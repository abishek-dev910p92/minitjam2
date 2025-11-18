// controllers/chatController.js
const pool = require('../db');
const push = require('../utils/push');

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
    const [result] = await conn.query(
      'INSERT INTO Chats (sender_type, sender_id, receiver_type, receiver_id, message) VALUES (?, ?, ?, ?, ?)',
      [sender_type, sender_id, receiver_type, receiver_id, message]
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

  const pageNum = Number(page);
  const perPageNum = Number(per_page);
  const offset = (pageNum - 1) * perPageNum;
  
  const conn = await pool.getConnection();
  try {
    const where = `
      (sender_type = ? AND sender_id = ? AND receiver_type = ? AND receiver_id = ?)
      OR (sender_type = ? AND sender_id = ? AND receiver_type = ? AND receiver_id = ?)
    `;

    const params = [
      sender_type, sender_id, receiver_type, receiver_id,
      receiver_type, receiver_id, sender_type, sender_id
    ];

    const [rows] = await conn.query(
      `SELECT * FROM Chats WHERE ${where} ORDER BY sent_at ASC LIMIT ? OFFSET ?`,
      [...params, perPageNum, offset]
    );

    const [countRows] = await conn.query(
      `SELECT COUNT(*) AS total FROM Chats WHERE ${where}`,
      params
    );

    res.json({
      messages: rows,
      pagination: {
        page: pageNum,
        per_page: perPageNum,
        total: countRows[0].total,
        total_pages: Math.ceil(countRows[0].total / perPageNum)
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
  saveMessage,
  generateConversationId
};
