// utils/push.js - Expo push notifications helper
const { Expo } = require('expo-server-sdk');
const pool = require('../db');

const expo = new Expo();
const rateMap = new Map();

async function ensurePushTokensTable(conn) {
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS PushTokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_type VARCHAR(20) NOT NULL,
      user_id INT NOT NULL,
      token VARCHAR(255) NOT NULL UNIQUE,
      platform VARCHAR(20) DEFAULT NULL,
      enabled TINYINT(1) DEFAULT 1,
      allow_preview TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user (user_type, user_id)
    )`);
  } catch (e) {
    console.warn('ensurePushTokensTable failed', e?.message || e);
  }
}

async function getUserTokens(userType, userId) {
  const conn = await pool.getConnection();
  try {
    await ensurePushTokensTable(conn);
    const [rows] = await conn.query(
      'SELECT token, allow_preview FROM PushTokens WHERE user_type = ? AND user_id = ? AND enabled = 1',
      [userType, userId]
    );
    return rows;
  } finally {
    conn.release();
  }
}

async function ensurePushLogsTable(conn) {
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS PushLogs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_type VARCHAR(20) NOT NULL,
      user_id INT NOT NULL,
      token VARCHAR(255) NOT NULL,
      title VARCHAR(255) DEFAULT NULL,
      status VARCHAR(50) DEFAULT NULL,
      receipt_id VARCHAR(255) DEFAULT NULL,
      error TEXT DEFAULT NULL,
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (user_type, user_id)
    )`);
  } catch (_e) {}
}

async function getTotalUnread(userType, userId) {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      'SELECT COUNT(*) AS total FROM Chats WHERE receiver_type = ? AND receiver_id = ? AND read_status = 0',
      [userType, userId]
    );
    return Number(rows[0]?.total || 0);
  } catch (_e) {
    return 0;
  } finally {
    conn.release();
  }
}

async function logPushResults(userType, userId, messages, tickets) {
  const conn = await pool.getConnection();
  try {
    await ensurePushLogsTable(conn);
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const t = tickets[i] || {};
      await conn.query(
        'INSERT INTO PushLogs (user_type, user_id, token, title, status, receipt_id, error) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userType, userId, m.to, m.title || '', String(t.status || ''), t.id || null, t.message || null]
      );
    }
  } finally {
    conn.release();
  }
}

async function sendPushToUser(userType, userId, { title, body, data, sound = 'default' }) {
  try {
    const now = Date.now();
    const key = `${userType}:${userId}`;
    const arr = rateMap.get(key) || [];
    const recent = arr.filter((t) => now - t < 15000);
    if (recent.length >= 5) return { sent: 0, rate_limited: true };
    recent.push(now);
    rateMap.set(key, recent);
    const tokens = await getUserTokens(userType, userId);
    if (!tokens || tokens.length === 0) return { sent: 0 };
    const badge = await getTotalUnread(userType, userId);
    const messages = [];
    for (const t of tokens) {
      const token = t.token;
      if (!Expo.isExpoPushToken(token)) continue;
      messages.push({
        to: token,
        title,
        body: t.allow_preview ? body : 'New message',
        data,
        sound,
        badge,
      });
    }
    if (messages.length === 0) return { sent: 0 };
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (e) {
        console.warn('expo push send failed', e?.message || e);
      }
    }
    try { await logPushResults(userType, userId, messages, tickets); } catch {}
    return { sent: messages.length, tickets };
  } catch (e) {
    console.warn('sendPushToUser failed', e?.message || e);
    return { sent: 0, error: e?.message || String(e) };
  }
}

async function registerToken(userType, userId, token, platform, allow_preview = 1, enabled = 1) {
  const conn = await pool.getConnection();
  try {
    await ensurePushTokensTable(conn);
    await conn.query(
      `INSERT INTO PushTokens (user_type, user_id, token, platform, allow_preview) VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE platform = VALUES(platform), allow_preview = VALUES(allow_preview), updated_at = CURRENT_TIMESTAMP`,
      [userType, userId, token, platform || null, allow_preview ? 1 : 0]
    );
    await conn.query('UPDATE PushTokens SET enabled = ? WHERE token = ?', [enabled ? 1 : 0, token]);
    return { ok: true };
  } catch (e) {
    console.warn('registerToken error', e?.message || e);
    return { ok: false, error: e?.message || String(e) };
  } finally {
    conn.release();
  }
}

module.exports = { sendPushToUser, registerToken };
