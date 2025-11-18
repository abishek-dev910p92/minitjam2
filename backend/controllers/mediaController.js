// controllers/mediaController.js
const pool = require('../db');
// NOTE: for demo we accept uploads to local 'uploads/' directory via multer in routes

async function uploadMedia(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  // file available as req.file by multer
  if (!req.file) return res.status(400).json({ error: 'File required' });

  // Debug logging to help trace issues from clients
  try {
    console.log('uploadMedia: received file:', {
      originalname: req.file.originalname,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      body: req.body
    });
    // Log headers and any client-supplied profile field for debugging
    try { console.log('uploadMedia: headers', { host: req.get('host'), referer: req.get('referer'), authorization: !!req.headers.authorization }); } catch (e) {}
  } catch (e) {
    console.warn('uploadMedia: failed to log file info', e && e.message);
  }

  // determine owner_type and owner_id from user's role
  const owner_type = req.user.role; // 'artist' or 'club'
  const owner_id = req.user.id;
  const media_type = req.body.media_type || 'image';
  // Prefer configured BASE_URL, otherwise build from request host/protocol
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  const media_url = `${baseUrl}/uploads/${req.file.filename}`;

  const conn = await pool.getConnection();
  try {
    const [r] = await conn.query('INSERT INTO Media (owner_type, owner_id, media_url, media_type) VALUES (?, ?, ?, ?)', [owner_type, owner_id, media_url, media_type]);
    const [row] = await conn.query('SELECT * FROM Media WHERE media_id = ?', [r.insertId]);
    try {
      console.log('uploadMedia: inserted media', { insertId: r.insertId, mediaRow: row[0] });
    } catch (e) {}

  // Optionally set this media as profile image for the owner.
  // Client can provide set_as_profile=true or replace_profile=true in the multipart form-data.
  const setAsProfile = String(req.body.set_as_profile || '').toLowerCase() === 'true';
  const replaceProfile = String(req.body.replace_profile || '').toLowerCase() === 'true';
    let profileUpdated = false;
    let updatedUser = null;
    try {
      if ((owner_type === 'artist' || owner_type === 'club') && media_type && media_type.startsWith('image')) {
        // Check current profile_image_url
        const userTable = owner_type === 'artist' ? 'Artists' : 'Clubs';
        const idCol = owner_type === 'artist' ? 'artist_id' : 'club_id';
        const [urows] = await conn.query(`SELECT ${idCol}, profile_image_url FROM ${userTable} WHERE ${idCol} = ?`, [owner_id]);
        const currentProfile = (urows && urows[0]) ? urows[0].profile_image_url : null;

    // Update profile when explicitly requested (set_as_profile), when replace_profile flag is set,
    // or when the owner has no profile yet.
        if (setAsProfile || replaceProfile || !currentProfile) {
          try {
            console.log('uploadMedia: updating profile_image_url', { userTable, idCol, owner_id, media_url, currentProfile, setAsProfile, replaceProfile });

            // Ensure audit table exists
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

            await conn.query(`UPDATE ${userTable} SET profile_image_url = ? WHERE ${idCol} = ?`, [media_url, owner_id]);

            // record audit row
            await conn.query('INSERT INTO ProfileImageAudit (owner_type, owner_id, old_url, new_url, source) VALUES (?, ?, ?, ?, ?)', [owner_type, owner_id, currentProfile, media_url, 'media_upload']);

            profileUpdated = true;
            // return updated user basic row (exclude sensitive columns)
            const [updatedRows] = await conn.query(`SELECT ${idCol} as id, name, email, profile_image_url FROM ${userTable} WHERE ${idCol} = ?`, [owner_id]);
            if (updatedRows && updatedRows[0]) updatedUser = updatedRows[0];
            console.log('uploadMedia: profile update result', { updatedUser });
          } catch (err) {
            console.warn('uploadMedia: failed to update profile_image_url', err && err.message);
          }
        }
      }
    } catch (err) {
      console.warn('uploadMedia: profile update check failed', err && err.message);
    }

    const result = Object.assign({}, row[0], { profile_updated: profileUpdated });
    if (updatedUser) result.updated_user = updatedUser;
    return res.json(result);
  } finally {
    conn.release();
  }
}

async function listMedia(req, res) {
  const owner_type = req.query.owner_type || null;
  const owner_id = req.query.owner_id ? Number(req.query.owner_id) : null;
  const page = Math.max(1, Number(req.query.page) || 1);
  const per_page = Math.max(1, Math.min(100, Number(req.query.per_page) || 20));
  const offset = (page - 1) * per_page;

  const conn = await pool.getConnection();
  try {
    const params = [];
    let where = '';
    if (owner_type && owner_id) {
      where = 'WHERE owner_type = ? AND owner_id = ?';
      params.push(owner_type, owner_id);
    }
    const [rows] = await conn.query(`SELECT * FROM Media ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, per_page, offset]);
    // normalize media_url to absolute
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const items = rows.map(r => {
      const url = r.media_url || r.mediaUrl || '';
      if (url && url.startsWith('/')) r.media_url = `${baseUrl}${url}`;
      return r;
    });
    return res.json({ items, page, per_page });
  } finally {
    conn.release();
  }
}

async function getMedia(req, res) {
  const id = Number(req.params.mediaId);
  if (!id) return res.status(400).json({ error: 'Invalid media id' });
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT * FROM Media WHERE media_id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Media not found' });
    // normalize media_url
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const row = rows[0];
    if (row.media_url && row.media_url.startsWith('/')) row.media_url = `${baseUrl}${row.media_url}`;
    return res.json(row);
  } finally {
    conn.release();
  }
}

async function updateMedia(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  const id = Number(req.params.mediaId);
  if (!id) return res.status(400).json({ error: 'Invalid media id' });

  const { media_type } = req.body || {};
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT * FROM Media WHERE media_id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Media not found' });
    const media = rows[0];
    if (String(media.owner_type) !== String(req.user.role) || Number(media.owner_id) !== Number(req.user.id)) return res.status(403).json({ error: 'Not owner' });

    const updates = [];
    const params = [];
    if (media_type) { updates.push('media_type = ?'); params.push(media_type); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    params.push(id);
    await conn.query(`UPDATE Media SET ${updates.join(', ')} WHERE media_id = ?`, params);
    const [updated] = await conn.query('SELECT * FROM Media WHERE media_id = ?', [id]);
    return res.json(updated[0]);
  } finally {
    conn.release();
  }
}

async function replaceMedia(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  const id = Number(req.params.mediaId);
  if (!id) return res.status(400).json({ error: 'Invalid media id' });
  if (!req.file) return res.status(400).json({ error: 'File required' });

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT * FROM Media WHERE media_id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Media not found' });
    const media = rows[0];
    if (String(media.owner_type) !== String(req.user.role) || Number(media.owner_id) !== Number(req.user.id)) return res.status(403).json({ error: 'Not owner' });

  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  const media_url = `${baseUrl}/uploads/${req.file.filename}`;
  await conn.query('UPDATE Media SET media_url = ? WHERE media_id = ?', [media_url, id]);
    const [updated] = await conn.query('SELECT * FROM Media WHERE media_id = ?', [id]);
    return res.json(updated[0]);
  } finally {
    conn.release();
  }
}

async function deleteMedia(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  const id = Number(req.params.mediaId);
  if (!id) return res.status(400).json({ error: 'Invalid media id' });
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT * FROM Media WHERE media_id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Media not found' });
    const media = rows[0];
    if (String(media.owner_type) !== String(req.user.role) || Number(media.owner_id) !== Number(req.user.id)) return res.status(403).json({ error: 'Not owner' });

    // soft delete: set deleted_at if column exists, otherwise hard delete
    const [cols] = await conn.query('SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = "Media" AND column_name = "deleted_at"');
    if (cols.length) {
      await conn.query('UPDATE Media SET deleted_at = NOW() WHERE media_id = ?', [id]);
    } else {
      await conn.query('DELETE FROM Media WHERE media_id = ?', [id]);
    }

    return res.json({ ok: true });
  } finally {
    conn.release();
  }
}

module.exports = { uploadMedia, listMedia, getMedia, updateMedia, replaceMedia, deleteMedia, setMediaAsProfile, syncProfileFromLatestMedia };

// POST /api/media/sync-profile
// Set the authenticated user's profile_image_url to their most recent image media
async function syncProfileFromLatestMedia(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  const owner_type = req.user.role;
  const owner_id = req.user.id;

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT * FROM Media WHERE owner_type = ? AND owner_id = ? AND media_type LIKE ? ORDER BY created_at DESC LIMIT 1', [owner_type, owner_id, 'image%']);
    if (!rows.length) return res.status(404).json({ error: 'No uploaded images found' });
    const media = rows[0];

    const media_url = media.media_url;
    const userTable = owner_type === 'artist' ? 'Artists' : 'Clubs';
    const idCol = owner_type === 'artist' ? 'artist_id' : 'club_id';

    // read old
    const [oldRows] = await conn.query(`SELECT ${idCol}, profile_image_url FROM ${userTable} WHERE ${idCol} = ?`, [owner_id]);
    const oldUrl = (oldRows && oldRows[0]) ? oldRows[0].profile_image_url : null;

    await conn.query(`UPDATE ${userTable} SET profile_image_url = ? WHERE ${idCol} = ?`, [media_url, owner_id]);

    // Ensure audit table exists and insert audit
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
    await conn.query('INSERT INTO ProfileImageAudit (owner_type, owner_id, old_url, new_url, source) VALUES (?, ?, ?, ?, ?)', [owner_type, owner_id, oldUrl, media_url, 'sync_latest_media']);

    const [updatedRows] = await conn.query(`SELECT ${idCol} as id, name, email, profile_image_url FROM ${userTable} WHERE ${idCol} = ?`, [owner_id]);
    return res.json({ ok: true, updated_user: updatedRows[0] });
  } finally {
    conn.release();
  }
}

// POST /api/media/:mediaId/set-as-profile
async function setMediaAsProfile(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  const mediaId = Number(req.params.mediaId);
  if (!mediaId) return res.status(400).json({ error: 'Invalid media id' });

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT * FROM Media WHERE media_id = ?', [mediaId]);
    if (!rows.length) return res.status(404).json({ error: 'Media not found' });
    const media = rows[0];

    // Only owner can set their profile
    if (String(media.owner_type) !== String(req.user.role) || Number(media.owner_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Not owner' });
    }

    const media_url = media.media_url;
    const owner_type = media.owner_type;
    const owner_id = media.owner_id;

    // Ensure audit table exists
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

    const userTable = owner_type === 'artist' ? 'Artists' : 'Clubs';
    const idCol = owner_type === 'artist' ? 'artist_id' : 'club_id';

    // read old
    const [oldRows] = await conn.query(`SELECT ${idCol}, profile_image_url FROM ${userTable} WHERE ${idCol} = ?`, [owner_id]);
    const oldUrl = (oldRows && oldRows[0]) ? oldRows[0].profile_image_url : null;

    await conn.query(`UPDATE ${userTable} SET profile_image_url = ? WHERE ${idCol} = ?`, [media_url, owner_id]);

    await conn.query('INSERT INTO ProfileImageAudit (owner_type, owner_id, old_url, new_url, source) VALUES (?, ?, ?, ?, ?)', [owner_type, owner_id, oldUrl, media_url, 'set_media_profile']);

    const [updatedRows] = await conn.query(`SELECT ${idCol} as id, name, email, profile_image_url FROM ${userTable} WHERE ${idCol} = ?`, [owner_id]);
    return res.json({ ok: true, updated_user: updatedRows[0] });
  } finally {
    conn.release();
  }
}
