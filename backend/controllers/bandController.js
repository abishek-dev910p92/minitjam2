// PATCH /api/bands/:bandId - update band profile (name, description, image)
async function updateBand(req, res) {
  const bandId = Number(req.params.bandId);
  if (!Number.isInteger(bandId) || bandId <= 0) return res.status(400).json({ error: 'Invalid band id' });
  if (!req.user || req.user.role !== 'artist') return res.status(401).json({ error: 'Auth required' });

  const conn = await pool.getConnection();
  try {
    const [bands] = await conn.query('SELECT created_by, profile_image_url FROM Bands WHERE band_id = ?', [bandId]);
    if (!bands.length) return res.status(404).json({ error: 'Band not found' });
    if (bands[0].created_by !== req.user.id) return res.status(403).json({ error: 'Only band creator can update profile' });

    const updates = [];
    const params = [];
    if (req.body.name) { updates.push('name = ?'); params.push(req.body.name); }
    if (req.body.description) { updates.push('description = ?'); params.push(req.body.description); }

    await conn.beginTransaction();

    // handle uploaded file if any (multer put it in req.file)
    if (req.file) {
      const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
      const media_url = `${baseUrl}/uploads/${req.file.filename}`;
      await conn.query('INSERT INTO Media (owner_type, owner_id, media_url, media_type) VALUES (?, ?, ?, ?)', ['band', bandId, media_url, 'image']);
      // audit previous value
      const oldProfile = bands[0].profile_image_url || null;
      await conn.query('UPDATE Bands SET profile_image_url = ? WHERE band_id = ?', [media_url, bandId]);
      // ensure audit table and insert audit
      await conn.query(`CREATE TABLE IF NOT EXISTS ProfileImageAudit (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_type VARCHAR(32) NOT NULL,
        owner_id INT NOT NULL,
        old_url TEXT,
        new_url TEXT,
        source VARCHAR(64),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
      await conn.query('INSERT INTO ProfileImageAudit (owner_type, owner_id, old_url, new_url, source) VALUES (?, ?, ?, ?, ?)',
        ['band', bandId, oldProfile, media_url, 'band_profile_update']);
    }

    if (updates.length) {
      params.push(bandId);
      await conn.query(`UPDATE Bands SET ${updates.join(', ')}, updated_at = NOW() WHERE band_id = ?`, params);
    }

    await conn.commit();

    const [updatedRows] = await conn.query('SELECT band_id, name, description, created_by, profile_image_url, created_at, updated_at FROM Bands WHERE band_id = ?', [bandId]);
    return res.json(updatedRows[0]);
  } catch (err) {
    try { await conn.rollback(); } catch (e) {}
    console.error('updateBand error:', err);
    return res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
}
// controllers/bandController.js
const pool = require('../db');

async function createBand(req, res) {
  if (!req.user || req.user.role !== 'artist') return res.status(403).json({ error: 'Only artists can create bands' });
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const conn = await pool.getConnection();
  try {
    if (req.file) {
      console.log('createBand: received file', { originalname: req.file.originalname, filename: req.file.filename, path: req.file.path, mimetype: req.file.mimetype, size: req.file.size });
    } else {
      console.log('createBand: no file uploaded');
    }
    // Use a transaction so band creation + member insert (+ optional media update) are atomic
    await conn.beginTransaction();
    const [b] = await conn.query('INSERT INTO Bands (name, description, created_by) VALUES (?, ?, ?)', [name, description || null, req.user.id]);
    const bandId = b.insertId;
    // add creator as member
    await conn.query('INSERT INTO BandMembers (band_id, artist_id, role) VALUES (?, ?, ?)', [bandId, req.user.id, 'creator']);

    // If a profile image was uploaded (via multer as req.file), store it in Media and set as band's profile
    if (req.file) {
      try {
        const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
        const media_url = `${baseUrl}/uploads/${req.file.filename}`;
        // insert media with owner_type = 'band'
        await conn.query('INSERT INTO Media (owner_type, owner_id, media_url, media_type) VALUES (?, ?, ?, ?)', ['band', bandId, media_url, 'image']);

        // read old profile (if any)
        const [oldRows] = await conn.query('SELECT profile_image_url FROM Bands WHERE band_id = ?', [bandId]);
        const oldProfile = (oldRows && oldRows[0]) ? oldRows[0].profile_image_url : null;

        // update band profile_image_url
        await conn.query('UPDATE Bands SET profile_image_url = ? WHERE band_id = ?', [media_url, bandId]);

        // ensure audit table exists and insert audit row
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
        await conn.query('INSERT INTO ProfileImageAudit (owner_type, owner_id, old_url, new_url, source) VALUES (?, ?, ?, ?, ?)', ['band', bandId, oldProfile, media_url, 'band_create_profile_upload']);
      } catch (e) {
        console.warn('createBand: failed to store uploaded profile image', e && e.message);
        // continue — don't block band creation for media failures
      }
    }

    await conn.commit();

    // Fetch band row with timestamps and profile_image_url
    const [bandRows] = await conn.query('SELECT band_id, name, description, created_by, profile_image_url, created_at, updated_at FROM Bands WHERE band_id = ?', [bandId]);
    if (!bandRows.length) return res.status(500).json({ error: 'Failed to fetch created band' });
    const band = bandRows[0];

    // Fetch members with joined_at and artist name
    const [memberRows] = await conn.query(
      `SELECT bm.artist_id, a.name, bm.role, bm.joined_at
       FROM BandMembers bm
       LEFT JOIN Artists a ON bm.artist_id = a.artist_id
       WHERE bm.band_id = ? ORDER BY bm.role = 'creator' DESC, bm.joined_at ASC`,
      [bandId]
    );

    // Ensure profile_image_url is null if not set
    if (!band.profile_image_url) band.profile_image_url = null;

    const result = Object.assign({}, band, { members: memberRows });
    return res.json(result);
  } catch (err) {
    try { await conn.rollback(); } catch (e) {}
    console.error('createBand error:', err && err.message);
    return res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
}

// GET /api/bands/:bandId
async function getBand(req, res) {
  const bandId = Number(req.params.bandId);
  if (!Number.isInteger(bandId) || bandId <= 0) return res.status(400).json({ error: 'Invalid band id' });
  const conn = await pool.getConnection();
  try {
    const [bandRows] = await conn.query('SELECT band_id, name, description, created_by, profile_image_url, created_at, updated_at FROM Bands WHERE band_id = ?', [bandId]);
    if (!bandRows.length) return res.status(404).json({ error: 'Band not found' });
    const band = bandRows[0];

    const [memberRows] = await conn.query(
      `SELECT bm.artist_id, a.name, bm.role, bm.joined_at
       FROM BandMembers bm
       LEFT JOIN Artists a ON bm.artist_id = a.artist_id
       WHERE bm.band_id = ? ORDER BY bm.role = 'creator' DESC, bm.joined_at ASC`,
      [bandId]
    );

    if (!band.profile_image_url) band.profile_image_url = null;
    return res.json(Object.assign({}, band, { members: memberRows }));
  } finally {
    conn.release();
  }
}

// GET /api/bands (memberships for current user)
async function getMyBands(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  const userId = req.user.id;
  const conn = await pool.getConnection();
  try {
    // find band ids the user belongs to
    const [brows] = await conn.query('SELECT DISTINCT b.* FROM Bands b JOIN BandMembers bm ON b.band_id = bm.band_id WHERE bm.artist_id = ?', [userId]);
    const bands = [];
    for (const b of brows) {
      const [memberRows] = await conn.query(
        `SELECT bm.artist_id, a.name, bm.role, bm.joined_at
         FROM BandMembers bm
         LEFT JOIN Artists a ON bm.artist_id = a.artist_id
         WHERE bm.band_id = ? ORDER BY bm.role = 'creator' DESC, bm.joined_at ASC`,
        [b.band_id]
      );
      if (!b.profile_image_url) b.profile_image_url = null;
      bands.push(Object.assign({}, { band_id: b.band_id, name: b.name, description: b.description, created_by: b.created_by, profile_image_url: b.profile_image_url, created_at: b.created_at, updated_at: b.updated_at, members: memberRows }));
    }
    return res.json(bands);
  } finally {
    conn.release();
  }
}

// GET /api/bands/:bandId/members
async function getBandMembers(req, res) {
  const bandId = Number(req.params.bandId);
  if (!Number.isInteger(bandId) || bandId <= 0) return res.status(400).json({ error: 'Invalid band id' });
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  const conn = await pool.getConnection();
  try {
    // return member rows joined with some artist info
    const [rows] = await conn.query(
      `SELECT bm.band_id, bm.artist_id, bm.role, a.name, a.profile_image_url
       FROM BandMembers bm
       LEFT JOIN Artists a ON bm.artist_id = a.artist_id
       WHERE bm.band_id = ? ORDER BY bm.role = 'creator' DESC, bm.artist_id ASC`,
      [bandId]
    );
    return res.json(rows);
  } finally {
    conn.release();
  }
}

// DELETE /api/bands/:bandId/members/:artistId
async function removeBandMember(req, res) {
  const bandId = Number(req.params.bandId);
  const artistId = Number(req.params.artistId);
  if (!Number.isInteger(bandId) || bandId <= 0) return res.status(400).json({ error: 'Invalid band id' });
  if (!Number.isInteger(artistId) || artistId <= 0) return res.status(400).json({ error: 'Invalid artist id' });
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  const conn = await pool.getConnection();
  try {
    // verify band exists
    const [bands] = await conn.query('SELECT * FROM Bands WHERE band_id = ?', [bandId]);
    if (!bands.length) return res.status(404).json({ error: 'Band not found' });

    // check if requester is the member themselves or the creator
    const [creatorRows] = await conn.query('SELECT created_by FROM Bands WHERE band_id = ?', [bandId]);
    const creatorId = creatorRows[0] ? creatorRows[0].created_by : null;
    if (req.user.id !== artistId && req.user.id !== creatorId) {
      return res.status(403).json({ error: 'Only the member or band creator can remove a member' });
    }

    // prevent removing creator via this endpoint unless creator is removing themselves and band will remain (you may wish to handle transfer)
    if (artistId === creatorId && req.user.id !== creatorId) return res.status(400).json({ error: 'Cannot remove the creator' });

    await conn.query('DELETE FROM BandMembers WHERE band_id = ? AND artist_id = ?', [bandId, artistId]);
    // notify removed member (optional)
    await conn.query('INSERT INTO Notifications (owner_type, owner_id, message) VALUES (?, ?, ?)', ['artist', artistId, `You were removed from band ${bandId}`]);
    return res.json({ ok: true });
  } finally {
    conn.release();
  }
}

// PATCH /api/bands/:bandId/members/:artistId
async function updateBandMemberRole(req, res) {
  const bandId = Number(req.params.bandId);
  const artistId = Number(req.params.artistId);
  if (!Number.isInteger(bandId) || bandId <= 0) return res.status(400).json({ error: 'Invalid band id' });
  if (!Number.isInteger(artistId) || artistId <= 0) return res.status(400).json({ error: 'Invalid artist id' });
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  const { role } = req.body;
  if (!role) return res.status(400).json({ error: 'role required' });

  const conn = await pool.getConnection();
  try {
    // only creator can change roles
    const [bands] = await conn.query('SELECT created_by FROM Bands WHERE band_id = ?', [bandId]);
    if (!bands.length) return res.status(404).json({ error: 'Band not found' });
    const creatorId = bands[0].created_by;
    if (req.user.id !== creatorId) return res.status(403).json({ error: 'Only the band creator can update member roles' });

    const [members] = await conn.query('SELECT * FROM BandMembers WHERE band_id = ? AND artist_id = ?', [bandId, artistId]);
    if (!members.length) return res.status(404).json({ error: 'Member not found' });

    await conn.query('UPDATE BandMembers SET role = ? WHERE band_id = ? AND artist_id = ?', [role, bandId, artistId]);
    // notify the member
    await conn.query('INSERT INTO Notifications (owner_type, owner_id, message) VALUES (?, ?, ?)', ['artist', artistId, `Your role in band ${bandId} was updated to ${role}`]);
    return res.json({ ok: true });
  } finally {
    conn.release();
  }
}

// POST /api/bands/:bandId/members  (direct add by creator)
async function addMemberDirect(req, res) {
  if (!req.user || req.user.role !== 'artist') return res.status(403).json({ error: 'Only artists' });
  const bandId = Number(req.params.bandId);
  const { artist_id, role } = req.body;
  if (!Number.isInteger(bandId) || bandId <= 0) return res.status(400).json({ error: 'Invalid band id' });
  if (!artist_id || !Number.isInteger(Number(artist_id))) return res.status(400).json({ error: 'artist_id required' });

  const conn = await pool.getConnection();
  try {
    const [bands] = await conn.query('SELECT created_by FROM Bands WHERE band_id = ?', [bandId]);
    if (!bands.length) return res.status(404).json({ error: 'Band not found' });
    if (bands[0].created_by !== req.user.id) return res.status(403).json({ error: 'Only the band creator can add members directly' });

    // prevent duplicate
    const [dup] = await conn.query('SELECT 1 FROM BandMembers WHERE band_id = ? AND artist_id = ?', [bandId, artist_id]);
    if (dup.length) return res.status(400).json({ error: 'Artist already a member' });

    const [ins] = await conn.query('INSERT INTO BandMembers (band_id, artist_id, role) VALUES (?, ?, ?)', [bandId, artist_id, role || 'member']);
    // fetch member info
    const [mrows] = await conn.query('SELECT bm.artist_id, a.name, bm.role, bm.joined_at FROM BandMembers bm LEFT JOIN Artists a ON bm.artist_id = a.artist_id WHERE bm.band_id = ? AND bm.artist_id = ?', [bandId, artist_id]);

    // notify artist
    await conn.query('INSERT INTO Notifications (owner_type, owner_id, message) VALUES (?, ?, ?)', ['artist', artist_id, `You were added to band ${bandId}`]);

    return res.json({ success: true, band_id: bandId, member: mrows[0] });
  } finally {
    conn.release();
  }
}

// POST /api/bands/:bandId/invite  (creator invites)
async function inviteArtist(req, res) {
  if (!req.user || req.user.role !== 'artist') return res.status(403).json({ error: 'Only artists' });
  const bandId = Number(req.params.bandId);
  const { artist_id, role } = req.body;
  if (!Number.isInteger(bandId) || bandId <= 0) return res.status(400).json({ error: 'Invalid band id' });
  if (!artist_id || !Number.isInteger(Number(artist_id))) return res.status(400).json({ error: 'artist_id required' });

  const conn = await pool.getConnection();
  try {
    const [members] = await conn.query('SELECT 1 FROM BandMembers WHERE band_id = ? AND artist_id = ?', [bandId, req.user.id]);
    if (!members.length) return res.status(403).json({ error: 'Only band members can invite' });

    // check already member
    const [already] = await conn.query('SELECT 1 FROM BandMembers WHERE band_id = ? AND artist_id = ?', [bandId, artist_id]);
    if (already.length) return res.status(400).json({ error: 'Artist already a member' });

    // Detect available columns in BandInvites (some schemas may not have role/status)
    const [cols] = await conn.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BandInvites'");
    const colSet = new Set(cols.map(r => r.COLUMN_NAME));
    const insertCols = [];
    const placeholders = [];
    const params = [];
    // required
    insertCols.push('band_id'); placeholders.push('?'); params.push(bandId);
    insertCols.push('invited_artist_id'); placeholders.push('?'); params.push(artist_id);
    insertCols.push('invited_by'); placeholders.push('?'); params.push(req.user.id);
    // optional: role
    if (colSet.has('role')) {
      insertCols.push('role'); placeholders.push('?'); params.push(role || 'member');
    }
    // optional: status
    if (colSet.has('status')) {
      insertCols.push('status'); placeholders.push('?'); params.push('pending');
    }
    const sql = `INSERT INTO BandInvites (${insertCols.join(',')}) VALUES (${placeholders.join(',')})`;
    const [ins] = await conn.query(sql, params);
    // create notification
    await conn.query('INSERT INTO Notifications (owner_type, owner_id, message) VALUES (?, ?, ?)', ['artist', artist_id, `You received a band invite to band ${bandId}`]);

    // For API consistency return role/status even if DB didn't store them
    const respRole = role || 'member';
    const respStatus = colSet.has('status') ? 'pending' : 'pending';
    return res.json({ success: true, invite_id: ins.insertId, band_id: bandId, artist_id, role: respRole, status: respStatus });
  } finally {
    conn.release();
  }
}

// POST /api/bands/:bandId/invite/:inviteId/respond  (artist accepts/rejects)
async function respondToInvite(req, res) {
  if (!req.user || req.user.role !== 'artist') return res.status(403).json({ error: 'Only artists' });
  const bandId = Number(req.params.bandId);
  const inviteId = Number(req.params.inviteId);
  const { status } = req.body; // 'accepted' or 'rejected'
  if (!Number.isInteger(bandId) || bandId <= 0) return res.status(400).json({ error: 'Invalid band id' });
  if (!Number.isInteger(inviteId) || inviteId <= 0) return res.status(400).json({ error: 'Invalid invite id' });
  if (!['accepted', 'rejected'].includes(status)) return res.status(400).json({ error: 'status must be accepted or rejected' });

  const conn = await pool.getConnection();
  try {
    const [invites] = await conn.query('SELECT * FROM BandInvites WHERE invite_id = ?', [inviteId]);
    if (!invites.length) return res.status(404).json({ error: 'Invite not found' });
    const invite = invites[0];
    if (invite.invited_artist_id !== req.user.id) return res.status(403).json({ error: 'Not your invite' });
    // Inspect schema to see if status/responded_at columns exist
    const [cols] = await conn.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BandInvites'");
    const colSet = new Set(cols.map(r => r.COLUMN_NAME));

    const isPending = colSet.has('status') ? (invite.status === 'pending') : (colSet.has('responded_at') ? (!invite.responded_at) : true);
    if (!isPending) return res.status(400).json({ error: 'Invite already responded' });

    // Build UPDATE dynamically to avoid unknown-column errors
    const updates = [];
    const params = [];
    if (colSet.has('status')) {
      updates.push('status = ?');
      params.push(status === 'accepted' ? 'accepted' : 'rejected');
    }
    if (colSet.has('responded_at')) {
      updates.push('responded_at = NOW()');
    }
    if (updates.length) {
      const sql = `UPDATE BandInvites SET ${updates.join(', ')} WHERE invite_id = ?`;
      params.push(inviteId);
      await conn.query(sql, params);
    }

    if (status === 'accepted') {
      // add to band members
      await conn.query('INSERT INTO BandMembers (band_id, artist_id, role) VALUES (?, ?, ?)', [invite.band_id, req.user.id, invite.role || 'member']);
      // notify inviter
      await conn.query('INSERT INTO Notifications (owner_type, owner_id, message) VALUES (?, ?, ?)', ['artist', invite.invited_by, `Artist ${req.user.id} accepted your band invite for band ${invite.band_id}`]);
      // fetch member info
      const [mrows] = await conn.query('SELECT bm.artist_id, a.name, bm.role, bm.joined_at FROM BandMembers bm LEFT JOIN Artists a ON bm.artist_id = a.artist_id WHERE bm.band_id = ? AND bm.artist_id = ?', [invite.band_id, req.user.id]);
      return res.json({ success: true, band_id: invite.band_id, member: mrows[0] });
    } else {
      await conn.query('INSERT INTO Notifications (owner_type, owner_id, message) VALUES (?, ?, ?)', ['artist', invite.invited_by, `Artist ${req.user.id} rejected your band invite for band ${invite.band_id}`]);
      return res.json({ success: true, band_id: invite.band_id });
    }
  } finally {
    conn.release();
  }
}

// GET /api/bands/invites - list invites for current authenticated artist
async function listMyInvites(req, res) {
  if (!req.user || req.user.role !== 'artist') return res.status(403).json({ error: 'Only artists' });
  const userId = req.user.id;
  const conn = await pool.getConnection();
  try {
    // detect BandInvites columns so we don't select non-existent fields
    const [cols] = await conn.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BandInvites'");
    const colSet = new Set(cols.map(r => r.COLUMN_NAME));
    const selectCols = ['bi.invite_id', 'bi.band_id', 'bi.invited_artist_id', 'bi.invited_by', 'b.name AS band_name'];
    if (colSet.has('role')) selectCols.push('bi.role');
    if (colSet.has('status')) selectCols.push('bi.status');
    // prefer created_at, otherwise accept invited_at as the timestamp column
    const timestampCol = colSet.has('created_at') ? 'bi.created_at' : (colSet.has('invited_at') ? 'bi.invited_at' : null);
    if (timestampCol) selectCols.push(timestampCol + ' AS invited_at');

    const orderBy = timestampCol ? `${timestampCol} DESC` : 'bi.invite_id DESC';
    const sql = `SELECT ${selectCols.join(', ')} \
                 FROM BandInvites bi \
                 LEFT JOIN Bands b ON bi.band_id = b.band_id \
                 WHERE bi.invited_artist_id = ? AND bi.status = 'pending' \
                 ORDER BY ${orderBy}`;
    const [rows] = await conn.query(sql, [userId]);
    return res.json(rows);
  } finally {
    conn.release();
  }
}

// GET /api/bands/:bandId/invites - list invites for a band (only creator)
async function listBandInvites(req, res) {
  if (!req.user || req.user.role !== 'artist') return res.status(403).json({ error: 'Only artists' });
  const bandId = Number(req.params.bandId);
  if (!Number.isInteger(bandId) || bandId <= 0) return res.status(400).json({ error: 'Invalid band id' });
  const conn = await pool.getConnection();
  try {
    const [bands] = await conn.query('SELECT created_by FROM Bands WHERE band_id = ?', [bandId]);
    if (!bands.length) return res.status(404).json({ error: 'Band not found' });
    if (bands[0].created_by !== req.user.id) return res.status(403).json({ error: 'Only the band creator can list invites for this band' });

    // detect BandInvites columns so we don't select non-existent fields
    const [cols] = await conn.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BandInvites'");
    const colSet = new Set(cols.map(r => r.COLUMN_NAME));
  const selectCols = ['bi.invite_id', 'bi.band_id', 'bi.invited_artist_id', 'bi.invited_by', 'a.name AS artist_name'];
  if (colSet.has('role')) selectCols.push('bi.role');
  if (colSet.has('status')) selectCols.push('bi.status');
  // prefer created_at, otherwise accept invited_at as the timestamp column
  const timestampColB = colSet.has('created_at') ? 'bi.created_at' : (colSet.has('invited_at') ? 'bi.invited_at' : null);
  if (timestampColB) selectCols.push(timestampColB + ' AS invited_at');

  const orderByB = timestampColB ? `${timestampColB} DESC` : 'bi.invite_id DESC';
  const sql = `SELECT ${selectCols.join(', ')} FROM BandInvites bi LEFT JOIN Artists a ON bi.invited_artist_id = a.artist_id WHERE bi.band_id = ? ORDER BY ${orderByB}`;
    const [rows] = await conn.query(sql, [bandId]);
    return res.json(rows);
  } finally {
    conn.release();
  }
}

// DELETE /api/bands/:bandId/invites/:inviteId  (creator cancels an invite)
async function cancelInvite(req, res) {
  if (!req.user || req.user.role !== 'artist') return res.status(403).json({ error: 'Only artists' });
  const bandId = Number(req.params.bandId);
  const inviteId = Number(req.params.inviteId);
  if (!Number.isInteger(bandId) || bandId <= 0) return res.status(400).json({ error: 'Invalid band id' });
  if (!Number.isInteger(inviteId) || inviteId <= 0) return res.status(400).json({ error: 'Invalid invite id' });

  const conn = await pool.getConnection();
  try {
    const [bands] = await conn.query('SELECT created_by FROM Bands WHERE band_id = ?', [bandId]);
    if (!bands.length) return res.status(404).json({ error: 'Band not found' });
    if (bands[0].created_by !== req.user.id) return res.status(403).json({ error: 'Only the band creator can cancel invites for this band' });

    const [invites] = await conn.query('SELECT * FROM BandInvites WHERE invite_id = ? AND band_id = ?', [inviteId, bandId]);
    if (!invites.length) return res.status(404).json({ error: 'Invite not found' });
    const invite = invites[0];

    // detect columns and prefer soft-cancel
    const [cols] = await conn.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BandInvites'");
    const colSet = new Set(cols.map(r => r.COLUMN_NAME));
    const updates = [];
    const params = [];
    if (colSet.has('status')) {
      updates.push('status = ?'); params.push('cancelled');
    }
    if (colSet.has('responded_at')) {
      updates.push('responded_at = NOW()');
    }
    if (updates.length) {
      const sql = `UPDATE BandInvites SET ${updates.join(', ')} WHERE invite_id = ?`;
      params.push(inviteId);
      await conn.query(sql, params);
    } else {
      await conn.query('DELETE FROM BandInvites WHERE invite_id = ? AND band_id = ?', [inviteId, bandId]);
    }

    // notify the invited artist
    try {
      await conn.query('INSERT INTO Notifications (owner_type, owner_id, message) VALUES (?, ?, ?)', ['artist', invite.invited_artist_id, `Your invite to join band ${bandId} was cancelled by the creator`]);
    } catch (e) {
      console.warn('cancelInvite: failed to insert notification', e && e.message);
    }

    return res.json({ ok: true });
  } finally {
    conn.release();
  }
}

// DELETE /api/bands/invites/:inviteId  (invitee withdraws their invite)
async function withdrawInvite(req, res) {
  if (!req.user || req.user.role !== 'artist') return res.status(403).json({ error: 'Only artists' });
  const inviteId = Number(req.params.inviteId);
  if (!Number.isInteger(inviteId) || inviteId <= 0) return res.status(400).json({ error: 'Invalid invite id' });

  const conn = await pool.getConnection();
  try {
    const [invites] = await conn.query('SELECT * FROM BandInvites WHERE invite_id = ?', [inviteId]);
    if (!invites.length) return res.status(404).json({ error: 'Invite not found' });
    const invite = invites[0];
    if (invite.invited_artist_id !== req.user.id) return res.status(403).json({ error: 'Not your invite' });

    // detect columns and prefer soft-withdraw
    const [cols] = await conn.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BandInvites'");
    const colSet = new Set(cols.map(r => r.COLUMN_NAME));
    const updates = [];
    const params = [];
    if (colSet.has('status')) {
      updates.push('status = ?'); params.push('withdrawn');
    }
    if (colSet.has('responded_at')) {
      updates.push('responded_at = NOW()');
    }
    if (updates.length) {
      const sql = `UPDATE BandInvites SET ${updates.join(', ')} WHERE invite_id = ?`;
      params.push(inviteId);
      await conn.query(sql, params);
    } else {
      await conn.query('DELETE FROM BandInvites WHERE invite_id = ?', [inviteId]);
    }

    // notify the inviter
    try {
      await conn.query('INSERT INTO Notifications (owner_type, owner_id, message) VALUES (?, ?, ?)', ['artist', invite.invited_by, `Artist ${req.user.id} withdrew their invite request for band ${invite.band_id}`]);
    } catch (e) {
      console.warn('withdrawInvite: failed to insert notification', e && e.message);
    }

    return res.json({ ok: true });
  } finally {
    conn.release();
  }
}

// DELETE /api/bands/:bandId  (creator deletes the band and related data)
async function deleteBand(req, res) {
  if (!req.user || req.user.role !== 'artist') return res.status(403).json({ error: 'Only artists' });
  const bandId = Number(req.params.bandId);
  if (!Number.isInteger(bandId) || bandId <= 0) return res.status(400).json({ error: 'Invalid band id' });

  const conn = await pool.getConnection();
  try {
    const [bands] = await conn.query('SELECT created_by FROM Bands WHERE band_id = ?', [bandId]);
    if (!bands.length) return res.status(404).json({ error: 'Band not found' });
    const creatorId = bands[0].created_by;
    if (req.user.id !== creatorId) return res.status(403).json({ error: 'Only the band creator can delete the band' });

    await conn.beginTransaction();

    // Important: delete dependent rows that reference Bands.first to avoid FK constraint failures.
    // Delete invites first (direct DELETE to remove FK references), then members and media/audits, then the band.
    try {
      await conn.query('DELETE FROM BandInvites WHERE band_id = ?', [bandId]);
    } catch (e) {
      // if the table doesn't exist or delete fails, log and continue to best-effort cleanup
      console.warn('deleteBand: failed to delete BandInvites', e && e.message);
    }

    // delete members
    try {
      await conn.query('DELETE FROM BandMembers WHERE band_id = ?', [bandId]);
    } catch (e) {
      console.warn('deleteBand: failed to delete BandMembers', e && e.message);
    }

    // delete media rows for this band
    try { await conn.query("DELETE FROM Media WHERE owner_type = 'band' AND owner_id = ?", [bandId]); } catch (e) { console.warn('deleteBand: failed to delete Media', e && e.message); }

    // delete profile image audit rows if table exists
    try {
      await conn.query('DELETE FROM ProfileImageAudit WHERE owner_type = ? AND owner_id = ?', ['band', bandId]);
    } catch (e) {
      // ignore if table doesn't exist
    }

    // finally delete the band
    await conn.query('DELETE FROM Bands WHERE band_id = ?', [bandId]);

    // optional: notify members (best-effort - members were already removed)
    await conn.commit();
    return res.json({ ok: true });
  } catch (err) {
    try { await conn.rollback(); } catch (e) {}
    console.error('deleteBand error:', err && err.message);
    return res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
}

// GET /api/bands/search?q=&page=&limit=&genre=&location=
async function searchBands(req, res) {
  const q = req.query.q ? String(req.query.q).trim() : null;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const conn = await pool.getConnection();
  try {
    const where = [];
    const params = [];
    if (q) {
      where.push('(b.name LIKE ? OR b.description LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }
    // optional filters (genre, location) if columns exist
    const [cols] = await conn.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Bands'");
    const colSet = new Set(cols.map(r => r.COLUMN_NAME));
    if (req.query.genre && colSet.has('genre')) { where.push('b.genre = ?'); params.push(req.query.genre); }
    if (req.query.location && colSet.has('location')) { where.push('b.location = ?'); params.push(req.query.location); }

    const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';

    const sql = `SELECT b.band_id, b.name, b.description, b.profile_image_url, b.created_at FROM Bands b ${whereSql} ORDER BY b.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    const [rows] = await conn.query(sql, params);
    // ensure profile_image_url is null when empty
    for (const r of rows) if (!r.profile_image_url) r.profile_image_url = null;
    return res.json({ page, limit, results: rows });
  } finally {
    conn.release();
  }
}

// GET /api/bands/featured?limit=10
async function featuredBands(req, res) {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const conn = await pool.getConnection();
  try {
    // If Bands has a `featured` boolean/flag column, use it; otherwise fall back to most recent bands
    const [cols] = await conn.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Bands'");
    const colSet = new Set(cols.map(r => r.COLUMN_NAME));
    let sql;
    if (colSet.has('featured')) {
      sql = `SELECT band_id, name, description, profile_image_url, created_at FROM Bands WHERE featured = 1 ORDER BY updated_at DESC LIMIT ?`;
      const [rows] = await conn.query(sql, [limit]);
      for (const r of rows) if (!r.profile_image_url) r.profile_image_url = null;
      return res.json(rows);
    }

    // Fallback: choose most recently active or created bands (created_at)
    sql = `SELECT band_id, name, description, profile_image_url, created_at FROM Bands ORDER BY created_at DESC LIMIT ?`;
    const [rows2] = await conn.query(sql, [limit]);
    for (const r of rows2) if (!r.profile_image_url) r.profile_image_url = null;
    return res.json(rows2);
  } finally {
    conn.release();
  }
}

// GET /api/bands/:bandId/details - public richer details including member bios
async function getBandDetails(req, res) {
  const bandId = Number(req.params.bandId);
  if (!Number.isInteger(bandId) || bandId <= 0) return res.status(400).json({ error: 'Invalid band id' });
  const conn = await pool.getConnection();
  try {
    const [bandRows] = await conn.query('SELECT band_id, name, description, profile_image_url, created_by, created_at, updated_at FROM Bands WHERE band_id = ?', [bandId]);
    if (!bandRows.length) return res.status(404).json({ error: 'Band not found' });
    const band = bandRows[0];

    // richer member join: include bio if present and artist profile image
    // Some schemas may not have `bio` on Artists; select defensively
    const [artistCols] = await conn.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Artists'");
    const artistColSet = new Set(artistCols.map(r => r.COLUMN_NAME));
    const extraSelect = artistColSet.has('bio') ? ', a.bio' : '';

    const [members] = await conn.query(
      `SELECT bm.artist_id, a.name, a.profile_image_url${extraSelect}, bm.role, bm.joined_at
       FROM BandMembers bm
       LEFT JOIN Artists a ON bm.artist_id = a.artist_id
       WHERE bm.band_id = ? ORDER BY bm.role = 'creator' DESC, bm.joined_at ASC`,
      [bandId]
    );

    if (!band.profile_image_url) band.profile_image_url = null;
    for (const m of members) if (!m.profile_image_url) m.profile_image_url = null;

    return res.json(Object.assign({}, band, { members }));
  } finally {
    conn.release();
  }
}

async function inviteToBand(req, res) {
  if (!req.user || req.user.role !== 'artist') return res.status(403).json({ error: 'Only artists can invite' });
  const bandId = Number(req.params.bandId);
  const { invited_artist_id, message } = req.body;
  if (!invited_artist_id) return res.status(400).json({ error: 'invited_artist_id required' });

  const conn = await pool.getConnection();
  try {
    // verify requester is band member
    const [members] = await conn.query('SELECT 1 FROM BandMembers WHERE band_id = ? AND artist_id = ?', [bandId, req.user.id]);
    if (!members.length) return res.status(403).json({ error: 'Only band members can invite' });

    // check if already member
    const [already] = await conn.query('SELECT 1 FROM BandMembers WHERE band_id = ? AND artist_id = ?', [bandId, invited_artist_id]);
    if (already.length) return res.status(400).json({ error: 'Artist already a member' });

    // create invite
    const [ins] = await conn.query('INSERT INTO BandInvites (band_id, invited_artist_id, invited_by, message) VALUES (?, ?, ?, ?)', [bandId, invited_artist_id, req.user.id, message || null]);

    // create notification (simplified)
    await conn.query('INSERT INTO Notifications (owner_type, owner_id, message) VALUES (?, ?, ?)', ['artist', invited_artist_id, `You received a band invite to band ${bandId}`]);

    const [rows] = await conn.query('SELECT * FROM BandInvites WHERE invite_id = ?', [ins.insertId]);
    return res.json(rows[0]);
  } finally {
    conn.release();
  }
}

async function respondInvite(req, res) {
  if (!req.user || req.user.role !== 'artist') return res.status(403).json({ error: 'Only artists can respond' });
  const inviteId = Number(req.params.inviteId);
  const { action, role } = req.body; // action: 'accept' or 'reject'

  if (!['accept', 'reject'].includes(action)) return res.status(400).json({ error: 'action must be accept or reject' });

  const conn = await pool.getConnection();
  try {
    const [invites] = await conn.query('SELECT * FROM BandInvites WHERE invite_id = ?', [inviteId]);
    if (!invites.length) return res.status(404).json({ error: 'Invite not found' });
    const invite = invites[0];
    if (invite.invited_artist_id !== req.user.id) return res.status(403).json({ error: 'Not your invite' });

    // detect columns to avoid unknown-column errors
    const [cols] = await conn.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BandInvites'");
    const colSet = new Set(cols.map(r => r.COLUMN_NAME));

    const isPending = colSet.has('status') ? (invite.status === 'pending') : (colSet.has('responded_at') ? (!invite.responded_at) : true);
    if (!isPending) return res.status(400).json({ error: 'Invite already responded' });

    const updates = [];
    const params = [];
    if (colSet.has('status')) {
      updates.push('status = ?');
      params.push(action === 'accept' ? 'accepted' : 'rejected');
    }
    if (colSet.has('responded_at')) {
      updates.push('responded_at = NOW()');
    }
    if (updates.length) {
      const sql = `UPDATE BandInvites SET ${updates.join(', ')} WHERE invite_id = ?`;
      params.push(inviteId);
      await conn.query(sql, params);
    }

    if (action === 'accept') {
      // add to band members
      await conn.query('INSERT INTO BandMembers (band_id, artist_id, role) VALUES (?, ?, ?)', [invite.band_id, req.user.id, role || null]);
      // notify inviter
      await conn.query('INSERT INTO Notifications (owner_type, owner_id, message) VALUES (?, ?, ?)', ['artist', invite.invited_by, `Artist ${req.user.id} accepted your band invite for band ${invite.band_id}`]);
    } else {
      await conn.query('INSERT INTO Notifications (owner_type, owner_id, message) VALUES (?, ?, ?)', ['artist', invite.invited_by, `Artist ${req.user.id} rejected your band invite for band ${invite.band_id}`]);
    }

    return res.json({ ok: true });
  } finally {
    conn.release();
  }
}

module.exports = {
  createBand,
  inviteToBand,
  respondInvite,
  getBand,
  getBandMembers,
  removeBandMember,
  updateBandMemberRole,
  getMyBands,
  addMemberDirect,
  inviteArtist,
  respondToInvite,
  listMyInvites,
  listBandInvites,
  cancelInvite,
  withdrawInvite,
  updateBand,
  deleteBand,
  searchBands,
  featuredBands
  ,getBandDetails
};
