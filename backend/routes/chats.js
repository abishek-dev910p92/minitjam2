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

// Read receipt update
router.patch('/:chat_id/read', auth(true), ctrl.updateReadStatus);

// Unread counts for current user
router.get('/unread', auth(true), ctrl.getUnreadCounts);

module.exports = router;
