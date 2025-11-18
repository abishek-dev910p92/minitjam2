// utils/helpers.js
const pool = require('../db');

async function findOrCreateGenre(name) {
  if (!name) return null;
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT genre_id FROM Genres WHERE name = ?', [name]);
    if (rows.length) return rows[0].genre_id;
    const [res] = await conn.query('INSERT INTO Genres (name) VALUES (?)', [name]);
    return res.insertId;
  } finally {
    conn.release();
  }
}

async function findOrCreateLocation(city, region) {
  if (!city && !region) return null;
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT location_id FROM Locations WHERE city = ? AND region = ?', [city || '', region || '']);
    if (rows.length) return rows[0].location_id;
    const [res] = await conn.query('INSERT INTO Locations (city, region) VALUES (?, ?)', [city || '', region || '']);
    return res.insertId;
  } finally {
    conn.release();
  }
}

module.exports = { findOrCreateGenre, findOrCreateLocation };
