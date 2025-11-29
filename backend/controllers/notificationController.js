// controllers/notificationController.js
const pool = require('../db');
const { registerToken } = require('../utils/push');

async function ensureNotificationsTable(conn) {
  try {
    await conn.query(
      'ALTER TABLE Notifications ADD COLUMN dismissed_at DATETIME NULL'
    );
  } catch (_e) {
    // ignore if already exists
  }
}

// GET /api/notifications
async function list(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  const { page = 1, per_page = 20, include_dismissed = 'false' } = req.query;
  const pageNum = Number(page) || 1;
  const perPageNum = Math.min(100, Number(per_page) || 20);
  const offset = (pageNum - 1) * perPageNum;

  const conn = await pool.getConnection();
  try {
    await ensureNotificationsTable(conn);
    const whereBase = 'owner_type = ? AND owner_id = ?';
    const whereDismissed = include_dismissed === 'true' ? '' : ' AND (dismissed_at IS NULL)';
    const order = 'ORDER BY created_at DESC';

    // Fallback if created_at column is not present
    let [rows] = await conn.query(
      `SELECT * FROM Notifications WHERE ${whereBase}${whereDismissed} ${order} LIMIT ? OFFSET ?`,
      [req.user.role, req.user.id, perPageNum, offset]
    ).catch(async () => {
      return await conn.query(
        `SELECT * FROM Notifications WHERE ${whereBase}${whereDismissed} ORDER BY notification_id DESC LIMIT ? OFFSET ?`,
        [req.user.role, req.user.id, perPageNum, offset]
      );
    });

    const [countRows] = await conn.query(
      `SELECT COUNT(*) AS total FROM Notifications WHERE ${whereBase}${whereDismissed}`,
      [req.user.role, req.user.id]
    );

    // Attempt to parse JSON payloads; fall back to raw message
    rows = rows.map((n) => {
      let parsed = null;
      try {
        parsed = JSON.parse(n.message);
      } catch (_e) {}
      return {
        notification_id: n.notification_id,
        owner_type: n.owner_type,
        owner_id: n.owner_id,
        message: n.message,
        payload: parsed,
        created_at: n.created_at || n.sent_at || null,
        dismissed_at: n.dismissed_at || null,
      };
    });

    res.json({
      notifications: rows,
      pagination: {
        page: pageNum,
        per_page: perPageNum,
        total: countRows[0]?.total || 0,
        total_pages: Math.ceil((countRows[0]?.total || 0) / perPageNum),
      },
    });
  } catch (e) {
    console.error('notifications list error', e);
    res.status(500).json({ error: 'Failed to list notifications' });
  } finally {
    conn.release();
  }
}

// POST /api/notifications/:id/dismiss
async function dismiss(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  const conn = await pool.getConnection();
  try {
    await ensureNotificationsTable(conn);
    const [result] = await conn.query(
      'UPDATE Notifications SET dismissed_at = NOW() WHERE notification_id = ? AND owner_type = ? AND owner_id = ?',
      [id, req.user.role, req.user.id]
    );
    res.json({ ok: true, affected: result.affectedRows || 0 });
  } catch (e) {
    console.error('notifications dismiss error', e);
    res.status(500).json({ error: 'Failed to dismiss notification' });
  } finally {
    conn.release();
  }
}

// POST /api/notifications/register-token
async function registerPushToken(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  const { token, platform, allow_preview, enabled } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Token required' });
  try {
    const result = await registerToken(req.user.role, req.user.id, token, platform, !!allow_preview, enabled == null ? 1 : (enabled ? 1 : 0));
    if (!result.ok) return res.status(500).json({ error: result.error || 'Failed to register token' });
    res.json({ ok: true });
  } catch (e) {
    console.error('registerPushToken error', e);
    res.status(500).json({ error: 'Failed to register push token' });
  }
}

module.exports = { list, dismiss, registerPushToken };