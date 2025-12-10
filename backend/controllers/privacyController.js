// controllers/privacyController.js
const pool = require('../db');

async function ensureTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS UserPrivacy (
      id INT AUTO_INCREMENT PRIMARY KEY,
      owner_type VARCHAR(16) NOT NULL,
      owner_id INT NOT NULL,
      show_email TINYINT(1) DEFAULT 0,
      show_mobile TINYINT(1) DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_owner (owner_type, owner_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

// GET /api/privacy
async function get(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  const role = String(req.user.role);
  const id = Number(req.user.id);
  const conn = await pool.getConnection();
  try {
    await ensureTable(conn);
    const [rows] = await conn.query('SELECT show_email, show_mobile FROM UserPrivacy WHERE owner_type = ? AND owner_id = ?', [role, id]);
    if (!rows.length) {
      console.log('privacy.get: no prefs, defaulting to false', { role, id });
      try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
      } catch {}
      return res.json({ show_email: false, show_mobile: false });
    }
    const r = rows[0];
    console.log('privacy.get: prefs', { role, id, show_email: !!r.show_email, show_mobile: !!r.show_mobile });
    try {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    } catch {}
    return res.json({ show_email: !!r.show_email, show_mobile: !!r.show_mobile });
  } finally {
    conn.release();
  }
}

// PATCH /api/privacy
async function update(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  const role = String(req.user.role);
  const id = Number(req.user.id);
  const body = req.body || {};
  const show_email = body.show_email ? 1 : 0;
  const show_mobile = body.show_mobile ? 1 : 0;
  const conn = await pool.getConnection();
  try {
    await ensureTable(conn);
    await conn.query(
      'INSERT INTO UserPrivacy (owner_type, owner_id, show_email, show_mobile) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE show_email = VALUES(show_email), show_mobile = VALUES(show_mobile)',
      [role, id, show_email, show_mobile]
    );
    console.log('privacy.update: saved', { role, id, show_email: !!show_email, show_mobile: !!show_mobile });
    return res.json({ ok: true, show_email: !!show_email, show_mobile: !!show_mobile });
  } finally {
    conn.release();
  }
}

module.exports = { get, update };
