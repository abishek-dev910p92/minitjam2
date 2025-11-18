// Lightweight Socket.IO connectivity test
// Usage:
//   SOCKET_URL=http://localhost:3000 SOCKET_TOKEN=<jwt> node backend/scripts/socket-test.js
// Optional:
//   ROOM_ID=123 SENDER_TYPE=user SENDER_ID=42
// Notes:
//   - Requires dev dependency: socket.io-client (npm i -D socket.io-client)
//   - Prints connection lifecycle and heartbeat health; can send a test group message

const io = require('socket.io-client');

const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:3000';
const SOCKET_TOKEN = process.env.SOCKET_TOKEN || '';
const ROOM_ID = process.env.ROOM_ID ? Number(process.env.ROOM_ID) : null;
const SENDER_TYPE = process.env.SENDER_TYPE || 'user';
const SENDER_ID = process.env.SENDER_ID ? Number(process.env.SENDER_ID) : null;

if (!SOCKET_TOKEN) {
  console.error('Missing SOCKET_TOKEN env var. Provide a valid JWT.');
  process.exit(1);
}

console.log('[test] connecting to', SOCKET_URL);
const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 15000,
  auth: { token: SOCKET_TOKEN },
});

let pings = 0;
let lastPingTs = 0;

socket.on('connect', () => {
  console.log('[test] connected. id=', socket.id);
  if (ROOM_ID) {
    console.log('[test] joining group room', ROOM_ID);
    socket.emit('group:join', { room_id: ROOM_ID });
  }
});

socket.on('group:joined', (payload) => {
  console.log('[test] group joined', payload);
  if (ROOM_ID && SENDER_ID != null) {
    // Send two test messages spaced 1s apart
    let count = 0;
    const iv = setInterval(() => {
      count += 1;
      const ciphertext = `hello-${Date.now()}`;
      console.log('[test] sending group:message', { count, ciphertext });
      socket.emit('group:message', {
        room_id: ROOM_ID,
        sender_type: SENDER_TYPE,
        sender_id: SENDER_ID,
        ciphertext,
      }, (ack) => {
        if (ack?.ok) {
          console.log('[test] group:message ack ok', ack?.message?.room_id, ack?.message?.sent_at);
        } else {
          console.warn('[test] group:message ack error', ack?.error);
        }
      });
      if (count >= 2) clearInterval(iv);
    }, 1000);
  }
});

socket.on('group:message', (msg) => {
  console.log('[test] recv group:message', { room_id: msg.room_id, sent_at: msg.sent_at });
});

socket.on('heartbeat:ping', (payload) => {
  lastPingTs = payload?.ts || Date.now();
  pings += 1;
  socket.emit('heartbeat:pong', { ts: Date.now() });
  if (pings % 3 === 0) {
    console.log('[test] heartbeat healthy. total pings=', pings);
  }
});

socket.on('connect_error', (err) => {
  console.error('[test] connect_error', err?.message || err);
});
socket.on('reconnect', (attempt) => {
  console.log('[test] reconnect', attempt);
});
socket.on('reconnect_error', (err) => {
  console.error('[test] reconnect_error', err?.message || err);
});
socket.on('disconnect', (reason) => {
  console.warn('[test] disconnected', reason);
});

// Exit after ~10s to avoid hanging CI runs
setTimeout(() => {
  console.log('[test] summary: pings=', pings, 'lastPingTs=', lastPingTs);
  try { socket.disconnect(); } catch {}
  process.exit(0);
}, 10000);