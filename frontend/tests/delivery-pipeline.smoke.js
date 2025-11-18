// Delivery pipeline smoke test for DM messages via Socket.IO.
// Usage:
//   TEST_JWT_SENDER=... TEST_JWT_RECEIVER=... TEST_SENDER_TYPE=artist TEST_SENDER_ID=1 \
//   TEST_RECEIVER_TYPE=club TEST_RECEIVER_ID=2 API_BASE=http://localhost:3001 \
//   node frontend/tests/delivery-pipeline.smoke.js

const io = require('socket.io-client');

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const base = process.env.API_BASE || 'http://localhost:3001';
  const senderToken = process.env.TEST_JWT_SENDER || '';
  const receiverToken = process.env.TEST_JWT_RECEIVER || '';
  const sender_type = process.env.TEST_SENDER_TYPE || 'artist';
  const sender_id = Number(process.env.TEST_SENDER_ID || 1);
  const receiver_type = process.env.TEST_RECEIVER_TYPE || 'club';
  const receiver_id = Number(process.env.TEST_RECEIVER_ID || 2);

  console.log('Base:', base);

  const sSender = io(base, { transports: ['websocket'], auth: { token: senderToken }, timeout: 15000 });
  const sReceiver = io(base, { transports: ['websocket'], auth: { token: receiverToken }, timeout: 15000 });

  sSender.on('connect', () => console.log('[sender] connected', sSender.id));
  sReceiver.on('connect', () => console.log('[receiver] connected', sReceiver.id));

  sReceiver.on('message', (m) => {
    console.log('[receiver] message event:', { chat_id: m.chat_id, sender_type: m.sender_type, sender_id: m.sender_id });
  });
  sReceiver.on('notify:new_message', (m) => {
    console.log('[receiver] notify:new_message:', { chat_id: m.chat_id });
  });

  // Join rooms
  sSender.emit('join', { sender_type, sender_id, receiver_type, receiver_id });
  sReceiver.emit('join', { sender_type: receiver_type, sender_id: receiver_id, receiver_type: sender_type, receiver_id: sender_id });

  await delay(1000);
  console.log('[sender] sending cipher payload');
  // Send a dummy base64-like ciphertext message (will be stored and re-broadcast)
  sSender.emit('message', {
    sender_type, sender_id, receiver_type, receiver_id, message: 'U29ja2V0VGVzdA=='
  }, (ack) => {
    console.log('[sender] ack:', ack);
  });

  // Allow events to flow
  await delay(4000);
  sSender.disconnect();
  sReceiver.disconnect();
  console.log('Delivery pipeline smoke test finished.');
  process.exit(0);
}

main();