// routes/index.js
const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth'));
router.use('/artists', require('./artists'));
router.use('/bands', require('./bands'));
router.use('/opportunities', require('./opportunities'));
router.use('/applications', require('./applications'));
router.use('/bookings', require('./bookings'));
router.use('/chats', require('./chats'));
router.use('/media', require('./media'));
router.use('/venues', require('./venues'));
router.use('/music-stores', require('./musicStores'));
router.use('/notifications', require('./notifications'));

module.exports = router;
