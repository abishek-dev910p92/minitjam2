// controllers/bookingController.js
const pool = require('../db');

// Helper to clamp pagination
function parsePagination(q) {
  const page = Math.max(1, Number(q.page) || 1);
  const per_page = Math.max(1, Math.min(100, Number(q.per_page) || Number(q.per_page) || 20));
  const offset = (page - 1) * per_page;
  return { page, per_page, offset };
}

// GET /api/bookings
// Returns bookings for authenticated user with pagination and joined fields
async function listBookingsForArtistOrBand(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  const { role, id } = req.user;
  const { page, per_page, offset } = parsePagination(req.query);

  const conn = await pool.getConnection();
  try {
    let where = '';
    const params = [];
    if (role === 'artist') {
      where = 'WHERE b.artist_id = ?'; params.push(id);
    } else if (role === 'band') {
      where = 'WHERE b.band_id = ?'; params.push(id);
    } else if (role === 'club') {
      where = 'WHERE b.club_id = ?'; params.push(id);
    } else {
      return res.status(400).json({ error: 'Unknown role' });
    }

    // total count for pagination
    const [countRows] = await conn.query(`SELECT COUNT(*) as total FROM Bookings b ${where}`, params);
    const total = countRows[0] ? Number(countRows[0].total) : 0;

    // Join bookings with clubs, artists, opportunities for richer response
    const sql = `
      SELECT b.*, c.name AS club_name, a.name AS artist_name, o.title AS opportunity_title, o.event_date, o.event_time
      FROM Bookings b
      LEFT JOIN Clubs c ON b.club_id = c.club_id
      LEFT JOIN Artists a ON b.artist_id = a.artist_id
      LEFT JOIN Opportunities o ON b.opportunity_id = o.opportunity_id
      ${where}
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rowsParams = params.concat([per_page, offset]);
    const [rows] = await conn.query(sql, rowsParams);

    return res.json({ items: rows, page, per_page, total });
  } finally {
    conn.release();
  }
}

// POST /api/bookings
// Clubs create bookings for an artist/band against an opportunity
async function createBooking(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  if (req.user.role !== 'club') return res.status(403).json({ error: 'Only clubs can create bookings' });

  const { artist_id, band_id, opportunity_id, fee, notes } = req.body || {};
  if (!opportunity_id) return res.status(400).json({ error: 'opportunity_id is required' });
  if (!artist_id && !band_id) return res.status(400).json({ error: 'artist_id or band_id is required' });

  const conn = await pool.getConnection();
  try {
    const [r] = await conn.query(
      'INSERT INTO Bookings (club_id, artist_id, band_id, opportunity_id, fee, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, artist_id || null, band_id || null, opportunity_id, fee || null, notes || null]
    );

    const [rows] = await conn.query('SELECT * FROM Bookings WHERE booking_id = ?', [r.insertId]);
    return res.status(201).json(rows[0]);
  } finally {
    conn.release();
  }
}

// PATCH /api/bookings/:bookingId
// Club who created the booking can update fee/notes
async function updateBooking(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  const bookingId = Number(req.params.bookingId);
  const { fee, notes } = req.body || {};
  if (!bookingId) return res.status(400).json({ error: 'Invalid booking id' });

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT * FROM Bookings WHERE booking_id = ?', [bookingId]);
    if (!rows.length) return res.status(404).json({ error: 'Booking not found' });
    const booking = rows[0];

    if (req.user.role !== 'club' || req.user.id !== booking.club_id) {
      return res.status(403).json({ error: 'Only booking club can update booking' });
    }

    const updates = [];
    const params = [];
    if (fee !== undefined) { updates.push('fee = ?'); params.push(fee); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    params.push(bookingId);
    await conn.query(`UPDATE Bookings SET ${updates.join(', ')} WHERE booking_id = ?`, params);
    const [updated] = await conn.query('SELECT * FROM Bookings WHERE booking_id = ?', [bookingId]);
    return res.json(updated[0]);
  } finally {
    conn.release();
  }
}

// DELETE /api/bookings/:bookingId
// Cancel booking - booking club or booked artist/band can cancel
async function cancelBooking(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  const bookingId = Number(req.params.bookingId);
  if (!bookingId) return res.status(400).json({ error: 'Invalid booking id' });

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT * FROM Bookings WHERE booking_id = ?', [bookingId]);
    if (!rows.length) return res.status(404).json({ error: 'Booking not found' });
    const booking = rows[0];

    const isClubOwner = req.user.role === 'club' && req.user.id === booking.club_id;
    const isArtistBooked = (req.user.role === 'artist' && req.user.id === booking.artist_id) || (req.user.role === 'band' && req.user.id === booking.band_id);
    if (!isClubOwner && !isArtistBooked) return res.status(403).json({ error: 'Not allowed to cancel booking' });

    await conn.query('DELETE FROM Bookings WHERE booking_id = ?', [bookingId]);
    return res.json({ ok: true, cancelled: true });
  } finally {
    conn.release();
  }
}

module.exports = { listBookingsForArtistOrBand, createBooking, updateBooking, cancelBooking };
