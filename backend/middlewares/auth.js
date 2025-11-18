// middlewares/auth.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

function auth(required = true) {
  return function (req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      if (required) return res.status(401).json({ error: 'Missing Authorization header' });
      req.user = null;
      return next();
    }
    const parts = authHeader.split(' ');
    if (parts.length !== 2) return res.status(401).json({ error: 'Invalid Authorization header' });
    const token = parts[1];
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { id: payload.sub, role: payload.role };
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

module.exports = auth;
