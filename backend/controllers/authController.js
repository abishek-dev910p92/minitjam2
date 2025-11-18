// controllers/authController.js
const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { findOrCreateGenre, findOrCreateLocation } = require('../utils/helpers');

require('dotenv').config();

const SALT_ROUNDS = 12;

function signToken(id, role) {
  return jwt.sign({ sub: id, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

async function signupArtist(req, res) {
  const { name, email, password, phone, genre_name, genre_id, location, location_id, bio } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });

  const conn = await pool.getConnection();
  try {
    // unique email across artists (optionally across clubs — omitted)
    const [exists] = await conn.query('SELECT artist_id FROM Artists WHERE email = ?', [email]);
    if (exists.length) return res.status(400).json({ error: 'Email already registered as artist' });

    // handle genre & location
    let gid = genre_id;
    if (!gid && genre_name) gid = await findOrCreateGenre(genre_name);

    let lid = location_id;
    if (!lid && location && (location.city || location.region)) {
      lid = await findOrCreateLocation(location.city || '', location.region || '');
    }

    const pwd = await bcrypt.hash(password, SALT_ROUNDS);
    const [result] = await conn.query(
      'INSERT INTO Artists (name, email, password_hash, phone, genre_id, bio, location_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, email, pwd, phone, gid || null, bio || null, lid || null]
    );

    const token = signToken(result.insertId, 'artist');
    const [rows] = await conn.query('SELECT artist_id, name, email, phone, genre_id, bio, location_id, profile_image_url, created_at FROM Artists WHERE artist_id = ?', [result.insertId]);
    return res.json({ token, user: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
}

async function signupClub(req, res) {
  const { name, email, password, location, location_id, description, capacity } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
  const conn = await pool.getConnection();
  try {
    const [exists] = await conn.query('SELECT club_id FROM Clubs WHERE email = ?', [email]);
    if (exists.length) return res.status(400).json({ error: 'Email already registered as club' });

    let lid = location_id;
    if (!lid && location && (location.city || location.region)) {
      lid = await findOrCreateLocation(location.city || '', location.region || '');
    }

    const pwd = await bcrypt.hash(password, SALT_ROUNDS);
    const [result] = await conn.query('INSERT INTO Clubs (name, email, password_hash, location_id, description, capacity) VALUES (?, ?, ?, ?, ?, ?)', [name, email, pwd, lid || null, description || null, capacity || null]);

    const token = signToken(result.insertId, 'club');
    const [rows] = await conn.query('SELECT club_id, name, email, location_id, description, capacity, profile_image_url, created_at FROM Clubs WHERE club_id = ?', [result.insertId]);
    return res.json({ token, user: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
}

async function login(req, res) {
  const { email, password, role } = req.body;
  if (!email || !password || !role) return res.status(400).json({ error: 'email, password, role required' });

  const conn = await pool.getConnection();
  try {
    if (role === 'artist') {
      const [rows] = await conn.query('SELECT artist_id, password_hash, name, email, phone, genre_id, bio, profile_image_url FROM Artists WHERE email = ?', [email]);
      if (!rows.length) return res.status(400).json({ error: 'Invalid credentials' });
      const user = rows[0];
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
      const token = signToken(user.artist_id, 'artist');
      delete user.password_hash;
      return res.json({ token, user });
    } else if (role === 'club') {
      const [rows] = await conn.query('SELECT club_id, password_hash, name, email, description, profile_image_url FROM Clubs WHERE email = ?', [email]);
      if (!rows.length) return res.status(400).json({ error: 'Invalid credentials' });
      const user = rows[0];
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
      const token = signToken(user.club_id, 'club');
      delete user.password_hash;
      return res.json({ token, user });
    } else {
      return res.status(400).json({ error: 'role must be artist or club' });
    }
  } finally {
    conn.release();
  }
}

// ---------------- Email OTP (send + verify) ----------------
let otpTableEnsured = false;
function validEmail(email) {
  return typeof email === 'string' && email.length <= 255 && /.+@.+\..+/.test(email);
}

async function ensureOtpTable() {
  if (otpTableEnsured) return;
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS EmailOtps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        otp VARCHAR(10) NOT NULL,
        purpose VARCHAR(32) DEFAULT 'login',
        expires_at DATETIME NOT NULL,
        consumed TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email_created (email, created_at),
        INDEX idx_email_expires (email, expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    otpTableEnsured = true;
  } finally {
    conn.release();
  }
}

function generateOtp(length = 6) {
  const n = Math.pow(10, length - 1);
  return String(Math.floor(n + Math.random() * (9 * n))).padStart(length, '0');
}

async function sendEmail(email, subject, text) {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true';

  if (!host || !user || !pass) {
    console.warn('SMTP not configured, skipping real email send.');
    console.log(`[DEV ONLY] Email to ${email}: ${subject} -> ${text}`);
    return { accepted: [], rejected: [], dev: true };
  }

  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  return transporter.sendMail({ from: process.env.SMTP_FROM || user, to: email, subject, text });
}

// POST /api/auth/otp/send
async function sendEmailOtp(req, res) {
  try {
    const { email, purpose } = req.body || {};
    if (!validEmail(email)) return res.status(400).json({ error: 'Valid email required' });

    await ensureOtpTable();

    const conn = await pool.getConnection();
    try {
      // throttle: configurable cooldown per email + purpose
      const [last] = await conn.query(
        'SELECT created_at FROM EmailOtps WHERE email = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1',
        [email, purpose || 'login']
      );
      if (last.length) {
        const lastCreated = new Date(last[0].created_at).getTime();
        const now = Date.now();
        const delta = Math.floor((now - lastCreated) / 1000);
        const configured = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS);
        const cooldown = Number.isFinite(configured) && configured >= 0 ? configured : 15;
        if (delta < cooldown) {
          const retry = cooldown - delta;
          res.set('Retry-After', String(retry));
          return res.status(429).json({ error: 'Too many requests', retry_after_seconds: retry });
        }
      }

      const otp = generateOtp(6);
      const ttlSec = Number(process.env.OTP_TTL_SECONDS || 600); // 10 minutes default
      const expiresAt = new Date(Date.now() + ttlSec * 1000);
      await conn.query(
        'INSERT INTO EmailOtps (email, otp, purpose, expires_at) VALUES (?, ?, ?, ?)',
        [email, otp, purpose || 'login', expiresAt]
      );

      const mailSubject = 'Your verification code';
      const mailText = `Your verification code is ${otp}. It expires in ${Math.floor(ttlSec/60)} minutes.`;
      const info = await sendEmail(email, mailSubject, mailText);

      const devOtp = (!process.env.SMTP_HOST || info.dev) && process.env.EXPOSE_DEV_OTP !== 'false';

      return res.json({ ok: true, sent: !info.dev, expires_in: ttlSec, ...(devOtp ? { dev_otp: otp } : {}) });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('sendEmailOtp error:', err);
    return res.status(500).json({ error: 'Failed to send OTP' });
  }
}

// POST /api/auth/otp/verify
async function verifyEmailOtp(req, res) {
  try {
    const { email, otp, purpose } = req.body || {};
    if (!validEmail(email) || !otp) return res.status(400).json({ error: 'email and otp required' });

    await ensureOtpTable();

    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query(
        `SELECT * FROM EmailOtps 
         WHERE email = ? AND otp = ? AND consumed = 0 AND expires_at > NOW() AND purpose = COALESCE(?, purpose)
         ORDER BY created_at DESC LIMIT 1`,
        [email, otp, purpose || null]
      );

      if (!rows.length) {
        return res.status(400).json({ ok: false, verified: false, error: 'Invalid or expired OTP' });
      }

      const id = rows[0].id;
      await conn.query('UPDATE EmailOtps SET consumed = 1 WHERE id = ?', [id]);

      return res.json({ ok: true, verified: true, email });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('verifyEmailOtp error:', err);
    return res.status(500).json({ error: 'Failed to verify OTP' });
  }
}

// POST /api/auth/password/forgot
async function forgotPassword(req, res) {
  try {
    const { email, role } = req.body || {};
    if (!validEmail(email)) return res.status(400).json({ error: 'Valid email required' });
    if (role !== 'artist' && role !== 'club') return res.status(400).json({ error: 'role must be artist or club' });

    const conn = await pool.getConnection();
    try {
      // Ensure account exists for given role
      const table = role === 'artist' ? 'Artists' : 'Clubs';
      const idCol = role === 'artist' ? 'artist_id' : 'club_id';
      const [rows] = await conn.query(`SELECT ${idCol} FROM ${table} WHERE email = ?`, [email]);
      if (!rows.length) return res.status(404).json({ error: 'Email not found' });
    } finally {
      conn.release();
    }

    await ensureOtpTable();

    // throttle: configurable cooldown per email + purpose
    const conn2 = await pool.getConnection();
    try {
      const [last] = await conn2.query(
        'SELECT created_at FROM EmailOtps WHERE email = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1',
        [email, `password_reset:${role}`]
      );
      if (last.length) {
        const lastCreated = new Date(last[0].created_at).getTime();
        const now = Date.now();
        const delta = Math.floor((now - lastCreated) / 1000);
        const configured = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS);
        const cooldown = Number.isFinite(configured) && configured >= 0 ? configured : 15;
        if (delta < cooldown) {
          const retry = cooldown - delta;
          res.set('Retry-After', String(retry));
          return res.status(429).json({ error: 'Too many requests', retry_after_seconds: retry });
        }
      }

      const otp = generateOtp(6);
      const ttlSec = Number(process.env.OTP_TTL_SECONDS || 600);
      const expiresAt = new Date(Date.now() + ttlSec * 1000);
      await conn2.query('INSERT INTO EmailOtps (email, otp, purpose, expires_at) VALUES (?, ?, ?, ?)', [email, otp, `password_reset:${role}`, expiresAt]);

      const mailSubject = 'Reset your password';
      const mailText = `Your password reset code is ${otp}. It expires in ${Math.floor(ttlSec/60)} minutes.`;
      const info = await sendEmail(email, mailSubject, mailText);
      const devOtp = (!process.env.SMTP_HOST || info.dev) && process.env.EXPOSE_DEV_OTP !== 'false';

      return res.json({ ok: true, sent: !info.dev, expires_in: ttlSec, ...(devOtp ? { dev_otp: otp } : {}) });
    } finally {
      conn2.release();
    }
  } catch (err) {
    console.error('forgotPassword error:', err);
    return res.status(500).json({ error: 'Failed to start password reset' });
  }
}

// POST /api/auth/password/reset
async function resetPassword(req, res) {
  try {
    const { email, otp, role, new_password } = req.body || {};
    if (!validEmail(email) || !otp) return res.status(400).json({ error: 'email and otp required' });
    if (role !== 'artist' && role !== 'club') return res.status(400).json({ error: 'role must be artist or club' });
    if (!new_password || typeof new_password !== 'string' || new_password.length < 8) {
      return res.status(400).json({ error: 'new_password must be at least 8 characters' });
    }

    await ensureOtpTable();

    const conn = await pool.getConnection();
    try {
      // Verify OTP for this specific purpose
      const [rows] = await conn.query(
        `SELECT * FROM EmailOtps 
         WHERE email = ? AND otp = ? AND consumed = 0 AND expires_at > NOW() AND purpose = ?
         ORDER BY created_at DESC LIMIT 1`,
        [email, otp, `password_reset:${role}`]
      );
      if (!rows.length) {
        return res.status(400).json({ ok: false, error: 'Invalid or expired OTP' });
      }

      // Mark consumed
      await conn.query('UPDATE EmailOtps SET consumed = 1 WHERE id = ?', [rows[0].id]);

      // Update password
      const pwdHash = await bcrypt.hash(new_password, SALT_ROUNDS);
      const table = role === 'artist' ? 'Artists' : 'Clubs';
      await conn.query(`UPDATE ${table} SET password_hash = ? WHERE email = ?`, [pwdHash, email]);

      return res.json({ ok: true, reset: true });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('resetPassword error:', err);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
}

module.exports = { signupArtist, signupClub, login, sendEmailOtp, verifyEmailOtp, forgotPassword, resetPassword };
