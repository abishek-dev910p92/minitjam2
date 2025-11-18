// routes/chats.js
const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const ctrl = require('../controllers/chatController');

// REST endpoints (backward compatible)
router.post('/', auth(true), ctrl.sendMessage);
router.get('/', auth(true), ctrl.getConversation);

// New endpoints for conversation management
router.get('/conversations', auth(true), ctrl.getUserConversations);

module.exports = router;
