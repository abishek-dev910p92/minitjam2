// controllers/applicationController.js
const pool = require('../db');

async function applyToOpportunity(req, res) {
  if (!req.user || (req.user.role !== 'artist' && req.user.role !== 'club')) return res.status(403).json({ error: 'Auth required' });
  // accept either /:opportunityId or /:id
  const oppId = Number(req.params.opportunityId || req.params.id);
  const { artist_id, band_id } = req.body;

  if (!artist_id && !band_id) return res.status(400).json({ error: 'artist_id or band_id required' });

  const conn = await pool.getConnection();
  try {
    // check opp exists and open
    const [opps] = await conn.query('SELECT * FROM Opportunities WHERE opportunity_id = ?', [oppId]);
    if (!opps.length) return res.status(404).json({ error: 'Opportunity not found' });
    if (opps[0].status !== 'open') return res.status(400).json({ error: 'Opportunity not open' });

    // prevent duplicate
    const [dup] = await conn.query('SELECT 1 FROM Applications WHERE opportunity_id = ? AND (artist_id = ? OR band_id = ?)', [oppId, artist_id || 0, band_id || 0]);
    if (dup.length) return res.status(400).json({ error: 'Already applied' });

    const [ins] = await conn.query('INSERT INTO Applications (opportunity_id, artist_id, band_id) VALUES (?, ?, ?)', [oppId, artist_id || null, band_id || null]);

    // notify club
    await conn.query('INSERT INTO Notifications (owner_type, owner_id, message) VALUES (?, ?, ?)', ['club', opps[0].club_id, `New application for opportunity ${oppId}`]);

    const [rows] = await conn.query('SELECT * FROM Applications WHERE application_id = ?', [ins.insertId]);
    return res.json(rows[0]);
  } finally {
    conn.release();
  }
}

async function listApplicantsForOpportunity(req, res) {
  // Only clubs (owners) can list applicants for their own opportunity
  if (!req.user || req.user.role !== 'club') return res.status(403).json({ error: 'Only clubs' });
  const oppId = Number(req.params.opportunityId || req.params.id);
  const conn = await pool.getConnection();
  try {
    const [opps] = await conn.query('SELECT * FROM Opportunities WHERE opportunity_id = ?', [oppId]);
    if (!opps.length) return res.status(404).json({ error: 'Opportunity not found' });
    const opportunity = opps[0];
    if (opportunity.club_id !== req.user.id) return res.status(403).json({ error: 'Not your opportunity' });

    const [rows] = await conn.query('SELECT * FROM Applications WHERE opportunity_id = ? ORDER BY applied_at DESC', [oppId]);
    return res.json(rows);
  } finally {
    conn.release();
  }
}

async function listApplicationsForClub(req, res) {
  if (!req.user || req.user.role !== 'club') return res.status(403).json({ error: 'Only clubs' });
  const clubId = req.user.id;
  const conn = await pool.getConnection();
  try {
    // fetch applications for opportunities of this club
    const [rows] = await conn.query(
      `SELECT a.* FROM Applications a
       JOIN Opportunities o ON a.opportunity_id = o.opportunity_id
       WHERE o.club_id = ? ORDER BY a.applied_at DESC`,
      [clubId]
    );
    return res.json(rows);
  } finally {
    conn.release();
  }
}

async function acceptApplication(req, res) {
  if (!req.user || req.user.role !== 'club') return res.status(403).json({ error: 'Only clubs' });
  const appId = Number(req.params.applicationId);
  const conn = await pool.getConnection();
  try {
    const [apps] = await conn.query('SELECT a.*, o.club_id, o.event_date, o.event_time FROM Applications a JOIN Opportunities o ON a.opportunity_id = o.opportunity_id WHERE a.application_id = ?', [appId]);
    if (!apps.length) return res.status(404).json({ error: 'Application not found' });
    const app = apps[0];
    if (app.club_id !== req.user.id) return res.status(403).json({ error: 'Not your opportunity' });

    // transaction: update application, create booking, close opportunity (optional)
    await conn.query('UPDATE Applications SET status = ? WHERE application_id = ?', ['accepted', appId]);

    const [b] = await conn.query('INSERT INTO Bookings (artist_id, band_id, club_id, event_date, event_time, status) VALUES (?, ?, ?, ?, ?, ?)', [app.artist_id || null, app.band_id || null, req.user.id, app.event_date || null, app.event_time || null, 'confirmed']);

    await conn.query('UPDATE Opportunities SET status = ? WHERE opportunity_id = ?', ['closed', app.opportunity_id]);

    // notify applicant
    if (app.artist_id) {
      await conn.query('INSERT INTO Notifications (owner_type, owner_id, message) VALUES (?, ?, ?)', ['artist', app.artist_id, `Your application ${appId} was accepted`]);
    }
    if (app.band_id) {
      await conn.query('INSERT INTO Notifications (owner_type, owner_id, message) VALUES (?, ?, ?)', ['band', app.band_id, `Your application ${appId} was accepted`]);
    }

    const [bookingRows] = await conn.query('SELECT * FROM Bookings WHERE booking_id = ?', [b.insertId]);
    return res.json({ booking: bookingRows[0] });
  } finally {
    conn.release();
  }
}

module.exports = { applyToOpportunity, listApplicationsForClub, acceptApplication, listApplicantsForOpportunity };
