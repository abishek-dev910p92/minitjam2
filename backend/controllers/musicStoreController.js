// controllers/musicStoreController.js
const pool = require('../db');

// GET /api/music-stores - Get all music stores
async function getAllMusicStores(req, res) {
  const conn = await pool.getConnection();
  try {
    const [tbl] = await conn.query("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'music_stores'");
    if (!tbl || tbl.length === 0) {
      return res.json({ stores: [] });
    }
    const [rows] = await conn.query('SELECT id, name, address_1, address_2, phone_number, rating FROM music_stores ORDER BY name ASC');
    return res.json({ stores: rows });
  } finally {
    conn.release();
  }
}

// GET /api/music-stores/:id - Get a specific music store by ID
async function getMusicStoreById(req, res) {
  const storeId = Number(req.params.id);
  if (!Number.isInteger(storeId) || storeId <= 0) {
    return res.status(400).json({ error: 'Invalid store id' });
  }
  
  const conn = await pool.getConnection();
  try {
    const [tbl] = await conn.query("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'music_stores'");
    if (!tbl || tbl.length === 0) {
      return res.status(404).json({ error: 'Music stores unavailable' });
    }
    const [rows] = await conn.query('SELECT id, name, address_1, address_2, phone_number, rating FROM music_stores WHERE id = ?', [storeId]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Music store not found' });
    }
    return res.json(rows[0]);
  } finally {
    conn.release();
  }
}

// GET /api/music-stores/search - Search music stores by name
async function searchMusicStores(req, res) {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ error: 'Search query (q) is required' });
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const conn = await pool.getConnection();
  try {
    const [tbl] = await conn.query("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'music_stores'");
    if (!tbl || tbl.length === 0) {
      return res.json({ stores: [], page, limit, total: 0, totalPages: 0 });
    }
    const searchTerm = `%${q}%`;
    const [rows] = await conn.query(
      `SELECT id, name, address_1, address_2, phone_number, rating 
       FROM music_stores 
       WHERE name LIKE ? 
       ORDER BY name ASC 
       LIMIT ? OFFSET ?`,
      [searchTerm, limit, offset]
    );
    
    const [totalRows] = await conn.query(
      'SELECT COUNT(*) as total FROM music_stores WHERE name LIKE ?',
      [searchTerm]
    );
    
    return res.json({
      stores: rows,
      page,
      limit,
      total: totalRows[0].total,
      totalPages: Math.ceil(totalRows[0].total / limit)
    });
  } finally {
    conn.release();
  }
}

// GET /api/music-stores/filter - Filter music stores by rating
async function filterMusicStoresByRating(req, res) {
  const minRating = Number(req.query.min_rating) || 0;
  const maxRating = Number(req.query.max_rating) || 5;
  
  if (minRating < 0 || maxRating > 5 || minRating > maxRating) {
    return res.status(400).json({ error: 'Invalid rating range. Must be between 0-5' });
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const conn = await pool.getConnection();
  try {
    const [tbl] = await conn.query("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'music_stores'");
    if (!tbl || tbl.length === 0) {
      return res.json({ stores: [], page, limit, total: 0, totalPages: 0, filters: { min_rating: minRating, max_rating: maxRating } });
    }
    const [rows] = await conn.query(
      `SELECT id, name, address_1, address_2, phone_number, rating 
       FROM music_stores 
       WHERE rating >= ? AND rating <= ?
       ORDER BY rating DESC, name ASC 
       LIMIT ? OFFSET ?`,
      [minRating, maxRating, limit, offset]
    );
    
    const [totalRows] = await conn.query(
      'SELECT COUNT(*) as total FROM music_stores WHERE rating >= ? AND rating <= ?',
      [minRating, maxRating]
    );
    
    return res.json({
      stores: rows,
      page,
      limit,
      total: totalRows[0].total,
      totalPages: Math.ceil(totalRows[0].total / limit),
      filters: { min_rating: minRating, max_rating: maxRating }
    });
  } finally {
    conn.release();
  }
}

// GET /api/music-stores/featured - Get featured music stores
async function featuredMusicStores(req, res) {
  const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 10));
  const conn = await pool.getConnection();
  try {
    // Check if music_stores has a 'featured' column
    const [cols] = await conn.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'music_stores'"
    );
    const colSet = new Set(cols.map(r => r.COLUMN_NAME));
    if (!cols || cols.length === 0) {
      return res.json({ stores: [], limit });
    }
    
    let sql;
    if (colSet.has('featured')) {
      // If featured column exists, use it
      sql = `SELECT id, name, address_1, address_2, phone_number, rating 
             FROM music_stores 
             WHERE featured = 1 
             ORDER BY rating DESC, name ASC 
             LIMIT ?`;
    } else {
      // Fallback: get highest rated stores or most recent
      sql = `SELECT id, name, address_1, address_2, phone_number, rating 
             FROM music_stores 
             ORDER BY rating DESC, name ASC 
             LIMIT ?`;
    }
    
    const [rows] = await conn.query(sql, [limit]);
    return res.json({ stores: rows, limit });
  } finally {
    conn.release();
  }
}

module.exports = {
  getAllMusicStores,
  getMusicStoreById,
  searchMusicStores,
  filterMusicStoresByRating,
  featuredMusicStores
};