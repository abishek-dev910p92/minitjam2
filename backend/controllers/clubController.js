// controllers/clubController.js
const pool = require('../db');

// GET /api/venues/search?q=...&page=&limit=
async function searchVenues(req, res) {
  const q = (req.query.q || req.query.name || '').trim();
  if (!q) return res.status(400).json({ error: 'query (q) is required' });

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const conn = await pool.getConnection();
  try {
    const like = `%${q}%`;
    const [rows] = await conn.query(
      `SELECT club_id, name, location_id, capacity, profile_image_url, created_at
       FROM Clubs
       WHERE name LIKE ?
       ORDER BY name ASC
       LIMIT ? OFFSET ?`,
      [like, limit, offset]
    );

    return res.json({ items: rows, page, limit });
  } catch (err) {
    console.error('searchVenues error:', err);
    return res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
}

// GET /api/venues/featured?limit=
async function featuredVenues(req, res) {
  const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 10));

  const conn = await pool.getConnection();
  try {
    // Placeholder strategy: newest venues as featured. Can replace with a boolean featured flag later.
    const [rows] = await conn.query(
      `SELECT club_id, name, location_id, capacity, profile_image_url, created_at
       FROM Clubs
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit]
    );

    return res.json({ items: rows, limit });
  } catch (err) {
    console.error('featuredVenues error:', err);
    return res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
}

// GET /api/venues/:id
async function getVenueById(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid venue id' });

  const conn = await pool.getConnection();
  try {
    // Fetch club basic info
    const [clubs] = await conn.query('SELECT club_id, name, location_id, description, capacity, profile_image_url, created_at FROM Clubs WHERE club_id = ?', [id]);
    if (!clubs.length) return res.status(404).json({ error: 'Venue not found' });
    const club = clubs[0];

    // Optionally fetch location details if table exists
    let location = null;
    try {
      if (club.location_id) {
        const [locs] = await conn.query('SELECT city, region AS state, country FROM Locations WHERE location_id = ?', [club.location_id]);
        if (locs && locs.length) location = locs[0];
      }
    } catch (e) {
      // ignore if Locations table not present
    }

    // Fetch media for this club (limit recent 20)
    let media = [];
    try {
      const [mrows] = await conn.query('SELECT media_url AS url, media_type AS type FROM Media WHERE owner_type = ? AND owner_id = ? ORDER BY created_at DESC LIMIT 50', ['club', id]);
      const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
      media = mrows.map(r => {
        let url = r.url || '';
        if (url && url.startsWith('/')) url = `${baseUrl}${url}`;
        return { url, type: r.type };
      });
    } catch (e) {
      // ignore if Media table missing
    }

    // Fetch upcoming opportunities for this club
    let opportunities = [];
    try {
      const [orows] = await conn.query('SELECT opportunity_id AS id, title, event_date AS date FROM Opportunities WHERE club_id = ? AND (event_date IS NULL OR event_date >= CURDATE()) ORDER BY event_date ASC LIMIT 20', [id]);
      opportunities = orows.map(r => ({ id: r.id, title: r.title, date: r.date }));
    } catch (e) {
      // ignore if Opportunities table missing
    }

    return res.json({
      club_id: club.club_id,
      name: club.name,
      location: location,
      description: club.description,
      capacity: club.capacity,
      profile_image_url: club.profile_image_url,
      media,
      opportunities,
      created_at: club.created_at
    });
  } finally {
    conn.release();
  }
}

module.exports = { searchVenues, featuredVenues, getVenueById };