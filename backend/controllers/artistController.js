// controllers/artistController.js
const pool = require('../db');
const { findOrCreateGenre, findOrCreateLocation } = require('../utils/helpers');
const bcrypt = require('bcrypt');

async function getArtist(req, res) {
  const id = req.params.artistId;
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT artist_id, name, email, phone, genre_id, bio, location_id, profile_image_url, created_at FROM Artists WHERE artist_id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Artist not found' });
    const artist = rows[0];

    // fetch media for this artist if Media table exists
    let media = [];
    try {
      const [mrows] = await conn.query('SELECT media_url AS url, media_type AS type FROM Media WHERE owner_type = ? AND owner_id = ? ORDER BY created_at DESC', ['artist', id]);
      const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
      media = mrows.map(r => {
        let url = r.url || '';
        if (url && url.startsWith('/')) url = `${baseUrl}${url}`;
        return { url, type: r.type };
      });
    } catch (e) {
      // ignore if Media table doesn't exist
    }

    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS UserPrivacy (
          id INT AUTO_INCREMENT PRIMARY KEY,
          owner_type VARCHAR(16) NOT NULL,
          owner_id INT NOT NULL,
          show_email TINYINT(1) DEFAULT 0,
          show_mobile TINYINT(1) DEFAULT 0,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_owner (owner_type, owner_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
    } catch {}

    try {
      const [prefsRows] = await conn.query('SELECT show_email, show_mobile FROM UserPrivacy WHERE owner_type = ? AND owner_id = ?', ['artist', id]);
      const prefs = prefsRows[0] || { show_email: 0, show_mobile: 0 };
      console.log('getArtist: privacy prefs', { artistId: id, show_email: !!prefs.show_email, show_mobile: !!prefs.show_mobile });
      function maskEmail(email) {
        if (!email || typeof email !== 'string') return email;
        const parts = email.split('@');
        if (parts.length !== 2) return email.replace(/.(?=.{2})/g, '*');
        const local = parts[0];
        const domain = parts[1];
        const keep = Math.min(1, local.length);
        const maskedLocal = local.slice(0, keep) + '*'.repeat(Math.max(0, local.length - keep));
        return `${maskedLocal}@${domain}`;
      }
      function maskPhone(phone) {
        if (!phone || typeof phone !== 'string') return phone;
        const digits = phone.replace(/\D/g, '');
        const keep = Math.min(4, digits.length);
        let out = '';
        let digitIndex = 0;
        const cutoff = Math.max(0, digits.length - keep);
        for (const ch of phone) {
          if (/\d/.test(ch)) {
            out += (digitIndex < cutoff) ? '*' : ch;
            digitIndex++;
          } else {
            out += ch;
          }
        }
        return out;
      }
      if (!prefs.show_email && artist.email) {
        const masked = maskEmail(artist.email);
        if (masked !== artist.email) console.log('getArtist: masked email', { artistId: id });
        artist.email = masked;
      }
      if (!prefs.show_mobile && artist.phone) {
        const masked = maskPhone(artist.phone);
        if (masked !== artist.phone) console.log('getArtist: masked phone', { artistId: id });
        artist.phone = masked;
      }
    } catch (e) {
      console.warn('getArtist: privacy mask failed', { artistId: id, error: e && e.message });
    }

    try {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    } catch {}
    return res.json({ ...artist, media });
  } finally {
    conn.release();
  }
}

async function updateArtist(req, res) {
  const id = Number(req.params.artistId);
  if (!req.user || req.user.role !== 'artist' || req.user.id !== id) return res.status(403).json({ error: 'Forbidden' });

  const { name, bio, genre_name, genre_id, location, location_id } = req.body;
  // Defensive: log profile_image_url updates and prevent external URLs from overwriting
  const incomingProfileUrl = req.body.profile_image_url;
  if (typeof incomingProfileUrl !== 'undefined') {
    console.log('updateArtist: incoming profile_image_url', { artistId: id, incomingProfileUrl });
  }
  const conn = await pool.getConnection();
  try {
    let gid = genre_id;
    if (!gid && genre_name) gid = await findOrCreateGenre(genre_name);

    let lid = location_id;
    if (!lid && location && (location.city || location.region)) lid = await findOrCreateLocation(location.city || '', location.region || '');

    const updates = [];
    const params = [];
    if (name) { updates.push('name = ?'); params.push(name); }
    if (bio) { updates.push('bio = ?'); params.push(bio); }
    if (gid !== undefined) { updates.push('genre_id = ?'); params.push(gid); }
    if (lid !== undefined) { updates.push('location_id = ?'); params.push(lid); }
    // Only accept profile_image_url if it's from our uploads directory. External URLs are forbidden.
    if (typeof incomingProfileUrl !== 'undefined') {
      const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
      const allowedPrefix = `${baseUrl.replace(/\/$/, '')}/uploads/`;
      if (typeof incomingProfileUrl === 'string' && incomingProfileUrl.startsWith(allowedPrefix)) {
        updates.push('profile_image_url = ?'); params.push(incomingProfileUrl);
        // We'll insert audit after performing the UPDATE below.
      } else {
        console.log('updateArtist: rejected profile_image_url update due to external URL', { incomingProfileUrl, allowedPrefix });
        return res.status(400).json({ error: 'External profile_image_url values are not allowed. Use media upload and set-as-profile endpoint.' });
      }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    params.push(id);
    // capture old profile for audit
    let oldProfile = null;
    try {
      const [oldRows] = await conn.query('SELECT profile_image_url FROM Artists WHERE artist_id = ?', [id]);
      if (oldRows && oldRows[0]) oldProfile = oldRows[0].profile_image_url;
    } catch (e) {
      console.warn('updateArtist: failed to read old profile for audit', e && e.message);
    }

    await conn.query(`UPDATE Artists SET ${updates.join(', ')} WHERE artist_id = ?`, params);
    // if profile changed, insert audit row
    if (typeof incomingProfileUrl !== 'undefined' && incomingProfileUrl) {
      try {
        await conn.query(`
          CREATE TABLE IF NOT EXISTS ProfileImageAudit (
            id INT AUTO_INCREMENT PRIMARY KEY,
            owner_type VARCHAR(32) NOT NULL,
            owner_id INT NOT NULL,
            old_url TEXT,
            new_url TEXT,
            source VARCHAR(64),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        await conn.query('INSERT INTO ProfileImageAudit (owner_type, owner_id, old_url, new_url, source) VALUES (?, ?, ?, ?, ?)', ['artist', id, oldProfile, incomingProfileUrl, 'artist_update']);
      } catch (e) {
        console.warn('updateArtist: failed to insert audit row', e && e.message);
      }
    }
    const [rows] = await conn.query('SELECT artist_id, name, email, genre_id, bio, location_id, profile_image_url FROM Artists WHERE artist_id = ?', [id]);
    return res.json(rows[0]);
  } finally {
    conn.release();
  }
}

async function changePassword(req, res) {
  const id = Number(req.params.artistId);
  if (!req.user || req.user.role !== 'artist' || req.user.id !== id) return res.status(403).json({ error: 'Forbidden' });

  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ error: 'oldPassword and newPassword required' });
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT password_hash FROM Artists WHERE artist_id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Artist not found' });
    const ok = await bcrypt.compare(oldPassword, rows[0].password_hash);
    if (!ok) return res.status(400).json({ error: 'Old password incorrect' });
    const hashed = await bcrypt.hash(newPassword, 12);
    await conn.query('UPDATE Artists SET password_hash = ? WHERE artist_id = ?', [hashed, id]);
    return res.json({ ok: true });
  } finally {
    conn.release();
  }
}

async function searchArtists(req, res) {
  const q = (req.query.q || req.query.name || '').trim();
  if (!q) return res.status(400).json({ error: 'query (q) is required' });

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const conn = await pool.getConnection();
  try {
    const like = `%${q}%`;
    const [rows] = await conn.query(
      `SELECT artist_id, name, genre_id, location_id, profile_image_url, created_at
       FROM Artists
       WHERE name LIKE ?
       ORDER BY name ASC
       LIMIT ? OFFSET ?`,
      [like, limit, offset]
    );
    return res.json({ items: rows, page, limit });
  } catch (err) {
    console.error('searchArtists error:', err);
    return res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
}

module.exports = { getArtist, updateArtist, changePassword, searchArtists };

// GET /api/artists/featured?limit=
async function featuredArtists(req, res) {
  const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 10));
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `SELECT artist_id, name, genre_id, location_id, profile_image_url, created_at
       FROM Artists
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit]
    );
    return res.json({ items: rows, limit });
  } finally {
    conn.release();
  }
}

// extend exports
module.exports = { getArtist, updateArtist, changePassword, searchArtists, featuredArtists };

// GET /api/artists/:artistId/gigs?page=&per_page=
async function getArtistGigs(req, res) {
  const artistId = Number(req.params.artistId);
  if (!artistId) return res.status(400).json({ error: 'Invalid artist id' });

  const page = Math.max(1, Number(req.query.page) || 1);
  const per_page = Math.max(1, Math.min(100, Number(req.query.per_page) || 20));
  const offset = (page - 1) * per_page;

  const conn = await pool.getConnection();
  try {
    // detect columns present in Bookings to adapt queries
    const [schemaCols] = await conn.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'Bookings'`
    );
    const colSet = new Set(schemaCols.map(r => r.column_name));

    const hasEventDate = colSet.has('event_date');
    const hasEventTime = colSet.has('event_time');
    const hasDescription = colSet.has('description') || colSet.has('notes');
    const hasClubId = colSet.has('club_id') || colSet.has('clubid') || colSet.has('clubId');

    const today = new Date();
    const todaySql = today.toISOString().split('T')[0];

    let countSql, countParams;
    if (hasEventDate) {
      countSql = `SELECT COUNT(*) as total FROM Bookings b WHERE b.artist_id = ? AND b.event_date >= ?`;
      countParams = [artistId, todaySql];
    } else {
      countSql = `SELECT COUNT(*) as total FROM Bookings b WHERE b.artist_id = ?`;
      countParams = [artistId];
    }

    const [countRows] = await conn.query(countSql, countParams);
    const total = countRows[0] ? Number(countRows[0].total) : 0;

    let rows;
    if (hasEventDate) {
      // use event_date stored on Bookings and join Clubs for club_name if possible
      const selectCols = ['b.booking_id'];
      if (hasDescription) selectCols.push(`b.${colSet.has('description') ? 'description' : 'notes'} AS notes`);
      selectCols.push('b.created_at');
      selectCols.push('b.event_date');
      if (hasEventTime) selectCols.push('b.event_time');
      if (hasClubId) {
        selectCols.push('b.club_id');
        // include venue details from Clubs
        selectCols.push('c.name AS venue_name');
        selectCols.push('c.profile_image_url AS venue_image_url');
      }

      let sql = 'SELECT ' + selectCols.join(', ');
      sql += ' FROM Bookings b';
      if (hasClubId) sql += ' LEFT JOIN Clubs c ON b.club_id = c.club_id';
      sql += ' WHERE b.artist_id = ? AND b.event_date >= ?';
      if (hasClubId) sql += ' ORDER BY b.event_date ASC'; else sql += ' ORDER BY b.created_at DESC';
      sql += ' LIMIT ? OFFSET ?';

      const params = [artistId, todaySql, per_page, offset];
      const [r] = await conn.query(sql, params);
      rows = r;
    } else {
      // fallback: minimal booking rows
      let fallbackSql = 'SELECT b.booking_id, b.description AS notes, b.created_at, b.club_id';
      if (hasClubId) fallbackSql += ', c.name AS venue_name, c.profile_image_url AS venue_image_url';
      fallbackSql += ' FROM Bookings b';
      if (hasClubId) fallbackSql += ' LEFT JOIN Clubs c ON b.club_id = c.club_id';
      fallbackSql += ' WHERE b.artist_id = ? ORDER BY b.created_at DESC LIMIT ? OFFSET ?';
      const [r] = await conn.query(fallbackSql, [artistId, per_page, offset]);
      rows = r;
    }

    return res.json({ items: rows, page, per_page, total });
  } finally {
    conn.release();
  }
}

// export extended
module.exports = { getArtist, updateArtist, changePassword, searchArtists, featuredArtists, getArtistGigs };

// GET /api/artists/:artistId/bands - check membership and list bands
async function getBandsForArtist(req, res) {
  const artistId = Number(req.params.artistId);
  if (!Number.isInteger(artistId) || artistId <= 0) return res.status(400).json({ error: 'Invalid artist id' });

  const conn = await pool.getConnection();
  try {
    const [exists] = await conn.query('SELECT 1 FROM BandMembers WHERE artist_id = ? LIMIT 1', [artistId]);
    const isMember = exists.length > 0;
    let bands = [];
    if (isMember) {
      const [rows] = await conn.query(
        `SELECT b.band_id, b.name, b.description, b.profile_image_url, bm.role, bm.joined_at
         FROM Bands b JOIN BandMembers bm ON b.band_id = bm.band_id
         WHERE bm.artist_id = ? ORDER BY bm.joined_at ASC`,
        [artistId]
      );
      bands = rows;
      // normalize profile_image_url to null if empty
      bands = bands.map(b => ({ ...b, profile_image_url: b.profile_image_url || null }));
    }
    return res.json({ artist_id: artistId, isMember, bands });
  } finally {
    conn.release();
  }
}

// extend exports
module.exports.getBandsForArtist = getBandsForArtist;
