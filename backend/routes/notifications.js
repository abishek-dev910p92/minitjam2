// routes/notifications.js
const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const ctrl = require('../controllers/notificationController');

router.get('/', auth, ctrl.list);
router.post('/register-token', auth, ctrl.registerPushToken);
router.post('/:id/dismiss', auth, ctrl.dismiss);

module.exports = router;