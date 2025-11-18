// controllers/opportunityController.js
const pool = require('../db');

async function createOpportunity(req, res) {
  if (!req.user || req.user.role !== 'club') return res.status(403).json({ error: 'Only clubs can create opportunities' });
  const { title, description, event_date, event_time } = req.body;
  if (!event_date) return res.status(400).json({ error: 'event_date required' });

  const conn = await pool.getConnection();
  try {
    const [r] = await conn.query('INSERT INTO Opportunities (club_id, title, description, event_date, event_time) VALUES (?, ?, ?, ?, ?)', [req.user.id, title || null, description || null, event_date, event_time || null]);
    const [rows] = await conn.query('SELECT * FROM Opportunities WHERE opportunity_id = ?', [r.insertId]);
    return res.json(rows[0]);
  } finally {
    conn.release();
  }
}

async function listOpportunities(req, res) {
  // simple listing with optional club filter
  const { club_id, page = 1, per_page = 20 } = req.query;
  const offset = (page - 1) * per_page;
  const conn = await pool.getConnection();
  try {
    const params = [];
    // Only include current and upcoming opportunities (event_date NULL or >= today)
    let whereClauses = ['(event_date IS NULL OR event_date >= CURDATE())'];
    if (club_id) {
      whereClauses.push('club_id = ?');
      params.push(club_id);
    }
    const where = 'WHERE ' + whereClauses.join(' AND ');
    // Order by event_date ascending so nearest upcoming events come first; null dates go last
    const [rows] = await conn.query(`SELECT * FROM Opportunities ${where} ORDER BY (event_date IS NULL), event_date ASC LIMIT ? OFFSET ?`, [...params, Number(per_page), Number(offset)]);
    return res.json(rows);
  } finally {
    conn.release();
  }
}

async function myOpportunities(req, res) {
  // role query param required: club|artist
  const role = (req.query.role || '').toLowerCase();
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  const conn = await pool.getConnection();
  try {
    if (role === 'club') {
      if (req.user.role !== 'club') return res.status(403).json({ error: 'Only clubs' });
      const [rows] = await conn.query('SELECT * FROM Opportunities WHERE club_id = ? ORDER BY event_date DESC', [req.user.id]);
      return res.json(rows);
    }

    if (role === 'artist') {
      if (req.user.role !== 'artist') return res.status(403).json({ error: 'Only artists' });
      // Return opportunities this artist has applied to, including application metadata
      const [rows] = await conn.query(
        `SELECT o.*, a.application_id, a.status as application_status, a.applied_at, a.band_id
         FROM Opportunities o
         JOIN Applications a ON a.opportunity_id = o.opportunity_id
         WHERE a.artist_id = ?
         ORDER BY a.applied_at DESC`,
        [req.user.id]
      );
      return res.json(rows);
    }

    return res.status(400).json({ error: 'role query param must be club or artist' });
  } finally {
    conn.release();
  }
}

async function getOpportunity(req, res) {
  const { id } = req.params;
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT * FROM Opportunities WHERE opportunity_id = ?', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Opportunity not found' });
    return res.json(rows[0]);
  } finally {
    conn.release();
  }
}

async function updateOpportunity(req, res) {
  const { id } = req.params;
  const updates = req.body || {};
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT * FROM Opportunities WHERE opportunity_id = ?', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Opportunity not found' });
    const opportunity = rows[0];

    if (!req.user || req.user.role !== 'club' || req.user.id !== opportunity.club_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const allowed = ['title', 'description', 'event_date', 'event_time', 'location', 'fee', 'capacity', 'extra_info'];
    const fields = [];
    const params = [];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        fields.push(`${key} = ?`);
        params.push(updates[key]);
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: 'No updatable fields provided' });

    params.push(id);
    const sql = `UPDATE Opportunities SET ${fields.join(', ')} WHERE opportunity_id = ?`;
    await conn.query(sql, params);
    const [updated] = await conn.query('SELECT * FROM Opportunities WHERE opportunity_id = ?', [id]);
    return res.json(updated[0]);
  } finally {
    conn.release();
  }
}

async function deleteOpportunity(req, res) {
  const { id } = req.params;
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT * FROM Opportunities WHERE opportunity_id = ?', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Opportunity not found' });
    const opportunity = rows[0];

    if (!req.user || req.user.role !== 'club' || req.user.id !== opportunity.club_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const [cols] = await conn.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Opportunities' AND COLUMN_NAME = 'deleted_at'");
    if (cols && cols.length > 0) {
      await conn.query('UPDATE Opportunities SET deleted_at = NOW() WHERE opportunity_id = ?', [id]);
    } else {
      await conn.query('DELETE FROM Opportunities WHERE opportunity_id = ?', [id]);
    }
    return res.json({ success: true });
  } finally {
    conn.release();
  }
}

module.exports = { createOpportunity, listOpportunities, myOpportunities, getOpportunity, updateOpportunity, deleteOpportunity };
