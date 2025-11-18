// app.js - HTTP server + Socket.IO realtime server
const express = require('express');
const dotenv = require('dotenv');
const http = require('http');
dotenv.config();

const routes = require('./routes');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
// Initialize Socket.IO realtime server
try {
  const SocketServer = require('./socketServer');
  const socketServer = new SocketServer(server);
  app.set('io', socketServer.getIO());
  console.log('Socket.IO realtime server enabled');
} catch (e) {
  console.warn('Socket.IO initialization failed:', e?.message || e);
}

app.use(express.json());

// Enable CORS with explicit headers
app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Auth-Code'],
}));
// Handle preflight requests
// Preflight handled by cors middleware above for configured routes

// For multipart uploads (media)
const multer = require('multer');
// Ensure uploads directory exists (helps on Windows/OneDrive environments)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const upload = multer({ dest: uploadsDir }); // For production switch to S3

// Basic routes
app.use('/api', routes);

// health endpoint - updated to remove Socket.IO references
app.get('/', (req, res) => res.json({ 
  ok: true, 
  now: new Date(),
  server: 'HTTP + Socket.IO',
  redis: !!process.env.REDIS_URL
}));

// Simple test endpoint to verify backend is working
app.get('/api/test', (req, res) => res.json({
  message: 'Backend is working correctly!',
  timestamp: new Date(),
  status: 'healthy',
  socketIO: 'enabled',
  redis: !!process.env.REDIS_URL
}));

// Socket.IO status endpoint removed - no longer needed
// Use /api/health instead for server status

const port = process.env.PORT || 3000;
// Serve uploaded files from /uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

server.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
  console.log('HTTP + Socket.IO server ready');
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Port ${port} already in use. Choose a different PORT or stop the process using it.`);
    process.exit(1);
  }
  console.error('Server error:', err);
  process.exit(1);
});
