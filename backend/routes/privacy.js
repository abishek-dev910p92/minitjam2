// routes/privacy.js
const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const ctrl = require('../controllers/privacyController');

router.get('/', auth(true), ctrl.get);
router.patch('/', auth(true), ctrl.update);

module.exports = router;

